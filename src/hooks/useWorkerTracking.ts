'use client';

import { useEffect, useCallback } from 'react';
import { workerTrackingService } from '@/services/workerTrackingService';
import { usePathname } from 'next/navigation';

interface UseWorkerTrackingOptions {
  appName: string;
  trackNavigation?: boolean;
  trackClicks?: boolean;
}

/**
 * Hook to automatically track worker activity in any app/module
 * 
 * Usage:
 * function MyComponent() {
 *   useWorkerTracking({ appName: 'crm', trackNavigation: true });
 *   // ... component logic
 * }
 */
export function useWorkerTracking(options: UseWorkerTrackingOptions) {
  const { appName, trackNavigation = true } = options;
  const pathname = usePathname();

  // Track navigation
  useEffect(() => {
    if (trackNavigation && pathname) {
      workerTrackingService.trackNavigation(appName, pathname);
    }
  }, [appName, pathname, trackNavigation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Optional: End session on component unmount
      // workerTrackingService.endSession();
    };
  }, []);

  // Manual tracking helpers
  const trackView = useCallback((moduleName: string, entityType: string, entityId: string) => {
    workerTrackingService.trackView(appName, moduleName, entityType, entityId);
  }, [appName]);

  const trackCreate = useCallback((moduleName: string, entityType: string, entityId: string, metadata?: any) => {
    workerTrackingService.trackCreate(appName, moduleName, entityType, entityId, metadata);
  }, [appName]);

  const trackEdit = useCallback((moduleName: string, entityType: string, entityId: string) => {
    workerTrackingService.trackEdit(appName, moduleName, entityType, entityId);
  }, [appName]);

  const trackSearch = useCallback((moduleName: string, query: string, resultsCount?: number) => {
    workerTrackingService.trackSearch(appName, moduleName, query, resultsCount);
  }, [appName]);

  const trackExport = useCallback((moduleName: string, entityType: string, format: string) => {
    workerTrackingService.trackExport(appName, moduleName, entityType, format);
  }, [appName]);

  return {
    trackView,
    trackCreate,
    trackEdit,
    trackSearch,
    trackExport,
  };
}

/**
 * Example: How to add tracking to existing LeadView component
 * 
 * BEFORE:
 * function LeadView({ lead }) {
 *   return <div>{lead.name}</div>
 * }
 * 
 * AFTER:
 * function LeadView({ lead }) {
 *   const { trackView } = useWorkerTracking({ appName: 'leads' });
 *   
 *   useEffect(() => {
 *     trackView('lead_detail', 'lead', lead.id);
 *   }, [lead.id]);
 *   
 *   return <div>{lead.name}</div>
 * }
 */

/**
 * Higher-order component for automatic tracking
 */
export function withWorkerTracking<P extends object>(
  Component: React.ComponentType<P>,
  appName: string
) {
  return function WrappedComponent(props: P) {
    useWorkerTracking({ appName, trackNavigation: true });
    return <Component {...props} />;
  };
}
