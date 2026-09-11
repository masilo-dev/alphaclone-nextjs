/**
 * Tenant-partitioned offline store.
 *
 * Only low-risk drafts and explicitly allowlisted mutations belong here. Tokens,
 * payment data, private messages, exports, and unrestricted API responses must
 * never be persisted in this database.
 */

export const OFFLINE_MUTATION_ALLOWLIST = [
  'task.create',
  'task.update',
  'note.create',
  'lead.draft',
  'expense.draft',
] as const;

export type OfflineMutationType = (typeof OFFLINE_MUTATION_ALLOWLIST)[number];
export type OfflineSyncState = 'queued' | 'syncing' | 'failed' | 'conflict';

export interface OfflinePartition {
  tenantId: string;
  userId: string;
}

export interface OfflineMutation extends OfflinePartition {
  id: string;
  idempotencyKey: string;
  type: OfflineMutationType;
  payload: Record<string, unknown>;
  entityId?: string;
  baseVersion?: string;
  state: OfflineSyncState;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
}

interface CachedRecord<T = unknown> extends OfflinePartition {
  key: string;
  data: T;
  cachedAt: string;
  expiresAt: string;
}

const DB_NAME = 'AlphaCloneOffline';
const DB_VERSION = 2;
const MUTATIONS = 'mutations';
const CACHE = 'cache';
const CONFLICTS = 'conflicts';

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function partitionKey(partition: OfflinePartition, key: string): string {
  return `${partition.tenantId}:${partition.userId}:${key}`;
}

function assertPartition(partition: OfflinePartition): void {
  if (!partition.tenantId || !partition.userId) {
    throw new Error('Offline storage requires an authenticated tenant and user');
  }
}

class OfflineService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  async init(): Promise<void> {
    await this.database();
  }

  private database(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Offline database upgrade blocked by another tab'));
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const legacy of ['messages', 'projectUpdates', 'cachedData']) {
          if (db.objectStoreNames.contains(legacy)) db.deleteObjectStore(legacy);
        }
        if (!db.objectStoreNames.contains(MUTATIONS)) {
          const store = db.createObjectStore(MUTATIONS, { keyPath: 'id' });
          store.createIndex('partition', ['tenantId', 'userId']);
          store.createIndex('partitionState', ['tenantId', 'userId', 'state']);
          store.createIndex('idempotencyKey', 'idempotencyKey', { unique: true });
        }
        if (!db.objectStoreNames.contains(CACHE)) {
          const store = db.createObjectStore(CACHE, { keyPath: 'key' });
          store.createIndex('partition', ['tenantId', 'userId']);
          store.createIndex('expiresAt', 'expiresAt');
        }
        if (!db.objectStoreNames.contains(CONFLICTS)) {
          const store = db.createObjectStore(CONFLICTS, { keyPath: 'id' });
          store.createIndex('partition', ['tenantId', 'userId']);
        }
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
    });
    return this.dbPromise;
  }

  async enqueueMutation(
    partition: OfflinePartition,
    type: OfflineMutationType,
    payload: Record<string, unknown>,
    options: { entityId?: string; baseVersion?: string; idempotencyKey?: string } = {},
  ): Promise<OfflineMutation> {
    assertPartition(partition);
    if (!OFFLINE_MUTATION_ALLOWLIST.includes(type)) throw new Error(`Offline operation is blocked: ${type}`);
    const db = await this.database();
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const record: OfflineMutation = {
      ...partition,
      id,
      idempotencyKey: options.idempotencyKey || crypto.randomUUID(),
      type,
      payload: structuredClone(payload),
      entityId: options.entityId,
      baseVersion: options.baseVersion,
      state: 'queued',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };
    await requestResult(db.transaction(MUTATIONS, 'readwrite').objectStore(MUTATIONS).add(record));
    await this.requestSync();
    return record;
  }

  async listMutations(partition: OfflinePartition): Promise<OfflineMutation[]> {
    assertPartition(partition);
    const db = await this.database();
    const index = db.transaction(MUTATIONS).objectStore(MUTATIONS).index('partition');
    const records = await requestResult(index.getAll([partition.tenantId, partition.userId]));
    return (records as OfflineMutation[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async cacheData<T>(
    partition: OfflinePartition,
    key: string,
    data: T,
    ttlMs = 15 * 60 * 1000,
  ): Promise<void> {
    assertPartition(partition);
    const db = await this.database();
    const now = Date.now();
    const record: CachedRecord<T> = {
      ...partition,
      key: partitionKey(partition, key),
      data: structuredClone(data),
      cachedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
    };
    await requestResult(db.transaction(CACHE, 'readwrite').objectStore(CACHE).put(record));
  }

  async getCachedData<T>(partition: OfflinePartition, key: string): Promise<T | undefined> {
    assertPartition(partition);
    const db = await this.database();
    const store = db.transaction(CACHE, 'readonly').objectStore(CACHE);
    const storageKey = partitionKey(partition, key);
    const record = await requestResult(store.get(storageKey)) as CachedRecord<T> | undefined;
    if (!record) return undefined;
    if (Date.parse(record.expiresAt) <= Date.now()) {
      await requestResult(db.transaction(CACHE, 'readwrite').objectStore(CACHE).delete(storageKey));
      return undefined;
    }
    return structuredClone(record.data);
  }

  async getQueuedUpdatesCount(partition?: OfflinePartition): Promise<number> {
    if (!partition) return 0;
    return (await this.listMutations(partition)).filter((item) => item.state !== 'failed').length;
  }

  async updateMutation(id: string, patch: Partial<Pick<OfflineMutation, 'state' | 'attempts' | 'lastError' | 'updatedAt'>>): Promise<void> {
    const db = await this.database();
    const store = db.transaction(MUTATIONS, 'readwrite').objectStore(MUTATIONS);
    const existing = await requestResult(store.get(id)) as OfflineMutation | undefined;
    if (!existing) return;
    const updated: OfflineMutation = {
      ...existing,
      ...patch,
      updatedAt: patch.updatedAt || new Date().toISOString(),
    };
    await requestResult(store.put(updated));
  }

  async removeMutation(id: string): Promise<void> {
    const db = await this.database();
    await requestResult(db.transaction(MUTATIONS, 'readwrite').objectStore(MUTATIONS).delete(id));
  }

  async getQueuedMessagesCount(): Promise<number> {
    // Sending messages while offline is intentionally blocked.
    return 0;
  }

  isOnline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine;
  }

  async requestSync(): Promise<void> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    const sync = (registration as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> };
    }).sync;
    await sync?.register('alphaclone-safe-mutations');
  }

  async clearPartition(partition: OfflinePartition): Promise<void> {
    assertPartition(partition);
    const db = await this.database();
    for (const storeName of [MUTATIONS, CACHE, CONFLICTS]) {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const index = store.index('partition');
      const keys = await requestResult(index.getAllKeys([partition.tenantId, partition.userId]));
      for (const key of keys) {
        await requestResult(db.transaction(storeName, 'readwrite').objectStore(storeName).delete(key));
      }
    }
  }
}

export const offlineService = new OfflineService();
