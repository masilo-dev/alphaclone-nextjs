import { describe, it, expect, vi, beforeEach } from 'vitest';
import { messageService } from '../../services/messageService';

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => ({
            or: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn(() => ({
        subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
      })),
    })),
  },
}));

describe('messageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get messages for a user', async () => {
    const result = await messageService.getMessages('user-1', false, 100);
    expect(result).toHaveProperty('messages');
    expect(result).toHaveProperty('error');
  });

  it('should handle errors gracefully', async () => {
    const result = await messageService.getMessages('user-1', false, 100);
    expect(result.error).toBeNull();
  });
});

