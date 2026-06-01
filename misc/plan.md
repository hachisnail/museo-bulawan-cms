# Review of `payload_cms_astro_integration.md`

> **⚠️ STALENESS WARNING (2026-05-05):** This document is a **historical review**. The canonical references are now:
> - **Architecture & decisions:** `payload_cms_astro_integration.md` (v3)
> - **Actionable TODOs:** `to_do.md`
>
> Line numbers referenced below (e.g., `Articles.ts:258-266`) point to an **older version** of the file and may not match current source. Use section descriptions rather than line numbers to locate content.

**Reviewer note:** This document is the *plan / review* of the existing Payload CMS integration notes.
Items are roughly ordered from "most important" to "nice-to-have."

---

## Status of recommendations (updated 2026-05-05)

**Applied directly:**
- ✅ Rewrote `payload_cms_astro_integration.md` (v3): fixed SSR vs SSG, removed PocketBase refs, added XSS mitigation section, updated risk register.
- ✅ Created `apps/cms/.env.example` as a committed template for `PAYLOAD_SECRET`, `DATABASE_URI`, S3/MinIO, and SMTP.
- ✅ `Users.ts` already has a `name` field (Display Name) — §10.C option 1 is effectively done.
- ✅ `Media.ts` already has `alt: required` and `imageSizes` (thumbnail/card/hero) — §10.J is partially done.
- ✅ Fixed XSS in `[slug].astro` Lexical renderer — `escapeHtml()` now applied to text nodes.
- ✅ Removed PocketBase from `package.json` dev scripts and `stack.txt`.

**Deferred (not auto-applied — code-touching changes):**
The following recommendations require modifying existing source files (`payload.config.ts`, `Articles.ts`, `[slug].astro`, `articles.astro`). They are documented with ready-to-paste snippets in §5.B of the rewritten integration doc, but were not edited here so you can apply them deliberately:
- ⏸️ Wire Payload uploads to MinIO via `@payloadcms/storage-s3` — snippet in integration doc §5.B.
- ⏸️ Replace hardcoded `http://127.0.0.1:3001` URLs in `articles.astro` / `[slug].astro` once MinIO is wired.
- ⏸️ Add 301 redirect for `/articles/<id>` → `/articles/<slug>` once a slug exists (or force slug required).
- ⏸️ Extract `renderLexicalNode` into a shared module so `panel-visitor` can reuse it.
- ⏸️ Production CORS list update in `payload.config.ts`.
- ⏸️ Auth strategy decision (Payload vs Express) — needs human decision before code.

**Out of scope here:**
- Database swap SQLite → Postgres (when scale demands it).
- Backup automation.
- Build pipeline / CI changes.

The original review below is preserved for reference.

---

## Update: PocketBase removed — MariaDB only

> **User confirmed: PocketBase is no longer part of the stack. The only database used by the application is MariaDB (with Payload still keeping its own separate DB — see §10.B below).**

Implications for what was previously written:

- The "three independent user stores" problem in §6.B collapses to **two**: Express/MariaDB users and Payload users. That is much easier to reason about.
- All references to `apps/service-collections/` and PocketBase migrations in `stack.txt` should be considered **deprecated**. Treat that folder as scheduled for removal.
- `dev:pb` script in the root `package.json` (`apps\\service-collections\\pocketbase.exe serve`) should be removed from the `dev` aggregate script so a fresh clone doesn't fail when the binary is gone.
- Anything that previously hit a PocketBase endpoint (appointments, intake forms) needs to be re-pointed to the Express API + MariaDB. That migration is owned by the API team, not by Payload, but it changes the answer to "where does artifact data live?" — it now lives **only** in MariaDB.
- The "auth fragmentation" risk in §7 row 4 drops from Medium to **Low/Medium** since only Payload sits outside the unified Express/MariaDB world.

---

## 10. Additional Article Builder recommendations (Payload-specific)

These are focused on the **Article Builder** — the Payload Articles collection in `apps/cms/src/collections/Articles.ts` and the Astro renderer in `apps/landing/src/pages/articles/[slug].astro`. They are ordered from "highest payoff" to "polish."

### A. Switch Payload's DB adapter from SQLite to MariaDB-compatible Postgres — or keep SQLite explicitly

