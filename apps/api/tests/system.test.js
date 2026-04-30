import { db } from '../src/config/db.js';
import { initMariaDB as initDb } from '../src/config/dbInit.js';
import { userService } from '../src/services/userService.js';
import { submissionService } from '../src/services/form/submissionService.js';
import { formPipelineService } from '../src/services/formPipelineService.js';
import { acquisitionService } from '../src/services/acquisitionService.js';
import { inventoryService } from '../src/services/acquisition/inventoryService.js';
import { mediaService } from '../src/services/mediaService.js';
import { maintenanceService } from '../src/services/maintenanceService.js';
import { ulid } from 'ulid';

describe('Museum System Integration Tests', () => {
    let testUserId;
    let testSubmissionId;
    let testIntakeId;
    let testAccessionId;
    let testInventoryId;

    const donorEmail = `test_${Date.now()}@example.com`;

    beforeAll(async () => {
        // Initialize DB schema
        await initDb();

        // Ensure DB is connected
        const [dbCheck] = await db.query('SELECT 1 + 1 as val');
        expect(dbCheck.val).toBe(2);

        // Fetch or create a test user
        const users = await userService.listUsers();
        if (users.length > 0) {
            testUserId = users[0].id;
        } else {
            // This would need a create user service call, assuming one exists for testing
            throw new Error('No users found in database for testing.');
        }

        // Seed Form
        const formDefinition = {
            slug: 'donation-form',
            title: 'Artifact Donation & Temporary Loan Form',
            type: 'donation',
            schema_data: {
                "type": "object",
                "required": ["donor_first_name", "donor_last_name", "donor_email", "artifact_name", "acquisition_type"],
                "properties": {
                    "donor_first_name": { "type": "string" },
                    "donor_last_name": { "type": "string" },
                    "donor_email": { "type": "string" },
                    "artifact_name": { "type": "string" },
                    "acquisition_type": { "type": "string", "enum": ["Gift", "Loan", "Bequest"] }
                }
            },
            settings: {
                "field_mapping": {
                    "firstName": "donor_first_name",
                    "lastName": "donor_last_name",
                    "donorEmail": "donor_email",
                    "itemName": "artifact_name",
                    "acquisitionType": "acquisition_type"
                }
            }
        };

        await db.query(`
            REPLACE INTO form_definitions (id, slug, title, type, schema_data, settings, otp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [ulid(), formDefinition.slug, formDefinition.title, formDefinition.type, 
            JSON.stringify(formDefinition.schema_data), 
            JSON.stringify(formDefinition.settings), 
            false]);
    });

    test('Step 1: Form Submission', async () => {
        const payload = {
            donor_first_name: 'Jest',
            donor_last_name: 'Tester',
            donor_email: donorEmail,
            artifact_name: 'Jest Artifact ' + ulid(),
            acquisition_type: 'Gift'
        };

        const submission = await submissionService.submitForm('donation-form', payload, null, [], { ip: '127.0.0.1' });
        expect(submission).toBeDefined();
        expect(submission.id).toBeDefined();
        testSubmissionId = submission.id;
    });

    test('Step 2: Intake Creation & Workflow', async () => {
        // Submission -> Intake
        const pipelineResult = await formPipelineService.processExternalIntake(testUserId, testSubmissionId);
        testIntakeId = pipelineResult.intakes[0].id;
        expect(testIntakeId).toBeDefined();

        // Workflow: approved -> awaiting_delivery -> in_custody
        await acquisitionService.approveIntake(testUserId, testIntakeId);
        
        const moaResult = await acquisitionService.generateDynamicMOA(testUserId, testIntakeId);
        const token = moaResult.qrPayload.token;
        expect(token).toBeDefined();

        const inCustody = await acquisitionService.confirmPhysicalDelivery(testUserId, testIntakeId, token);
        expect(inCustody.status).toBe('in_custody');
    });

    test('Step 3: Accession Processing', async () => {
        const accession = await acquisitionService.processAccession(testUserId, testIntakeId, {
            handlingInstructions: 'Handle with care',
            isMoaSigned: true,
            conditionReport: 'Excellent'
        });
        expect(accession.id).toBeDefined();
        expect(accession.accession_number).toBeDefined();
        testAccessionId = accession.id;

        await acquisitionService.approveAccession(testUserId, testAccessionId, 'Approved by Jest', 'Jest Runner');
    });

    test('Step 4: Finalizing to Inventory', async () => {
        // Need to update accession with required research data first
        await acquisitionService.updateAccessionResearch(testUserId, testAccessionId, {
            dimensions: '10x10x10',
            materials: 'Digital Matter',
            historical_significance: 'Created during system validation'
        });

        const inventory = await inventoryService.finalizeToInventory(testUserId, testAccessionId, {
            location: 'Jest Vault',
            imageSkipReason: 'Automated test skip'
        });
        expect(inventory.id).toBeDefined();
        expect(inventory.catalog_number).toBeDefined();
        testInventoryId = inventory.id;
    });

    test('Step 5: Media Junction Integrity', async () => {
        const mockFile = {
            originalname: 'jest_test.png',
            mimetype: 'image/png',
            size: 123,
            buffer: Buffer.from('abc')
        };

        try {
            const links = await mediaService.attachMedia(testUserId, 'inventory', testInventoryId, [mockFile], 'Jest Evidence');
            expect(links.length).toBe(1);
            const linkId = links[0].link_id;

            const mediaList = await mediaService.listMedia('inventory', testInventoryId);
            expect(mediaList.items.some(m => m.link_id === linkId)).toBe(true);

            await mediaService.deleteMedia(testUserId, linkId);
        } catch (err) {
            if (err.message.includes('Storage backend') || err.name === 'S3Error') {
                console.warn('⚠️ Skipping media integrity check due to S3 storage constraints.');
            } else {
                throw err;
            }
        }
    });

    test('Step 6: Maintenance Engine', async () => {
        await expect(maintenanceService.runCleanup()).resolves.not.toThrow();
    });
});
