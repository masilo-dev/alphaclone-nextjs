import { supabase } from '@/lib/supabase';
import { tenantService } from './tenancy/TenantService';

export interface WorkerActivity {
  id: string;
  user_id: string;
  app_name: string;
  module_name?: string;
  action_type: string;
  entity_type?: string;
  entity_id?: string;
  page_path?: string;
  metadata?: Record<string, any>;
  session_start: string;
  duration_seconds?: number;
  clicks_count: number;
}

export interface ActiveWorker {
  tenant_id: string;
  user_id: string;
  user_email?: string;
  user_name?: string;
  app_name: string;
  module_name?: string;
  action_type: string;
  entity_type?: string;
  session_minutes: number;
  clicks_count: number;
  metadata?: Record<string, any>;
  device_type?: string;
  ip_address?: string;
}

export interface WorkerProductivity {
  work_date: string;
  total_activities: number;
  unique_apps: number;
  entities_touched: number;
  active_hours: number;
  productivity_score: number;
}

class WorkerTrackingService {
  private currentSessionId: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Log worker activity - call this when user performs any action
   */
  async logActivity(
    appName: string,
    actionType: 'view' | 'create' | 'edit' | 'delete' | 'export' | 'search' | 'click' | 'navigate',
    options?: {
      moduleName?: string;
      entityType?: string;
      entityId?: string;
      pagePath?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      const tenantId = tenantService.getCurrentTenantId();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!tenantId || !user) return;

      // Get device info
      const deviceType = this.getDeviceType();
      const browser = this.getBrowser();

      const { data, error } = await supabase.rpc('log_worker_activity', {
        p_tenant_id: tenantId,
        p_user_id: user.id,
        p_app_name: appName,
        p_module_name: options?.moduleName || null,
        p_action_type: actionType,
        p_entity_type: options?.entityType || null,
        p_entity_id: options?.entityId || null,
        p_page_path: options?.pagePath || window.location.pathname,
        p_metadata: options?.metadata || {},
        p_device_type: deviceType,
        p_browser: browser
      });

      if (error) throw error;
      
      if (data) {
        this.currentSessionId = data;
        this.startHeartbeat();
      }
    } catch (err) {
      console.warn('[WorkerTracking] Failed to log activity:', err);
    }
  }

  /**
   * End current session - call on logout or tab close
   */
  async endSession(): Promise<void> {
    if (!this.currentSessionId) return;
    
    try {
      await supabase.rpc('end_worker_session', {
        p_session_id: this.currentSessionId
      });
      
      this.stopHeartbeat();
      this.currentSessionId = null;
    } catch (err) {
      console.warn('[WorkerTracking] Failed to end session:', err);
    }
  }

  /**
   * Get all currently active workers (real-time)
   */
  async getActiveWorkers(): Promise<ActiveWorker[]> {
    try {
      const tenantId = tenantService.getCurrentTenantId();
      
      const { data, error } = await supabase
        .from('active_workers')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('session_start', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[WorkerTracking] Failed to get active workers:', err);
      return [];
    }
  }

  /**
   * Get worker productivity for a specific user
   */
  async getWorkerProductivity(
    userId: string,
    days: number = 7
  ): Promise<WorkerProductivity[]> {
    try {
      const tenantId = tenantService.getCurrentTenantId();
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { data, error } = await supabase.rpc('get_worker_productivity', {
        p_tenant_id: tenantId,
        p_user_id: userId,
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[WorkerTracking] Failed to get productivity:', err);
      return [];
    }
  }

  /**
   * Get daily summary for all workers
   */
  async getDailySummary(date?: string): Promise<any[]> {
    try {
      const tenantId = tenantService.getCurrentTenantId();
      const targetDate = date || new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('worker_daily_summary')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('work_date', targetDate)
        .order('total_activities', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[WorkerTracking] Failed to get daily summary:', err);
      return [];
    }
  }

  /**
   * Subscribe to real-time worker activity updates
   */
  subscribeToWorkerActivity(
    onUpdate: (workers: ActiveWorker[]) => void
  ): () => void {
    const tenantId = tenantService.getCurrentTenantId();
    
    const subscription = supabase
      .channel(`worker_activity:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'worker_sessions',
          filter: `tenant_id=eq.${tenantId}`
        },
        async () => {
          // Refresh active workers on any change
          const workers = await this.getActiveWorkers();
          onUpdate(workers);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }

  /**
   * Track page navigation
   */
  trackNavigation(appName: string, pagePath: string): void {
    this.logActivity(appName, 'navigate', { pagePath });
  }

  /**
   * Track entity view
   */
  trackView(appName: string, moduleName: string, entityType: string, entityId: string): void {
    this.logActivity(appName, 'view', {
      moduleName,
      entityType,
      entityId
    });
  }

  /**
   * Track creation
   */
  trackCreate(appName: string, moduleName: string, entityType: string, entityId: string, metadata?: any): void {
    this.logActivity(appName, 'create', {
      moduleName,
      entityType,
      entityId,
      metadata
    });
  }

  /**
   * Track edit
   */
  trackEdit(appName: string, moduleName: string, entityType: string, entityId: string): void {
    this.logActivity(appName, 'edit', {
      moduleName,
      entityType,
      entityId
    });
  }

  /**
   * Track search
   */
  trackSearch(appName: string, moduleName: string, query: string, resultsCount?: number): void {
    this.logActivity(appName, 'search', {
      moduleName,
      metadata: { query, results_count: resultsCount }
    });
  }

  /**
   * Track export
   */
  trackExport(appName: string, moduleName: string, entityType: string, format: string): void {
    this.logActivity(appName, 'export', {
      moduleName,
      entityType,
      metadata: { format }
    });
  }

  // Private helpers

  private startHeartbeat(): void {
    if (this.heartbeatInterval) return;
    
    // Send heartbeat every 2 minutes to keep session alive
    this.heartbeatInterval = setInterval(() => {
      if (this.currentSessionId) {
        supabase
          .from('worker_sessions')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', this.currentSessionId)
          .then(({ error }: { error: any }) => {
            if (error) {
              console.warn('[WorkerTracking] Heartbeat failed:', error);
            }
          });
      }
    }, 2 * 60 * 1000); // 2 minutes
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private getDeviceType(): string {
    const ua = navigator.userAgent;
    if (/Mobile|Android|iPhone/i.test(ua)) return 'mobile';
    if (/Tablet|iPad/i.test(ua)) return 'tablet';
    return 'desktop';
  }

  private getBrowser(): string {
    const ua = navigator.userAgent;
    if (/Chrome\//i.test(ua)) return 'Chrome';
    if (/Firefox\//i.test(ua)) return 'Firefox';
    if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'Safari';
    if (/Edg\//i.test(ua)) return 'Edge';
    return 'Unknown';
  }
}

export const workerTrackingService = new WorkerTrackingService();

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    workerTrackingService.endSession();
  });
}
