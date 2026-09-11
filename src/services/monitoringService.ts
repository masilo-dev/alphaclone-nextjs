/**
 * Monitoring & Analytics Service - 120% Feature
 * Core Web Vitals, error tracking, and performance monitoring
 */

import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';

// Core Web Vitals thresholds
const WEB_VITALS_THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000 }, // Largest Contentful Paint
  FID: { good: 100, needsImprovement: 300 },    // First Input Delay
  CLS: { good: 0.1, needsImprovement: 0.25 },   // Cumulative Layout Shift
  FCP: { good: 1800, needsImprovement: 3000 },  // First Contentful Paint
  TTFB: { good: 800, needsImprovement: 1800 },  // Time to First Byte
  INP: { good: 200, needsImprovement: 500 },     // Interaction to Next Paint
};

type WebVitalName = keyof typeof WEB_VITALS_THRESHOLDS;
type WebVitalRating = 'good' | 'needs-improvement' | 'poor';

export interface WebVitalsMetric {
  name: WebVitalName;
  value: number;
  rating: WebVitalRating;
  delta?: number;
  id: string;
  navigationType?: string;
}

export interface ErrorReport {
  id?: string;
  tenantId?: string;
  userId?: string;
  message: string;
  stack?: string;
  component?: string;
  url: string;
  userAgent: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

export interface PerformanceEntry {
  name: string;
  startTime: number;
  duration: number;
  entryType: string;
}

/**
 * Initialize Core Web Vitals monitoring
 */
export function initWebVitalsMonitoring(): void {
  if (typeof window === 'undefined') return;

  // Check if PerformanceObserver is supported
  if (!('PerformanceObserver' in window)) {
    console.warn('[Monitoring] PerformanceObserver not supported');
    return;
  }

  // LCP - Largest Contentful Paint
  const lcpObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1] as PerformanceEntry;
    reportWebVital({
      name: 'LCP',
      value: lastEntry.startTime,
      rating: getRating('LCP', lastEntry.startTime),
      id: generateMetricId(),
    });
  });
  lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

  // FID - First Input Delay
  const fidObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    entries.forEach((entry) => {
      const fidEntry = entry as any;
      reportWebVital({
        name: 'FID',
        value: fidEntry.processingStart - fidEntry.startTime,
        rating: getRating('FID', fidEntry.processingStart - fidEntry.startTime),
        id: generateMetricId(),
      });
    });
  });
  fidObserver.observe({ entryTypes: ['first-input'] });

  // CLS - Cumulative Layout Shift
  let clsValue = 0;
  let clsEntries: any[] = [];

  const clsObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    entries.forEach((entry) => {
      const layoutShift = entry as any;
      if (!layoutShift.hadRecentInput) {
        clsValue += layoutShift.value;
        clsEntries.push(layoutShift);
      }
    });
  });
  clsObserver.observe({ entryTypes: ['layout-shift'] });

  // Report CLS on page visibility change
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && clsValue > 0) {
      reportWebVital({
        name: 'CLS',
        value: clsValue,
        rating: getRating('CLS', clsValue),
        id: generateMetricId(),
      });
      clsValue = 0;
      clsEntries = [];
    }
  });

  // FCP - First Contentful Paint
  const fcpObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    entries.forEach((entry) => {
      if ((entry as any).name === 'first-contentful-paint') {
        reportWebVital({
          name: 'FCP',
          value: entry.startTime,
          rating: getRating('FCP', entry.startTime),
          id: generateMetricId(),
        });
      }
    });
  });
  fcpObserver.observe({ entryTypes: ['paint'] });

  // TTFB - Time to First Byte
  window.addEventListener('load', () => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      reportWebVital({
        name: 'TTFB',
        value: navigation.responseStart,
        rating: getRating('TTFB', navigation.responseStart),
        id: generateMetricId(),
      });
    }
  });
}

/**
 * Get rating for a web vital metric
 */
function getRating(name: WebVitalName, value: number): WebVitalRating {
  const thresholds = WEB_VITALS_THRESHOLDS[name];
  if (!thresholds) return 'needs-improvement';

  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.needsImprovement) return 'needs-improvement';
  return 'poor';
}

/**
 * Generate unique metric ID
 */
function generateMetricId(): string {
  return crypto.randomUUID();
}

/**
 * Report web vital to analytics
 */
