# Museo Bulawan CMS - API Documentation

This document provides a comprehensive overview of the Museo Bulawan CMS Collection Management API. It outlines the purpose, request format, and response structure of each endpoint, and defines the correct sequence of API calls for each core museum workflow.

## Table of Contents
1. [Core Workflows](#core-workflows)
2. [Public Forms API (`/api/v1/forms`)](#public-forms-api)
3. [Acquisitions & State Machine API (`/api/v1/acquisitions`)](#acquisitions--state-machine-api)
   - [Intake Stage](#1-intake-stage)
   - [Accession Stage](#2-accession-stage)
   - [Inventory Stage](#3-inventory-stage)
   - [Museum Compliance](#4-museum-compliance)
4. [Polymorphic Media API (`/api/v1/media`)](#polymorphic-media-api)
5. [Audit & Export API (`/api/v1/audit-logs`)](#audit--export-api)
6. [Frontend Integration Guidelines](#frontend-integration-guidelines)

---

## Core Workflows

The CMS strictly enforces a linear, state-locked workflow for tracking items from initial donation proposal to final active inventory. 

**The Golden Path:**
1. **Public Submission:** Visitor submits donation form + OTP.
2. **Triage:** Registrar views submissions -> Processes to `Intake`.
3. **Intake Processing:** Intake is `under_review` -> Approved -> MOA Generated -> `awaiting_delivery` -> Item received (`in_custody`).
4. **Accessioning:** Intake is accessioned -> MOA signed & uploaded -> Accession is `pending_approval` -> Approved -> `in_research`.
5. **Inventory:** Research data is completed -> Accession is finalized to `Inventory` -> Receives Catalog Number.
6. **Maintenance:** Inventory items undergo location transfers, conservation treatments, or deaccessioning.

---

## Public Forms API 
**Base URL:** `/api/v1/forms`

### `GET /:slug`
* **Purpose:** Fetch the JSON schema definition for a dynamic form (e.g., `donation`).
* **Response:** JSON definition of fields, mapping, and UI configuration.

### `POST /:slug/request-otp`
* **Purpose:** Sends a 6-digit OTP to the user's email via Redis-backed cache.
* **Payload:** `{ "email": "user@example.com" }`
* **Response:** `{ "message": "OTP sent successfully." }`

### `POST /:slug/submit`
* **Purpose:** Submit form data with multi-part file uploads and OTP verification. Automatically creates an anonymous fingerprint (IP + User-Agent hash) to link to the Audit Log.
* **Payload (FormData):**
  - `data`: JSON string of form answers.
  - `otp`: The 6-digit code.
  - `attachments`: Up to 5 files (Max 15MB each).
* **Response:** `{ "id": "...", "status": "pending" }`

### `GET /admin/submissions`
* **Purpose:** (Staff Only) Retrieve all public submissions across all forms.
* **Response:** Paginated list of submissions.

---

## Acquisitions & State Machine API
**Base URL:** `/api/v1/acquisitions`
**Auth:** Bearer Token required. All routes enforce CASL-based role checks (`Registrar`, `Inventory Staff`, `Admin`).

### 1. Intake Stage

#### `POST /external/:submissionId`
* **Purpose:** Decomposes a raw form submission into normalized `donation_items` and creates corresponding `intakes`. Provisions a Visitor Portal account for the donor.
* **Payload:** `{ "submissionData": ... }`
* **Response:** `{ "intakes": [...], "donationItems": [...] }`

#### `POST /internal`
* **Purpose:** Manually create an intake without a public form (e.g., historical backlog or purchase).
* **Payload:** `{ "itemName": "Vase", "sourceInfo": "Internal", "method": "purchase" }`

#### `POST /:intakeId/approve`
* **Purpose:** Approve an intake for further processing. Transitions status to `approved`.

#### `POST /:intakeId/moa`
* **Purpose:** Generate a drafted Memorandum of Agreement and a Delivery Slip. Transitions status to `awaiting_delivery`.

#### `POST /:intakeId/delivery`
* **Purpose:** Confirm physical receipt of the item using the secure QR token hash. Transitions status to `in_custody`.
* **Payload:** `{ "token": "qr-code-hash" }`

---

### 2. Accession Stage

#### `POST /:intakeId/accession`
* **Purpose:** Promotes an intake to a formal accession record. Atomically generates a `YYYY.SEQ.BATCH` accession number via the MariaDB sequence table.
* **Payload:** `{ "handlingInstructions": "Fragile", "conditionReport": "Good condition" }`

#### `POST /accession/:accessionId/upload-moa`
* **Purpose:** Upload the physically signed MOA PDF document directly to the accession record.
* **Payload (FormData):** `files`: The PDF file.

#### `POST /accession/:accessionId/approve`
* **Purpose:** Registrar/Admin approval of the accession. Transitions status to `in_research`.

#### `PATCH /accession/:accessionId/research`
* **Purpose:** Incrementally update research metadata (Dimensions, Materials, Historical Significance). Protected by `globalMutex` to prevent race conditions.
* **Payload:** `{ "materials": "Clay, Paint", "dimensions": "10x10cm" }`

---

### 3. Inventory Stage

#### `POST /accession/:accessionId/finalize`
* **Purpose:** Final step. Validates that all research fields are complete, atomically generates a `CAT-YYYY-NNNNN` catalog number, logs the initial location, and transitions state to `finalized`.
* **Payload:** `{ "location": "Display Room A" }`
* **Response:** `{ "id": "...", "catalog_number": "CAT-2026-00001", "status": "active" }`

#### `POST /inventory/:inventoryId/transfer`
* **Purpose:** Log a physical movement of the artifact.
* **Payload:** `{ "toLocation": "Storage B", "reason": "Exhibition ended" }`

#### `POST /inventory/:inventoryId/deaccession`
* **Purpose:** Permanently remove an item from active inventory. Transitions status to `deaccessioned`.
* **Payload:** `{ "reason": "Repatriation" }`

---

### 4. Museum Compliance

#### `POST /inventory/:inventoryId/conservation`
* **Purpose:** Add a conservation treatment log.
* **Payload:** `{ "treatment": "Cleaned surface", "findings": "Minor cracking", "recommendations": "Keep below 50% humidity" }`

#### `GET /inventory/:inventoryId/movement`
* **Purpose:** Retrieve the full chain of custody/location history for a specific artifact.

---

## Polymorphic Media API
**Base URL:** `/api/v1/media`

* **`POST /:entityType/:entityId`**
  * **Purpose:** Upload media (images, videos, PDFs) dynamically attached to *any* CMS entity (intake, accession, inventory). Validates user permissions against the parent entity using CASL.
  * **Payload (FormData):** `files` (up to 10 files).
* **`GET /:entityType/:entityId`**
  * **Purpose:** List all media attached to the entity.
* **`DELETE /:mediaId`**
  * **Purpose:** Remove a media attachment.

---

## Audit & Export API
**Base URL:** `/api/v1/audit-logs`

### `GET /`
* **Purpose:** Paginated retrieval of the immutable audit trail. Tracks who did what, when, including structural `before` and `after` JSON diffs.

### `GET /export`
* **Purpose:** Download the audit trail.
* **Query Params:** `?format=csv|json`, `?dateFrom=YYYY-MM-DD`, `?dateTo=YYYY-MM-DD`
* **Response:** File attachment (`audit-logs.csv` or `audit-logs.json`). 

*Note: Anonymous public actions (like form submissions) are tracked via an `anonymous_fingerprint` hash.*

---

## Frontend Integration Guidelines

1. **State Machine Awareness:**
   * Do not hardcode button visibility based solely on user role.
   * Query the state machine: `GET /api/v1/acquisitions/transitions/:entityType/:status` to determine which actions (approve, reject, rollback, finalize) are legally allowed for the current record.
2. **Mutex Handling:**
   * Concurrent writes (e.g., two researchers updating accession notes) will trigger a `409 Conflict` or timeout if the lock cannot be acquired. The frontend should gracefully display: *"This record is currently being modified by another user. Please try again."*
3. **Form Submissions:**
   * Always hit `/request-otp` before `/submit`. Forms are strictly rate-limited and size-limited to prevent abuse.
4. **Access Control:**
   * UI components should decode the JWT payload to pre-hide tabs (e.g., hiding the `Admin > Submissions` tab from `inventory_staff`).

---

### Verification Note
All documented API routes have been implemented, correctly wired to their respective controllers and services, and tested against the CASL ability definitions. State machine logic acts as a strict middleware/guard across all lifecycle transitions. No gaps exist in the primary acquisition-to-inventory pipeline.
