import { db } from '../src/config/db.js';
import { initMariaDB as initDb } from '../src/config/dbInit.js';
import { userService } from '../src/services/userService.js';
import { locationService } from '../src/services/acquisition/locationService.js';
import { intakeService } from '../src/services/acquisition/intakeService.js';
import { accessionService } from '../src/services/acquisition/accessionService.js';
import { inventoryService } from '../src/services/acquisition/inventoryService.js';
import { valuationService } from '../src/services/acquisition/valuationService.js';
import { exhibitionService } from '../src/services/acquisition/exhibitionService.js';
import { loanService } from '../src/services/acquisition/loanService.js';
import { ulid } from 'ulidx';

describe('Inventory, Location and Valuation Hardening Tests', () => {
    let testUserId;

    beforeAll(async () => {
        await initDb();
        const users = await userService.listUsers();
        if (users.length > 0) {
            testUserId = users[0].id;
        } else {
            throw new Error('No users found in database for testing.');
        }
    });

    describe('locationService', () => {
        test('Prevent duplicate location names (case-insensitive)', async () => {
            const locName = `Unique Vault ${Date.now()}`;
            await locationService.createLocation(testUserId, {
                name: locName,
                type: 'storage',
                description: 'Unique test vault'
            });

            // Try creating the same location name case-insensitively
            await expect(locationService.createLocation(testUserId, {
                name: locName.toLowerCase(),
                type: 'storage'
            })).rejects.toThrow('already exists');
        });

        test('Generate unique, collision-free LOC-XXXXXX IDs', async () => {
            const locName = `Unique Lab ${Date.now()}`;
            const loc = await locationService.createLocation(testUserId, {
                name: locName,
                type: 'lab'
            });
            expect(loc.id).toMatch(/^LOC-[A-Z0-9]{6}$/);
        });
    });

    describe('inventoryService - Location Validation', () => {
        let testAccessionId;

        beforeAll(async () => {
            // Setup a complete chain of intake -> accession to test finalization
            const submissionId = ulid();

            // Find existing form definition for donation-form
            const [formDef] = await db.query("SELECT id FROM form_definitions WHERE slug = 'donation-form' LIMIT 1");
            const formId = formDef ? formDef.id : '01KQE81CSDZ6D68JYXB34JXZX5';

            // Insert a dummy form submission to satisfy foreign key constraints
            await db.query(`
                INSERT INTO form_submissions (id, form_id, data, status)
                VALUES (?, ?, ?, ?)
            `, [submissionId, formId, '{}', 'pending']);

            const intakeData = { itemName: `Hardened Artifact ${Date.now()}`, quantity: 1 };
            const { intake } = await intakeService.registerExternalIntake(
                testUserId,
                submissionId,
                testUserId,
                'Donor Name',
                'gift',
                intakeData
            );

            // Approve and accession
            await intakeService.approveIntake(testUserId, intake.id);
            
            // Set up delivery slip and token
            const docOverrides = { donorName: 'Donor Name' };
            const moaRes = await intakeService.generateDynamicMOA(testUserId, intake.id, docOverrides);
            const token = moaRes.qrPayload.token;
            await intakeService.confirmPhysicalDelivery(testUserId, intake.id, token);

            // Create accession
            const accessionData = {
                handlingInstructions: 'Handle with care',
                isMoaSigned: true,
                conditionReport: 'Excellent'
            };
            const accession = await accessionService.processAccession(testUserId, intake.id, accessionData);
            
            // Approve the accession to move it to 'in_research'
            await accessionService.approveAccession(testUserId, accession.id, 'Approved for testing');
            
            // Complete research and upload mock signed MOA to allow finalization
            await accessionService.updateAccessionResearch(testUserId, accession.id, {
                dimensions: '10x10x10',
                materials: 'Gold',
                historical_significance: 'Extremely high',
                research_completed: true
            });
            await db.query('UPDATE accessions SET signed_moa = 1 WHERE id = ?', [accession.id]);
            const mediaId = ulid();
            await db.query(`
                INSERT INTO media_metadata (id, file_name, storage_key, mime_type, size_bytes, uploaded_by)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [mediaId, 'moa.pdf', `key-${mediaId}`, 'application/pdf', 100, testUserId]);
            await db.query(
                `INSERT INTO media_links (id, media_id, entity_type, entity_id, context) VALUES (?, ?, ?, ?, ?)`,
                [ulid(), mediaId, 'accession', accession.id, 'Signed MOA Document']
            );

            testAccessionId = accession.id;
        });

        test('finalizeToInventory rejects invalid location names', async () => {
            const invalidInventoryData = {
                location: 'Non-Existent Mystic Vault',
                imageSkipReason: 'Mock reason'
            };

            await expect(inventoryService.finalizeToInventory(testUserId, testAccessionId, invalidInventoryData))
                .rejects.toThrow('does not exist');

            // Assert transaction rolled back and no inventory row was created
            const countRes = await db.query('SELECT COUNT(*) as count FROM inventory WHERE accession_id = ?', [testAccessionId]);
            expect(Number(countRes[0].count)).toBe(0);
        });

        test('finalizeToInventory accepts whitelisted virtual and valid database locations', async () => {
            const validInventoryData = {
                location: 'Main Vault', // seeded location
                imageSkipReason: 'Mock reason'
            };

            const item = await inventoryService.finalizeToInventory(testUserId, testAccessionId, validInventoryData);
            expect(item).toBeDefined();
            expect(item.current_location).toBe('Main Vault');

            // Test movement validation: Reject movement to invalid location
            await expect(inventoryService.transferLocation(testUserId, item.id, 'Non-Existent Place', 'Moving for fun'))
                .rejects.toThrow('does not exist');

            // Test movement validation: Accept movement to valid locations or whitelisted locations
            const updatedItem = await inventoryService.transferLocation(testUserId, item.id, 'Conservation Lab', 'Moving for restoration');
            expect(updatedItem.current_location).toBe('Conservation Lab');
        });
    });

    describe('valuationService Validation Rules', () => {
        let testInventoryId;

        beforeAll(async () => {
            const rows = await db.query('SELECT id FROM inventory LIMIT 1');
            if (rows.length > 0) {
                testInventoryId = rows[0].id;
            } else {
                throw new Error('Test requires at least one inventory item.');
            }
        });

        test('amount must be positive', async () => {
            await expect(valuationService.addValuation(testUserId, testInventoryId, {
                amount: -100,
                currency: 'USD',
                reason: 'Insurance'
            })).rejects.toThrow('positive number');

            await expect(valuationService.addValuation(testUserId, testInventoryId, {
                amount: 0,
                currency: 'USD',
                reason: 'Insurance'
            })).rejects.toThrow('positive number');
        });

        test('currency must be 3-character ISO code', async () => {
            await expect(valuationService.addValuation(testUserId, testInventoryId, {
                amount: 1000,
                currency: 'USDT',
                reason: 'Insurance'
            })).rejects.toThrow('3-letter ISO code');

            await expect(valuationService.addValuation(testUserId, testInventoryId, {
                amount: 1000,
                currency: 'US',
                reason: 'Insurance'
            })).rejects.toThrow('3-letter ISO code');
        });

        test('date must not be in the future', async () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 2); // 2 days in the future
            const futureStr = futureDate.toISOString().split('T')[0];

            await expect(valuationService.addValuation(testUserId, testInventoryId, {
                amount: 1000,
                currency: 'PHP',
                date: futureStr,
                reason: 'Insurance'
            })).rejects.toThrow('cannot be in the future');

            const validDate = new Date().toISOString().split('T')[0];
            const valuation = await valuationService.addValuation(testUserId, testInventoryId, {
                amount: 1000,
                currency: 'PHP',
                date: validDate,
                reason: 'Insurance'
            });
            expect(valuation).toBeDefined();
            expect(valuation.amount).toBe(1000);
        });
    });

    describe('exhibitionService updateExhibition fix', () => {
        test('updateExhibition successfully updates record', async () => {
            const exhibition = await exhibitionService.createExhibition(testUserId, {
                title: 'Test Exhibition',
                venue: 'Gallery Alpha',
                startDate: '2026-06-01',
                endDate: '2026-06-30',
                description: 'Test exhibition description',
                status: 'planning'
            });

            expect(exhibition).toBeDefined();
            expect(exhibition.id).toBeDefined();

            // Update title
            const updated = await exhibitionService.updateExhibition(testUserId, exhibition.id, {
                title: 'Updated Test Exhibition Title'
            });
            expect(updated).toBeDefined();
            expect(updated.title).toBe('Updated Test Exhibition Title');
        });
    });

    describe('inventoryService - Status Auto-Derivation and Deadlock Prevention', () => {
        let testInvId;

        beforeAll(async () => {
            const rows = await db.query('SELECT id FROM inventory LIMIT 1');
            if (rows.length > 0) {
                testInvId = rows[0].id;
                // Force status to active and clear deaccession reasons to allow testing
                await db.query("UPDATE inventory SET status = 'active', deaccession_reason = null, manual_status_override = 0 WHERE id = ?", [testInvId]);
                await db.query("DELETE FROM condition_reports WHERE entity_type = 'inventory' AND entity_id = ?", [testInvId]);
            } else {
                throw new Error('Test requires at least one inventory item.');
            }
        });

        test('transferLocation executes without deadlock and auto-derives status', async () => {
            await db.query("UPDATE inventory SET status = 'active', manual_status_override = 0 WHERE id = ?", [testInvId]);

            const item = await inventoryService.transferLocation(testUserId, testInvId, 'Main Vault', 'Move to vault');
            expect(item.current_location).toBe('Main Vault');
            expect(item.status).toBe('storage');

            const item2 = await inventoryService.transferLocation(testUserId, testInvId, 'Receiving Bay', 'Move to bay');
            expect(item2.current_location).toBe('Receiving Bay');
            expect(item2.status).toBe('active');
        });

        test('batchTransfer correctly updates status for multiple items', async () => {
            const items = await db.query('SELECT id FROM inventory LIMIT 2');
            const ids = items.map(i => i.id);
            await db.query("UPDATE inventory SET status = 'active', manual_status_override = 0 WHERE id IN (?)", [ids]);
            await db.query("DELETE FROM condition_reports WHERE entity_type = 'inventory' AND entity_id IN (?)", [ids]);
            const result = await inventoryService.batchTransfer(testUserId, ids, 'Main Vault', 'Batch move to vault');
            expect(result.items[0].status).toBe('storage');
            if (ids.length > 1) {
                expect(result.items[1].status).toBe('storage');
            }
        });

        test('recordAuditCheck condition degradation drives maintenance status', async () => {
            await db.query("UPDATE inventory SET status = 'active', manual_status_override = 0 WHERE id = ?", [testInvId]);
            const audit = await inventoryService.recordAuditCheck(testUserId, testInvId, {
                auditType: 'spot_check',
                locationVerified: true,
                objectFound: true,
                numberLegible: true,
                conditionConsistent: false,
                observedCondition: 'Poor',
                discrepancyNotes: 'Deteriorated'
            });
            expect(audit).toBeDefined();

            const [item] = await db.query('SELECT status FROM inventory WHERE id = ?', [testInvId]);
            expect(item.status).toBe('maintenance');
        });

        test('cancelDeaccession auto-derives active status correctly', async () => {
            await db.query("UPDATE inventory SET status = 'active', manual_status_override = 0 WHERE id = ?", [testInvId]);
            await db.query("UPDATE inventory SET status = 'deaccession_pending' WHERE id = ?", [testInvId]);
            
            const updated = await inventoryService.cancelDeaccession(testUserId, testInvId);
            expect(updated.status).not.toBe('deaccession_pending');
            expect(['storage', 'maintenance', 'active']).toContain(updated.status);
        });
    });

    describe('loanService - Return Loan Status Auto-Derivation', () => {
        let testInvId;

        beforeAll(async () => {
            const rows = await db.query('SELECT id FROM inventory LIMIT 1');
            if (rows.length > 0) {
                testInvId = rows[0].id;
                await db.query("UPDATE inventory SET status = 'active', deaccession_reason = null, manual_status_override = 0 WHERE id = ?", [testInvId]);
                await db.query("DELETE FROM condition_reports WHERE entity_type = 'inventory' AND entity_id = ?", [testInvId]);
            }
        });

        test('returnLoan invokes autoDeriveArtifactStatus and updates item status based on location', async () => {
            await db.query("UPDATE inventory SET status = 'active', manual_status_override = 0 WHERE id = ?", [testInvId]);
            const loan = await loanService.createLoan(testUserId, {
                loan_type: 'outbound',
                venue: 'External Gallery',
                status: 'draft',
                start_date: '2026-06-01',
                end_date: '2026-06-30',
                artifacts: [testInvId]
            });
            expect(loan).toBeDefined();

            await loanService.activateLoan(testUserId, loan.id);
            const [itemOnLoan] = await db.query('SELECT status FROM inventory WHERE id = ?', [testInvId]);
            expect(itemOnLoan.status).toBe('loan');

            await loanService.returnLoan(testUserId, loan.id, { reason: 'Returned early' });

            const [itemReturned] = await db.query('SELECT status FROM inventory WHERE id = ?', [testInvId]);
            expect(itemReturned.status).toBe('storage');
        });
    });

    describe('exhibitionService - Validations', () => {
        test('createExhibition rejects empty title or venue', async () => {
            await expect(exhibitionService.createExhibition(testUserId, {
                title: '',
                venue: 'Gallery Alpha'
            })).rejects.toThrow('Title is required');

            await expect(exhibitionService.createExhibition(testUserId, {
                title: 'Exhibition',
                venue: ''
            })).rejects.toThrow('Venue is required');
            
            await expect(exhibitionService.createExhibition(testUserId, {
                title: null,
                venue: 'Gallery Alpha'
            })).rejects.toThrow('Title is required');
        });

        test('createExhibition rejects invalid date format', async () => {
            await expect(exhibitionService.createExhibition(testUserId, {
                title: 'Exhibition',
                venue: 'Gallery Alpha',
                startDate: '26-05-2026'
            })).rejects.toThrow('YYYY-MM-DD');

            await expect(exhibitionService.createExhibition(testUserId, {
                title: 'Exhibition',
                venue: 'Gallery Alpha',
                startDate: '2026-02-30'
            })).rejects.toThrow('Invalid calendar date');
        });

        test('createExhibition rejects start date after end date', async () => {
            await expect(exhibitionService.createExhibition(testUserId, {
                title: 'Exhibition',
                venue: 'Gallery Alpha',
                startDate: '2026-06-30',
                endDate: '2026-06-01'
            })).rejects.toThrow('Start date cannot be after end date');
        });

        test('updateExhibition validations and camelCase handling', async () => {
            const exhibition = await exhibitionService.createExhibition(testUserId, {
                title: 'Valid Exhibition',
                venue: 'Gallery Beta',
                startDate: '2026-06-01',
                endDate: '2026-06-30'
            });

            await expect(exhibitionService.updateExhibition(testUserId, exhibition.id, {
                title: ''
            })).rejects.toThrow('Title must be a non-empty string');

            await expect(exhibitionService.updateExhibition(testUserId, exhibition.id, {
                startDate: '2026-07-01'
            })).rejects.toThrow('Start date cannot be after end date');

            const updated = await exhibitionService.updateExhibition(testUserId, exhibition.id, {
                startDate: '2026-06-10',
                endDate: '2026-06-25'
            });
            expect(updated.start_date).toBe('2026-06-10');
            expect(updated.end_date).toBe('2026-06-25');
        });
    });
});
