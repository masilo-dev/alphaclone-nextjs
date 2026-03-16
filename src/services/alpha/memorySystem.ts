import { tenantFortress } from './fortressLayer';

export type MemoryStore = 'shortTerm' | 'longTerm' | 'episodic';

export interface MemoryEntry {
    tenantId: string;
    userId: string;
    type: string;
    content: any;
    success?: boolean;
    timestamp: Date;
}

class MemorySystem {
    // Hierarchical Memory: Redis for Short, Postgres + Vector for Long/Episodic
    // For now, using in-memory mock until DB schemas are established
    private cache: Map<string, MemoryEntry[]> = new Map();

    async store(entry: MemoryEntry, store: MemoryStore = 'shortTerm') {
        const key = tenantFortress.getIsolatedKey(entry.tenantId, store);
        const entries = this.cache.get(key) || [];
        entries.push(entry);
        this.cache.set(key, entries);
        
        console.log(`MEMORY_FORTRESS [${store.toUpperCase()}]: Pattern isolated for ${entry.tenantId}`);
    }

    async recall(tenantId: string, query: string, store: MemoryStore = 'longTerm'): Promise<MemoryEntry[]> {
        const key = tenantFortress.getIsolatedKey(tenantId, store);
        const data = this.cache.get(key) || [];
        return tenantFortress.sanitizeResponse(tenantId, data);
    }

    async getPatterns(tenantId: string): Promise<any[]> {
        const key = tenantFortress.getIsolatedKey(tenantId, 'longTerm');
        const data = (this.cache.get(key) || [])
            .filter(e => e.success)
            .map(e => e.content);
        
        return tenantFortress.sanitizeResponse(tenantId, data);
    }
}

export const memorySystem = new MemorySystem();
