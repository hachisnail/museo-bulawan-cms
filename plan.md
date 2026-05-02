# Review of `payload_cms_astro_integration.md`

**Reviewer note:** This document is a *plan / review* of the existing Payload CMS integration notes. It does NOT modify `payload_cms_astro_integration.md`. Read this top-to-bottom — items are roughly ordered from "most important" to "nice-to-have."

---

## TL;DR — Will it work with your multi-stack setup?

**Short answer: Yes, it will work.** Payload CMS is being run as a *decoupled microservice* (its own Next.js process on port 3001 with its own SQLite DB). It does **not** force the rest of your stack to be Next.js. Every other app (Express API, Astro landing, Astro panel-visitor, React/Vite panel-admin, PocketBase) talks to it the same way — over HTTP using its REST API. So Payload behaves like just another backend service in your monorepo, alongside MariaDB (Express) and PocketBase.

**Caveats** (details below in §6):
- Payload itself is a Next.js app internally — you cannot avoid Node.js + Next.js running on port 3001.
- The SQLite DB used by Payload is *separate* from MariaDB. Cross-DB joins are not possible — anything that needs to relate Payload data (articles, authors) to MIS data (artifacts, users) must be done at the application layer (API calls), not at the DB layer.
- Auth is **not** unified yet. Payload has its own `users` collection; the Express API has its own users in MariaDB. See §6.B.

---

## 1. What the doc gets right (keep these)

These are well-documented and worth preserving as-is:

- §2.A **Author → Users foreign key fix.** Correctly identifies that the auto-draft on `/admin/.../create` will fail FK if the relationship target collection is empty. Good catch — this is a real Payload v3 quirk.
- §2.B **Lexical infinite recursion when nesting `lexicalEditor()`.** Real and reproducible. Document is right to warn against it.
- §2.C **SQLite + Drizzle migration limitations.** Accurate; Drizzle's SQLite migrator is fragile around index/FK changes.
- §3.A **`where[_status][equals]=published` filter.** Critical to prevent draft leaks. Keep.
- §3.B **Slug fallback to ID.** Pragmatic fix — sensible default for editor-driven content.
- §3.C **Lexical AST → recursive Astro renderer.** Correct approach (Payload returns AST, not HTML).

---

## 2. Gaps & things that should be added to the doc

### A. Missing: Environment variables / secrets

The doc never mentions:
- `PAYLOAD_SECRET` (required, currently defaults to `'CHANGE-ME-IN-PRODUCTION'` in `apps/cms/src/payload.config.ts:45`).
- `DATABASE_URI` for SQLite (line 40).
- No `.env.example` is referenced.

**Add a section:** "Required env vars for `apps/cms`" listing `PAYLOAD_SECRET`, `DATABASE_URI`, and the URL where the API/Landing fetch from.

### B. Missing: How Astro fetches Payload (endpoint URLs)

§3.A says "fetch with `where[_status][equals]=published`" but never shows:
- The base URL (`http://localhost:3001/api/articles`?).
- Whether fetch happens at *build time* (SSG) or *request time* (SSR).
- Auth headers (none? API key? bearer?).

**Add:** an example `fetch` snippet and clarify that the Astro `landing` app is **SSG** — meaning Payload must be running at build time. This has deployment implications (see §4).

### C. Missing: Media / uploads handling

The Payload config (`payload.config.ts:64-68`) sets a 20MB upload limit and there's an `apps/cms/media/` folder, but the doc says nothing about:
- Where uploaded media is served from.
- Whether the Astro frontend hotlinks `http://localhost:3001/media/...` (it must, currently).
- What happens in production (CDN? proxy through nginx? MinIO? — note you already have `apps/minio/`).

**This is important** because hotlinking `localhost:3001` from a static-built Astro site means the production frontend won't work unless Payload is publicly reachable OR media is rewritten to MinIO/CDN.

### D. Missing: CORS list maintenance

`payload.config.ts:56-61` hardcodes localhost CORS. The doc should warn:
- These need to be updated for production domains.
- Adding a new frontend (e.g., `panel-admin` on a new port) requires editing the config.

### E. Missing: Draft preview workflow

