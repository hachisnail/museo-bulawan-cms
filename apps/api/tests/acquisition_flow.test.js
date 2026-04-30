import { db } from '../src/config/db.js';
import { initMariaDB as initDb } from '../src/config/dbInit.js';
import { userService } from '../src/services/userService.js';
import { submissionService } from '../src/services/form/submissionService.js';
import { formPipelineService } from '../src/services/formPipelineService.js';
import { acquisitionService } from '../src/services/acquisitionService.js';
import { ulid } from 'ulidx';

describe('Acquisition Pipeline Flow & Consolidation Tests', () => {
    let testUserId;
    let testSubmissionId;
    let testIntakeId;
    let testAccessionId;
    const donorEmail = `donor_${Date.now()}@jest.com`;

    afterEach(() => {
        console.log(`Current State - Submission: ${testSubmissionId}, Intake: ${testIntakeId}, Accession: ${testAccessionId}`);
    });

    beforeAll(async () => {
        await initDb();
        const users = await userService.listUsers();
        if (users.length > 0) {
            testUserId = users[0].id;
        } else {
            throw new Error('No users found in database for testing.');
        }

        // Seed Donation Form
        await db.query(`
            REPLACE INTO form_definitions (id, slug, title, type, settings, otp)
            VALUES (?, ?, ?, ?, ?, ?)
        `, ['TEST_FORM_ID', 'donation-test', 'Jest Donation', 'donation', JSON.stringify({
            field_mapping: {
                firstName: 'fname',
                lastName: 'lname',
                donorEmail: 'email',
                itemName: 'item',
                acquisitionType: 'method'
            }
        }), false]);
    });

    test('Consolidated Account Generation (Email Uniqueness)', async () => {
        const payload = { fname: 'John', lname: 'Doe', email: donorEmail, item: 'Relic A', method: 'gift' };
        
        // 1. Submit first form
        const sub1 = await submissionService.submitForm('donation-test', payload, null);
        await formPipelineService.processExternalIntake(testUserId, sub1.id);

        // 2. Submit second form with same email
        const payload2 = { fname: 'John', lname: 'Doe', email: donorEmail, item: 'Relic B', method: 'gift' };
        const sub2 = await submissionService.submitForm('donation-test', payload2, null);
        await formPipelineService.processExternalIntake(testUserId, sub2.id);

        // 3. Verify only one user account exists for this email
        const [userCount] = await db.query('SELECT COUNT(*) as count FROM users WHERE email = ?', [donorEmail]);
        expect(Number(userCount.count)).toBe(1);

        // 4. Verify both intakes are linked to the same donor_account_id
        const intakes = await db.query('SELECT donor_account_id FROM intakes WHERE submission_id IN (?, ?)', [sub1.id, sub2.id]);
        expect(intakes.length).toBe(2);
        expect(intakes[0].donor_account_id).toBe(intakes[1].donor_account_id);
        
        testSubmissionId = sub1.id;
        testIntakeId = (await db.query('SELECT id FROM intakes WHERE submission_id = ?', [sub1.id]))[0].id;
    });

    test('Unified Legal & Rights Management Consolidation', async () => {
        // Step 1: Approve Intake (under_review -> approved)
        await acquisitionService.approveIntake(testUserId, testIntakeId);

        // Step 2: Generate MOA (approved -> awaiting_delivery)
        const moaRes = await acquisitionService.generateDynamicMOA(testUserId, testIntakeId);
        const token = moaRes.qrPayload.token;

        // Step 3: Confirm Delivery (awaiting_delivery -> in_custody)
        await acquisitionService.confirmPhysicalDelivery(testUserId, testIntakeId, token);

        // Step 4: Process Accession (in_custody -> accessioned)
        const accession = await acquisitionService.processAccession(testUserId, testIntakeId, {
            accessionNumber: 'ACC-' + ulid(),
            isMoaSigned: true
        });
        testAccessionId = accession.id;

        expect(accession.contract_type).toBe('deed_of_gift');
        expect(accession.legal_status).toBe('Museum Property');

        // Step 5: Update Consolidated Legal & Rights Metadata
        const legalData = {
            contract_type: 'bill_of_sale',
            legal_status: 'Purchased Asset',
            license_type: 'CC BY 4.0',
            usage_restrictions: 'None',
            credit_line: 'Purchased via Jest Fund'
        };

        const updated = await acquisitionService.updateAccessionResearch(testUserId, testAccessionId, legalData);
        
        expect(updated.contract_type).toBe('bill_of_sale');
        expect(updated.legal_status).toBe('Purchased Asset');
        expect(updated.license_type).toBe('CC BY 4.0');
        expect(updated.credit_line).toBe('Purchased via Jest Fund');

        // Step 6: Verify Database Integrity
        const [dbRecord] = await db.query('SELECT * FROM accessions WHERE id = ?', [testAccessionId]);
        expect(dbRecord.contract_type).toBe('bill_of_sale');
        expect(dbRecord.license_type).toBe('CC BY 4.0');
    });

    test('Synchronous Transactional Integrity (One at a time)', async () => {
        // This tests the globalMutex and transaction wrapping
        const updates = Array.from({ length: 5 }, (_, i) => 
            acquisitionService.updateAccessionResearch(testUserId, testAccessionId, {
                research_notes: `Update ${i}`
            })
        );

        // Run in parallel but mutex should ensure sequential execution
        await Promise.all(updates);

        const [final] = await db.query('SELECT research_notes, version FROM accessions WHERE id = ?', [testAccessionId]);
        expect(final.version).toBeGreaterThan(5); // Initial + updates
    });
});
