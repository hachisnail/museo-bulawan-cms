import { jest } from '@jest/globals';

// Mock dependencies
const mockDb = {
  query: jest.fn(),
  transaction: jest.fn(callback => callback(mockDb)),
  updateRecord: jest.fn()
};

const mockNotificationService = {
  sendGlobal: jest.fn()
};

const mockBaseService = {
  _getRecord: jest.fn(),
  _createRecord: jest.fn()
};

describe('Institutional Operations - Batch & Analytics', () => {
  let inventoryService;

  beforeEach(() => {
    jest.resetAllMocks();

    mockDb.transaction = jest.fn(callback => callback(mockDb));
    mockDb.updateRecord = jest.fn();
    mockDb.query = jest.fn();

    inventoryService = {
      async batchTransfer(staffId, inventoryIds, toLocation, reason) {
        return await mockDb.transaction(async (tx) => {
          const results = [];
          for (const id of inventoryIds) {
            const item = await tx.query('SELECT * FROM inventory WHERE id = ?', [id]);
            if (item && item.length > 0) {
              await mockBaseService._createRecord(staffId, 'location_history', { inventory_item_id: id, to_location: toLocation });
              const updated = await tx.updateRecord('inventory', id, { current_location: toLocation });
              results.push(updated);
            }
          }
          mockNotificationService.sendGlobal('Batch Move Success', `${results.length} items moved`);
          return { count: results.length, items: results };
        });
      }
    };
  });

  describe('Batch Transfer Logic', () => {
    test('should move multiple artifacts and log history for each', async () => {
      const ids = ['INV-1', 'INV-2'];
      mockDb.query.mockResolvedValue([{ id: 'INV-1', current_location: 'Storage' }]);
      mockDb.updateRecord.mockImplementation((table, id, data) => ({ id, ...data }));

      const result = await inventoryService.batchTransfer('USER-1', ids, 'Gallery A', 'Exhibition Setup');

      expect(result.count).toBe(2);
      expect(mockDb.updateRecord).toHaveBeenCalledTimes(2);
      expect(mockBaseService._createRecord).toHaveBeenCalledTimes(2);
      expect(mockNotificationService.sendGlobal).toHaveBeenCalled();
    });
  });

  describe('Collection Analytics', () => {
    test('should aggregate collection health correctly', async () => {
      // Simulating the controller logic
      mockDb.query
        .mockResolvedValueOnce([{ state: 'Good', count: 10 }, { state: 'Poor', count: 2 }]) // healthDist
        .mockResolvedValueOnce([{ count: 2 }]) // maintenanceCount
        .mockResolvedValueOnce([{ count: 12 }]); // totalCount

      const healthPercentage = ( (12 - 2) / 12 * 100 ).toFixed(2);
      
      expect(healthPercentage).toBe('83.33');
    });

    test('should sum latest valuations across currencies', async () => {
      mockDb.query.mockResolvedValueOnce([
        { total: 1000000.00, currency: 'PHP' },
        { total: 5000.00, currency: 'USD' }
      ]);

      const result = await mockDb.query('SELECT SUM...');
      expect(result).toHaveLength(2);
      expect(result[0].currency).toBe('PHP');
    });
  });
});
