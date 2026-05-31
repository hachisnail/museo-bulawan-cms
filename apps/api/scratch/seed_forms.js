import { db } from '../src/config/db.js';
import { ulid } from 'ulidx';

async function seedForms() {
    try {
        console.log('--- Seeding Form Definitions ---');

        const forms = [
            {
                id: '01KQE81CSDZ6D68JYXB34JXZX5',
                slug: 'donation-form',
                title: 'Artifact Donation & Temporary Loan Form',
                type: 'donation',
                schema_data: {
                    properties: {
                        // ── Step 1: Donor Information ──
                        is_anonymous: {
                            title: "Submit Anonymously",
                            type: "boolean",
                            description: "Check to hide your name and contact details. Only your email is required.",
                            "ui:group": "donor_info"
                        },
                        donor_first_name: {
                            title: "First Name",
                            type: "string",
                            dependsOn: { field: "is_anonymous", value: true, operator: "neq" },
                            "ui:group": "donor_info"
                        },
                        donor_last_name: {
                            title: "Last Name",
                            type: "string",
                            dependsOn: { field: "is_anonymous", value: true, operator: "neq" },
                            "ui:group": "donor_info"
                        },
                        donor_email: {
                            format: "email",
                            title: "Email Address",
                            type: "string",
                            "ui:group": "donor_info"
                        },
                        donor_phone: {
                            title: "Phone Number",
                            type: "string",
                            dependsOn: { field: "is_anonymous", value: true, operator: "neq" },
                            "ui:group": "donor_info"
                        },

                        // ── Step 2: Donation Type ──
                        acquisition_type: {
                            enum: ["Gift", "Loan", "Bequest"],
                            title: "Donation Type",
                            type: "string",
                            "ui:group": "donation_type"
                        },
                        loan_end_date: {
                            format: "date",
                            title: "Loan Return Date",
                            type: "string",
                            description: "When should the loaned artifact be returned?",
                            dependsOn: { field: "acquisition_type", value: "Loan" },
                            "ui:group": "donation_type"
                        },

                        // ── Step 3: Artifact Information ──
                        artifact_name: {
                            title: "Artifact Name",
                            type: "string",
                            description: "The formal title or name of the object",
                            "ui:group": "artifact_info"
                        },
                        artifact_description: {
                            format: "textarea",
                            title: "Physical Description",
                            type: "string",
                            "ui:group": "artifact_info"
                        },
                        artifact_provenance: {
                            format: "textarea",
                            title: "Provenance / History",
                            type: "string",
                            description: "How did you acquire this item?",
                            "ui:group": "artifact_info"
                        },
                        supporting_documents: {
                            format: "file",
                            title: "Photos / Supporting Documents",
                            type: "string",
                            description: "Upload photos of the artifact, certificates, or provenance documents",
                            "ui:group": "artifact_info"
                        }
                    },
                    required: ["donor_first_name", "donor_last_name", "donor_email", "artifact_name", "acquisition_type"],
                    type: "object"
                },
                settings: {
                    allow_attachments: true,
                    description: "Official Artifact Donation & Temporary Loan Form",
                    field_mapping: {
                        acquisitionType: "acquisition_type",
                        description: "artifact_description",
                        donorEmail: "donor_email",
                        firstName: "donor_first_name",
                        itemName: "artifact_name",
                        lastName: "donor_last_name"
                    },
                    step_groups: [
                        { id: "donor_info", label: "Donor Information", icon: "user" },
                        { id: "donation_type", label: "Donation Type", icon: "gift" },
                        { id: "artifact_info", label: "Artifact Details", icon: "archive" }
                    ],
                    layout: "wizard"
                },
                otp: 1
            },
            {
                id: ulid(),
                slug: 'artifact-movement',
                title: 'Movement',
                type: 'artifact_movement',
                schema_data: {
                    properties: {
                        artifact_id: { title: "Artifact ID", type: "string", "ui:widget": "hidden" },
                        moved_by: { title: "Moved By", type: "string" },
                        reason: { format: "textarea", title: "Reason for Movement", type: "string" },
                        to_location: { title: "Destination Location", type: "string" }
                    },
                    required: ["artifact_id", "to_location", "reason"],
                    type: "object"
                },
                settings: {
                    allow_attachments: false,
                    description: "Record the transfer of an artifact.",
                    layout: "single_column"
                },
                otp: 0
            },
            {
                id: ulid(),
                slug: 'artifact-health',
                title: 'Health',
                type: 'artifact_health',
                schema_data: {
                    properties: {
                        artifact_id: { title: "Artifact ID", type: "string", "ui:widget": "hidden" },
                        condition: { enum: ["Excellent", "Good", "Fair", "Poor", "Critical"], title: "Overall Condition", type: "string" },
                        detailed_notes: { format: "textarea", title: "Detailed Findings (e.g. Cracks, Fading)", type: "string" }
                    },
                    required: ["artifact_id", "condition"],
                    type: "object"
                },
                settings: {
                    allow_attachments: true,
                    description: "Log physical state with optional photo evidence.",
                    layout: "single_column"
                },
                otp: 0
            }
        ];

        for (const form of forms) {
            // Use INSERT INTO ... ON DUPLICATE KEY UPDATE to avoid errors on re-run
            const sql = `
                INSERT INTO form_definitions (id, slug, title, type, schema_data, settings, otp)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    title = VALUES(title),
                    type = VALUES(type),
                    schema_data = VALUES(schema_data),
                    settings = VALUES(settings),
                    otp = VALUES(otp)
            `;

            await db.query(sql, [
                form.id,
                form.slug,
                form.title,
                form.type,
                JSON.stringify(form.schema_data),
                JSON.stringify(form.settings),
                form.otp
            ]);
            console.log(`✓ Seeded form: ${form.slug}`);
        }

        console.log('--- Seeding Complete ---');
        process.exit(0);
    } catch (error) {
        console.error('Seed failed:', error);
        process.exit(1);
    }
}

seedForms();
