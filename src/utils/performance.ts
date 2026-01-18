// Performance Monitoring Utilities

export const performanceMonitor = {
  // Mark performance milestones
  mark(name: string) {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(name);
    }
  },

  // Measure between two marks
  measure(name: string, startMark: string, endMark: string) {
    if (typeof performance !== 'undefined' && performance.measure) {
      try {
        performance.measure(name, startMark, endMark);
        const measure = performance.getEntriesByName(name)[0];
        return measure?.duration || 0;
      } catch (e) {
        console.warn('Performance measure failed:', e);
        return 0;
      }
    }
    return 0;
  },

  // Get all performance marks
  getMarks() {
    if (typeof performance !== 'undefined' && performance.getEntriesByType) {
      return performance.getEntriesByType('mark');
    }
    return [];
  },

  // Clear all performance data
  clear() {
    if (typeof performance !== 'undefined' && performance.clearMarks) {
      performance.clearMarks();
      performance.clearMeasures();
    }
  },

  // Log performance metrics
  logMetrics(name: string) {
    const entries = performance.getEntriesByName(name);
    if (entries.length > 0) {
      const entry = entries[0];
      if (entry && entry.duration && entry.duration > 1000) {
        console.warn(`Slow operation detected: ${name} took ${entry.duration.toFixed(2)}ms`);
      }
    }
  },
};

// Web Vitals monitoring (optional - requires web-vitals package)
export const reportWebVitals = (onPerfEntry?: (metric: any) => void) => {
  if (onPerfEntry && typeof window !== 'undefined') {
    // Commented out until web-vitals is installed
    // import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
    //   getCLS(onPerfEntry);
    //   getFID(onPerfEntry);
    //   getFCP(onPerfEntry);
    //   getLCP(onPerfEntry);
    //   getTTFB(onPerfEntry);
    // }).catch(() => {
    //   console.log('web-vitals not installed');
    // });
  }
};

// Component render time tracker
export function trackRenderTime(componentName: string) {
  const startMark = `${componentName}-render-start`;
  const endMark = `${componentName}-render-end`;
  
  return {
    start: () => performanceMonitor.mark(startMark),
    end: () => {
      performanceMonitor.mark(endMark);
      const duration = performanceMonitor.measure(
        `${componentName}-render`,
        startMark,
        endMark
      );
      
      if (duration > 100) {
        console.warn(`${componentName} took ${duration.toFixed(2)}ms to render`);
      }
      
      return duration;
    },
  };
}

// Network request tracker
export function trackNetworkRequest(url: string, method: string = 'GET') {
  const startTime = Date.now();
  
  return {
    end: (success: boolean = true) => {
      const duration = Date.now() - startTime;
      
      if (duration > 2000) {
        console.warn(`Slow ${method} request to ${url}: ${duration}ms`);
      }
      
      return {
        url,
        method,
        duration,
        success,
      };
    },
  };
}

// Memory usage monitor
export function checkMemoryUsage() {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    const used = memory.usedJSHeapSize / 1048576; // Convert to MB
    const total = memory.totalJSHeapSize / 1048576;
    const limit = memory.jsHeapSizeLimit / 1048576;
    
    if (used / limit > 0.9) {
      console.warn(`High memory usage: ${used.toFixed(2)}MB / ${limit.toFixed(2)}MB`);
    }
    
    return {
      used: used.toFixed(2),
      total: total.toFixed(2),
      limit: limit.toFixed(2),
      percentage: ((used / limit) * 100).toFixed(2),
    };
  }
  
  return null;
}

// Bundle size analyzer
export const getBundleInfo = () => {
  const scripts = Array.from(document.querySelectorAll('script[src]'));
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
  
  return {
    scriptCount: scripts.length,
    styleCount: styles.length,
    scripts: scripts.map((s: any) => s.src),
    styles: styles.map((l: any) => l.href),
  };
};

