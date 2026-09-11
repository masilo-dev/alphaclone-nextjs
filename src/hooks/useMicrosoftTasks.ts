import { useCallback, useEffect, useState } from 'react';
import { microsoftAuthService } from '@/services/microsoftAuthService';
import { microsoftGraphService } from '@/services/microsoftGraphService';

export interface MicrosoftTaskListSummary {
  id: string;
  displayName: string;
  wellknownListName?: string;
  tasks: any[];
}

export function useMicrosoftTasks() {
  const [lists, setLists] = useState<MicrosoftTaskListSummary[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const isConnected = await microsoftAuthService.isConnected();
      setConnected(isConnected);
      if (!isConnected) {
        setLists([]);
        return;
      }

      const taskLists = await microsoftGraphService.getTaskLists();
      const populated = await Promise.all(
        taskLists.slice(0, 4).map(async (list: any) => ({
          ...list,
          tasks: await microsoftGraphService.getTasks(list.id),
        }))
      );
      setLists(populated);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error ? refreshError.message : 'Failed to load Microsoft To Do'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    lists,
    connected,
    loading,
    error,
    refresh,
  };
}