If editors save a draft, how do they preview it? The doc only describes the *published* fetch. Drafts are unreachable from the Astro side as written. Either:
- Document that "drafts are preview-only inside the Payload admin" and that's intentional, OR
- Add a draft-preview route on Astro that uses a token.

### F. Missing: Build-order / dev-startup instructions

A new dev cloning the repo doesn't know:
- That Payload (port 3001) **must** be running before `pnpm --filter landing build`.
- Whether there's a root `dev` script that starts everything (the root `package.json` should be checked — if not, add one).

---

## 3. Things in the doc that are slightly misleading

### A. §1 calls Payload a "microservice"
Technically Payload is a full Next.js app, not a slim microservice. It ships an admin React UI, a REST API, a GraphQL API, and a server-side admin auth layer. Calling it a "microservice" is fine as shorthand but readers expecting something Express-sized will be surprised. **Recommend rewording to "decoupled CMS service (Next.js-based)."**

### B. §2.C "delete `apps/cms/data/payload.db`"
This advice is fine *during early dev*, but the doc should explicitly say: **DO NOT DO THIS once real content exists.** Add a warning. Once content is created, switch to proper Payload migrations (`payload migrate:create`, `payload migrate`).

### C. §2.A "Payload automatically saves an empty draft when the create page opens"
This is true for collections with `versions.drafts: true` and `autosave` enabled. If autosave is off, the create page won't auto-save. Worth noting that the FK crash only manifests under autosave-on-create configurations — so the fix (point to `users`) is still correct, but the *root cause* is autosave, not Payload in general.

