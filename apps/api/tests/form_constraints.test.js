import { db } from '../src/config/db.js';
import { initMariaDB as initDb } from '../src/config/dbInit.js';
import { definitionService } from '../src/services/form/definitionService.js';
import { ulid } from 'ulidx';

describe('Form Constraints Tests', () => {
    beforeAll(async () => {
        await initDb();
    });

    test('createDefinition rejects non-custom types', async () => {
        const payload = {
            slug: 'test-feedback-recreate',
            title: 'Feedback',
            type: 'feedback',
            schema_data: { type: "object", properties: {} },
            settings: {}
        };

        await expect(definitionService.createDefinition(payload))
            .rejects.toThrow('ONLY_CUSTOM_FORMS_ALLOWED');
    });

    test('createDefinition defaults type to custom', async () => {
        const payload = {
            slug: 'test-custom-success-' + Date.now(),
            title: 'Custom Form',
            schema_data: { type: "object", properties: {} },
            settings: {}
        };

        const res = await definitionService.createDefinition(payload);
        expect(res.type).toBe('custom');
    });

    test('updateDefinition rejects updates on system forms', async () => {
        // Seed a system form directly in the database
        const formId = '01JSEEDEDSYSTEMFORMID0001';
        await db.query(`
            REPLACE INTO form_definitions (id, slug, title, type, schema_data, settings, otp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [formId, 'system-feedback-form', 'System Feedback', 'feedback', '{}', '{}', false]);

        // Attempting to update a system form should fail
        await expect(definitionService.updateDefinition(formId, { title: 'Updated Title' }))
            .rejects.toThrow('SYSTEM_FORM_READONLY');
    });

    test('updateDefinition rejects updating custom form to a system type', async () => {
        // Create a custom form
        const payload = {
            slug: 'test-custom-to-system-' + Date.now(),
            title: 'Custom Form',
            type: 'custom',
            schema_data: { type: "object", properties: {} },
            settings: {}
        };
        const customForm = await definitionService.createDefinition(payload);

        // Attempting to update its type to 'donation' should fail
        await expect(definitionService.updateDefinition(customForm.id, { type: 'donation' }))
            .rejects.toThrow('ONLY_CUSTOM_FORMS_ALLOWED');
    });

    test('deleteDefinition rejects deletes on system forms', async () => {
        const formId = '01JSEEDEDSYSTEMFORMID0002';
        await db.query(`
            REPLACE INTO form_definitions (id, slug, title, type, schema_data, settings, otp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [formId, 'system-appointment-form', 'System Appointment', 'appointment', '{}', '{}', false]);

        // Attempting to delete a system form should fail
        await expect(definitionService.deleteDefinition(formId))
            .rejects.toThrow('SYSTEM_FORM_READONLY');
    });

    test('deleteDefinition allows deletes on custom forms', async () => {
        const payload = {
            slug: 'test-custom-to-delete-' + Date.now(),
            title: 'Custom Form to Delete',
            type: 'custom',
            schema_data: { type: "object", properties: {} },
            settings: {}
        };
        const customForm = await definitionService.createDefinition(payload);

        // Should succeed
        const res = await definitionService.deleteDefinition(customForm.id);
        expect(res.id).toBe(customForm.id);
    });
});
