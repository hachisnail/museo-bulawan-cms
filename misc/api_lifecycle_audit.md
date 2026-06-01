# 🔬 Full API Lifecycle Audit

## Bugs Found & Fixed This Pass

### 🚨 CRITICAL (would crash or corrupt data)

| # | File | Issue | Fix |
|---|---|---|---|
| 1 | [fileController.js](file:///c:/Users/jeffe/Development/prod-dev/museo-bulawan-cms/apps/api/src/controllers/fileController.js#L50) | `require('stream')` in an ESM module — **runtime crash** | Changed to `import { Readable } from 'stream'` |
| 2 | [notificationController.js](file:///c:/Users/jeffe/Development/prod-dev/museo-bulawan-cms/apps/api/src/controllers/notificationController.js#L42) | `markAsRead` used `TARGET_CONDITION` (needs 3 params: userId, userId, role) but passed `[userId, notificationId]` — **SQL parameter mismatch**, would mark ALL notifications as read or throw | Replaced with direct `INSERT IGNORE INTO ... VALUES (?, ?)` |
| 3 | `fileController.js` resourceMap | Missing `intakes` and `form_submissions` collections — file proxy would reject valid file requests from these collections with "Invalid collection" | Added both to the map |

### ⚠️ AUTH GAPS (buildAbility without requireAuth)

Four route files used `buildAbility` without `requireAuth` upstream. `buildAbility` assigns `guest` abilities when `req.user` is null instead of rejecting — this is a security anti-pattern.

| Route File | Risk | Fix |
|---|---|---|
| [sseRoutes.js](file:///c:/Users/jeffe/Development/prod-dev/museo-bulawan-cms/apps/api/src/routes/sseRoutes.js) | Had a manual check but inconsistent pattern | Added `requireAuth`, removed redundant manual check |
| [fileRoutes.js](file:///c:/Users/jeffe/Development/prod-dev/museo-bulawan-cms/apps/api/src/routes/fileRoutes.js) | Guest could reach the CASL check layer | Added `requireAuth` before `buildAbility` |
| [uploadRoutes.js](file:///c:/Users/jeffe/Development/prod-dev/museo-bulawan-cms/apps/api/src/routes/uploadRoutes.js) | Artifact upload unprotected at auth level | Added `requireAuth` before `buildAbility` |
| userRoutes.js | Already fixed in previous pass | ✅ |

---

## Lifecycle Trace — All Domains

### 1. AUTH (`/api/v1/auth`)

```
POST /login       → passport.authenticate → session + cookie + SSE force_logout to old devices
POST /logout      → clear session + cookie + audit log
GET  /check       → verify session + instance ID match → return {id, username, role, fname, lname, email}
```

| Check | Status |
|---|---|
| Rate limiting on login | ✅ `authLimiter` (5/15min) |
| Deactivated user blocked | ✅ Passport strategy checks `user.status` |
| Invited user blocked | ✅ Passport strategy checks `user.status` |
| Single-device enforcement | ✅ `loginInstanceId` vs `current_session_id` |
| SSE kickout on new login | ✅ Broadcasts `force_logout` to `user_{id}` channel |
| Auth check returns full user | ✅ Fixed to include fname, lname, email |

---

### 2. USERS (`/api/v1/user`)

```
PUBLIC:
  POST /onboard           → First admin creation + PB sync
  POST /setup             → Token-based account activation + PB sync
  POST /forgot-password   → Generate token + send email
  POST /reset-password    → Validate token + update password

SELF (requireAuth):
  GET    /me              → Own profile
  PATCH  /me              → Update own fname, lname
  PATCH  /me/password     → Change password (requires currentPassword)

ADMIN (requireAuth + manage User):
  GET    /                → List all users
  POST   /invite          → Create invited user + send email
  PATCH  /:id             → Update role, name, email
  PATCH  /:id/deactivate  → Set deactivated + SSE force_logout
  POST   /:id/force-logout → Kill session + SSE force_logout
  POST   /:id/resend-invite → Re-generate token + re-send email
```

| Check | Status |
|---|---|
| Joi validation on all inputs | ✅ All controllers validated |
| Password strength enforcement | ✅ 8+ chars, upper, lower, digit |
| `syncUser` passes correct `id` | ✅ Fixed — passes ULID |
| `listUsers` returns full array | ✅ Fixed — no destructuring |
| Self-role change blocked | ✅ `CANNOT_CHANGE_OWN_ROLE` |
| Self-deactivation blocked | ✅ `CANNOT_DEACTIVATE_SELF` |
| Audit logging on all mutations | ✅ All methods call `auditService.log()` |

---

### 3. FORMS (`/api/v1/forms`)

```
PUBLIC:
  GET    /:slug                → Get form definition (schema)
  POST   /:slug/request-otp   → Generate + email 6-digit OTP
  POST   /:slug/verify-otp    → Pre-submission OTP verification
  POST   /:slug/submit        → Submit form + files (validates OTP + Ajv schema)

STAFF (requireAuth + read Intake):
  GET    /:slug/submissions    → List submissions for a form
```

| Check | Status |
|---|---|
| Rate limiting on OTP/submit | ✅ `strictActionLimiter` (3/hr) |
| File upload limits | ✅ 15MB per file, 5 files max |
| Ajv schema validation | ✅ Compiled from `form_definitions.schema` |
| OTP hash comparison (not plaintext) | ✅ SHA-256 hashed |
| OTP consumed after use | ✅ `otpCache.delete()` |
| Staff-only submission listing | ✅ `requireAuth + buildAbility + checkPermission` |

---

### 4. ACQUISITIONS (`/api/v1/acquisitions`)

```
All routes: requireAuth + buildAbility

INTAKE STAGE (manage Intake):
  GET  /intakes                    → List all intakes
  POST /external/:submissionId     → Process form submission → intake
  POST /internal                   → Create manual intake (purchase/existing)
  POST /:intakeId/reject           → Reject intake with reason
  POST /:intakeId/moa              → Generate Memorandum of Agreement
  POST /:intakeId/delivery         → Confirm physical delivery via QR token

ACCESSION STAGE (manage Accession):
  GET   /accessions                → List all accessions
  POST  /:intakeId/accession       → Process intake → accession
  PATCH /accession/:accessionId/research → Update research fields

INVENTORY STAGE (manage Inventory):
  GET  /inventory                  → List inventory (with expand)
  POST /accession/:accessionId/finalize → Finalize accession → inventory
```

| Check | Status |
|---|---|
| Joi validation via `validateBody` middleware | ✅ All POST/PATCH routes |
| Versioned record updates (`version` field) | ✅ `_updateRecord` increments |
| Audit trail on every mutation | ✅ `auditService.log()` with before/after |
| Mutex for race conditions | ✅ `globalMutex.runExclusive` on state transitions |
| Donor auto-provisioning | ✅ `_provisionDonorAccount()` creates PB `app_users` shadow user |
| QR token delivery flow | ✅ Token generated in MOA stage, validated in delivery stage |

---

### 5. UPLOADS (`/api/v1/upload`)

```
PUBLIC:
  POST /donation   → Guest file upload → queued processing

STAFF (requireAuth + create Artifact):
  POST /artifact   → Staff file upload → queued processing
```

| Check | Status |
|---|---|
| File size limit | ✅ 50MB hard limit |
| Background queue (dev: memory / prod: Redis BRPOP) | ✅ |
| SSE progress reporting to uploader | ✅ queued → processing → completed/error |
| Temp file cleanup | ✅ `fs.unlinkSync` in finally block |
| `requireAuth` on artifact upload | ✅ Fixed this pass |

---

### 6. FILES (`/api/v1/file`)

```
STAFF (requireAuth + buildAbility):
  GET /:collection/:recordId/:filename → RBAC-gated file proxy from PB/S3
```

| Check | Status |
|---|---|
| CASL permission check per collection | ✅ `resourceMap` → `req.ability.can('read', resource)` |
| ESM `import { Readable }` | ✅ Fixed this pass |
| Collection whitelist covers all collections | ✅ Fixed — added intakes, form_submissions |
| Streaming (no RAM buffering) | ✅ `Readable.fromWeb().pipe(res)` |
| Auth token forwarded to PB | ✅ `pbService.pb.authStore.token` |

---

### 7. NOTIFICATIONS (`/api/v1/notifications`)

```
ALL ROUTES: requireAuth

GET    /              → Fetch user's notifications (user + role + global)
PATCH  /read-all      → Mark all as read
PATCH  /:id/read      → Mark single as read
```

| Check | Status |
|---|---|
| Multi-target query (user + role + global) | ✅ `TARGET_CONDITION` SQL |
| Read receipts (per-user) | ✅ `user_notification_reads` junction table |
| `INSERT IGNORE` for idempotency | ✅ |
| `markAsRead` correct parameter binding | ✅ Fixed — was using wrong SQL template |
| Service: `sendGlobal`, `sendToRole`, `sendToUser` | ✅ All save to DB + SSE broadcast |

---

### 8. AUDIT LOGS (`/api/v1/audit-logs`)

```
ADMIN (requireAuth + manage AuditLog):
  GET / → Fetch all audit logs from PocketBase
```

| Check | Status |
|---|---|
| Admin-only access | ✅ `checkPermission('manage', 'AuditLog')` |
| Logs written from service layer | ✅ `auditService.log()` used across all services |
| Sorted by creation date | ✅ `sort: '-created'` |

---

### 9. SSE (`/api/v1/realtime`)

```
STAFF (requireAuth + buildAbility):
  GET /stream → Long-lived SSE connection with RBAC-filtered channels
```

| Check | Status |
|---|---|
| Channel assignment by CASL abilities | ✅ Dynamic based on `req.ability.can(...)` |
| User-specific private channel | ✅ `user_{id}` for force_logout, upload_status |
| Heartbeat keep-alive | ✅ Every 20s |
| Reconnect retry | ✅ `retry: 5000` header |
| Cleanup on disconnect | ✅ `req.on('close', ...)` |

---

## Summary of All Changes This Pass

| File | Change |
|---|---|
| `fileController.js` | Fixed `require('stream')` → ESM import; added `intakes`/`form_submissions` to resourceMap |
| `notificationController.js` | Fixed `markAsRead` SQL parameter mismatch |
| `uploadRoutes.js` | Added `requireAuth` before `buildAbility` |
| `fileRoutes.js` | Added `requireAuth` before `buildAbility` |
| `sseRoutes.js` | Added `requireAuth` before `buildAbility`; removed redundant manual check |

All previous-pass fixes (userService, userController, userRoutes, errorHandler, authController, authContext, passport) remain in place and consistent.

> [!TIP]
> The entire API codebase now follows a consistent auth pattern: **`requireAuth → buildAbility → checkPermission`** on every protected route. No route file uses `buildAbility` alone.
