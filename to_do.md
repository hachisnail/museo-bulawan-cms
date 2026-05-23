# TODO — Museo Bulawan CMS

> Priority order. Each item links back to the section in `plan.md` or `payload_cms_astro_integration.md` that explains the *why* and the *how*.

---

## P0 — blockers for any non-local deployment

- [ ] **Wire Payload uploads to MinIO** via `@payloadcms/storage-s3`.
  - Snippet ready in `payload_cms_astro_integration.md` §5.B.
  - This unblocks deploying `apps/landing` anywhere other than localhost (currently media URLs are hardcoded to `http://127.0.0.1:3001/...`).
  - After the plugin is active, remove the `http://127.0.0.1:3001` prefix in `apps/landing/src/pages/articles.astro` and `apps/landing/src/pages/articles/[slug].astro`.

- [ ] **Set a real `PAYLOAD_SECRET`** in `apps/cms/.env` before any non-dev deploy. Default in `payload.config.ts` is `CHANGE-ME-IN-PRODUCTION` and must never ship.

- [ ] **Update production CORS list** in `apps/cms/src/payload.config.ts:56-61`. Currently localhost-only.

---

## P1 — content quality / editor UX

- [ ] **Fix `slug: null` policy** (`payload_cms_astro_integration.md` §3.B).
  - Easiest: make `slug` `required: true` in `Articles.ts` so editors cannot save without it.
  - Or: keep the runtime slug-vs-ID fallback and emit a 301 from `/articles/<id>` → `/articles/<slug>` once a slug exists.

- [ ] **Decide Articles `author` target** (`payload_cms_astro_integration.md` §8).
  - `Authors` collection exists with rich fields (name, bio, avatar, role, externalId) but is **not used** by Articles — Articles still point to `users`.
  - Either: switch `author` relation to `authors` (and seed at least one record to avoid FK bug), or keep `users` and accept the simpler model.

- [ ] **Slug collision suffixing** (`plan.md` §10.D). Auto-append `-2`, `-3` in the `beforeChange` hook so duplicate titles don't crash with `UNIQUE constraint failed`.

- [ ] **Auto-fill SEO defaults** (`plan.md` §10.E). `afterRead` hook to populate `seo.metaTitle` from `title` and `seo.metaDescription` from `excerpt` when blank.

- [ ] **Auto-derive excerpt** from first paragraph when blank (`plan.md` §10.K).

- [ ] **Fix Lexical renderer XSS** (`payload_cms_astro_integration.md` §3.E). Escape text nodes in `renderLexicalNode` before inserting via `set:html`. Security issue — don't defer.

- [ ] **Use `<picture srcset>` in Astro** with the existing `imageSizes` (thumbnail/card/hero already defined in `Media.ts`). Currently Astro uses bare `<img>` with full-size images.

---

## P2 — structural improvements

- [ ] **Convert tags to a relationship collection** (`plan.md` §10.F). New `Tags` collection + many-to-many. Astro fetch needs `depth=2` after this.

- [ ] **Validate `catalogNumber` against Express API** in `ArtifactHighlightBlock` (`plan.md` §10.B). Add `SKIP_ARTIFACT_VALIDATION` env flag so dev/offline saves still work.

- [ ] **Enforce scheduled publish** (`plan.md` §10.H). In the `read` access fn require `publishedAt <= now()` so future-dated articles stay hidden until their time.

- [ ] **Reading time virtual field** (`plan.md` §10.G). Walk Lexical AST in `afterRead`, count words, divide by 200.

- [ ] **Enable Payload `rateLimit` config** (`plan.md` §10.M).

---

## P3 — operations / monorepo cleanup

- [x] ~~**Remove PocketBase from the dev script.**~~ Done — cleaned from `package.json` and `stack.txt`.

- [ ] **Build & runtime pipeline ordering.** Payload must be alive at build time (for `articles.astro` listing) AND at runtime (for `[slug].astro` SSR). Document/automate this (`payload_cms_astro_integration.md` §5.F).

- [ ] **Build freshness strategy** (`plan.md` §10.O). The detail page is already SSR, so this mainly affects the listing page. Options:
  - Webhook-on-publish → CI rebuild.
  - Astro hybrid (SSR only for listing too).

- [ ] **Backups.** Schedule snapshots of `apps/cms/data/payload.db` (and MariaDB).

- [ ] **DB strategy decision** (`plan.md` §10.A). Stay on SQLite for now; plan a Postgres migration only if write volume / concurrency demands it. (No official MariaDB adapter — see §10.Q.)

- [ ] **Consolidate planning docs.** `plan.md` (477 lines) has heavy overlap with `payload_cms_astro_integration.md` and `to_do.md`. Consider archiving `plan.md` as a historical review and keeping just the integration doc + this TODO.

---

## P4 — nice-to-have content blocks

Add when editors actually ask for them (`plan.md` §10.L):

- [ ] VideoEmbedBlock (YouTube / Vimeo).
- [ ] TimelineBlock.
- [ ] PullQuoteBlock.
- [ ] CitationBlock / Footnotes.

---

## P5 — open architectural decisions

These need a human decision before code:

- [ ] **Auth strategy** (`plan.md` §6.B). Now only 2 user stores (Express/MariaDB + Payload/SQLite). Recommended: keep separate until launch; revisit only if federation becomes painful.
- [ ] **`panel-visitor` consuming Payload?** (`plan.md` §6.D). If yes, extract `renderLexicalNode` into a shared package.
- [ ] **Draft preview UX** (`payload_cms_astro_integration.md` §3.D). Document as "preview-in-admin only" or build a token-protected SSR preview route.

---

## Done (recent)

- ✅ Rewrote `payload_cms_astro_integration.md` (v3) — fixed SSR vs SSG references, removed PocketBase, added XSS section, updated risk register.
- ✅ `Users.ts` already has `name` (Display Name) field — author display works when editors fill it in.
- ✅ `Media.ts` already has `alt: required` and `imageSizes` (thumbnail/card/hero).
- ✅ `Authors` collection exists with rich fields (name, bio, avatar, role, externalId).
- ✅ Added `apps/cms/.env.example` template (`PAYLOAD_SECRET`, `DATABASE_URI`, S3/MinIO, SMTP).
- ✅ Captured all recommendations and multi-stack compatibility analysis in `plan.md` §10–§11.
- ✅ Smoke-tested running services (Payload, Express API, MariaDB, MinIO, Astro, panel-admin) — all reachable.
- ✅ Removed PocketBase from `package.json` dev script and `stack.txt`.