### D. §3.B "slug || id"
Routing to `/articles/<id>` works, but it creates **two URLs for the same article** the moment a slug exists (because Payload's slug hook runs on the next save and now both `/articles/1` and `/articles/my-title` exist). Recommend: emit a 301 from `/articles/<id>` → `/articles/<slug>` once a slug appears, or just hide articles with null slugs. Mention this trade-off in the doc.

---

## 4. Production-readiness concerns the doc should mention

| Concern | Status | Recommendation |
|---|---|---|
| `PAYLOAD_SECRET` default | Insecure default in config | Document that prod must override it |
| SQLite in prod | Works for low write volume, single-node only | Document the constraint; consider Postgres adapter if scaling |
| Astro SSG + Payload | Build needs Payload up | Document the build pipeline ordering |
| Media URLs | Localhost-hardcoded in dev | Document MinIO/CDN swap or reverse-proxy strategy |
| CORS | Localhost-only | Document prod domain update requirement |
| No CSRF on Payload | Payload has its own session cookies | Confirm Payload's built-in CSRF is enabled for admin |
| Backups | No mention | Document SQLite file backup or migration path |

---

## 5. Specific doc edits I'd suggest

1. **Add a §0 "Quick Start"** section at the top: ports, how to run dev, where the admin panel is (`http://localhost:3001/admin`), default seed user.
2. **Add a §4 "Production Deployment Notes"** covering the table in §4 above.
3. **Add a §5 "Glossary / Reference"** with links to the actual file paths:
   - `apps/cms/src/payload.config.ts` (config)
   - `apps/cms/src/collections/Articles.ts` (the schema discussed in §2)
   - `apps/landing/src/pages/articles/[slug].astro` (the routing fallback in §3.B)
   - `LexicalRenderer.astro` (mentioned in §3.C but never path'd)
4. **Add an appendix listing every Payload v3 quirk encountered**, even minor ones, so future devs don't re-discover them.

---

## 6. Multi-stack compatibility analysis (your specific worry)

Your stack from `stack.txt`:
- Express backend (MariaDB) — `apps/api`
- PocketBase backend-as-a-service — `apps/service-collections`
- Payload CMS (SQLite, Next.js) — `apps/cms`
- Astro SSG landing — `apps/landing`
- Astro panel-visitor — `apps/panel-visitor`
- React/Vite panel-admin — `apps/panel-admin`
- Umami JS analytics
- MinIO — `apps/minio`

### A. Will Payload "infect" the rest of the stack with Next.js?

**No.** Payload runs in its own process on its own port. The other apps consume it over HTTP, just like they consume PocketBase or your Express API. None of your other apps need to import Payload, install Next.js, or change their tooling.

The only Next.js code in the repo is inside `apps/cms/`. It's contained.

### B. Auth fragmentation (the real risk)

Right now you have **three independent user stores**:
1. Express API users (MariaDB) — used by `panel-admin`.
2. Payload users (SQLite) — used to log into the Payload admin panel.
3. PocketBase users — used by appointments / collections service.

Plus you have RBAC mentioned in `stack.txt` under "Core Services."

**This is a real architectural problem the doc does not address.** Recommendations to put in `plan.md`:

- **Decision needed:** Is the Payload admin panel only for content editors, while panel-admin (React/Vite) is for everyone else? If yes, fine — separate user stores are acceptable.
- **If you want unified auth:** You'll need to either (a) federate via JWT/OIDC, or (b) write a Payload auth strategy that delegates to the Express API. Both are non-trivial.
- **Simplest path:** Keep them separate; document that "Payload admin users are a small set of content editors and are managed manually."

### C. Data sharing between Payload SQLite and MariaDB

There is no shared database. If the MIS needs to display article counts, tag artifacts to articles, etc., it must hit the Payload REST API. Document this constraint.

### D. Will the Astro panel-visitor also consume Payload?

Currently only `apps/landing` is documented as a consumer. If `panel-visitor` will also render articles, the same fetch/render utilities (`LexicalRenderer.astro`, the published-only filter) should be shared between them. **Suggestion:** extract the renderer into a shared package or duplicate it carefully and add a note to the doc.

### E. Umami analytics
Independent — runs as its own service, just inject the script. No Payload conflict.

### F. MinIO
**Strong recommendation:** wire Payload's `upload` field to use MinIO via an S3-compatible adapter (`@payloadcms/storage-s3`). Right now Payload writes uploads to local disk (`apps/cms/media/`), which:
- Doesn't survive container redeploys.
- Doesn't share with the rest of the stack.
- Hardcodes `localhost:3001` in image URLs.

This is the single biggest infrastructure gap the doc should call out.

---

## 7. Risk register (sorted by severity)

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | `PAYLOAD_SECRET` defaults to a literal string | High | Set in env before any non-dev deploy |
| 2 | Media stored on local disk, hotlinked from Astro builds | High | Move to MinIO via S3 adapter |
| 3 | SQLite `payload.db` deletion advice in §2.C is dangerous post-launch | High | Add explicit warning + migrations workflow |
| 4 | No unified auth across Express/Payload/PocketBase | Medium | Decide: federate vs keep separate; document |
| 5 | Astro SSG requires Payload running at build time | Medium | Document build order; consider ISR or build-time snapshot |
| 6 | Slug-fallback creates duplicate URLs | Low | 301 redirect or hide null-slug articles |
| 7 | CORS list is localhost-only | Low | Add prod domains before deploy |
| 8 | Draft preview not implemented | Low | Document as "preview in admin only" or build a token-based preview route |

---

## 8. Suggested next actions (concrete TODOs)

These are NOT being done in this review — they're suggestions for you to triage.

- [ ] Add a "Quick Start" + "Env Vars" section to `payload_cms_astro_integration.md`.
- [ ] Add a production-deployment section covering MinIO, CORS, secret, and migrations.
- [ ] Decide on auth strategy: unified vs separate user stores. Document the decision.
- [ ] Wire Payload uploads to MinIO via `@payloadcms/storage-s3`.
- [ ] Replace the "delete the SQLite DB" advice with a proper migrations note.
- [ ] Add file-path references (clickable links) for `Articles.ts`, `[slug].astro`, `LexicalRenderer.astro`.
- [ ] Decide if `apps/panel-visitor` will also consume Payload; if so, share the renderer.
- [ ] If you anticipate scale, plan a SQLite → Postgres migration path for `apps/cms`.

---

## 9. Final verdict on the existing doc

The doc is **accurate, useful, and worth keeping**, but it's narrowly scoped to "Lexical/Drizzle/SQLite quirks I hit while building Articles." It reads like a debugging journal more than an integration guide. To be useful to a new developer (or future you in 6 months), it needs the additions in §2 and §5 — particularly env vars, build order, media handling, and production notes.

Nothing in the doc is *wrong*. The gaps are about *missing* context, not bad advice.
