# Payload CMS + Astro Integration Notes

**Target Audience:** Future AI assistants or developers maintaining this monorepo.
**Purpose:** Document the architectural decisions, environment, deployment, Lexical editor quirks, and routing fallbacks implemented for the Article Builder service.

---

## 0. Quick Start

### Ports
| Service | Port | App folder |
|---|---|---|
| panel-admin (React/Vite) | 5173 | `apps/panel-admin` |
| Express API (MIS) | 3000 | `apps/api` |
| **Payload CMS (Next.js)** | **3001** | **`apps/cms`** |
| Astro landing | 4321 | `apps/landing` |
| Astro panel-visitor | 4322 | `apps/panel-visitor` |
| PocketBase | 8090 | `apps/service-collections` |
| MinIO (S3) | 9000 / console 9001 | `apps/minio` |

### Run the whole stack
From the repo root:
```bash
npm run dev
```
This uses `concurrently` (see root `package.json`) to start panel-admin, api, cms, pocketbase, and minio in parallel.

### Run just Payload
```bash
npm run dev -w cms          # or: cd apps/cms && npm run dev
```
Admin panel: <http://localhost:3001/admin>
First-run: open the admin URL and Payload will prompt you to create the initial admin user.

### Required env vars (apps/cms/.env)
A template is committed at `apps/cms/.env.example`. Copy it to `apps/cms/.env` before first run:
```bash
cp apps/cms/.env.example apps/cms/.env
```
Variables:
- `PAYLOAD_SECRET` — REQUIRED. Long random string used to sign tokens. **The default in `payload.config.ts` is `CHANGE-ME-IN-PRODUCTION` — never ship without overriding it.**
- `DATABASE_URI` — defaults to `file:./data/payload.db` (SQLite). Override for Postgres in prod.
- `S3_*` (optional) — set if/when you wire uploads to MinIO (see §5.B).

---

## 1. Decoupled Architecture

- **CMS Service:** Payload CMS 3.0 runs in `apps/cms` (Port 3001) as a self-contained Next.js app with its own SQLite database (`apps/cms/data/payload.db`). It is **not** a slim Express microservice — it ships a React admin UI, REST API, GraphQL API, and server-side auth.
- **Frontend App:** An Astro SSG site runs in `apps/landing` (Port 4321), fetching data from the Payload REST API at build time.
- **Other consumers:** `apps/panel-visitor` (Astro) and `apps/panel-admin` (React/Vite) can also consume Payload over HTTP if needed.

### Multi-stack note
Payload being built on Next.js does **not** force the rest of the stack to use Next.js. Every other app talks to Payload via HTTP, the same way they talk to PocketBase or the Express API. Next.js is fully contained inside `apps/cms/`.

### Data isolation
The Payload SQLite DB is independent of MariaDB (Express API) and PocketBase. **There are no cross-DB joins.** Anything that needs to relate Payload content to MIS records must do so at the application layer (REST calls), not the DB layer.

---

## 2. Payload Schema Decisions & Quirks (`apps/cms/src/collections/Articles.ts`)

### A. Author Relationship (Database Constraint Bug)
- **Issue:** With autosave drafts enabled (`versions.drafts.autosave`), Payload tries to save an empty draft the moment `/admin/collections/articles/create` opens. If the `author` relationship targets an empty collection, SQLite throws `FOREIGN KEY constraint failed` and the React admin crashes (white screen).
- **Fix:** The `author` field MUST point to the `users` collection (which always has at least the logged-in admin). The `beforeChange` hook injects `req.user.id`. Do **not** repoint it to a separate `authors` collection unless that collection is guaranteed to be seeded.
- **Root cause clarification:** This crash only manifests under `autosave-on-create` configurations. With autosave disabled, the create page won't auto-save, but the FK fix is still correct.

### B. Custom Blocks & Infinite Recursion
- **Issue:** Adding custom blocks (like `ColumnsBlock`) to the Lexical editor can crash/hang the browser (15s+ load times) if not configured carefully.
- **Fix:** Do **NOT** use nested explicit `lexicalEditor()` instances inside custom block definitions. When defining `richText` fields for columns inside `ColumnsBlock`, let Payload fall back to the default internal editor. Explicit nested `lexicalEditor({...})` overrides cause an infinite recursive loop in Payload v3's React renderer.

