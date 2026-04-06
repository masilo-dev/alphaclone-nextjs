/**
 * Test Suite for Cron Service
 * 
 * Tests for automated recurring invoice processing
 */

import { cronService } from '../cronService';

// Mock Supabase client
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

describe('Cron Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('shouldGenerateInvoice', () => {
    it('should return false for future start dates', () => {
      const config = {
        id: '1',
        clientName: 'Test Client',
        amount: '100.00',
        frequency: 'monthly' as const,
        startDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        description: 'Test',
        tenantId: 'tenant-1',
        createdAt: new Date().toISOString(),
      };

      const result = cronService.shouldGenerateInvoice(config, new Date());
      expect(result).toBe(false);
    });

    it('should return true for past start date with no last generation', () => {
      const config = {
        id: '1',
        clientName: 'Test Client',
        amount: '100.00',
        frequency: 'monthly' as const,
        startDate: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        description: 'Test',
        tenantId: 'tenant-1',
        createdAt: new Date().toISOString(),
      };

      const result = cronService.shouldGenerateInvoice(config, new Date());
      expect(result).toBe(true);
    });

    it('should return false for same month with monthly frequency', () => {
      const today = new Date();
      const lastMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      const config = {
        id: '1',
        clientName: 'Test Client',
        amount: '100.00',
        frequency: 'monthly' as const,
        startDate: lastMonth.toISOString(),
        description: 'Test',
        tenantId: 'tenant-1',
        createdAt: lastMonth.toISOString(),
        lastGenerated: today.toISOString(),
      };

      const result = cronService.shouldGenerateInvoice(config, today);
      expect(result).toBe(false);
    });

    it('should return true for different month with monthly frequency', () => {
      const today = new Date();
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      
      const config = {
        id: '1',
        clientName: 'Test Client',
        amount: '100.00',
        frequency: 'monthly' as const,
        startDate: lastMonth.toISOString(),
        description: 'Test',
        tenantId: 'tenant-1',
        createdAt: lastMonth.toISOString(),
        lastGenerated: lastMonth.toISOString(),
      };

      const result = cronService.shouldGenerateInvoice(config, today);
      expect(result).toBe(true);
    });
  });

  describe('Date comparison helpers', () => {
    it('should correctly identify different days', () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-02');
      expect(cronService.isDifferentDay(date1, date2)).toBe(true);
    });

    it('should correctly identify same day', () => {
      const date1 = new Date('2024-01-01T10:00:00');
      const date2 = new Date('2024-01-01T15:00:00');
      expect(cronService.isDifferentDay(date1, date2)).toBe(false);
    });

    it('should correctly identify different months', () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-02-01');
      expect(cronService.isDifferentMonth(date1, date2)).toBe(true);
    });

    it('should correctly identify different years', () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2025-01-01');
      expect(cronService.isDifferentYear(date1, date2)).toBe(true);
    });
  });

  describe('isDifferentWeek', () => {
    it('should return true for dates 8 days apart', () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-09');
      expect(cronService.isDifferentWeek(date1, date2)).toBe(true);
    });

    it('should return false for dates 6 days apart', () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-07');
      expect(cronService.isDifferentWeek(date1, date2)).toBe(false);
    });
  });
});