Now that PocketBase is gone, you only have **two** databases left in the system:
1. MariaDB — Express API + everything else.
2. SQLite — Payload only.

**Reality check:** Payload v3 does NOT have an official MySQL/MariaDB adapter. The official adapters are `@payloadcms/db-sqlite`, `@payloadcms/db-postgres`, and `@payloadcms/db-mongodb`. So you cannot literally put Payload "into" your MariaDB server.

You have three sensible paths — pick one and document the choice:
1. **Keep SQLite for Payload.** Acceptable if Payload only stores articles + media metadata and write volume is low. Document that the Articles DB is intentionally separate and back it up nightly. Lowest effort.
2. **Add Postgres alongside MariaDB.** Use `@payloadcms/db-postgres` for Payload only. Now you have MariaDB (app data) + Postgres (CMS data) + MinIO (media). Best for scale but adds an operational service.
3. **Move Articles into MariaDB and drop Payload as a database.** Use Payload only as a *headless authoring UI* and expose articles via the Express API talking to MariaDB. This is the cleanest "single source of truth" model, but it means writing custom Payload `Database Adapter` glue or storing Payload's data via hooks — both non-trivial. Not recommended unless unification is a hard requirement.

**My recommendation: option 1 for now, option 2 when Articles outgrow SQLite.**

### B. Article ↔ Artifact link should be a real lookup, not a free-text catalog number

`Articles.ts:28-34` defines `catalogNumber` on the `ArtifactHighlight` block as a free-text input. With PocketBase gone, artifacts now live unambiguously in MariaDB. Replace the free-text field with a **server-validated lookup** so editors can't typo a catalog number that doesn't exist:

- **In Payload:** keep the `catalogNumber` text field, but add a `validate` function that calls the Express API (`GET /api/artifacts/:catalog`) at save-time. If the API returns 404, Payload rejects the save with a friendly error. (Payload field-level `validate` runs on the server with `fetch`.)
- **In Astro renderer:** when the `artifactHighlight` block is rendered, fetch the latest artifact data from the Express API at build time and merge it in. That way the article always shows the current artifact name/photo, even after the museum updates the catalog record.
- **Bonus:** add a `prefilled` text field stamped by the Payload `beforeChange` hook so the article keeps a snapshot copy of the name/description as a fallback if the artifact is later deleted.

### C. Author display name pipeline

`Articles.ts:258-266` makes `author` a relation to the `users` collection — correct per §2.A. But the Astro renderer at `[slug].astro:121` does `article.author?.name`, and the Payload `Users` collection by default only has `email`, not `name`. Result: every article currently displays the fallback "Museum Staff."

Two fixes (pick one, document the choice):
1. **Add `firstName`/`lastName` fields to `Users.ts`** and update the Astro renderer to use `${firstName} ${lastName}`.
2. **Add a separate `Authors` collection** (already imported in `payload.config.ts:12`) with `displayName`, `bio`, `photo`, `socialLinks`, and switch the Articles `author` relation to point at it. This is more flexible (one human can have multiple bylines, e.g., "Dr. Reyes" vs "The Curatorial Team") but reintroduces the §2.A FK-empty-collection bug — so seed the collection with at least one record before switching.

### D. Slug uniqueness and collision handling

`Articles.ts:344-352` declares `slug` as `unique: true`, but the auto-generation in the `beforeChange` hook (lines 226-232) does not check for collisions. If two articles share the same title (common: "Annual Report"), the second save will throw a SQLite `UNIQUE constraint failed` error and the editor gets a confusing UI error.

Fix: in the `beforeChange` hook, after generating the slug, query existing articles for that slug and append `-2`, `-3`, etc., until unique:
```ts
let candidate = baseSlug
let n = 1
while (await req.payload.find({ collection: 'articles', where: { slug: { equals: candidate } }, limit: 1 }).then(r => r.totalDocs > 0)) {
  n += 1
  candidate = `${baseSlug}-${n}`
}
data.slug = candidate
```

### E. SEO defaults and Open Graph