### C. SQLite Migration Limitations
- **Issue:** Drizzle ORM struggles to update relationships or indexes on the fly with SQLite (e.g., `CREATE INDEX` errors when modifying relations).
- **Dev fix:** Stop the server (`Ctrl+C`), delete `apps/cms/data/payload.db`, restart. Payload will rebuild the schema cleanly.
- **⚠️ WARNING — DO NOT DO THIS POST-LAUNCH.** Once real content exists, deleting the DB destroys it. Switch to proper migrations:
  ```bash
  cd apps/cms
  npx payload migrate:create
  npx payload migrate
  ```
- **Long-term:** If you need reliable migrations + concurrent writes, swap the SQLite adapter for `@payloadcms/db-postgres`. SQLite is fine for low-traffic single-node deployments.

---

## 3. Astro Frontend Integration

### A. Fetching Data
Data is fetched exclusively with `where[_status][equals]=published` to ensure drafts do not leak. Example from `apps/landing/src/pages/articles.astro`:
```ts
const response = await fetch(
  'http://127.0.0.1:3001/api/articles?where[_status][equals]=published&depth=1'
);
const { docs: articles } = await response.json();
```

**Runtime requirement:** The article detail page (`[slug].astro`) runs in **SSR** mode — it fetches from Payload on every request. The article listing page (`articles.astro`) fetches at build time. In both cases, Payload **must be running on port 3001**, otherwise the page returns an error.

In production, Payload must be a **long-running service** reachable by the Astro app at runtime (not just at build time).

### B. Null Slug Routing Fallback
- **Context:** If a museum editor saves a draft before typing a title, the slug-generation hook may not fire. When they later publish, the article can have `"slug": null`.
- **Implementation:** `[slug].astro` first queries by slug, then falls back to a numeric ID lookup at runtime (no `getStaticPaths` — this is SSR).
- **Result:** Articles without a slug fall back to `/articles/<id>`.
- **⚠️ Trade-off:** Once a slug is later set, the same article is reachable at both `/articles/<id>` and `/articles/<slug>` (duplicate URLs hurt SEO). Two ways to handle it:
  1. **Redirect.** When rendering on the ID path, detect that a slug now exists and emit a 301 redirect to `/articles/<slug>`.
  2. **Force slug.** Make `slug` required in `Articles.ts` so editors cannot publish without one.

### C. Lexical AST Rendering
Payload returns rich text as a JSON AST, not HTML.
- A recursive function (`renderLexicalNode`) inlined in `apps/landing/src/pages/articles/[slug].astro` walks the tree node-by-node.
- It handles native nodes (`paragraph`, `heading`, `list`, `quote`) and maps Payload's custom blocks (`columns`, `imageGallery`, `artifactHighlight`, `callToAction`) to layouts.
- **⚠️ XSS:** Text nodes are not HTML-escaped before being inserted via `set:html`. An `escapeHtml()` utility must be added (see §3.E).
- **Suggestion:** Extract `renderLexicalNode` into a shared utility (e.g., `apps/landing/src/lib/lexical.ts`) so `apps/panel-visitor` can reuse it without duplication.

### D. Draft Preview
There is currently **no draft preview from Astro**. Drafts are visible only inside the Payload admin (`http://localhost:3001/admin`). If editors need preview-before-publish on the public site, add a token-protected SSR route (e.g., `/articles/preview/[id]?token=...`) that fetches with `draft=true` using a Payload API key.

### E. Renderer XSS Mitigation
The `renderLexicalNode` function builds HTML strings and injects them via Astro's `set:html`. Text nodes must be sanitized to prevent script injection via the Payload API. An `escapeHtml()` helper is applied to all text nodes before any formatting. Long-term, rewrite as a recursive Astro component to remove the string-building surface entirely.

---

## 4. File Path Reference

