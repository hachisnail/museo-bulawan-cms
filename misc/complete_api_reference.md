# Museo Bulawan: Complete API Reference

This document provides a comprehensive map of all available API routes in the Museo Bulawan CMS, specifically focusing on the archival pipeline and its supporting services.

---

## 1. Acquisition Lifecycle (Intake → Accession → Inventory)
**Base Path:** `/api/v1/acquisitions`

### Intakes (The Pipeline)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/intakes` | List all intakes (Offers/Submissions). |
| `GET` | `/intakes/:id` | Get details for a specific intake. |
| `POST` | `/intakes/internal` | Create a new intake manually (internal staff). |
| `POST` | `/intakes/:id/approve` | Accept an intake (moves to `accepted` status). |
| `POST` | `/intakes/:id/reject` | Reject a submission. |
| `POST` | `/intakes/:id/reopen` | Revert a rejection or finalized status. |
| `POST` | `/intakes/:id/confirm-delivery` | Confirm physical item arrival at the museum. |
| `POST` | `/intakes/:id/generate-moa` | Generate the Legal MOA PDF. |
| `GET` | `/intakes/:id/export-moa` | Download the generated MOA PDF. |

### Accessions (The Registry)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/accessions` | List all records in the curatorial registry. |
| `POST` | `/accessions/from-intake/:id` | **Formal Accessioning**: Link an intake to the registry. |
| `POST` | `/accessions/:id/upload-moa` | Attach a signed MOA to the record. |
| `POST` | `/accessions/:id/approve` | Final curatorial approval of the record. |
| `PATCH` | `/accessions/:id/research` | Update research data (dimensions, significance, etc). |
| `GET` | `/accessions/:id/report` | Preview the Curatorial Report (PDF). |
| `GET` | `/accessions/:id/export` | Export the formal Curatorial Record (DOCX). |

### Inventory (Permanent Collection)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/inventory` | List all items in the permanent gallery. |
| `POST` | `/inventory/from-accession/:id` | **Finalize**: Move accessioned item to Inventory. |
| `POST` | `/inventory/:id/transfer` | Log a physical location transfer. |
| `POST` | `/inventory/batch-transfer` | Move multiple items at once. |
| `PATCH` | `/inventory/:id/status` | Manual status override (e.g., set to `at_risk`). |
| `POST` | `/inventory/:id/deaccession` | Formal removal of an item from the collection. |

---

## 2. Dynamic Forms & Submissions
**Base Path:** `/api/v1/forms`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/:slug` | Get form definition (fields, rules, UI schema). |
| `POST` | `/:slug/request-otp` | Start OTP flow for public submissions. |
| `POST` | `/:slug/verify-otp` | Verify OTP to allow submission. |
| `POST` | `/:slug/submit` | Submit form data + attachments (multipart). |
| `GET` | `/admin/submissions` | List all submissions across all form types. |
| `GET` | `/admin/submissions/:id` | View detailed submission data and file links. |

---

## 3. Media & Attachments
**Base Path:** `/api/v1/media`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/upload` | Upload media (requires `entity_type` and `entity_id` in body). |
| `GET` | `/:entityType/:entityId` | List all files attached to a specific record. |
| `DELETE`| `/:mediaId` | Remove an attachment. |

**Async Upload Queue:** `/api/v1/uploads`
- `POST /artifact`: Queue an artifact-related file for background processing.
- `POST /donation`: Queue a public donation submission for processing.

---

## 4. Compliance & Museum Standards
**Base Path:** `/api/v1/acquisitions` (Shared with Lifecycle)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/inventory/:id/movement` | View full location audit trail. |
| `GET` | `/inventory/:id/conservation` | View historical conservation logs. |
| `POST` | `/inventory/:id/conservation` | Create a new restoration/cleaning log. |
| `GET` | `/:type/:id/condition-reports` | View condition evaluations (Health). |
| `POST` | `/:type/:id/condition-reports` | Add a new condition report. |
| `GET` | `/inventory/:id/valuations` | View financial appraisal history. |
| `POST` | `/inventory/:id/valuations` | Add a new valuation/insurance record. |

---

## 5. Authority Control & Management
**Base Path:** `/api/v1`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/acquisitions/constituents` | List donors, makers, and legal entities. |
| `POST` | `/acquisitions/constituents` | Create a new constituent record. |
| `GET` | `/acquisitions/exhibitions` | List museum exhibitions. |
| `POST` | `/acquisitions/exhibitions/:id/artifacts` | Link an inventory item to an exhibition. |
| `GET` | `/sse/events` | **Critical**: Subscribe to real-time update stream. |

---

## 6. Authentication
**Base Path:** `/api/v1/auth`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/login` | Standard JWT/Cookie login. |
| `POST` | `/logout` | Clear session. |
| `GET` | `/me` | Get current user profile and permissions. |
| `POST` | `/request-reset` | Password recovery. |
