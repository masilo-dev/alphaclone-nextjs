/**
 * Custom Business Metrics Tracking
 * Track key metrics for business insights and alerting
 */

import { supabase } from '../supabase';

export interface BusinessMetric {
    name: string;
    value: number;
    unit: string;
    tags?: Record<string, string>;
    timestamp?: Date;
}

class MetricsService {
    private metrics: BusinessMetric[] = [];
    private flushInterval: NodeJS.Timeout | null = null;

    constructor() {
        // Flush metrics every 60 seconds
        if (typeof window === 'undefined') {
            // Server-side only
            this.flushInterval = setInterval(() => this.flush(), 60000);
        }
    }

    /**
     * Record a metric
     */
    record(name: string, value: number, unit: string = 'count', tags?: Record<string, string>) {
        this.metrics.push({
            name,
            value,
            unit,
            tags,
            timestamp: new Date(),
        });

        // Auto-flush if buffer is large
        if (this.metrics.length >= 100) {
            this.flush();
        }
    }

    /**
     * Increment a counter metric
     */
    increment(name: string, tags?: Record<string, string>) {
        this.record(name, 1, 'count', tags);
    }

    /**
     * Record timing metric
     */
    timing(name: string, milliseconds: number, tags?: Record<string, string>) {
        this.record(name, milliseconds, 'ms', tags);
    }

    /**
     * Record gauge (current value snapshot)
     */
    gauge(name: string, value: number, unit: string = 'value', tags?: Record<string, string>) {
        this.record(name, value, unit, tags);
    }

    /**
     * Flush metrics to storage/analytics
     */
    private async flush() {
        if (this.metrics.length === 0) return;

        const metricsToFlush = [...this.metrics];
        this.metrics = [];

        try {
            // Option 1: Store in database for custom analytics
            await this.storeInDatabase(metricsToFlush);

            // Option 2: Send to external analytics (Mixpanel, Segment, etc.)
            // await this.sendToExternal(metricsToFlush);

            // Option 3: Log for debugging
            if (process.env.NODE_ENV === 'development') {
                console.log('Metrics flushed:', metricsToFlush.length);
            }
        } catch (error) {
            console.error('Error flushing metrics:', error);
            // Re-add failed metrics for retry
            this.metrics.unshift(...metricsToFlush);
        }
    }

    /**
     * Store metrics in database for custom analytics
     */
    private async storeInDatabase(metrics: BusinessMetric[]) {
        // Store in a metrics table or time-series database
        // For now, just console log in development
        if (process.env.NODE_ENV === 'development') {
            metrics.forEach(m => {
                console.log(`[METRIC] ${m.name}: ${m.value}${m.unit}`, m.tags);
            });
        }
    }

    /**
     * Track key business events
     */
    trackEvent(eventName: string, properties?: Record<string, any>) {
        this.record(
            `event.${eventName}`,
            1,
            'count',
            properties as Record<string, string>
        );
    }

    /**
     * Clean up on shutdown
     */
    destroy() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }
        this.flush();
    }
}

// Singleton instance
export const metrics = new MetricsService();

/**
 * Common business metrics to track
 */
export const BusinessMetrics = {
    // User lifecycle
    USER_SIGNUP: 'user.signup',
    USER_LOGIN: 'user.login',
    USER_LOGOUT: 'user.logout',
    USER_DELETED: 'user.deleted',

    // Subscription events
    SUBSCRIPTION_CREATED: 'subscription.created',
    SUBSCRIPTION_UPGRADED: 'subscription.upgraded',
    SUBSCRIPTION_DOWNGRADED: 'subscription.downgraded',
    SUBSCRIPTION_CANCELED: 'subscription.canceled',
    SUBSCRIPTION_RENEWED: 'subscription.renewed',

    // Revenue events
    PAYMENT_SUCCEEDED: 'payment.succeeded',
    PAYMENT_FAILED: 'payment.failed',
    ADDON_PURCHASED: 'addon.purchased',
    INVOICE_PAID: 'invoice.paid',

    // Feature usage
    PROJECT_CREATED: 'project.created',
    CONTRACT_GENERATED: 'contract.generated',
    DOCUMENT_UPLOADED: 'document.uploaded',
    CALENDAR_EVENT_CREATED: 'calendar_event.created',
    API_CALL: 'api.call',

    // Conversion funnel
    UPGRADE_PROMPT_SHOWN: 'upgrade_prompt.shown',
    UPGRADE_PROMPT_CLICKED: 'upgrade_prompt.clicked',
    UPGRADE_PROMPT_CONVERTED: 'upgrade_prompt.converted',

    // Errors
    ERROR_OCCURRED: 'error.occurred',
    API_ERROR: 'api.error',

    // Performance
    PAGE_LOAD_TIME: 'performance.page_load',
    API_RESPONSE_TIME: 'performance.api_response',
    DATABASE_QUERY_TIME: 'performance.db_query',
};

/**
 * Helper to track function execution time
 */
export function trackExecutionTime<T>(
    metricName: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
): Promise<T> {
    const start = Date.now();

    return fn().finally(() => {
        const duration = Date.now() - start;
        metrics.timing(metricName, duration, tags);
    });
}

/**
 * Decorator to track method execution time
 */
export function TrackTime(metricName: string) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            return trackExecutionTime(
                metricName,
                () => originalMethod.apply(this, args),
                { method: propertyKey }
            );
        };

        return descriptor;
    };
}

/**
 * Track Web Vitals
 */
export function trackWebVitals() {
    if (typeof window === 'undefined') return;

    // Track Core Web Vitals
    if ('web-vital' in window || typeof (window as any).PerformanceObserver !== 'undefined') {
        // LCP - Largest Contentful Paint
        const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1] as any;
            metrics.timing('webvital.lcp', lastEntry.renderTime || lastEntry.loadTime);
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // FID - First Input Delay
        const fidObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach((entry: any) => {
                metrics.timing('webvital.fid', entry.processingStart - entry.startTime);
            });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

        // CLS - Cumulative Layout Shift
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry: any) => {
                if (!entry.hadRecentInput) {
                    clsValue += entry.value;
                }
            });
            metrics.gauge('webvital.cls', clsValue);
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });

        // TTFB - Time to First Byte
        const navEntry = performance.getEntriesByType('navigation')[0] as any;
        if (navEntry) {
            metrics.timing('webvital.ttfb', navEntry.responseStart);
        }
    }
}

/**
 * Track errors globally
 */
export function initErrorTracking() {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', (event) => {
        metrics.increment(BusinessMetrics.ERROR_OCCURRED, {
            message: event.message,
            filename: event.filename,
            lineno: String(event.lineno),
        });
    });

    window.addEventListener('unhandledrejection', (event) => {
        metrics.increment(BusinessMetrics.ERROR_OCCURRED, {
            message: event.reason?.message || 'Unhandled Promise Rejection',
            type: 'unhandled_promise',
        });
    });
}