The `seo` group in `Articles.ts:391-418` is great that it exists but currently has no defaults. Editors will forget to fill it in. Add a `beforeRead` (or `afterRead`) hook that populates `seo.metaTitle` from `title` and `seo.metaDescription` from `excerpt` when the editor leaves them blank. Consumers (Astro `<head>`) then never have to do null-coalescing.

Also: the `ogImage` field falls back to nothing if not set. The Astro renderer should fall back to `coverImage` for `og:image`. Add this to the renderer, not the schema.

### F. Tags should be a relationship, not free-text array

`Articles.ts:364-377` models tags as an array of `{ tag: string }`. That works but:
- Editors will inevitably type "WWII", "WW2", "World War 2" for the same concept.
- You can't list "all articles tagged X" without scanning every article.

Replace with a separate `Tags` collection and a many-to-many relation. This is a 10-minute schema change but it pays for itself the first time someone wants a "/articles/tag/:slug" page on the Astro site.

### G. Reading time / word count

Editors love seeing "5 min read." Add a virtual field computed in `afterRead` from the Lexical AST: walk the tree, count words in text nodes, divide by 200. Cheap to compute, big UX win on listing pages.

### H. Article scheduling (publish-at-date)

`publishedAt` already exists. Currently it's a freeform date, not enforced. Two enhancements:
1. In the access-`read` function (`Articles.ts:211-218`), also require `publishedAt <= now()` so articles dated in the future are hidden until their time.
2. Either run a cron in the Express API that pings Payload to invalidate caches at scheduled times, OR (simpler) have Astro rebuild on a schedule.

### I. Versions / audit trail UI

`versions.maxPerDoc: 25` is set, but Payload's admin UI doesn't surface version diffs prominently. Consider:
- Adding an admin description on the Articles collection ("All edits are saved; restore from the Versions tab on the right") so editors discover the feature.
- For sensitive content (e.g., obituaries, exhibit descriptions), increase `maxPerDoc` to 100.

### J. Image handling: alt text, focal point, responsive sizes

`Media.ts` should:
- Make `alt` **required** (a11y + SEO).
- Define `imageSizes` so Payload pre-generates `thumbnail`, `card`, `hero` sizes (the article API already returns a `sizes` object — confirm sizes are defined; if not, add them).
- Use the `focalPoint` UI so curators can crop images sensibly.

In Astro, render `<picture>` with `srcset` from `coverImage.sizes.*.url` instead of the bare `coverImage.url` — this fixes the "huge hero image on mobile" problem.

### K. Excerpt auto-generation

`excerpt` (line 354) is optional. When empty, derive it from the first paragraph of `content` in an `afterRead` hook. Same pattern as the SEO defaults.

### L. Content blocks worth adding

The current blocks (`columns`, `artifactHighlight`, `callToAction`, `imageGallery`) are good. Consider adding:
- **VideoEmbedBlock** — YouTube/Vimeo URL → responsive iframe. Editors will ask for this within a month.
- **TimelineBlock** — array of `{ year, title, description, image }` — perfect for museum history articles.
- **PullQuoteBlock** — for highlighting curator quotes mid-article (different from the inline `quote` Lexical feature).
- **CitationBlock** / Footnotes — academic articles will need this. Store `{ id, text, sourceUrl }` and let inline text reference `^[1]` markers.

Each block is ~30-50 lines in `Articles.ts`. Add only when there's editor demand.

### M. Rate limiting & abuse

Payload's `/api/articles` endpoint is currently unauthenticated for published reads (correct). But the same endpoint also accepts `where[...]` filters, which can be expensive. Either:
- Put Payload behind nginx/Caddy with a rate limit (10 req/sec/IP).
- Or use Payload's built-in rate-limit config:
  ```ts
  rateLimit: {
    max: 100, // requests per window
    window: 60 * 1000, // 1 minute
  }
  ```
  in `payload.config.ts`.

### N. Renderer hardening

The current `renderLexicalNode` in `[slug].astro:31-85` builds an HTML string and uses `set:html`. Two safety improvements:
1. **Sanitize text nodes.** Pass them through `escapeHtml()` before inserting. Right now a `<script>` tag typed into the editor would render. (Lexical's editor doesn't allow it through the UI, but the API does.)
2. **Render via Astro components, not strings.** Replace the string-builder with a recursive `<LexicalNode node={node} />` Astro component. This gets you scoped styles, easier theming, and removes the XSS surface entirely. Slightly more code, much better long-term.

