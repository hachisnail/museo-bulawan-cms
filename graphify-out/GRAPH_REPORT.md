# Graph Report - museo-bulawan-cms  (2026-05-31)

## Corpus Check
- 255 files · ~129,600 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1180 nodes · 1778 edges · 115 communities (91 shown, 24 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `02f85a4b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 105|Community 105]]
- [[_COMMUNITY_Community 106|Community 106]]
- [[_COMMUNITY_Community 107|Community 107]]
- [[_COMMUNITY_Community 108|Community 108]]
- [[_COMMUNITY_Community 109|Community 109]]
- [[_COMMUNITY_Community 110|Community 110]]
- [[_COMMUNITY_Community 111|Community 111]]
- [[_COMMUNITY_Community 112|Community 112]]
- [[_COMMUNITY_Community 113|Community 113]]
- [[_COMMUNITY_Community 114|Community 114]]

## God Nodes (most connected - your core abstractions)
1. `logger` - 42 edges
2. `db` - 40 edges
3. `useAuth()` - 37 edges
4. `env` - 21 edges
5. `10. Additional Article Builder recommendations (Payload-specific)` - 18 edges
6. `compilerOptions` - 16 edges
7. `Review of `payload_cms_astro_integration.md`` - 15 edges
8. `useSSE()` - 14 edges
9. `userService` - 13 edges
10. `auditService` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Analytics()` --calls--> `useAuth()`  [EXTRACTED]
  apps/panel-admin/src/pages/Analytics.jsx → apps/panel-admin/src/context/authContext.jsx
- `AuditLogs()` --calls--> `useAuth()`  [EXTRACTED]
  apps/panel-admin/src/pages/AuditLogs.jsx → apps/panel-admin/src/context/authContext.jsx
- `Locations()` --calls--> `useAuth()`  [EXTRACTED]
  apps/panel-admin/src/pages/Locations.jsx → apps/panel-admin/src/context/authContext.jsx
- `startServer()` --calls--> `initMariaDB()`  [EXTRACTED]
  apps/api/server.js → apps/api/src/config/dbInit.js
- `Page()` --calls--> `RootPage()`  [INFERRED]
  apps/cms/src/app/(payload)/admin/[[...segments]]/page.tsx → apps/cms/src/app/(payload)/page.tsx

## Import Cycles
- None detected.

## Communities (115 total, 24 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (59): accessionService, baseService, constituentService, exhibitionService, intakeService, inventoryService, loanService, locationService (+51 more)

### Community 1 - "Community 1"
Cohesion: 0.16
Nodes (13): ProtectedRoute(), AuthContext, AuthProvider(), useAuth(), SSEContext, SSEProvider(), Constituents(), Exhibitions() (+5 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (36): router, upload, defineAbilityFor(), getEffectiveRoles(), HIERARCHY, ROLE_RULES, acquisitionController, analyticsController (+28 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (47): author, dependencies, ajv, bcrypt, @casl/ability, connect-redis, cors, docx (+39 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (26): importMap, Articles, ArtifactHighlightBlock, CallToActionBlock, ColumnsBlock, ImageGalleryBlock, Authors, Categories (+18 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (38): author, dependencies, @astrojs/react, @jridgewell/trace-mapping, lucide-react, react, react-dom, @types/react (+30 more)

### Community 6 - "Community 6"
Cohesion: 0.05
Nodes (37): 0. Quick Start, 1. Decoupled Architecture, 2. Payload Schema Decisions & Quirks (`apps/cms/src/collections/Articles.ts`), 3. Astro Frontend Integration, 4. File Path Reference, 5. Production Deployment Notes, 6. Multi-Stack Compatibility Analysis, 7. Risk Register (+29 more)

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (33): 1. Intake Stage, 2. Accession Stage, 3. Inventory Stage, 4. Museum Compliance, Acquisitions & State Machine API, Audit & Export API, Core Workflows, Frontend Integration Guidelines (+25 more)

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (32): dependencies, docx-preview, @headlessui/react, js-cookie, jszip, lucide-react, qrcode, react (+24 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (27): ../layouts/Layout.astro, ../styles/global.css, connectSSE(), deliverySlipContainer, detailDate, detailId, detailMethodBadge, detailsContent (+19 more)

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (17): accessionController, complianceController, VALID_ENTITY_TYPES, intakeController, inventoryController, schemas, loansController, mapDTO() (+9 more)

### Community 11 - "Community 11"
Cohesion: 0.07
Nodes (27): 1. Architecture Overview, 2. State Machines, 3. Lifecycle Stages — Step by Step, 4. API Filter Reference, 5. Data Flow & Traceability, 6. Security Matrix, 7. Auto-Number Formats, Accession States (Formal Registration) (+19 more)

### Community 12 - "Community 12"
Cohesion: 0.07
Nodes (26): dependencies, cross-env, graphql, next, payload, @payloadcms/db-sqlite, @payloadcms/next, @payloadcms/richtext-lexical (+18 more)

### Community 13 - "Community 13"
Cohesion: 0.08
Nodes (24): Article, ArticlesSelect, Auth, Author, AuthorsSelect, CategoriesSelect, Category, CollectionsWidget (+16 more)

### Community 14 - "Community 14"
Cohesion: 0.08
Nodes (23): AllValuesOf, CollectionEntry, CollectionKey, ContentConfig, DataEntryMap, ExtractCollectionFilterType, ExtractEntryFilterType, ExtractErrorType (+15 more)

### Community 15 - "Community 15"
Cohesion: 0.08
Nodes (23): AllValuesOf, CollectionEntry, CollectionKey, ContentConfig, DataEntryMap, ExtractCollectionFilterType, ExtractEntryFilterType, ExtractErrorType (+15 more)

### Community 16 - "Community 16"
Cohesion: 0.09
Nodes (22): falsePositive, fired, precision, records, ruleStats, debug-statements, sql-injection-risk, xss-risk (+14 more)

### Community 17 - "Community 17"
Cohesion: 0.09
Nodes (21): 1.1. Public Portal: Submission Flow (Visitor/Donor), 1.2. Admin Portal: Core Acquisition Lifecycle, 1.3. Admin Portal: Inventory Subsystems & Movements, 1. Sequential Call Arrangements & Workflows, 2.1. Authentication Routes (`/auth`), 2.2. User Management Routes (`/user`), 2.3. Form Routes (`/forms`), 2.4. Acquisition Routes (`/acquisitions`) (+13 more)

### Community 18 - "Community 18"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+12 more)

### Community 19 - "Community 19"
Cohesion: 0.10
Nodes (20): dependencies, astro, @astrojs/node, @astrojs/react, react, react-dom, tailwindcss, @tailwindcss/vite (+12 more)

### Community 20 - "Community 20"
Cohesion: 0.10
Nodes (19): 1. Acceptance, 1. Confirm Delivery, 1. Create Accession Record, 1. Finalize to Inventory, 1. Initial Intake Creation, 1. Internal Movement (Transfer), 1. Update Research Data, 2. Attaching Initial Media (The Multi-Step Upload) (+11 more)

### Community 21 - "Community 21"
Cohesion: 0.12
Nodes (12): ../components/ui/Footer.astro, ../components/ui/Header.astro, ../components/ui/Nav.astro, ../../layouts/BaseLayout.astro, escapeHtml(), renderLexicalNode(), ../../assets/LOGO.png, ../styles/global.css (+4 more)

### Community 22 - "Community 22"
Cohesion: 0.11
Nodes (18): 10. Additional Article Builder recommendations (Payload-specific), A. Switch Payload's DB adapter from SQLite to MariaDB-compatible Postgres — or keep SQLite explicitly, B. Article ↔ Artifact link should be a real lookup, not a free-text catalog number, C. Author display name pipeline, D. Slug uniqueness and collision handling, E. SEO defaults and Open Graph, F. Tags should be a relationship, not free-text array, G. Reading time / word count (+10 more)

### Community 23 - "Community 23"
Cohesion: 0.12
Nodes (15): 1. AUTH (`/api/v1/auth`), 2. USERS (`/api/v1/user`), 3. FORMS (`/api/v1/forms`), 4. ACQUISITIONS (`/api/v1/acquisitions`), 5. UPLOADS (`/api/v1/upload`), 6. FILES (`/api/v1/file`), 7. NOTIFICATIONS (`/api/v1/notifications`), 8. AUDIT LOGS (`/api/v1/audit-logs`) (+7 more)

### Community 24 - "Community 24"
Cohesion: 0.12
Nodes (15): dependencies, astro, @astrojs/node, tailwindcss, @tailwindcss/vite, engines, node, name (+7 more)

### Community 25 - "Community 25"
Cohesion: 0.15
Nodes (12): 1. Directory Structure and Architectural Roles, 2. API Routing Reference, 3. Step-by-Step Donation Submission Guide, 4. Processing Submissions into Intakes, 5. Under-the-Hood: The Donation Pipeline Workflow, A. Public Forms Endpoints, API Routing Guide: Forms Service & Donation Form Lifecycle, B. Staff Administration Endpoints (+4 more)

### Community 27 - "Community 27"
Cohesion: 0.23
Nodes (11): loginSchema, userController, userService, identityController, identityService, lifecycleController, lifecycleService, managementController (+3 more)

### Community 28 - "Community 28"
Cohesion: 0.18
Nodes (10): 1. Acquisition Lifecycle (Intake → Accession → Inventory), 2. Dynamic Forms & Submissions, 3. Media & Attachments, 4. Compliance & Museum Standards, 5. Authority Control & Management, 6. Authentication, Accessions (The Registry), Intakes (The Pipeline) (+2 more)

### Community 29 - "Community 29"
Cohesion: 0.18
Nodes (10): 1. What the doc gets right (keep these), 4. Production-readiness concerns the doc should mention, 5. Specific doc edits I'd suggest, 7. Risk register (sorted by severity), 8. Suggested next actions (concrete TODOs), 9. Final verdict on the existing doc, Review of `payload_cms_astro_integration.md`, Status of recommendations (updated 2026-05-05) (+2 more)

### Community 31 - "Community 31"
Cohesion: 0.27
Nodes (3): MemoryQueueAdapter, NativeRedisQueueAdapter, processTask()

### Community 32 - "Community 32"
Cohesion: 0.15
Nodes (6): App(), Icons, MainLayout(), useSSEGlobal(), useSSE(), Dashboard()

### Community 33 - "Community 33"
Cohesion: 0.22
Nodes (8): Done (recent), P0 — blockers for any non-local deployment, P1 — content quality / editor UX, P2 — structural improvements, P3 — operations / monorepo cleanup, P4 — nice-to-have content blocks, P5 — open architectural decisions, TODO — Museo Bulawan CMS

### Community 34 - "Community 34"
Cohesion: 0.25
Nodes (3): baseService, mockAuditService, mockDb

### Community 35 - "Community 35"
Cohesion: 0.48
Nodes (4): ExternalForm(), STEP_ICONS, InternalForm(), useFormLogic()

### Community 36 - "Community 36"
Cohesion: 0.29
Nodes (7): 11. Multi-stack compatibility check for §10 recommendations, A. Per-item compatibility matrix, B. The one item that needs more thought: §10.O (build freshness), C. What stays decoupled regardless, D. Risks specific to the multi-stack setup that §10 DOES introduce, E. What would have broken cross-stack compatibility (and was deliberately NOT recommended), F. Final compatibility verdict

### Community 37 - "Community 37"
Cohesion: 0.29
Nodes (7): 6. Multi-stack compatibility analysis (your specific worry), A. Will Payload "infect" the rest of the stack with Next.js?, B. Auth fragmentation (the real risk), C. Data sharing between Payload SQLite and MariaDB, D. Will the Astro panel-visitor also consume Payload?, E. Umami analytics, F. MinIO

### Community 38 - "Community 38"
Cohesion: 0.29
Nodes (7): 2. Gaps & things that should be added to the doc, A. Missing: Environment variables / secrets, B. Missing: How Astro fetches Payload (endpoint URLs), C. Missing: Media / uploads handling, D. Missing: CORS list maintenance, E. Missing: Draft preview workflow, F. Missing: Build-order / dev-startup instructions

### Community 39 - "Community 39"
Cohesion: 0.40
Nodes (5): createConstituent(), _createRecord(), mockAuditService, mockDb, mockLogger

### Community 40 - "Community 40"
Cohesion: 0.40
Nodes (4): Astro Starter Kit: Minimal, 🧞 Commands, 🚀 Project Structure, 👀 Want to learn more?

### Community 41 - "Community 41"
Cohesion: 0.40
Nodes (4): Astro Starter Kit: Minimal, 🧞 Commands, 🚀 Project Structure, 👀 Want to learn more?

### Community 42 - "Community 42"
Cohesion: 0.40
Nodes (5): 3. Things in the doc that are slightly misleading, A. §1 calls Payload a "microservice", B. §2.C "delete `apps/cms/data/payload.db`", C. §2.A "Payload automatically saves an empty draft when the create page opens", D. §3.B "slug || id"

### Community 43 - "Community 43"
Cohesion: 0.40
Nodes (4): compilerOptions, jsx, jsxImportSource, extends

### Community 44 - "Community 44"
Cohesion: 0.40
Nodes (3): mockBaseService, mockDb, mockNotificationService

### Community 46 - "Community 46"
Cohesion: 0.50
Nodes (3): exclude, extends, include

### Community 47 - "Community 47"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + Vite

### Community 48 - "Community 48"
Cohesion: 0.50
Nodes (3): exclude, extends, include

### Community 51 - "Community 51"
Cohesion: 0.18
Nodes (3): STATUS_STYLES, Accessions(), STATUS_STYLES

### Community 61 - "Community 61"
Cohesion: 0.24
Nodes (4): getIntakeDonorEmail(), getIntakeDonorPhone(), Intakes(), STATUS_STYLES

### Community 105 - "Community 105"
Cohesion: 0.24
Nodes (3): ITEM_STATUS_COLORS, Inventory(), ITEM_STATUS_COLORS

### Community 106 - "Community 106"
Cohesion: 0.39
Nodes (5): formController, queryController, schemas, submissionController, formService

### Community 107 - "Community 107"
Cohesion: 0.43
Nodes (4): getIntakeDonorEmail(), getIntakeDonorPhone(), IntakeDetail(), STATUS_STYLES

### Community 108 - "Community 108"
Cohesion: 0.29
Nodes (3): AuditLogs(), Locations(), TYPE_STYLES

## Knowledge Gaps
- **585 isolated node(s):** `version`, `records`, `fired`, `falsePositive`, `precision` (+580 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `db` connect `Community 0` to `Community 2`, `Community 111`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `NativeRedisQueueAdapter` connect `Community 31` to `Community 0`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `version`, `records`, `fired` to the rest of the system?**
  _585 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05574949751401671 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.062146892655367235 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.041666666666666664 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.056025369978858354 - nodes in this community are weakly interconnected._