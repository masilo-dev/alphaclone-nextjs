/**
 * Audit Service
 * Performs automated checks on leads against raw API data.
 */

export interface AuditResult {
    accuracyScore: number;
    totalLeads: number;
    flags: {
        type: 'CRITICAL HALLUCINATION' | 'FAIL' | 'WARNING';
        businessName: string;
        reason: string;
    }[];
}

export const auditService = {
    /**
     * Perform a 4-step audit on generated leads
     */
    performLeadAudit(leads: any[], rawMapsData: any[], targetNiche: string, constraints: { noWebsiteRequired?: boolean } = {}): AuditResult {
        const flags: AuditResult['flags'] = [];
        let score = 100;

        // Normalize data for comparison
        const normalizedRawNames = rawMapsData.map(r => (r.displayName?.text || '').toLowerCase().trim());
        const mapsDataMap = new Map(rawMapsData.map(r => [(r.displayName?.text || '').toLowerCase().trim(), r]));

        leads.forEach(lead => {
            const leadName = (lead.businessName || '').toLowerCase().trim();
            const rawMatch = mapsDataMap.get(leadName);

            // 1. Ghost Lead Check
            if (!rawMatch) {
                flags.push({
                    type: 'CRITICAL HALLUCINATION',
                    businessName: lead.businessName,
                    reason: 'Business name exists in Sales Agent list but NOT in raw API JSON.'
                });
                score -= 20;
                return; // Skip other checks if it's a ghost
            }

            // 2. Website Integrity Check
            const rawWebsite = rawMatch.websiteUri || '';
            const agentSaidNoWebsite = (lead.website === '' || lead.website === 'No Website' || !lead.website);

            if (rawWebsite && agentSaidNoWebsite) {
                flags.push({
                    type: 'FAIL',
                    businessName: lead.businessName,
                    reason: 'API provides a website URL, but Sales Agent reported "No Website".'
                });
                score -= 10;
            }

            // 3. Category Verification
            const rawTypes = rawMatch.types || [];
            const isMatch = rawTypes.some((t: string) =>
                t.toLowerCase().includes(targetNiche.toLowerCase().replace(/\s+/g, '_')) ||
                targetNiche.toLowerCase().includes(t.toLowerCase().replace(/_/g, ' '))
            );

            if (!isMatch && rawTypes.length > 0) {
                flags.push({
                    type: 'FAIL',
                    businessName: lead.businessName,
                    reason: `Category Mismatch: Expected "${targetNiche}", but API returned [${rawTypes.join(', ')}].`
                });
                score -= 10;
            }
        });

        // Clamp score
        const finalScore = Math.max(0, score);

        return {
            accuracyScore: finalScore,
            totalLeads: leads.length,
            flags
        };
    }
};