### O. Build-time data freshness

Astro SSG rebuilds only when CI fires. If a curator publishes an article at 3pm, it doesn't appear until the next deploy. Options:
1. **Webhook-on-publish:** add an `afterChange` hook on Articles that POSTs to a CI rebuild URL when `_status` changes to `published`.
2. **Switch landing to Astro SSR** with a 60-second cache. Simpler, but you give up the "static files in a CDN" model.
3. **Astro hybrid** (`output: 'hybrid'`) — keep most pages static, mark `articles/[slug].astro` as `export const prerender = false` for SSR-on-demand.

### P. Concrete TODO checklist for §10

- [ ] §10.A: pick a DB strategy for Payload (SQLite stay vs Postgres) and write the decision into `payload_cms_astro_integration.md`.
- [ ] §10.B: add `validate` on `catalogNumber` in `ArtifactHighlightBlock` calling the Express API.
- [ ] §10.C: add `firstName`/`lastName` to `Users.ts` (or commit to using the `Authors` collection).
- [ ] §10.D: add slug-collision suffix logic in the Articles `beforeChange` hook.
- [ ] §10.E: add SEO defaults via `afterRead` hook.
- [ ] §10.F: convert tags to a relationship to a `Tags` collection.
- [ ] §10.G: add reading-time virtual field.
- [ ] §10.H: enforce `publishedAt <= now()` in the `read` access function.
- [ ] §10.J: require `alt` on Media; verify `imageSizes` are defined; switch Astro to `<picture srcset>`.
- [ ] §10.K: auto-derive `excerpt` from first paragraph when blank.
- [ ] §10.M: enable Payload's `rateLimit` config.
- [ ] §10.N: sanitize text nodes in the Lexical renderer (or rewrite as components).
- [ ] §10.O: pick a freshness strategy (webhook rebuild vs SSR).

### Q. Things explicitly NOT recommended

So you don't waste time on these:
- **Don't** try to make Payload talk to MariaDB directly. No official adapter; community adapters are unmaintained.
- **Don't** put article content into MariaDB just because everything else is there. The Lexical AST is a JSON blob — MariaDB's JSON support is fine but you lose Payload's whole admin UI, hooks, versioning, draft-publish flow, autosave, and access control. The "single DB" benefit is not worth losing all of that.
- **Don't** roll your own rich-text editor. Lexical is already there, the quirks are documented (§2.B), and replacing it is a multi-week project for zero user-visible benefit.
- **Don't** unify Payload auth with Express auth before launch. Sequence: ship the article builder → confirm editors actually use it → then federate auth if it's actually painful. Premature unification is a known trap.

---

## 11. Multi-stack compatibility check for §10 recommendations

> **Bottom line: every recommendation in §10 keeps Payload working as a standalone HTTP service, and none of them require the Express API, Astro landing, panel-visitor, panel-admin, MinIO, or MariaDB to change frameworks or share runtime code with Payload.**

### A. Per-item compatibility matrix

