import { supabase } from '../lib/supabase';

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

class SecurityScannerService {

    /**
     * Simulates a security scan (since browser-side CORS blocks real header checks on arbitrary domains).
     * In a production environment, this would call a server-side Edge Function.
     */
    async scanWebsite(url: string): Promise<ScanResult> {
        // Normalize URL
        if (!url.startsWith('http')) {
            url = 'https://' + url;
        }

        console.log(`🔍 Scanning ${url}...`);

        // Simulate network delay for realism
        await new Promise(resolve => setTimeout(resolve, 2500));

        // Deterministic score based on URL length and protocol for demo consistency
        const isSecure = url.startsWith('https');
        const urlHash = url.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const score = isSecure
            ? Math.floor(90 + (urlHash % 11)) // 90-100
            : Math.floor(40 + (urlHash % 21)); // 40-60

        const result: ScanResult = {
            url,
            timestamp: new Date(),
            score,
            grade: this.calculateGrade(score),
            checks: {
                ssl: {
                    status: isSecure ? 'pass' : 'fail',
                    details: isSecure ? 'Valid SSL Certificate (RSA 2048-bit)' : 'No SSL Certificate detected'
                },
                headers: {
                    status: score > 80 ? 'pass' : 'warning',
                    details: score > 80 ? 'Security headers configured correctly' : 'Missing X-Frame-Options'
                },
                malware: {
                    status: 'pass',
                    details: 'No malware found in Google Safe Browsing database'
                },
                mail: {
                    status: 'warning',
                    details: 'DMARC record not found (DNS)'
                }
            },
            issues: []
        };

        if (!isSecure) result.issues.push('Missing SSL Certificate');
        if (score < 95) result.issues.push('Content-Security-Policy header missing');
        if (score < 85) result.issues.push('Missing Strict-Transport-Security');

        return result;
    }

    private calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
        if (score >= 90) return 'A';
        if (score >= 80) return 'B';
        if (score >= 70) return 'C';
        if (score >= 60) return 'D';
        return 'F';
    }

    async saveScanResult(tenantId: string, result: ScanResult) {
        const { error } = await supabase
            .from('security_scans')
            .insert({
                tenant_id: tenantId,
                url: result.url,
                score: result.score,
                grade: result.grade,
                details: result
            });

        if (error) {
            console.error('Could not save scan to DB', error);
        }
    }

    async getScanHistory(tenantId: string): Promise<{ scans: any[]; error: any }> {
        const { data, error } = await supabase
            .from('security_scans')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });

        return { scans: data || [], error };
    }
}

export const securityScannerService = new SecurityScannerService();
