'use client';

import { useReportWebVitals } from 'next/web-vitals';

export function WebVitals() {
    useReportWebVitals((metric: any) => {
        // Log typical metrics to console in development
        if (process.env.NODE_ENV === 'development') {
            const { name, value, delta, id, rating } = metric;

            const color =
                rating === 'good' ? 'color: #0cce6b' :
                    rating === 'needs-improvement' ? 'color: #ffa400' :
                        'color: #ff4e42';

            console.log(
                `%c[Web Vitals] ${name}: ${value.toFixed(2)} (${rating})`,
                color,
                { id, delta, metric }
            );

            // Special warnings for poor performance
            if (rating === 'poor') {
                if (name === 'LCP' && value > 2500) {
                    console.warn('Largest Contentful Paint is slow (> 2.5s). Consider optimizing images or server response time.');
                }
                if (name === 'CLS' && value > 0.1) {
                    console.warn('Cumulative Layout Shift is high (> 0.1). Check for layout stability and unsized elements.');
                }
                if (name === 'INP' && value > 200) {
                    console.warn('Interaction to Next Paint is high (> 200ms). Check for long-running main thread tasks.');
                }
            }
        }

        // In production, you might want to send this to an analytics service
        // Example: sendToAnalytics(metric);
    });

    return null;
}
