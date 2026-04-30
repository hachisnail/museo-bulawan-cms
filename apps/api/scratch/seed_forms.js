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
                        acquisition_type: { enum: ["Gift", "Loan", "Bequest"], title: "Acquisition Type", type: "string" },
                        artifact_description: { format: "textarea", title: "Physical Description", type: "string" },
                        artifact_name: { description: "The formal title or name of the object", title: "Artifact Name", type: "string" },
                        artifact_provenance: { description: "How did you acquire this item?", format: "textarea", title: "Provenance / History", type: "string" },
                        donor_address: { format: "textarea", title: "Home/Office Address", type: "string" },
                        donor_email: { format: "email", title: "Email Address", type: "string" },
                        donor_first_name: { title: "First Name", type: "string" },
                        donor_last_name: { title: "Last Name", type: "string" },
                        donor_phone: { title: "Phone Number", type: "string" },
                        donor_title: { enum: ["Mr.", "Ms.", "Mrs.", "Dr.", "Prof."], title: "Title", type: "string" },
                        loan_end_date: { dependsOn: { field: "acquisition_type", value: "Loan" }, format: "date", title: "Loan Return Date", type: "string" },
                        supporting_documents: { format: "file", title: "Photos / Documents", type: "string" }
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
                    layout: "double_column"
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
