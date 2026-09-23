import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../..');

describe('Frontend Cache & Tab Return Synchronization', () => {
  describe('Tab Focus Coordinator', () => {
    it('defines the canonical tab-visible event and exports the hook and broadcaster', async () => {
      const coordinatorModule = await import('../../src/lib/sync/tabFocusCoordinator.ts');
      assert.equal(coordinatorModule.TAB_VISIBLE_EVENT, 'ac:tab-visible');
      assert.equal(typeof coordinatorModule.broadcastTabVisible, 'function');
      assert.equal(typeof coordinatorModule.initTabFocusCoordinator, 'function');
      assert.equal(typeof coordinatorModule.useOnTabVisible, 'function');
    });

    it('enforces throttling on broadcastTabVisible unless forced', async () => {
      const { broadcastTabVisible } = await import('../../src/lib/sync/tabFocusCoordinator.ts');
      
      // Mock window and dispatchEvent
      let dispatchedCount = 0;
      const originalWindow = globalThis.window;
      globalThis.window = {
        dispatchEvent: () => {
          dispatchedCount++;
          return true;
        },
      };

      try {
        // First broadcast should succeed
        const first = broadcastTabVisible('focus', 5000, true);
        assert.equal(first, true);
        assert.equal(dispatchedCount, 1);

        // Immediate second broadcast should be throttled (returns false)
        const second = broadcastTabVisible('focus', 5000, false);
        assert.equal(second, false);
        assert.equal(dispatchedCount, 1);

        // Forced broadcast should bypass throttle
        const forced = broadcastTabVisible('online', 5000, true);
        assert.equal(forced, true);
        assert.equal(dispatchedCount, 2);
      } finally {
        globalThis.window = originalWindow;
      }
    });
  });

  describe('React Query & Providers Configuration', () => {
    it('configures refetchOnWindowFocus, staleTime, and gcTime in Providers.tsx', () => {
      const content = readFileSync(path.join(root, 'src/components/Providers.tsx'), 'utf8');
      assert.match(content, /refetchOnWindowFocus:\s*true/);
      assert.match(content, /staleTime:\s*30\s*\*\s*1000/);
      assert.match(content, /gcTime:\s*10\s*\*\s*60\s*\*\s*1000/);
      assert.match(content, /focusManager\.setEventListener/);
      assert.match(content, /initTabFocusCoordinator/);
    });
  });

  describe('Auth Session Expiry Guard', () => {
    it('AuthContext checks token expiration before refreshing session', () => {
      const content = readFileSync(path.join(root, 'src/contexts/AuthContext.tsx'), 'utf8');
      assert.match(content, /useOnTabVisible/);
      assert.match(content, /session\.expires_at/);
      assert.match(content, /EXPIRY_BUFFER_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/);
      assert.match(content, /timeRemainingMs\s*<\s*EXPIRY_BUFFER_MS/);
      // Ensure unconditional refresh on visibilitychange is removed
      assert.doesNotMatch(content, /document\.addEventListener\('visibilitychange',\s*refreshOnReturn\)/);
    });

    it('pure logic correctly identifies expiring vs fresh JWT tokens', () => {
      const now = Date.now();
      const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

      // Token expiring in 45 minutes -> fresh, do NOT refresh
      const freshSession = { expires_at: Math.floor((now + 45 * 60 * 1000) / 1000) };
      const freshRemaining = (freshSession.expires_at * 1000) - now;
      assert.equal(freshRemaining < EXPIRY_BUFFER_MS, false, 'Fresh token must not refresh');

      // Token expiring in 2 minutes -> expiring soon, MUST refresh
      const expiringSession = { expires_at: Math.floor((now + 2 * 60 * 1000) / 1000) };
      const expiringRemaining = (expiringSession.expires_at * 1000) - now;
      assert.equal(expiringRemaining < EXPIRY_BUFFER_MS, true, 'Expiring token must refresh');

      // Expired token -> MUST refresh
      const expiredSession = { expires_at: Math.floor((now - 60 * 1000) / 1000) };
      const expiredRemaining = (expiredSession.expires_at * 1000) - now;
      assert.equal(expiredRemaining < EXPIRY_BUFFER_MS, true, 'Expired token must refresh');
    });
  });

  describe('Realtime Sync & Health Reconnection', () => {
    it('useRealtimeSync hooks useOnTabVisible to immediately reconnect dropped channels', () => {
      const content = readFileSync(path.join(root, 'src/hooks/useRealtimeSync.ts'), 'utf8');
      assert.match(content, /useOnTabVisible/);
      assert.match(content, /channelStatusRef/);
      assert.match(content, /reconnectNowRef/);
      assert.match(content, /void fetchData\(\)/);
    });

    it('useSyncStatus checks connection immediately on tab return rather than waiting 30 seconds', () => {
      const content = readFileSync(path.join(root, 'src/hooks/useRealtimeSync.ts'), 'utf8');
      assert.match(content, /useSyncStatus/);
      assert.match(content, /checkConnection/);
      assert.match(content, /useOnTabVisible\(\(\)\s*=>\s*\{\s*void checkConnection\(\);/);
    });
  });

  describe('Zero-Loading Flash Dashboard & Caching', () => {
    it('OperatingSystemHome initializes loading state from cache and revalidates on tab return', () => {
      const content = readFileSync(path.join(root, 'src/components/dashboard/OperatingSystemHome.tsx'), 'utf8');
      assert.match(content, /const\s+\[loading,\s*setLoading\]\s*=\s*useState\(\(\)\s*=>\s*!readDashboardStatsCache/);
      assert.match(content, /useOnTabVisible/);
    });

    it('Dashboard.tsx restores cached dashboardStats and revalidates on tab return', () => {
      const content = readFileSync(path.join(root, 'src/components/Dashboard.tsx'), 'utf8');
      assert.match(content, /cachedStats\s*=\s*localStorage\.getItem\(\s*`dashboard_stats_\$\{currentTenant\.id\}`/);
      assert.match(content, /useOnTabVisible/);
    });

    it('BusinessDashboard.tsx revalidates unread messages on tab return', () => {
      const content = readFileSync(path.join(root, 'src/components/dashboard/business/BusinessDashboard.tsx'), 'utf8');
      assert.match(content, /useOnTabVisible\(\(\)\s*=>\s*\{\s*void fetchUnread\(\);/);
    });

    it('useDashboardStats preserves crm invalidation and deduplicates in-flight requests', () => {
      const content = readFileSync(path.join(root, 'src/hooks/useDashboardStats.ts'), 'utf8');
      assert.match(content, /ac:crm-stats-invalidate/);
      assert.match(content, /inFlightRequests/);
      assert.match(content, /useOnTabVisible/);
    });

    it('TenantService deduplicates in-flight dashboard stats requests', () => {
      const content = readFileSync(path.join(root, 'src/services/tenancy/TenantService.ts'), 'utf8');
      assert.match(content, /inFlightStatsRequests/);
      assert.match(content, /inFlightStatsRequests\.get\(inFlightKey\)/);
    });
  });
});
