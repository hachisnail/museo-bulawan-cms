import { acquisitionService } from './src/services/acquisitionService.js';
import { mapDTO } from './src/utils/dtoMapper.js';

async function runTests() {
    console.log('--- Starting Modularization & DTO Tests ---');

    try {
        // 1. Check if facade is correctly populated
        const methods = Object.keys(acquisitionService);
        console.log(`Facade methods found: ${methods.length}`);
        
        const expectedMethods = [
            'registerExternalIntake', 'approveIntake', 'processAccession', 
            'finalizeToInventory', 'getInventoryItem'
        ];
        
        expectedMethods.forEach(m => {
            if (typeof acquisitionService[m] !== 'function') {
                throw new Error(`Missing method in facade: ${m}`);
            }
        });
        console.log('✅ Facade structure verified.');

        // 2. Test DTO Mapper
        const mockRecord = {
            id: '123',
            collectionId: 'pbc_123',
            collectionName: 'intakes',
            proposed_item_name: 'Test Item',
            expand: {
                submission_id: {
                    id: 'sub_1',
                    collectionName: 'form_submissions',
                    data: { key: 'value' }
                }
            }
        };

        const clean = mapDTO(mockRecord);
        if (clean.collectionId || clean.collectionName || clean.expand.submission_id.collectionName) {
            throw new Error('DTO Mapper failed to strip internal fields');
        }
        console.log('✅ DTO Mapper verified.');

        console.log('--- All Tests Passed Structurally! ---');
    } catch (error) {
        console.error('❌ Test Failed:', error.message);
        process.exit(1);
    }
}

runTests();
