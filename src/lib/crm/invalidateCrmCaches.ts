import { QueryClient } from '@tanstack/react-query';

/** Invalidate client/crm caches after delete or restore actions. */
export function invalidateCrmCaches(queryClient?: QueryClient) {
  if (queryClient) {
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    queryClient.invalidateQueries({ queryKey: ['contacts'] });
    queryClient.invalidateQueries({ queryKey: ['crm'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
  }
}
