import { clientActivityService } from '@/services/clientActivityService';
import { offlineService, type OfflineMutation, type OfflinePartition } from '@/services/offlineService';

async function syncTaskCreate(mutation: OfflineMutation, tenantId: string): Promise<void> {
  const payload = mutation.payload as {
    title?: string;
    description?: string;
    due_date?: string | null;
    priority?: string;
    related_to_project?: string | null;
    related_to_deal?: string | null;
    related_to_contact?: string | null;
    related_to_lead?: string | null;
  };

  if (!payload.title?.trim()) {
    throw new Error('Invalid offline task payload');
  }

  const response = await fetch(`/api/tenant/${encodeURIComponent(tenantId)}/tasks`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: payload.title,
      description: payload.description,
      due_date: payload.due_date ?? null,
      priority: payload.priority ?? 'medium',
      related_to_project: payload.related_to_project ?? null,
      related_to_deal: payload.related_to_deal ?? null,
      related_to_contact: payload.related_to_contact ?? null,
      related_to_lead: payload.related_to_lead ?? null,
      idempotencyKey: mutation.idempotencyKey,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Task sync failed');
  }
}

async function syncTaskUpdate(mutation: OfflineMutation, tenantId: string): Promise<void> {
  const payload = mutation.payload as {
    taskId?: string;
    changes?: Record<string, unknown>;
  };

  if (!payload.taskId || !payload.changes || Object.keys(payload.changes).length === 0) {
    throw new Error('Invalid offline task update payload');
  }

  const response = await fetch(`/api/tenant/${encodeURIComponent(tenantId)}/tasks`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ids: [payload.taskId],
      changes: payload.changes,
      idempotencyKey: mutation.idempotencyKey,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Task update sync failed');
  }
}

async function syncExpenseDraft(mutation: OfflineMutation, tenantId: string): Promise<void> {
  const payload = mutation.payload as {
    date?: string;
    amount?: number;
    tax_amount?: number;
    currency?: string;
    description?: string;
    vendor_name?: string;
    payment_method?: string;
    billable?: boolean;
    client_id?: string | null;
    category_id?: string | null;
    notes?: string | null;
    receipt_url?: string | null;
  };

  if (!payload.date || !payload.amount || payload.amount <= 0) {
    throw new Error('Invalid offline expense payload');
  }

  const response = await fetch('/api/finance/expenses', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create',
      tenantId,
      date: payload.date,
      amount: payload.amount,
      tax_amount: payload.tax_amount ?? 0,
      currency: payload.currency ?? 'USD',
      description: payload.description,
      vendor_name: payload.vendor_name,
      payment_method: payload.payment_method ?? 'card',
      billable: payload.billable ?? false,
      client_id: payload.client_id ?? null,
      category_id: payload.category_id ?? null,
      notes: payload.notes ?? null,
      receipt_url: payload.receipt_url ?? null,
      idempotencyKey: mutation.idempotencyKey,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Expense sync failed');
  }
}

async function processMutation(mutation: OfflineMutation, tenantId: string): Promise<void> {
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
    case 'task.create':
      await syncTaskCreate(mutation, tenantId);
      return;
    case 'task.update':
      await syncTaskUpdate(mutation, tenantId);
      return;
    case 'expense.draft':
      await syncExpenseDraft(mutation, tenantId);
      return;
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
      await processMutation(mutation, partition.tenantId);
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
