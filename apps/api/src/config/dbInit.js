import { db } from './db.js';
import { logger } from '../utils/logger.js';

/**
 * Initializes all required MariaDB tables if they do not exist.
 * This file replaces the legacy PocketBase schema with native relational tables.
 */
export async function initMariaDB() {
    let conn;
    try {
        conn = await db.getConnection(); // Get a connection for transaction
        await conn.query('BEGIN');

        // 1. Users Table (Consolidated PocketBase app_users + MariaDB users)
        await conn.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(26) PRIMARY KEY,
                fname VARCHAR(100),
                lname VARCHAR(100),
                email VARCHAR(255) UNIQUE NOT NULL,
                username VARCHAR(100) UNIQUE,
                password VARCHAR(255),
                role VARCHAR(50) DEFAULT 'visitor',
                status VARCHAR(20) DEFAULT 'active',
                current_session_id VARCHAR(255) NULL,
                action_token VARCHAR(255) NULL,
                action_token_expires DATETIME NULL,
                title VARCHAR(100) NULL,      -- Added from PB app_users
                phone VARCHAR(50) NULL,       -- Added from PB app_users
                address TEXT NULL,            -- Added from PB app_users
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Safely alter existing users table if it was created before we added the new fields
        try {
            await conn.query(`ALTER TABLE users ADD COLUMN title VARCHAR(100) NULL`);
            await conn.query(`ALTER TABLE users ADD COLUMN phone VARCHAR(50) NULL`);
            await conn.query(`ALTER TABLE users ADD COLUMN address TEXT NULL`);
        } catch(e) { /* Ignore if columns already exist */ }

        // 2. Sequences Table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS sequences (
                sequence_name VARCHAR(50) PRIMARY KEY,
                current_value BIGINT NOT NULL DEFAULT 0,
                reset_year SMALLINT UNSIGNED NOT NULL DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        await conn.query(`INSERT IGNORE INTO sequences (sequence_name, current_value, reset_year) VALUES ('accession', 0, 0)`);
        await conn.query(`INSERT IGNORE INTO sequences (sequence_name, current_value, reset_year) VALUES ('catalog', 0, 0)`);

        // 3. Media Metadata (Central storage for file properties)
        await conn.query(`
            CREATE TABLE IF NOT EXISTS media_metadata (
                id VARCHAR(26) PRIMARY KEY,
                file_name VARCHAR(255) NOT NULL,
                storage_key VARCHAR(255) UNIQUE NOT NULL,
                mime_type VARCHAR(100) NOT NULL,
                size_bytes BIGINT NOT NULL,
                uploaded_by VARCHAR(26),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_media_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
            )
        `);

        // 3.5 Media Links (Junction Table for entities)
        await conn.query(`
            CREATE TABLE IF NOT EXISTS media_links (
                id VARCHAR(26) PRIMARY KEY,
                media_id VARCHAR(26) NOT NULL,
                entity_type VARCHAR(50) NOT NULL, -- 'accession', 'intake', 'condition_report', etc.
                entity_id VARCHAR(26) NOT NULL,
                context VARCHAR(100) NULL,       -- 'signed_moa', 'photo_evidence', etc.
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_entity_link (entity_type, entity_id),
                CONSTRAINT fk_link_media FOREIGN KEY (media_id) REFERENCES media_metadata(id) ON DELETE CASCADE
            )
        `);

        // 4. Form Definitions
        await conn.query(`
            CREATE TABLE IF NOT EXISTS form_definitions (
                id VARCHAR(26) PRIMARY KEY,
                slug VARCHAR(255) UNIQUE NOT NULL,
                title VARCHAR(255) NOT NULL,
                type ENUM('donation', 'appointment', 'feedback', 'custom', 'artifact_health', 'artifact_movement', 'artifact_conservation') DEFAULT 'custom',
                schema_data JSON NULL,
                settings JSON NULL,
                otp BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Migration: Ensure type is ENUM if table already existed as VARCHAR
        try {
            await conn.query(`ALTER TABLE form_definitions MODIFY COLUMN type ENUM('donation', 'appointment', 'feedback', 'custom', 'artifact_health', 'artifact_movement', 'artifact_conservation') DEFAULT 'custom'`);
        } catch(e) { /* Ignore if already ENUM or table empty */ }

        // 5. Form Submissions
        await conn.query(`
            CREATE TABLE IF NOT EXISTS form_submissions (
                id VARCHAR(26) PRIMARY KEY,
                form_id VARCHAR(26) NOT NULL,
                data JSON NULL,
                status VARCHAR(50) DEFAULT 'pending',
                submitted_by VARCHAR(26) NULL,
                submitted_email VARCHAR(255) NULL,
                anonymous_fingerprint VARCHAR(255) NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_submission_form FOREIGN KEY (form_id) REFERENCES form_definitions(id) ON DELETE CASCADE,
                CONSTRAINT fk_submission_user FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL
            )
        `);

        // Safely add submitted_email if it was missing
        try {
            await conn.query(`ALTER TABLE form_submissions ADD COLUMN submitted_email VARCHAR(255) NULL AFTER submitted_by`);
        } catch(e) {}

        // 6. Donation Items
        await conn.query(`
            CREATE TABLE IF NOT EXISTS donation_items (
                id VARCHAR(26) PRIMARY KEY,
                submission_id VARCHAR(26) NULL,
                item_name VARCHAR(255) NOT NULL,
                description TEXT NULL,
                quantity INT DEFAULT 1,
                status VARCHAR(50) DEFAULT 'pending',
                version INT DEFAULT 1,
                created_by VARCHAR(26) NULL,
                updated_by VARCHAR(26) NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_donation_submission FOREIGN KEY (submission_id) REFERENCES form_submissions(id) ON DELETE CASCADE,
                CONSTRAINT fk_donation_creator FOREIGN KEY (created_by) REFERENCES users(id),
                CONSTRAINT fk_donation_updater FOREIGN KEY (updated_by) REFERENCES users(id)
            )
        `);

        // Safely add version and tracking columns if they were missing
        try {
            await conn.query(`ALTER TABLE donation_items ADD COLUMN version INT DEFAULT 1 AFTER status`);
            await conn.query(`ALTER TABLE donation_items ADD COLUMN created_by VARCHAR(26) NULL AFTER version`);
            await conn.query(`ALTER TABLE donation_items ADD COLUMN updated_by VARCHAR(26) NULL AFTER created_by`);
        } catch(e) {}

        // 7. Intakes
        await conn.query(`
            CREATE TABLE IF NOT EXISTS intakes (
                id VARCHAR(26) PRIMARY KEY,
                submission_id VARCHAR(26) NULL,
                donation_item_id VARCHAR(26) NULL,
                donor_account_id VARCHAR(26) NULL,
                proposed_item_name VARCHAR(255) NOT NULL,
                donor_info TEXT NOT NULL,
                acquisition_method VARCHAR(50) NOT NULL,
                loan_end_date DATE NULL,
                status VARCHAR(50) NOT NULL,
                moa_status VARCHAR(50) NOT NULL,
                rejection_reason TEXT NULL,
                donor_name_override VARCHAR(255) NULL,
                loan_duration_override VARCHAR(100) NULL,
                delivery_slip_id VARCHAR(100) NULL,
                qr_token_hash VARCHAR(255) NULL,
                qr_token_expires DATETIME NULL,
                version INT DEFAULT 1,
                created_by VARCHAR(26) NOT NULL,
                updated_by VARCHAR(26) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_intake_sub FOREIGN KEY (submission_id) REFERENCES form_submissions(id) ON DELETE SET NULL,
                CONSTRAINT fk_intake_donation FOREIGN KEY (donation_item_id) REFERENCES donation_items(id) ON DELETE SET NULL,
                CONSTRAINT fk_intake_donor FOREIGN KEY (donor_account_id) REFERENCES users(id) ON DELETE SET NULL,
                CONSTRAINT fk_intake_creator FOREIGN KEY (created_by) REFERENCES users(id),
                CONSTRAINT fk_intake_updater FOREIGN KEY (updated_by) REFERENCES users(id)
            )
        `);

        // Migration: Fix qr_token_expires type
        try {
            await conn.query(`ALTER TABLE intakes MODIFY COLUMN qr_token_expires DATETIME NULL`);
        } catch(e) {}
        await conn.query(`
            CREATE TABLE IF NOT EXISTS accessions (
                id VARCHAR(26) PRIMARY KEY,
                intake_id VARCHAR(26) NOT NULL,
                accession_number VARCHAR(100) UNIQUE NOT NULL,
                handling_instructions TEXT NULL,
                dimensions VARCHAR(255) NULL,
                materials VARCHAR(255) NULL,
                maker VARCHAR(255) NULL,         -- Legacy/Fallback
                maker_id VARCHAR(26) NULL,        -- SPECTRUM: Authority Control
                object_type VARCHAR(100) NULL,
                classification VARCHAR(100) NULL,
                period_era VARCHAR(100) NULL,
                tags JSON NULL,
                research_notes TEXT NULL,
                historical_significance TEXT NULL,
                
                -- Institutional & Legal Framework (Unified Rights/Legal)
                contract_type VARCHAR(50) NOT NULL,
                legal_status VARCHAR(255) NOT NULL,
                copyright_holder_id VARCHAR(26) NULL,
                license_type VARCHAR(100) NULL,   -- e.g. 'CC BY-SA', 'Proprietary'
                usage_restrictions TEXT NULL,
                credit_line TEXT NULL,            -- e.g. 'Gift of John Doe'
                
                status VARCHAR(50) NOT NULL,
                version INT DEFAULT 1,
                research_data JSON NULL,
                created_by VARCHAR(26) NOT NULL,
                updated_by VARCHAR(26) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_acc_intake FOREIGN KEY (intake_id) REFERENCES intakes(id),
                CONSTRAINT fk_acc_maker FOREIGN KEY (maker_id) REFERENCES constituents(id),
                CONSTRAINT fk_acc_copyright FOREIGN KEY (copyright_holder_id) REFERENCES constituents(id),
                CONSTRAINT fk_acc_creator FOREIGN KEY (created_by) REFERENCES users(id),
                CONSTRAINT fk_acc_updater FOREIGN KEY (updated_by) REFERENCES users(id)
            )
        `);

        // Migration: Add new cataloging and rights fields to accessions
        try {
            await conn.query(`ALTER TABLE accessions ADD COLUMN maker_id VARCHAR(26) NULL AFTER maker`);
            await conn.query(`ALTER TABLE accessions ADD COLUMN copyright_holder_id VARCHAR(26) NULL AFTER historical_significance`);
            await conn.query(`ALTER TABLE accessions ADD COLUMN license_type VARCHAR(100) NULL AFTER copyright_holder_id`);
            await conn.query(`ALTER TABLE accessions ADD COLUMN usage_restrictions TEXT NULL AFTER license_type`);
            await conn.query(`ALTER TABLE accessions ADD COLUMN credit_line TEXT NULL AFTER usage_restrictions`);
        } catch(e) {}

        // 8.5 Constituents (SPECTRUM: Authority Control for People/Organizations)
        await conn.query(`
            CREATE TABLE IF NOT EXISTS constituents (
                id VARCHAR(26) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                type ENUM('individual', 'organization', 'group') NOT NULL,
                contact_info JSON NULL,
                biography TEXT NULL,
                external_id VARCHAR(255) NULL, -- e.g. LCNAF or Getty ULAN
                version INT DEFAULT 1,
                created_by VARCHAR(26) NOT NULL,
                updated_by VARCHAR(26) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_const_creator FOREIGN KEY (created_by) REFERENCES users(id),
                CONSTRAINT fk_const_updater FOREIGN KEY (updated_by) REFERENCES users(id)
            )
        `);

        // Migration: Add version to constituents if missing
        try {
            await conn.query(`ALTER TABLE constituents ADD COLUMN version INT DEFAULT 1 AFTER external_id`);
        } catch(e) {}

        // 9. Inventory
        await conn.query(`
            CREATE TABLE IF NOT EXISTS inventory (
                id VARCHAR(26) PRIMARY KEY,
                accession_id VARCHAR(26) NOT NULL,
                catalog_number VARCHAR(100) UNIQUE NOT NULL,
                current_location VARCHAR(255) NOT NULL,
                status VARCHAR(50) NOT NULL,
                deaccession_reason TEXT NULL,
                manual_status_override BOOLEAN DEFAULT FALSE,
                tags JSON NULL,
                version INT DEFAULT 1,
                created_by VARCHAR(26) NOT NULL,
                updated_by VARCHAR(26) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_inv_accession FOREIGN KEY (accession_id) REFERENCES accessions(id),
                CONSTRAINT fk_inv_creator FOREIGN KEY (created_by) REFERENCES users(id),
                CONSTRAINT fk_inv_updater FOREIGN KEY (updated_by) REFERENCES users(id)
            )
        `);

        // Safely add manual_status_override if it was missing
        try {
            await conn.query(`ALTER TABLE inventory ADD COLUMN manual_status_override BOOLEAN DEFAULT FALSE AFTER deaccession_reason`);
        } catch(e) {}

        // Migration: Add tags to inventory
        try {
            await conn.query(`ALTER TABLE inventory ADD COLUMN tags JSON NULL AFTER manual_status_override`);
        } catch(e) {}

        // 9.5 Valuations (SPECTRUM: Financial Accountability)
        await conn.query(`
            CREATE TABLE IF NOT EXISTS valuations (
                id VARCHAR(26) PRIMARY KEY,
                inventory_id VARCHAR(26) NOT NULL,
                amount DECIMAL(19,4) NOT NULL,
                currency CHAR(3) DEFAULT 'PHP',
                valuation_date DATE NOT NULL,
                valuation_reason VARCHAR(100) NOT NULL, -- 'Insurance', 'Acquisition', 'Audit'
                valuer VARCHAR(255) NULL,
                notes TEXT NULL,
                version INT DEFAULT 1,
                created_by VARCHAR(26) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_val_item FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
                CONSTRAINT fk_val_creator FOREIGN KEY (created_by) REFERENCES users(id)
            )
        `);

        // Migration: Add version to valuations if missing
        try {
            await conn.query(`ALTER TABLE valuations ADD COLUMN version INT DEFAULT 1 AFTER notes`);
        } catch(e) {}

        // 9.6 Exhibitions & Events (SPECTRUM: Use of Collections)
        await conn.query(`
            CREATE TABLE IF NOT EXISTS exhibitions (
                id VARCHAR(26) PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                venue VARCHAR(255) NOT NULL,
                start_date DATE NULL,
                end_date DATE NULL,
                curator_id VARCHAR(26) NULL,
                description TEXT NULL,
                status ENUM('planning', 'active', 'closed') DEFAULT 'planning',
                version INT DEFAULT 1,
                created_by VARCHAR(26) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_exh_curator FOREIGN KEY (curator_id) REFERENCES users(id),
                CONSTRAINT fk_exh_creator FOREIGN KEY (created_by) REFERENCES users(id)
            )
        `);

        // Migration: Add version to exhibitions if missing
        try {
            await conn.query(`ALTER TABLE exhibitions ADD COLUMN version INT DEFAULT 1 AFTER status`);
        } catch(e) {}

        await conn.query(`
            CREATE TABLE IF NOT EXISTS exhibition_artifacts (
                id VARCHAR(26) PRIMARY KEY,
                exhibition_id VARCHAR(26) NOT NULL,
                inventory_id VARCHAR(26) NOT NULL,
                display_notes TEXT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_ea_exh FOREIGN KEY (exhibition_id) REFERENCES exhibitions(id) ON DELETE CASCADE,
                CONSTRAINT fk_ea_inv FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE
            )
        `);

        // 10. Condition Reports
        await conn.query(`
            CREATE TABLE IF NOT EXISTS condition_reports (
                id VARCHAR(26) PRIMARY KEY,
                entity_type ENUM('intake', 'accession', 'inventory') NOT NULL,
                entity_id VARCHAR(26) NOT NULL,
                condition_status VARCHAR(100) NOT NULL,
                stability VARCHAR(100) NULL,
                hazards TEXT NULL,
                notes TEXT NULL,
                immediate_action_required BOOLEAN DEFAULT FALSE,
                submission_id VARCHAR(26) NULL,
                reported_by VARCHAR(26) NULL,
                reporter_name VARCHAR(255) NULL,
                version INT DEFAULT 1,
                created_by VARCHAR(26) NULL,
                updated_by VARCHAR(26) NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_condition_user FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE SET NULL,
                CONSTRAINT fk_condition_creator FOREIGN KEY (created_by) REFERENCES users(id),
                CONSTRAINT fk_condition_updater FOREIGN KEY (updated_by) REFERENCES users(id),
                CONSTRAINT fk_cr_submission FOREIGN KEY (submission_id) REFERENCES form_submissions(id) ON DELETE SET NULL
            )
        `);

        // Migration logic for condition_reports
        try {
            await conn.query(`ALTER TABLE condition_reports ADD COLUMN stability VARCHAR(100) NULL AFTER condition_status`);
            await conn.query(`ALTER TABLE condition_reports ADD COLUMN hazards TEXT NULL AFTER stability`);
            await conn.query(`ALTER TABLE condition_reports ADD COLUMN immediate_action_required BOOLEAN DEFAULT FALSE AFTER notes`);
        } catch(e) {}

        // Safely add/modify columns if missing
        try {
            await conn.query(`ALTER TABLE condition_reports MODIFY COLUMN entity_type ENUM('intake', 'accession', 'inventory') NOT NULL`);
        } catch(e) {}
        try {
            await conn.query(`ALTER TABLE condition_reports ADD COLUMN version INT DEFAULT 1 AFTER reporter_name`);
        } catch(e) {}
        try {
            await conn.query(`ALTER TABLE condition_reports ADD COLUMN created_by VARCHAR(26) NULL AFTER version`);
        } catch(e) {}
        try {
            await conn.query(`ALTER TABLE condition_reports ADD COLUMN updated_by VARCHAR(26) NULL AFTER created_by`);
        } catch(e) {}
        try {
            await conn.query(`ALTER TABLE condition_reports ADD CONSTRAINT fk_condition_creator FOREIGN KEY (created_by) REFERENCES users(id)`);
        } catch(e) {}
        try {
            await conn.query(`ALTER TABLE condition_reports ADD CONSTRAINT fk_condition_updater FOREIGN KEY (updated_by) REFERENCES users(id)`);
        } catch(e) {}

        // 11. Audit Logs
        await conn.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id VARCHAR(26) PRIMARY KEY,
                user_id VARCHAR(26) NULL,
                action VARCHAR(100) NOT NULL,
                resource VARCHAR(100) NOT NULL,
                details JSON NULL,
                ip_address VARCHAR(255) NULL,
                before_state JSON NULL,
                after_state JSON NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_audit_user (user_id),
                INDEX idx_audit_resource (resource)
            )
        `);

        // 12. Notifications
        await conn.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id VARCHAR(26) PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                type VARCHAR(50) DEFAULT 'info',
                target_type VARCHAR(50) NOT NULL, -- 'global', 'role', 'user'
                target_id VARCHAR(100) NOT NULL, -- 'all', 'admin', or userId
                action_url VARCHAR(255) NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_notif_target (target_type, target_id)
            )
        `);

        // 13. Accession Approvals
        await conn.query(`
            CREATE TABLE IF NOT EXISTS accession_approvals (
                id VARCHAR(26) PRIMARY KEY,
                accession_id VARCHAR(26) NOT NULL,
                approved_by VARCHAR(26) NOT NULL,
                decision ENUM('approved', 'rejected') NOT NULL,
                notes TEXT NULL,
                reporter VARCHAR(255) NULL,
                submission_id VARCHAR(26) NULL,
                version INT DEFAULT 1,
                created_by VARCHAR(26) NULL,
                updated_by VARCHAR(26) NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_approval_accession FOREIGN KEY (accession_id) REFERENCES accessions(id) ON DELETE CASCADE,
                CONSTRAINT fk_approval_user FOREIGN KEY (approved_by) REFERENCES users(id),
                CONSTRAINT fk_approval_creator FOREIGN KEY (created_by) REFERENCES users(id),
                CONSTRAINT fk_approval_updater FOREIGN KEY (updated_by) REFERENCES users(id)
            )
        `);

        // Migration logic
        try {
            await conn.query(`ALTER TABLE accession_approvals ADD COLUMN version INT DEFAULT 1 AFTER submission_id`);
            await conn.query(`ALTER TABLE accession_approvals ADD COLUMN created_by VARCHAR(26) NULL AFTER version`);
            await conn.query(`ALTER TABLE accession_approvals ADD COLUMN updated_by VARCHAR(26) NULL AFTER created_by`);
        } catch(e) {}

        // 14. Location History
        await conn.query(`
            CREATE TABLE IF NOT EXISTS location_history (
                id VARCHAR(26) PRIMARY KEY,
                inventory_item_id VARCHAR(26) NOT NULL,
                from_location VARCHAR(255) NOT NULL,
                to_location VARCHAR(255) NOT NULL,
                movement_type VARCHAR(50) NULL,
                reason TEXT NULL,
                handling_notes TEXT NULL,
                moved_by VARCHAR(26) NOT NULL,
                submission_id VARCHAR(26) NULL,
                version INT DEFAULT 1,
                created_by VARCHAR(26) NULL,
                updated_by VARCHAR(26) NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_loc_item FOREIGN KEY (inventory_item_id) REFERENCES inventory(id) ON DELETE CASCADE,
                CONSTRAINT fk_loc_user FOREIGN KEY (moved_by) REFERENCES users(id),
                CONSTRAINT fk_loc_creator FOREIGN KEY (created_by) REFERENCES users(id),
                CONSTRAINT fk_loc_updater FOREIGN KEY (updated_by) REFERENCES users(id)
            )
        `);

        try {
            await conn.query(`ALTER TABLE location_history ADD COLUMN movement_type VARCHAR(50) NULL AFTER to_location`);
            await conn.query(`ALTER TABLE location_history ADD COLUMN handling_notes TEXT NULL AFTER reason`);
            await conn.query(`ALTER TABLE location_history ADD COLUMN version INT DEFAULT 1 AFTER submission_id`);
            await conn.query(`ALTER TABLE location_history ADD COLUMN created_by VARCHAR(26) NULL AFTER version`);
            await conn.query(`ALTER TABLE location_history ADD COLUMN updated_by VARCHAR(26) NULL AFTER created_by`);
        } catch(e) {}

        // 15. Conservation Logs
        await conn.query(`
            CREATE TABLE IF NOT EXISTS conservation_logs (
                id VARCHAR(26) PRIMARY KEY,
                inventory_item_id VARCHAR(26) NOT NULL,
                conservator_name VARCHAR(255) NULL,
                treatment_objective VARCHAR(100) NULL,
                treatment TEXT NOT NULL,
                findings TEXT NOT NULL,
                recommendations TEXT NULL,
                next_review_date DATE NULL,
                conservator_id VARCHAR(26) NOT NULL,
                submission_id VARCHAR(26) NULL,
                version INT DEFAULT 1,
                created_by VARCHAR(26) NULL,
                updated_by VARCHAR(26) NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_cons_item FOREIGN KEY (inventory_item_id) REFERENCES inventory(id) ON DELETE CASCADE,
                CONSTRAINT fk_cons_user FOREIGN KEY (conservator_id) REFERENCES users(id),
                CONSTRAINT fk_cons_creator FOREIGN KEY (created_by) REFERENCES users(id),
                CONSTRAINT fk_cons_updater FOREIGN KEY (updated_by) REFERENCES users(id)
            )
        `);

        try {
            await conn.query(`ALTER TABLE conservation_logs ADD COLUMN conservator_name VARCHAR(255) NULL AFTER inventory_item_id`);
            await conn.query(`ALTER TABLE conservation_logs ADD COLUMN treatment_objective VARCHAR(100) NULL AFTER conservator_name`);
            await conn.query(`ALTER TABLE conservation_logs ADD COLUMN next_review_date DATE NULL AFTER recommendations`);
            await conn.query(`ALTER TABLE conservation_logs ADD COLUMN version INT DEFAULT 1 AFTER conservator_id`);
            await conn.query(`ALTER TABLE conservation_logs ADD COLUMN created_by VARCHAR(26) NULL AFTER version`);
            await conn.query(`ALTER TABLE conservation_logs ADD COLUMN updated_by VARCHAR(26) NULL AFTER created_by`);
            await conn.query(`ALTER TABLE conservation_logs ADD COLUMN submission_id VARCHAR(26) NULL AFTER conservator_id`);
        } catch(e) {}

        // 18. Valuations (Financial Appraisal)
        await conn.query(`
            CREATE TABLE IF NOT EXISTS valuations (
                id VARCHAR(26) PRIMARY KEY,
                inventory_id VARCHAR(26) NOT NULL,
                amount DECIMAL(15, 2) NOT NULL,
                currency VARCHAR(10) DEFAULT 'PHP',
                valuation_date DATE NOT NULL,
                valuation_reason VARCHAR(100) NULL, -- Insurance, Acquisition, Audit
                valuer VARCHAR(255) NULL,
                notes TEXT NULL,
                version INT DEFAULT 1,
                created_by VARCHAR(26) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_val_inv FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
                CONSTRAINT fk_val_creator FOREIGN KEY (created_by) REFERENCES users(id)
            )
        `);

        // 17. Loans (Outbound)
        await conn.query(`
            CREATE TABLE IF NOT EXISTS loans (
                id VARCHAR(26) PRIMARY KEY,
                loan_type ENUM('outbound', 'inbound') DEFAULT 'outbound',
                borrower_id VARCHAR(26) NULL, -- From constituents
                borrower_name_manual VARCHAR(255) NULL,
                venue VARCHAR(255) NULL,
                purpose TEXT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                status ENUM('draft', 'active', 'returned', 'overdue') DEFAULT 'draft',
                insurance_coverage TEXT NULL,
                courier_details TEXT NULL,
                version INT DEFAULT 1,
                created_by VARCHAR(26) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_loan_borrower FOREIGN KEY (borrower_id) REFERENCES constituents(id),
                CONSTRAINT fk_loan_creator FOREIGN KEY (created_by) REFERENCES users(id)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS loan_artifacts (
                id VARCHAR(26) PRIMARY KEY,
                loan_id VARCHAR(26) NOT NULL,
                inventory_id VARCHAR(26) NOT NULL,
                condition_on_out TEXT NULL,
                condition_on_return TEXT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_la_loan FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE,
                CONSTRAINT fk_la_inv FOREIGN KEY (inventory_id) REFERENCES inventory(id)
            )
        `);

        // 16. Default Form Seedings
        const defaultForms = [
            {
                id: '01KQE81CSDZ6D68JYXB34JXZX5',
                slug: 'donation-form',
                title: 'Artifact Donation & Temporary Loan Form',
                type: 'donation',
                schema_data: {
                    properties: {
                        acquisition_type: { enum: ["Gift", "Loan", "Bequest"], title: "Acquisition Type", type: "string" },
                        artifact_description: { format: "textarea", title: "Physical Description", type: "string" },
                        artifact_name: { title: "Artifact Name", type: "string" },
                        donor_email: { format: "email", title: "Email Address", type: "string" },
                        donor_first_name: { title: "First Name", type: "string" },
                        donor_last_name: { title: "Last Name", type: "string" }
                    },
                    required: ["donor_first_name", "donor_last_name", "donor_email", "artifact_name", "acquisition_type"],
                    type: "object"
                },
                settings: { allow_attachments: true, description: "Official Artifact Donation Form", layout: "double_column" },
                otp: true
            },
            {
                id: '01KQEAAX7RAE9CEYNBV2VF512N',
                slug: 'artifact-movement',
                title: 'Movement',
                type: 'artifact_movement',
                schema_data: {
                    properties: {
                        artifact_id: { title: "Artifact ID", type: "string", "ui:widget": "hidden" },
                        to_location: { title: "Destination Location", type: "string", description: "Storage Room, Exhibition Hall, etc." },
                        movement_type: { enum: ["Exhibition", "Storage", "Loan", "Conservation", "Research", "Other"], title: "Type of Movement", type: "string" },
                        moved_by: { title: "Authorized Personnel", type: "string", description: "Who is responsible for the transport?" },
                        reason: { format: "textarea", title: "Reason for Movement", type: "string" },
                        handling_notes: { format: "textarea", title: "Handling Instructions", type: "string", description: "e.g., Use gloves, vertical transport only." }
                    },
                    required: ["artifact_id", "to_location", "movement_type", "reason"],
                    type: "object"
                },
                settings: { allow_attachments: true, description: "Record official location transfers.", layout: "single_column" },
                otp: false
            },
            {
                id: '01KQEAAX7RAE9CEYNBV2VF512M',
                slug: 'artifact-health',
                title: 'Health',
                type: 'artifact_health',
                schema_data: {
                    properties: {
                        artifact_id: { title: "Artifact ID", type: "string", "ui:widget": "hidden" },
                        condition: { enum: ["Excellent", "Good", "Fair", "Poor", "Critical"], title: "Overall Condition", type: "string" },
                        stability: { enum: ["Stable", "Active Deterioration", "Fragile", "Under Observation"], title: "Stability Status", type: "string" },
                        hazards: { title: "Identified Hazards", type: "string", description: "e.g., Mold, Pests, Corrosion, Structural Stress" },
                        detailed_notes: { format: "textarea", title: "Detailed Findings", type: "string" },
                        immediate_action_required: { title: "Immediate Action Required?", type: "boolean" }
                    },
                    required: ["artifact_id", "condition", "stability"],
                    type: "object"
                },
                settings: { allow_attachments: true, description: "Log physical state and vulnerability assessments.", layout: "single_column" },
                otp: false
            },
            {
                id: '01KQEAAX7RAE9CEYNBV2VF512P',
                slug: 'artifact-conservation',
                title: 'Conservation',
                type: 'artifact_conservation',
                schema_data: {
                    properties: {
                        artifact_id: { title: "Artifact ID", type: "string", "ui:widget": "hidden" },
                        conservator_name: { title: "Conservator / Practitioner", type: "string" },
                        treatment_objective: { enum: ["Cleaning", "Stabilization", "Restoration", "Preventive Care", "Documentation"], title: "Treatment Objective", type: "string" },
                        treatment: { format: "textarea", title: "Treatment Methods & Materials", type: "string" },
                        findings: { format: "textarea", title: "Technical Observations", type: "string" },
                        recommendations: { format: "textarea", title: "Future Care Recommendations", type: "string" },
                        next_review_date: { format: "date", title: "Recommended Review Date", type: "string" }
                    },
                    required: ["artifact_id", "treatment", "findings", "treatment_objective"],
                    type: "object"
                },
                settings: { allow_attachments: true, description: "Official conservation and restoration records.", layout: "single_column" },
                otp: false
            }
        ];

        for (const f of defaultForms) {
            await conn.query(`
                INSERT IGNORE INTO form_definitions (id, slug, title, type, schema_data, settings, otp)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [f.id, f.slug, f.title, f.type, JSON.stringify(f.schema_data), JSON.stringify(f.settings), f.otp]);
        }

        await conn.query('COMMIT');
        logger.info('MariaDB Schema initialized & seeded successfully.');
    } catch (error) {
        if (conn) await conn.query('ROLLBACK');
        logger.error('Failed to initialize MariaDB tables', { error: error.message });
        throw error;
    } finally {
        if (conn) conn.release();
    }
}