| Topic | File |
|---|---|
| Payload root config | `apps/cms/src/payload.config.ts` |
| Articles schema (§2) | `apps/cms/src/collections/Articles.ts` |
| Users collection | `apps/cms/src/collections/Users.ts` |
| Media collection | `apps/cms/src/collections/Media.ts` |
| Authors collection | `apps/cms/src/collections/Authors.ts` |
| Categories collection | `apps/cms/src/collections/Categories.ts` |
| Astro article list (§3.A) | `apps/landing/src/pages/articles.astro` |
| Astro article detail + slug fallback (§3.B) | `apps/landing/src/pages/articles/[slug].astro` |
| Auto-generated TS types | `apps/cms/src/payload-types.ts` |
| Local upload folder | `apps/cms/media/` |
| Local SQLite DB | `apps/cms/data/payload.db` |

---

## 5. Production Deployment Notes

### A. Secrets
- **`PAYLOAD_SECRET`** — generate with `openssl rand -hex 32` and set via env. The literal default in `payload.config.ts` (`CHANGE-ME-IN-PRODUCTION`) must never run in prod.
- Do **not** commit `apps/cms/.env`. The `.env.example` template is safe to commit.

### B. Media / Uploads — wire to MinIO
**This is the single biggest infrastructure gap.** Currently Payload writes uploads to local disk (`apps/cms/media/`) and the Astro frontend hotlinks `http://127.0.0.1:3001/<media-url>` (see `[slug].astro` line 112 and `articles.astro` line 42). That breaks the moment Astro is built statically and deployed elsewhere.

**Recommended fix** — use the official S3 storage adapter against your existing MinIO instance:

1. Install in `apps/cms`:
   ```bash
   npm i @payloadcms/storage-s3 -w cms
   ```
2. Add to `apps/cms/src/payload.config.ts`:
   ```ts
   import { s3Storage } from '@payloadcms/storage-s3'

   plugins: [
     s3Storage({
       collections: {
         media: { prefix: 'cms/media' },
       },
       bucket: process.env.S3_BUCKET!,
       config: {
         endpoint: process.env.S3_ENDPOINT,           // e.g. http://localhost:9000
         region: process.env.S3_REGION || 'us-east-1',
         credentials: {
           accessKeyId: process.env.S3_ACCESS_KEY!,
           secretAccessKey: process.env.S3_SECRET_KEY!,
         },
         forcePathStyle: true, // required for MinIO
       },
     }),
   ],
   ```
3. Set in `apps/cms/.env`:
   ```
   S3_ENDPOINT=http://localhost:9000
   S3_BUCKET=museo-cms
   S3_REGION=us-east-1
   S3_ACCESS_KEY=...
   S3_SECRET_KEY=...
   ```
4. Update Astro fetches to use the returned `url` field directly (Payload will return absolute MinIO URLs once the plugin is active), removing the hardcoded `http://127.0.0.1:3001` prefix.

### C. CORS
`payload.config.ts:56-61` lists localhost origins only. Before production deploy, add your real domains:
```ts
cors: [
  'https://museobulawan.example',
  'https://admin.museobulawan.example',
  // ...
],
```

### D. Database
- **Dev:** SQLite is fine.
- **Prod:** consider `@payloadcms/db-postgres` for concurrent writes, real backups, and proper migrations. The schema swap is straightforward; uploads/media live in MinIO so the DB only stores metadata.

### E. Backups
Whatever DB you use, schedule snapshots:
- SQLite: copy `apps/cms/data/payload.db` to S3/MinIO nightly.
- Postgres: `pg_dump` cron.

### F. Build & Runtime pipeline
Astro `landing` has a **mixed** setup: the listing page (`articles.astro`) fetches at build time, while the detail page (`[slug].astro`) fetches at **runtime (SSR)**. This means:
1. Payload must be alive at **build time** for the listing page.
2. Payload must be alive at **runtime** for individual article pages.

In docker-compose / CI:
1. Boot the Payload service.
2. Wait for `http://cms:3001/api/health` (or `/api/articles?limit=0`) to return 200.
3. Run the Astro build.
4. Keep Payload running alongside the Astro server in production.

---

## 6. Multi-Stack Compatibility Analysis

