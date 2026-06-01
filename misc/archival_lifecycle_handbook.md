# Museo Bulawan: Complete Archival Lifecycle Handbook

This document provides a granular, step-by-step technical guide to the Museo Bulawan archival pipeline. It covers every status transition, API interaction, and background process required to move an artifact from a public offer to permanent museum custody.

---

## Phase 0: Submission (The Offer)
The lifecycle begins when a donor or staff member submits an item for consideration.

### 1. Initial Intake Creation
**Endpoint:** `POST /api/v1/acquisitions/intakes`
**Payload:**
```json
{
  "proposed_item_name": "Surigao Treasure Fragment",
  "donor_id": "const-ULID",
  "acquisition_method": "donation",
  "description": "Gold fragment with intricate engravings.",
  "initial_condition": "Stable"
}
```
**Status:** `under_review`

### 2. Attaching Initial Media (The Multi-Step Upload)
Uploading files is an asynchronous process involving a queue.

1.  **Request Upload:** `POST /api/v1/uploads` (multipart/form-data)
    - **Fields:** `collectionName: intakes`, `entity_id: intake-ULID`, `file: [binary]`
2.  **Queue Acknowledgment:** Server returns `202 Accepted` with a `taskId`.
3.  **Wait for Confirmation:** Subscribe to SSE (`/api/v1/sse/events?channel=user_{id}`).
    - **Event:** `upload_status`
    - **Data:** `{ "taskId": "abc", "status": "completed", "record": { ... } }`
4.  **Confirmation:** Once `status: completed` is received, the file is safely in MinIO and linked to the intake.

---

## Phase 1: Intake Processing (Review)
The curator reviews the submission and decides whether to proceed.

### 1. Acceptance
**Endpoint:** `POST /api/v1/acquisitions/intakes/:id/approve`
**Effect:** Moves status to `accepted`. This generates a **Temporary Custody Number**.

### 2. Legal MOA Generation
**Endpoint:** `POST /api/v1/acquisitions/intakes/:id/moa`
**Effect:** Generates a "Memorandum of Agreement" PDF. This should be signed by the donor.

---

## Phase 2: Delivery & Confirmation
The physical item arrives at the museum.

### 1. Confirm Delivery
**Endpoint:** `POST /api/v1/acquisitions/intakes/:id/confirm-delivery`
**Payload:**
```json
{
  "received_by": "user-ULID",
  "condition_on_arrival": "Matches description",
  "storage_location": "Receiving Bay A"
}
```
**Status:** `received`

---

## Phase 3: Accessioning (The Registry)
The item is formally "Accessioned" into the museum's permanent registry. This is a legal point of no return.

### 1. Create Accession Record
**Endpoint:** `POST /api/v1/acquisitions/accessions`
**Payload:**
```json
{
  "intake_id": "intake-ULID",
  "contract_type": "deed_of_gift",
  "legal_status": "owned",
  "accession_number": "2026.01.01" 
}
```
> [!TIP]
> If `accession_number` is omitted, the system generates it using the `YYYY.SEQ.BATCH` format (e.g., `2026.01.01`).

**Status:** `in_research`

---

## Phase 4: Curatorial Research (Enrichment)
Curators perform deep research, measurements, and classification.

### 1. Update Research Data
**Endpoint:** `PATCH /api/v1/acquisitions/accessions/:id/research`
**Payload:**
```json
{
  "dimensions": "12cm x 5cm x 2cm",
  "materials": "Gold, Quartz",
  "historical_significance": "Crucial evidence of trans-regional trade...",
  "tags": ["gold", "archaeological", "butuan"],
  "research_data": {
    "weight_grams": 156,
    "karat": 22
  }
}
```

---

## Phase 5: Inventory (Permanent Custody)
The final step where the artifact is moved to the permanent gallery or secure storage.

### 1. Finalize to Inventory
**Endpoint:** `POST /api/v1/acquisitions/inventory/from-accession/:id`
**Payload:**
```json
{
  "location": "Gallery 1, Display Case 4",
  "status": "active"
}
```
**Effect:**
1.  Generates a **Catalog Number** (e.g., `CAT-2026-0001`).
2.  Creates a permanent Inventory record.
3.  The Accession record status moves to `finalized`.

---

## Phase 6: Maintenance & Lifecycle
The artifact is now a permanent part of the collection.

### 1. Internal Movement (Transfer)
**Endpoint:** `POST /api/v1/acquisitions/inventory/:id/transfer`
**Payload:**
```json
{
  "toLocation": "Conservation Lab",
  "reason": "Annual health check"
}
```

### 2. Health & Conservation
Use the `FormRenderer` with the `artifact-health` or `artifact-conservation` slug.
**Endpoint:** `POST /api/v1/acquisitions/compliance/condition-reports`
**Endpoint:** `POST /api/v1/acquisitions/compliance/conservation`

---

## Summary of Sequence Generators
- **Intake ID**: `intk-{ULID}` (Auto-generated)
- **Accession Number**: `YYYY.SEQ.BATCH` (e.g., `2026.02.01`)
- **Catalog Number**: `CAT-YYYY-SEQ` (e.g., `CAT-2026-0005`)
- **Task ID**: `8-char hex` (For tracking async uploads)
