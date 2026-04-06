// import { performanceMonitor } from '../utils/performance'; // Unused for now

import { supabase } from '../lib/supabase';

interface ErrorLog {
  message: string;
  stack?: string;
  timestamp: string;
  userAgent: string;
  url: string;
  userId?: string;
  tenantId?: string;
  severity?: 'error' | 'warning' | 'info';
}

interface PerformanceLog {
  metric: string;
  value: number;
  timestamp: string;
  page: string;
  userId?: string;
  tenantId?: string;
}

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: boolean;
    api: boolean;
    auth: boolean;
    storage: boolean;
  };
  metrics: {
    errorRate: number;
    avgResponseTime: number;
    activeUsers: number;
  };
  timestamp: string;
}

class MonitoringService {
  private errorLogs: ErrorLog[] = [];
  private performanceLogs: PerformanceLog[] = [];
  private maxLogs = 100;

  constructor() {
    this.setupErrorHandling();
    this.setupPerformanceMonitoring();
  }

  private setupErrorHandling() {
    if (typeof window === 'undefined') return;

    // Catch unhandled errors
    window.addEventListener('error', (event) => {
      this.logError({
        message: event.message,
        stack: event.error?.stack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      });
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      });
    });
  }

  private setupPerformanceMonitoring() {
    if (typeof window === 'undefined') return;

    // Monitor page load
    window.addEventListener('load', () => {
      setTimeout(() => {
        const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

        if (perfData) {
          this.logPerformance('page-load', perfData.loadEventEnd - perfData.fetchStart, window.location.pathname);
          this.logPerformance('dom-content-loaded', perfData.domContentLoadedEventEnd - perfData.fetchStart, window.location.pathname);
          this.logPerformance('first-paint', perfData.responseEnd - perfData.fetchStart, window.location.pathname);
        }
      }, 0);
    });
  }

  logError(error: ErrorLog) {
    this.errorLogs.push(error);

    // Keep only recent logs
    if (this.errorLogs.length > this.maxLogs) {
      this.errorLogs.shift();
    }

    // Log to database for persistence
    this.persistErrorLog(error);

    // Send to Sentry if available
    try {
      import('./errorTracking').then(({ captureException }) => {
        const err = new Error(error.message);
        if (error.stack) err.stack = error.stack;
        const contexts: any = {};
        if (error.url) contexts.url = error.url;
        if (error.userAgent) contexts.userAgent = error.userAgent;
        if (error.timestamp) contexts.timestamp = error.timestamp;
        captureException(err, { errorLog: contexts });
      }).catch(() => {
        // Sentry not available, just log
        console.error('[Error Logged]:', error);
      });
    } catch (e) {
      // Sentry not available, just log
      console.error('[Error Logged]:', error);
    }
  }

  private async persistErrorLog(error: ErrorLog) {
    try {
      await supabase.from('error_logs').insert({
        message: error.message,
        stack: error.stack,
        user_agent: error.userAgent,
        url: error.url,
        user_id: error.userId,
        tenant_id: error.tenantId,
        severity: error.severity || 'error',
        created_at: error.timestamp
      });
    } catch (err) {
      // Silently fail if database logging fails
      console.error('[Failed to persist error log]:', err);
    }
  }

  logPerformance(metric: string, value: number, page: string) {
    const log: PerformanceLog = {
      metric,
      value,
      timestamp: new Date().toISOString(),
      page,
    };

    this.performanceLogs.push(log);

    if (this.performanceLogs.length > this.maxLogs) {
      this.performanceLogs.shift();
    }

    // Warn on slow performance
    const thresholds: Record<string, number> = {
      'page-load': 3000,
      'dom-content-loaded': 2000,
      'api-request': 2000,
      'component-render': 100,
    };

    if (value > (thresholds[metric] || 1000)) {
      console.warn(`[Performance Warning] ${metric} took ${value.toFixed(2)}ms (threshold: ${thresholds[metric] || 1000}ms)`);
    }
  }

  trackApiCall(url: string, method: string, duration: number, success: boolean) {
    this.logPerformance(`api-${method.toLowerCase()}`, duration, url);

    if (!success) {
      this.logError({
        message: `API call failed: ${method} ${url}`,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      });
    }
  }

  trackComponentRender(componentName: string, duration: number) {
    this.logPerformance(`component-${componentName}`, duration, window.location.pathname);
  }

  getErrorLogs(): ErrorLog[] {
    return [...this.errorLogs];
  }

  getPerformanceLogs(): PerformanceLog[] {
    return [...this.performanceLogs];
  }

  getAveragePerformance(metric: string): number {
    const logs = this.performanceLogs.filter((log) => log.metric === metric);
    if (logs.length === 0) return 0;

    const sum = logs.reduce((acc: number, log: PerformanceLog) => acc + log.value, 0);
    return sum / logs.length;
  }

  clearLogs() {
    this.errorLogs = [];
    this.performanceLogs = [];
  }

  // Health check
  async getHealthStatus(): Promise<HealthCheck> {
    const recentErrors = this.errorLogs.filter(
      (log) => new Date(log.timestamp).getTime() > Date.now() - 60000 // Last minute
    );

    const avgPageLoad = this.getAveragePerformance('page-load');
    const avgApiRequest = this.getAveragePerformance('api-request');

    // Check database connectivity
    let databaseHealthy = false;
    try {
      const { error } = await supabase.from('tenants').select('id').limit(1);
      databaseHealthy = !error;
    } catch (e) {
      databaseHealthy = false;
    }

    // Check auth service
    let authHealthy = false;
    try {
      const { data } = await supabase.auth.getSession();
      authHealthy = data !== null;
    } catch (e) {
      authHealthy = false;
    }

    // Check storage
    let storageHealthy = false;
    try {
      const { error } = await supabase.storage.listBuckets();
      storageHealthy = !error;
    } catch (e) {
      storageHealthy = false;
    }

    // Calculate overall status
    const checksPassed = [databaseHealthy, authHealthy, storageHealthy].filter(Boolean).length;
    const totalChecks = 3;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (checksPassed === totalChecks && recentErrors.length < 5 && avgPageLoad < 3000) {
      status = 'healthy';
    } else if (checksPassed >= totalChecks - 1 && recentErrors.length < 10 && avgPageLoad < 5000) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      checks: {
        database: databaseHealthy,
        api: true, // Assuming API is healthy if we're running this
        auth: authHealthy,
        storage: storageHealthy
      },
      metrics: {
        errorRate: recentErrors.length,
        avgResponseTime: avgPageLoad,
        activeUsers: 0 // Would need to be calculated from active sessions
      },
      timestamp: new Date().toISOString()
    };
  }

  // Export logs for debugging
  exportLogs() {
    return {
      errors: this.getErrorLogs(),
      performance: this.getPerformanceLogs(),
      health: this.getHealthStatus(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };
  }
}

export const monitoringService = new MonitoringService();

// Global error boundary integration
export function setupGlobalMonitoring() {
  if (typeof window !== 'undefined') {
    // Expose monitoring service for debugging
    (window as any).__monitoring = monitoringService;

    console.log('[Monitoring] Service initialized. Access via window.__monitoring');
  }
}