Your overall stack:
- Express API + MariaDB — `apps/api`
- PocketBase — `apps/service-collections`
- Payload CMS + SQLite — `apps/cms`
- Astro landing (SSG) — `apps/landing`
- Astro panel-visitor — `apps/panel-visitor`
- React/Vite panel-admin — `apps/panel-admin`
- Umami JS analytics — external script
- MinIO — `apps/minio`

### A. Will Payload conflict with the rest?
**No.** Each app is a separate process. Payload is just another HTTP service. Adding it does not change the tooling for any other app.

### B. Auth fragmentation
There are **two independent user stores** (PocketBase has been removed from the stack):
1. Express API users (MariaDB) — used by `panel-admin`.
2. Payload users (SQLite) — used to log into the Payload admin.

**Decision required.** Pick one:
- **(Simplest — recommended)** Keep them separate. Treat Payload's user store as "content editors only" — a small, manually-managed set. Document this as policy.
- **(Federated)** Issue JWTs from the Express API and write a Payload custom auth strategy that validates them. Non-trivial.
- **(SSO/OIDC)** Add an external IdP (Keycloak, Authentik) and have both services delegate. Highest effort, cleanest result.

`stack.txt` mentions "implement RBAC perms and roles" under Core Services — that needs to be reconciled with whichever option above you pick.

### C. Cross-service data
There is no shared DB. Anything that needs both (e.g., "show artifact info inside an article") must be done via API calls. The `artifactHighlight` block in `Articles.ts` currently stores a free-text `catalogNumber` — it does not actually look up the artifact in MariaDB. If you want live artifact data, render the block on the Astro side by fetching the Express API for that catalog number.

### D. Astro panel-visitor
If `panel-visitor` will also render articles, **share the renderer** with `landing`. Either:
- Extract a small workspace package `packages/lexical-renderer` and import it from both.
- Or duplicate carefully and add a note here so they don't drift.

### E. Umami analytics
Independent. Just inject the tracking snippet. No conflict.

### F. MinIO
See §5.B. This is the highest-priority cleanup item.

---

## 7. Risk Register

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | `PAYLOAD_SECRET` defaults to a literal string | High | Set in env; never deploy without it |
| 2 | Media on local disk, hotlinked from Astro builds | High | Move to MinIO via `@payloadcms/storage-s3` (§5.B) |
| 3 | "Delete the SQLite DB" advice is dangerous post-launch | High | Use migrations; see §2.C warning |
| 4 | No unified auth across Express/Payload | Medium | Decide per §6.B; document the choice |
| 5 | Astro SSR requires Payload running at runtime | Medium | Payload must be a long-running prod service (§5.F) |
| 6 | Lexical renderer does not escape text nodes (XSS) | Medium | Apply `escapeHtml()` to text nodes (§3.E) |
| 7 | Slug-fallback creates duplicate URLs | Low | Add 301 redirect or force slug required (§3.B) |
| 8 | CORS list is localhost-only | Low | Add prod domains before deploy (§5.C) |
| 9 | Draft preview not implemented | Low | Document as "preview-in-admin only" or build token route |

---

## 8. Open Decisions / TODOs

These are explicit decisions the team still owes:
- [ ] Choose an auth strategy from §6.B and document it here.
- [ ] Wire MinIO per §5.B (open task; recommended snippet provided).
- [ ] Decide null-slug policy: redirect vs force-required (§3.B).
- [ ] Decide on draft-preview UX (§3.D).
- [ ] Decide if `panel-visitor` will also render Payload articles (§6.D).
- [ ] Plan SQLite → Postgres migration timing if scale grows.
- [ ] Decide on `Articles.author` target: keep `users` or switch to `authors` collection (§2.A).

---

## 9. Changelog of this doc

- v3 (current): Corrected SSG→SSR for `[slug].astro`, removed PocketBase references (only 2 user stores now), added §3.E XSS mitigation section, updated risk register, fixed build pipeline section for mixed SSG/SSR reality.
- v2: Added Quick Start, env vars, MinIO/S3 wiring guide, production notes, risk register, multi-stack analysis, file path index. Clarified §2.A root cause, §2.C migration warning, §3.B duplicate-URL trade-off.
- v1: Initial debugging journal of Lexical/Drizzle/SQLite quirks encountered while building the Articles collection.