| § | Recommendation | Cross-stack impact | Verdict |
|---|---|---|---|
| 10.A | Keep SQLite (or move to Postgres) for Payload | Pure Payload-internal. MariaDB untouched. | ✅ Safe |
| 10.B | Validate `catalogNumber` against Express API | Payload calls Express over HTTP at save-time. **Adds a soft dependency**: if the Express API is down, Payload saves fail. Mitigate with a dev bypass env flag. | ✅ Safe with caveat |
| 10.C | Add `firstName`/`lastName` to Payload Users | Payload-internal schema change. Astro just reads new JSON fields. | ✅ Safe |
| 10.D | Slug collision suffixing | Pure hook logic inside Payload. Astro keeps reading `slug` the same way. | ✅ Safe |
| 10.E | SEO defaults via hook | Payload-internal. Astro keeps reading `seo.metaTitle`. | ✅ Safe |
| 10.F | Tags → relationship collection | Payload-internal change, **but Astro fetch needs `depth=2`** (or to populate tags) — minor renderer tweak, no framework change. | ✅ Safe |
| 10.G | Reading time virtual field | Payload-internal. Astro reads a new field optionally. | ✅ Safe |
| 10.H | Enforce `publishedAt <= now()` | Pure access-control logic. Astro fetch unchanged. | ✅ Safe |
| 10.I | Versions UI hint | Doc-only. | ✅ Safe |
| 10.J | Required `alt`, image sizes, `<picture srcset>` | Payload-internal + an Astro renderer update (still Astro, no new tech). | ✅ Safe |
| 10.K | Auto-excerpt | Payload-internal. | ✅ Safe |
| 10.L | New blocks (Video/Timeline/etc.) | Payload schema + Astro renderer cases. Same pattern as existing blocks. | ✅ Safe |
| 10.M | Payload rate-limit config | Payload-internal. Other apps must handle 429 if they hammer the API — they don't currently. | ✅ Safe |
| 10.N | Renderer hardening | **Astro-only change** (sanitize or use components). Doesn't touch Payload. | ✅ Safe |
| 10.O | Build freshness (webhook / SSR / hybrid) | The **only one with real cross-stack implications**. See §11.B. | ⚠️ Read trade-offs |

### B. The one item that needs more thought: §10.O (build freshness)

The three options have different blast radius:

1. **Webhook-on-publish → CI rebuild.** Requires CI/CD that the rest of the stack doesn't currently use. If you don't have CI yet, this adds a new piece of infra. Other apps unaffected.
2. **Astro SSR for landing.** Changes `apps/landing` from SSG to SSR. Means Payload must be reachable **at runtime**, not just at build. Production deploy now needs Payload to be a long-running HTTP service the public traffic flows through (or sits behind). The other apps (Express, panel-admin, etc.) don't change.
3. **Astro hybrid.** Cleanest middle ground. Most of the site stays static; only `articles/[slug]` goes SSR. Same Payload-must-be-reachable-at-runtime caveat, but only for that one route.

**None of the three forces Express, MariaDB, MinIO, panel-admin, or panel-visitor to change.** They just shift *when* Payload needs to be online.

### C. What stays decoupled regardless

- **Payload remains a self-contained Next.js app on port 3001.** No other app imports Payload code or runs Next.js.
- **MariaDB is still the only DB the Express API touches.**
- **MinIO is still the only blob store** (once §5.B from the integration doc is wired).
- **Communication is still HTTP/JSON only** between every app pair.
- **Astro stays Astro, panel-admin stays React/Vite, Express stays Express.**

### D. Risks specific to the multi-stack setup that §10 DOES introduce

1. **§10.B creates a Payload → Express runtime dependency.** Today Payload is fully autonomous. After this change, Payload save operations require the Express API to be up. Document this and add a graceful fallback (warning, not hard error) so editors aren't blocked when the API is down for maintenance. Suggested env flag: `SKIP_ARTIFACT_VALIDATION=true` for local dev.
2. **§10.O (any option)** changes deployment ordering. Currently Payload only needs to be up at Astro **build** time. If you pick SSR/hybrid, Payload joins the production critical path.
3. **§10.F's Tags collection** adds another small consumer concern: the Astro renderer must request `depth=2` (or higher) to inline tag titles, otherwise it gets bare IDs. Minor but real.

### E. What would have broken cross-stack compatibility (and was deliberately NOT recommended)

These are listed in §10.Q for exactly this reason:
- Forcing Payload onto MariaDB.
- Moving article content into MariaDB tables.
- Rolling a custom rich-text editor.
- Federated auth before launch.

Each would entangle Payload with the rest of the stack in ways that are hard to undo.

### F. Final compatibility verdict

The §10 recommendations are intentionally scoped so Payload stays a **black-box HTTP service** to the rest of the monorepo:
- The Express API doesn't have to know Payload exists (except for the small reverse callback in §10.B).
- The frontends (Astro landing, panel-visitor, panel-admin) just keep doing `fetch('http://.../api/articles')`.
- Adding all of §10 does **not** change the answer to "does this work with my multi-stack setup?" — it remains **yes**.

The two things to watch are the soft dependency from §10.B and the deployment shift from §10.O. Both are documented above and can be mitigated.

---

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