async function reportWebVital(metric: WebVitalsMetric): Promise<void> {
  // Send to analytics endpoint
  try {
    await fetch('/api/analytics/web-vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metric),
      keepalive: true,
    });
  } catch (err) {
    // Silent fail - monitoring shouldn't break the app
    console.warn('[Monitoring] Failed to report web vital:', err);
  }

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Web Vital] ${metric.name}: ${metric.value} (${metric.rating})`);
  }
}

/**
 * Error boundary for React components
 */
export function logError(error: Error, errorInfo?: { componentStack?: string }): void {
  const report: ErrorReport = {
    message: error.message,
    stack: error.stack,
    component: errorInfo?.componentStack,
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    timestamp: new Date().toISOString(),
    severity: getErrorSeverity(error),
  };

  // Send error report
  sendErrorReport(report);

  // Console output
  console.error('[Monitoring] Error logged:', error);
}

/**
 * Get error severity based on message
 */
function getErrorSeverity(error: Error): ErrorReport['severity'] {
  const message = error.message.toLowerCase();
  
  if (message.includes('fatal') || message.includes('crash')) return 'critical';
  if (message.includes('api') || message.includes('network')) return 'high';
  if (message.includes('warning') || message.includes('deprecated')) return 'low';
  return 'medium';
}

/**
 * Send error report to backend
 */
async function sendErrorReport(report: ErrorReport): Promise<void> {
  try {
    await fetch('/api/analytics/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
      keepalive: true,
    });
  } catch (err) {
    // Store in localStorage as fallback
    const errors = JSON.parse(localStorage.getItem('pending-errors') || '[]');
    errors.push(report);
    localStorage.setItem('pending-errors', JSON.stringify(errors.slice(-20)));
  }
}

/**
 * Track user interaction
 */
export function trackInteraction(
  action: string,
  metadata?: Record<string, any>
): void {
  if (typeof window === 'undefined') return;

  const interaction = {
    action,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    metadata,
  };

  // Queue for batching
  queueAnalyticsEvent('interaction', interaction);
}

/**
 * Track page view
 */
export function trackPageView(page: string, metadata?: Record<string, any>): void {
  queueAnalyticsEvent('pageview', {
    page,
    referrer: typeof document !== 'undefined' ? document.referrer : '',
    timestamp: new Date().toISOString(),
    metadata,
  });
}

/**
 * Track feature usage
 */
export function trackFeature(feature: string, action: string, metadata?: Record<string, any>): void {
  queueAnalyticsEvent('feature', {
    feature,
    action,
    timestamp: new Date().toISOString(),
    metadata,
  });
}

// Analytics event queue
const analyticsQueue: any[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

function queueAnalyticsEvent(type: string, data: any): void {
  analyticsQueue.push({ type, data, sent: false });
  
  if (!flushTimeout) {
    flushTimeout = setTimeout(flushAnalytics, 5000);
  }
  
  // Flush immediately if queue is large
  if (analyticsQueue.length >= 10) {
    flushAnalytics();
  }
}

/**
 * Flush analytics queue to server
 */
async function flushAnalytics(): Promise<void> {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  const unsent = analyticsQueue.filter(e => !e.sent);
  if (unsent.length === 0) return;

  try {
    await fetch('/api/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: unsent }),
      keepalive: true,
    });

    // Mark as sent
    unsent.forEach(e => e.sent = true);
  } catch (err) {
    console.warn('[Monitoring] Failed to flush analytics:', err);
  }
}

/**
 * Get monitoring dashboard data
 */
export async function getMonitoringDashboard(): Promise<{
  webVitals: Record<WebVitalName, { avg: number; p75: number; p95: number; rating: WebVitalRating }>;
  errors: { total: number; bySeverity: Record<string, number> };
  performance: { avgLoadTime: number; avgApiLatency: number };
}> {
  try {
    const tenantId = tenantService.getCurrentTenantId();
    
    // Fetch web vitals from last 24 hours
    const { data: webVitalsData } = await supabase
      .from('web_vitals')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Calculate web vitals stats
    const webVitals: any = {};
    Object.keys(WEB_VITALS_THRESHOLDS).forEach((name) => {
      const metrics = (webVitalsData || []).filter((d: any) => d.name === name).map((d: any) => d.value);
      
      if (metrics.length > 0) {
        const sorted = metrics.sort((a: number, b: number) => a - b);
        const avg = sorted.reduce((a: number, b: number) => a + b, 0) / sorted.length;
        const p75 = sorted[Math.floor(sorted.length * 0.75)];
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        
        webVitals[name] = {
          avg: Math.round(avg * 100) / 100,
          p75,
          p95,
          rating: getRating(name as WebVitalName, avg),
        };
      }
    });

    // Fetch error stats
    const { data: errorData } = await supabase
      .from('error_reports')
      .select('severity')
      .eq('tenant_id', tenantId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const bySeverity: Record<string, number> = {};
    (errorData || []).forEach((e: any) => {
      bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1;
    });

    return {
      webVitals,
      errors: {
        total: errorData?.length || 0,
        bySeverity,
      },
      performance: {
        avgLoadTime: webVitals.LCP?.avg || 0,
        avgApiLatency: 0, // Would need separate API timing
      },
    };
  } catch (err) {
    console.error('Failed to get monitoring dashboard:', err);
    const emptyWebVitals: Record<WebVitalName, { avg: number; p75: number; p95: number; rating: WebVitalRating }> = {
      LCP: { avg: 0, p75: 0, p95: 0, rating: 'good' },
      FID: { avg: 0, p75: 0, p95: 0, rating: 'good' },
      CLS: { avg: 0, p75: 0, p95: 0, rating: 'good' },
      FCP: { avg: 0, p75: 0, p95: 0, rating: 'good' },
      TTFB: { avg: 0, p75: 0, p95: 0, rating: 'good' },
      INP: { avg: 0, p75: 0, p95: 0, rating: 'good' },
    };
    return { webVitals: emptyWebVitals, errors: { total: 0, bySeverity: {} }, performance: { avgLoadTime: 0, avgApiLatency: 0 } };
  }
}

/**
 * Measure API call performance
 */
export function measureApiCall<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  
  return fn().finally(() => {
    const duration = performance.now() - start;
    queueAnalyticsEvent('api_timing', {
      endpoint: name,
      duration: Math.round(duration),
      timestamp: new Date().toISOString(),
    });
  });
}
