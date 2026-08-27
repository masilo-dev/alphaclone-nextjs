import { clientActivityService } from '@/services/clientActivityService';
import { offlineService, type OfflineMutation, type OfflinePartition } from '@/services/offlineService';

async function processMutation(mutation: OfflineMutation): Promise<void> {
  switch (mutation.type) {
    case 'note.create': {
      const payload = mutation.payload as {
        clientId?: string;
        title?: string;
        description?: string;
        createdBy?: string;
      };
      if (!payload.clientId || !payload.title || !payload.createdBy) {
        throw new Error('Invalid offline note payload');
      }
      const { error } = await clientActivityService.addClientNote(
        payload.clientId,
        payload.title,
        payload.description || '',
        payload.createdBy,
      );
      if (error) throw new Error(error);
      return;
    }
    default:
      throw new Error(`Offline sync not implemented for ${mutation.type as string}`);
  }
}

export async function syncOfflineMutations(
  partition: OfflinePartition,
): Promise<{ synced: number; failed: number }> {
  if (!offlineService.isOnline()) {
    return { synced: 0, failed: 0 };
  }

  const mutations = await offlineService.listMutations(partition);
  let synced = 0;
  let failed = 0;

  for (const mutation of mutations) {
    if (mutation.state === 'failed') continue;

    await offlineService.updateMutation(mutation.id, {
      state: 'syncing',
      attempts: mutation.attempts + 1,
    });

    try {
      await processMutation(mutation);
      await offlineService.removeMutation(mutation.id);
      synced += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      await offlineService.updateMutation(mutation.id, {
        state: 'failed',
        lastError: message,
      });
      failed += 1;
    }
  }

  return { synced, failed };
}
