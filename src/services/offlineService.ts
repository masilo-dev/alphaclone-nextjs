/**
 * Offline Support Service
 * Manages offline data caching and synchronization
 */

class OfflineService {
    private db: IDBDatabase | null = null;
    private readonly DB_NAME = 'AlphaCloneOffline';
    private readonly DB_VERSION = 1;

    /**
     * Initialize IndexedDB
     */
    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event: any) => {
                const db = event.target.result;

                // Create object stores
                if (!db.objectStoreNames.contains('messages')) {
                    db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
                }

                if (!db.objectStoreNames.contains('projectUpdates')) {
                    db.createObjectStore('projectUpdates', { keyPath: 'id', autoIncrement: true });
                }

                if (!db.objectStoreNames.contains('cachedData')) {
                    db.createObjectStore('cachedData', { keyPath: 'key' });
                }
            };
        });
    }

    /**
     * Queue message for sending when online
     */
    async queueMessage(message: any): Promise<void> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['messages'], 'readwrite');
            const store = transaction.objectStore('messages');
            const request = store.add({
                ...message,
                queuedAt: new Date().toISOString(),
            });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Queue project update for syncing when online
     */
    async queueProjectUpdate(projectId: string, updates: any): Promise<void> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['projectUpdates'], 'readwrite');
            const store = transaction.objectStore('projectUpdates');
            const request = store.add({
                projectId,
                data: updates,
                queuedAt: new Date().toISOString(),
            });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Cache data for offline access
     */
    async cacheData(key: string, data: any): Promise<void> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['cachedData'], 'readwrite');
            const store = transaction.objectStore('cachedData');
            const request = store.put({
                key,
                data,
                cachedAt: new Date().toISOString(),
            });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get cached data
     */
    async getCachedData(key: string): Promise<any> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['cachedData'], 'readonly');
            const store = transaction.objectStore('cachedData');
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result?.data);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get queued messages count
     */
    async getQueuedMessagesCount(): Promise<number> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['messages'], 'readonly');
            const store = transaction.objectStore('messages');
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get queued project updates count
     */
    async getQueuedUpdatesCount(): Promise<number> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['projectUpdates'], 'readonly');
            const store = transaction.objectStore('projectUpdates');
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Check if online
     */
    isOnline(): boolean {
        return navigator.onLine;
    }

    /**
     * Register service worker
     * @deprecated Use pwaService.registerServiceWorker() instead
     */
    async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
        // Delegating to PWA service or returning null to avoid double registration
        console.warn('offlineService.registerServiceWorker is deprecated. Use pwaService instead.');
        return null;
    }

    /**
     * Request background sync
     */
    async requestSync(tag: string): Promise<void> {
        if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
            const registration = await navigator.serviceWorker.ready;
            await (registration as any).sync.register(tag);
        }
    }

    /**
     * Show offline indicator
     */
    showOfflineIndicator(): void {
        const indicator = document.createElement('div');
        indicator.id = 'offline-indicator';
        indicator.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      padding: 12px;
      text-align: center;
      font-size: 14px;
      font-weight: 600;
      z-index: 10000;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;
        indicator.textContent = '📡 You are offline. Changes will sync when connection is restored.';
        document.body.appendChild(indicator);
    }

    /**
     * Hide offline indicator
     */
    hideOfflineIndicator(): void {
        const indicator = document.getElementById('offline-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    /**
     * Setup online/offline listeners
     */
    setupListeners(): void {
        window.addEventListener('online', async () => {
            this.hideOfflineIndicator();

            // Trigger sync
            await this.requestSync('sync-messages');
            await this.requestSync('sync-projects');

            // Show success message
            const count = await this.getQueuedMessagesCount() + await this.getQueuedUpdatesCount();
            if (count > 0) {
                console.log(`Syncing ${count} queued items...`);
            }
        });

        window.addEventListener('offline', () => {
            this.showOfflineIndicator();
        });

        // Check initial state
        if (!this.isOnline()) {
            this.showOfflineIndicator();
        }
    }
}

export const offlineService = new OfflineService();
