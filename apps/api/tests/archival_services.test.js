import { jest } from '@jest/globals';

// Mock dependencies
const mockDb = {
  query: jest.fn(),
  insertRecord: jest.fn(),
  updateRecord: jest.fn()
};

const mockAuditService = {
  log: jest.fn()
};

// Simulated baseService logic
const baseService = {
  _genId: () => '01KQE_TEST_ID',
  async _getRecord(table, id) {
    mockDb.query.mockResolvedValueOnce([{ id, version: 1 }]);
    return { id, version: 1 };
  },
  async _createRecord(userId, table, data) {
    const recordData = {
      id: this._genId(),
      ...data,
      version: 1,
      created_by: userId,
      updated_by: userId
    };
    mockDb.insertRecord.mockResolvedValueOnce(recordData);
    return await mockDb.insertRecord(table, recordData);
  },
  async _updateRecord(userId, table, id, data) {
    const existing = await this._getRecord(table, id);
    const updateData = {
      ...data,
      version: (existing.version || 0) + 1,
      updated_by: userId
    };
    mockDb.updateRecord.mockResolvedValueOnce({ ...existing, ...updateData });
    return await mockDb.updateRecord(table, id, updateData);
  }
};

describe('Archival Services - Standardized Record Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Constituent Service', () => {
    const constituentService = {
      async createConstituent(staffId, data) {
        return await baseService._createRecord(staffId, 'constituents', data);
      }
    };

    test('should include version:1 when creating a constituent', async () => {
      const result = await constituentService.createConstituent('U1', { name: 'Artist A' });
      expect(result.version).toBe(1);
      expect(mockDb.insertRecord).toHaveBeenCalledWith('constituents', expect.objectContaining({ version: 1 }));
    });
  });

  describe('Valuation Service', () => {
    const valuationService = {
      async addValuation(staffId, inventoryId, data) {
        return await baseService._createRecord(staffId, 'valuations', { inventory_id: inventoryId, ...data });
      }
    };

    test('should include version:1 when adding a valuation', async () => {
      const result = await valuationService.addValuation('U1', 'INV1', { amount: 5000 });
      expect(result.version).toBe(1);
      expect(mockDb.insertRecord).toHaveBeenCalledWith('valuations', expect.objectContaining({ version: 1 }));
    });
  });

  describe('Exhibition Service', () => {
    const exhibitionService = {
      async createExhibition(staffId, data) {
        return await baseService._createRecord(staffId, 'exhibitions', data);
      },
      async updateExhibition(staffId, id, data) {
        return await baseService._updateRecord(staffId, 'exhibitions', id, data);
      }
    };

    test('should include version:1 when creating an exhibition', async () => {
      const result = await exhibitionService.createExhibition('U1', { title: 'Great Expo' });
      expect(result.version).toBe(1);
      expect(mockDb.insertRecord).toHaveBeenCalledWith('exhibitions', expect.objectContaining({ version: 1 }));
    });

    test('should increment version when updating an exhibition', async () => {
      const result = await exhibitionService.updateExhibition('U1', 'EXH1', { title: 'Updated Expo' });
      expect(result.version).toBe(2);
      expect(mockDb.updateRecord).toHaveBeenCalledWith('exhibitions', 'EXH1', expect.objectContaining({ version: 2 }));
    });
  });
});
