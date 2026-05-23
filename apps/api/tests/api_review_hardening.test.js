import { db } from '../src/config/db.js';
import { initMariaDB as initDb } from '../src/config/dbInit.js';
import { userService } from '../src/services/userService.js';
import { verificationService } from '../src/services/form/verificationService.js';
import { submissionService } from '../src/services/form/submissionService.js';
import { queryService } from '../src/services/form/queryService.js';
import { otpStore } from '../src/utils/otpStore.js';
import crypto from 'crypto';
import { ulid } from 'ulidx';

describe('API Review Hardening Tests', () => {
    let testUserId;
    const testEmail = `hardening_test_${Date.now()}@example.com`;
    const testOtp = '123456';

    beforeAll(async () => {
        await initDb();
        const users = await userService.listUsers();
        if (users.length > 0) {
            testUserId = users[0].id;
        } else {
            throw new Error('No users found in database for testing.');
        }

        // Seed a Form Definition with OTP required and custom fields
        await db.query(`
            REPLACE INTO form_definitions (id, slug, title, type, schema_data, settings, otp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, ['HARDENING_FORM_ID', 'hardening-test', 'Hardening Test Form', 'donation', JSON.stringify({
            "type": "object",
            "properties": {
                "email": { "type": "string" },
                "notes": { "type": "string", "format": "textarea" },
                "attachment": { "type": ["string", "array"], "format": "file" }
            }
        }), JSON.stringify({
            field_mapping: {
                donorEmail: 'email'
            }
        }), true]);
    });

    test('OTP Non-Destruction and Consumption Flow', async () => {
        // Set OTP in cache
        const otpHash = crypto.createHash('sha256').update(testOtp).digest('hex');
        await otpStore.set(testEmail, { otpHash });

        // 1. Verify OTP first (should succeed and NOT delete the OTP from store)
        const verifyRes = await verificationService.verifyOtp(testEmail, testOtp);
        expect(verifyRes.valid).toBe(true);

        // Verify it still exists in the store
        const cachedAfterVerify = await otpStore.get(testEmail);
        expect(cachedAfterVerify).not.toBeNull();
        expect(cachedAfterVerify.otpHash).toBe(otpHash);

        // 2. Submit the form (should verify and successfully consume/delete the OTP)
        const payload = {
            email: testEmail,
            notes: 'Some textarea content',
            attachment: 'file.png'
        };
        const submission = await submissionService.submitForm('hardening-test', payload, testOtp);
        expect(submission).toBeDefined();
        expect(submission.id).toBeDefined();

        // Verify the OTP is now consumed and deleted from the store
        const cachedAfterSubmit = await otpStore.get(testEmail);
        expect(cachedAfterSubmit).toBeNull();

        // 3. Attempting to submit again with the same OTP should fail
        await expect(submissionService.submitForm('hardening-test', payload, testOtp))
            .rejects.toThrow('OTP not found or expired');
    });

    test('AJV custom formats textarea and file type checks', async () => {
        // Prepare OTP
        const otpHash = crypto.createHash('sha256').update(testOtp).digest('hex');
        await otpStore.set(testEmail, { otpHash });

        // Invalid textarea type (e.g. number instead of string)
        const invalidTextareaPayload = {
            email: testEmail,
            notes: 12345, // should be a string
            attachment: 'file.png'
        };

        await expect(submissionService.submitForm('hardening-test', invalidTextareaPayload, testOtp))
            .rejects.toThrow('notes');

        // Invalid file type (e.g. object instead of string or array of strings)
        await otpStore.set(testEmail, { otpHash }); // reset OTP
        const invalidFilePayload = {
            email: testEmail,
            notes: 'Valid string',
            attachment: { name: 'invalid_object' } // should be string or array of strings
        };

        await expect(submissionService.submitForm('hardening-test', invalidFilePayload, testOtp))
            .rejects.toThrow('attachment');

        // Valid array of strings for file format
        await otpStore.set(testEmail, { otpHash }); // reset OTP
        const validFileArrayPayload = {
            email: testEmail,
            notes: 'Valid string',
            attachment: ['file1.png', 'file2.png']
        };

        const submission = await submissionService.submitForm('hardening-test', validFileArrayPayload, testOtp);
        expect(submission).toBeDefined();
    });

    test('queryService search queries escape wildcards and search by email', async () => {
        // Seed some submissions with distinct emails to search for
        const targetEmail = `specific${Date.now()}@test.com`;
        const wildcardEmail1 = `wild_percent_%_${Date.now()}@test.com`;
        const wildcardEmail2 = `wild_underscore___${Date.now()}@test.com`;

        const formId = 'HARDENING_FORM_ID';

        // Insert directly to bypass OTP validation for test setup
        const id1 = ulid();
        await db.query(`
            INSERT INTO form_submissions (id, form_id, data, status, submitted_email)
            VALUES (?, ?, ?, 'pending', ?)
        `, [id1, formId, JSON.stringify({ email: targetEmail }), targetEmail]);

        const id2 = ulid();
        await db.query(`
            INSERT INTO form_submissions (id, form_id, data, status, submitted_email)
            VALUES (?, ?, ?, 'pending', ?)
        `, [id2, formId, JSON.stringify({ email: wildcardEmail1 }), wildcardEmail1]);

        // Search for % wildcard literal (should only match wildcardEmail1, not targetEmail or others)
        const searchPercentResult = await queryService.listSubmissions('hardening-test', { search: '%' });
        expect(searchPercentResult.items.some(item => item.id === id2)).toBe(true);
        expect(searchPercentResult.items.some(item => item.id === id1)).toBe(false);

        // Search for _ wildcard literal (should match wildcardEmail1 or wildcardEmail2, but escaping should ensure specific matches)
        const searchUnderscoreResult = await queryService.listSubmissions('hardening-test', { search: '_' });
        // Since both wildcardEmail1 and wildcardEmail2 contain literal underscores, they match.
        // But targetEmail has no underscore, so it should not match!
        expect(searchUnderscoreResult.items.some(item => item.id === id1)).toBe(false);
    });
});
