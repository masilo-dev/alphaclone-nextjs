/**
 * Performance Monitoring Service
 * Tracks and reports performance metrics
 */

export interface PerformanceMetric {
    name: string;
    value: number;
    unit: 'ms' | 'bytes' | 'count';
    timestamp: string;
    page: string;
    userId?: string;
}

export interface WebVital {
    name: 'CLS' | 'FID' | 'FCP' | 'LCP' | 'TTFB';
    value: number;
    rating: 'good' | 'needs-improvement' | 'poor';
    timestamp: string;
}

export const performanceMonitoringService = {
    /**
     * Track Web Vitals
     */
    trackWebVitals(): void {
        if (typeof window === 'undefined') return;

        // Largest Contentful Paint (LCP)
        if ('PerformanceObserver' in window) {
            try {
                const lcpObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1] as any;
                    this.recordMetric({
                        name: 'LCP',
                        value: lastEntry.renderTime || lastEntry.loadTime,
                        unit: 'ms',
                        timestamp: new Date().toISOString(),
                        page: window.location.pathname,
                    });
                });
                lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
            } catch (e) {
                // Browser doesn't support LCP
            }

            // First Input Delay (FID)
            try {
                const fidObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach((entry: any) => {
                        this.recordMetric({
                            name: 'FID',
                            value: entry.processingStart - entry.startTime,
                            unit: 'ms',
                            timestamp: new Date().toISOString(),
                            page: window.location.pathname,
                        });
                    });
                });
                fidObserver.observe({ entryTypes: ['first-input'] });
            } catch (e) {
                // Browser doesn't support FID
            }

            // Cumulative Layout Shift (CLS)
            try {
                let clsValue = 0;
                const clsObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach((entry: any) => {
                        if (!entry.hadRecentInput) {
                            clsValue += entry.value;
                        }
                    });
                });
                clsObserver.observe({ entryTypes: ['layout-shift'] });

                // Report CLS on page unload
                window.addEventListener('beforeunload', () => {
                    this.recordMetric({
                        name: 'CLS',
                        value: clsValue,
                        unit: 'count',
                        timestamp: new Date().toISOString(),
                        page: window.location.pathname,
                    });
                });
            } catch (e) {
                // Browser doesn't support CLS
            }
        }

        // First Contentful Paint (FCP)
        const paintEntries = performance.getEntriesByType('paint');
        paintEntries.forEach((entry) => {
            if (entry.name === 'first-contentful-paint') {
                this.recordMetric({
                    name: 'FCP',
                    value: entry.startTime,
                    unit: 'ms',
                    timestamp: new Date().toISOString(),
                    page: window.location.pathname,
                });
            }
        });

        // Time to First Byte (TTFB)
        const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigationEntry) {
            this.recordMetric({
                name: 'TTFB',
                value: navigationEntry.responseStart - navigationEntry.requestStart,
                unit: 'ms',
                timestamp: new Date().toISOString(),
                page: window.location.pathname,
            });
        }
    },

    /**
     * Record performance metric
     */
    recordMetric(metric: PerformanceMetric): void {
        // Store in memory (would send to analytics service in production)
        const metrics = this.getStoredMetrics();
        metrics.push(metric);

        // Keep only last 100 metrics
        if (metrics.length > 100) {
            metrics.shift();
        }

        localStorage.setItem('performance_metrics', JSON.stringify(metrics));

        // Log to console in development
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[Performance] ${metric.name}: ${metric.value}${metric.unit}`);
        }

        // Send to analytics service (Sentry, etc.)
        if (process.env.NODE_ENV === 'production') {
            // Would send to monitoring service
        }
    },

    /**
     * Get stored metrics
     */
    getStoredMetrics(): PerformanceMetric[] {
        try {
            const stored = localStorage.getItem('performance_metrics');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    },

    /**
     * Get performance summary
     */
    getPerformanceSummary(): {
        lcp: number;
        fid: number;
        cls: number;
        fcp: number;
        ttfb: number;
    } {
        const metrics = this.getStoredMetrics();
        const summary: any = {};

        ['LCP', 'FID', 'CLS', 'FCP', 'TTFB'].forEach((name) => {
            const relevant = metrics.filter((m) => m.name === name && m.page === window.location.pathname);
            if (relevant.length > 0) {
                summary[name.toLowerCase()] =
                    relevant.reduce((sum: number, m: PerformanceMetric) => sum + m.value, 0) / relevant.length;
            }
        });

        return {
            lcp: summary.lcp || 0,
            fid: summary.fid || 0,
            cls: summary.cls || 0,
            fcp: summary.fcp || 0,
            ttfb: summary.ttfb || 0,
        };
    },

    /**
     * Measure function execution time
     */
    async measureExecution<T>(fn: () => Promise<T>, name: string): Promise<T> {
        const start = performance.now();
        try {
            const result = await fn();
            const duration = performance.now() - start;

            this.recordMetric({
                name: `execution:${name}`,
                value: duration,
                unit: 'ms',
                timestamp: new Date().toISOString(),
                page: window.location.pathname,
            });

            return result;
        } catch (error) {
            const duration = performance.now() - start;
            this.recordMetric({
                name: `execution:${name}:error`,
                value: duration,
                unit: 'ms',
                timestamp: new Date().toISOString(),
                page: window.location.pathname,
            });
            throw error;
        }
    },

    /**
     * Track resource loading
     */
    trackResourceLoading(): void {
        if (typeof window === 'undefined') return;

        if ('PerformanceObserver' in window) {
            try {
                const observer = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach((entry: any) => {
                        if (entry.initiatorType === 'img' || entry.initiatorType === 'script') {
                            this.recordMetric({
                                name: `resource:${entry.initiatorType}`,
                                value: entry.duration,
                                unit: 'ms',
                                timestamp: new Date().toISOString(),
                                page: window.location.pathname,
                            });
                        }
                    });
                });
                observer.observe({ entryTypes: ['resource'] });
            } catch (e) {
                // Browser doesn't support resource timing
            }
        }
    },

    /**
     * Initialize performance monitoring
     */
    init(): void {
        this.trackWebVitals();
        this.trackResourceLoading();
    },
};

