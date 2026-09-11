export interface ScanResult {
    url: string;
    timestamp: Date;
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    checks: {
        ssl: { status: 'pass' | 'fail' | 'warning'; details: string };
        headers: { status: 'pass' | 'fail' | 'warning'; details: string };
        malware: { status: 'pass' | 'fail' | 'warning'; details: string };
        mail: { status: 'pass' | 'fail' | 'warning'; details: string };
    };
    issues: string[];
}

export const securityScannerService = {
    async scanWebsite(url: string, tenantId?: string): Promise<ScanResult> {
        if (!tenantId) throw new Error('Select a workspace before scanning');
        const response = await fetch('/api/security/scan', {
            method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId, url }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Security scan failed');
        return { ...payload, timestamp: new Date(payload.timestamp) } as ScanResult;
    },
    async getScanHistory(tenantId: string): Promise<{ scans: any[]; error: any }> {
        try {
            const response = await fetch(`/api/security/scan?tenantId=${encodeURIComponent(tenantId)}`, { cache: 'no-store' });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'History failed');
            return { scans: payload.scans || [], error: null };
        } catch (error) { return { scans: [], error }; }
    },
};
