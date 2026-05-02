# Payload CMS + Astro Integration Notes

**Target Audience:** Future AI assistants or developers maintaining this monorepo.
**Purpose:** Document the architectural decisions, Lexical editor quirks, and routing fallbacks implemented for the Article Builder microservice.

---

## 1. Decoupled Architecture
- **CMS Microservice:** Payload CMS 3.0 runs in `apps/cms` (Port 3001) using a local SQLite database (`apps/cms/data/payload.db`). This isolates the content editing workflow from the primary MariaDB MIS stack.
- **Frontend App:** An Astro SSG frontend runs in `apps/landing` (Port 4321), fetching data statically from the Payload REST API.

---

## 2. Payload Schema Decisions & Quirks (`Articles.ts`)

### A. Author Relationship (Database Constraint Bug)
- **Issue:** Payload's Draft/Publish workflow automatically attempts to save an empty draft the moment the `/admin/collections/articles/create` page opens.
- **Fix:** The `author` field relationship MUST point to the `users` collection, not an `authors` collection. The `beforeChange` hook injects the current admin's ID (`req.user.id`). If it points to `authors` (and the ID doesn't exist there), SQLite throws a `FOREIGN KEY constraint failed` error, causing the React Admin UI to crash with a White Screen.

### B. Custom Blocks & Infinite Recursion
- **Issue:** Adding custom blocks (like `ColumnsBlock`) to the Lexical editor can cause the browser to crash/hang (15s+ load times) if not configured carefully.
- **Fix:** Do **NOT** use nested explicit `lexicalEditor()` instances inside custom block definitions. When defining the `richText` fields for columns inside `ColumnsBlock`, let Payload fallback to the default internal editor. Using explicit nested `lexicalEditor({...})` overrides causes an infinite recursive loop in Payload v3's React renderer.

### C. SQLite Migration Limitations
- **Issue:** Drizzle ORM struggles to update relationships or indexes on the fly with SQLite (e.g., throwing `CREATE INDEX` errors when modifying relations).
- **Fix:** During development, if modifying foreign keys, it is safer to stop the server (`Ctrl+C`), delete `apps/cms/data/payload.db`, and let Payload initialize a clean database structure.

---

## 3. Astro Frontend Integration

### A. Fetching Data
Data is fetched exclusively with the condition `where[_status][equals]=published` to ensure drafts do not leak to the client side.

### B. Null Slug Routing Fallback
- **Context:** If a museum editor saves a draft before typing a title, the `beforeChange` hook for slug generation may not fire properly. When they later publish, the article might have `"slug": null`.
- **Implementation:** In `apps/landing/src/pages/articles/[slug].astro`, the `getStaticPaths` function maps to `article.slug || article.id.toString()`. 
- **Result:** If an article lacks a valid slug, the frontend dynamically routes to the database ID (e.g., `/articles/1`) instead of hiding the article entirely.

### C. Lexical AST Rendering
Payload returns rich text not as HTML, but as a deep JSON AST (Abstract Syntax Tree). 
- A recursive Astro component (`LexicalRenderer.astro`) processes this tree node-by-node. 
- It handles native HTML tags (`paragraph`, `heading`, `quote`) and maps Payload's custom blocks (`columns`) to responsive CSS Grid layouts.
