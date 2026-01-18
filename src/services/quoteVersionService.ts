import { supabase } from '../lib/supabase';
import { auditLoggingService } from './auditLoggingService';

export interface Quote {
    id: string;
    client_id: string;
    project_id?: string;
    version: number;
    title: string;
    items: QuoteItem[];
    subtotal: number;
    tax: number;
    total: number;
    status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
    valid_until: string;
    created_at: string;
    updated_at: string;
    created_by: string;
}

export interface QuoteItem {
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
}

export interface QuoteVersion {
    version: number;
    quote: Quote;
    changes: string[];
    created_at: string;
    created_by: string;
}

export interface QuoteComparison {
    version1: Quote;
    version2: Quote;
    differences: {
        field: string;
        oldValue: any;
        newValue: any;
    }[];
}

class QuoteVersionService {
    /**
     * Create new quote version
     */
    async createVersion(
        quoteId: string,
        updates: Partial<Quote>,
        userId: string,
        changeNotes?: string
    ): Promise<{ version: Quote | null; error?: string }> {
        try {
            // Get current quote
            const { data: currentQuote } = await supabase
                .from('quotes')
                .select('*')
                .eq('id', quoteId)
                .single();

            if (!currentQuote) {
                return { version: null, error: 'Quote not found' };
            }

            // Archive current version
            await this.archiveVersion(currentQuote);

            // Create new version
            const newVersion = currentQuote.version + 1;
            const updatedQuote = {
                ...currentQuote,
                ...updates,
                version: newVersion,
                updated_at: new Date().toISOString(),
            };

            const { data: newQuote, error } = await supabase
                .from('quotes')
                .update(updatedQuote)
                .eq('id', quoteId)
                .select()
                .single();

            if (error) {
                return { version: null, error: error.message };
            }

            // Log version creation
            await auditLoggingService.logAction(
                'quote_version_created',
                'quote',
                quoteId,
                { version: currentQuote.version },
                { version: newVersion, changes: changeNotes }
            );

            return { version: newQuote };
        } catch (error) {
            return { version: null, error: String(error) };
        }
    }

    /**
     * Archive quote version
     */
    private async archiveVersion(quote: Quote): Promise<void> {
        try {
            await supabase.from('quote_versions').insert({
                quote_id: quote.id,
                version: quote.version,
                data: quote,
                created_at: new Date().toISOString(),
            });
        } catch (error) {
            console.error('Error archiving quote version:', error);
        }
    }

    /**
     * Get all versions of a quote
     */
    async getVersionHistory(quoteId: string): Promise<QuoteVersion[]> {
        try {
            const { data: versions } = await supabase
                .from('quote_versions')
                .select('*')
                .eq('quote_id', quoteId)
                .order('version', { ascending: false });

            if (!versions) return [];

            return versions.map(v => ({
                version: v.version,
                quote: v.data,
                changes: v.changes || [],
                created_at: v.created_at,
                created_by: v.data.created_by,
            }));
        } catch (error) {
            console.error('Error fetching version history:', error);
            return [];
        }
    }

    /**
     * Compare two quote versions
     */
    async compareVersions(
        quoteId: string,
        version1: number,
        version2: number
    ): Promise<QuoteComparison | null> {
        try {
            const versions = await this.getVersionHistory(quoteId);

            const v1 = versions.find(v => v.version === version1);
            const v2 = versions.find(v => v.version === version2);

            if (!v1 || !v2) {
                return null;
            }

            const differences: QuoteComparison['differences'] = [];

            // Compare key fields
            const fieldsToCompare = ['total', 'subtotal', 'tax', 'status', 'valid_until'];

            fieldsToCompare.forEach(field => {
                if (v1.quote[field as keyof Quote] !== v2.quote[field as keyof Quote]) {
                    differences.push({
                        field,
                        oldValue: v1.quote[field as keyof Quote],
                        newValue: v2.quote[field as keyof Quote],
                    });
                }
            });

            // Compare items
            if (JSON.stringify(v1.quote.items) !== JSON.stringify(v2.quote.items)) {
                differences.push({
                    field: 'items',
                    oldValue: v1.quote.items,
                    newValue: v2.quote.items,
                });
            }

            return {
                version1: v1.quote,
                version2: v2.quote,
                differences,
            };
        } catch (error) {
            console.error('Error comparing versions:', error);
            return null;
        }
    }

    /**
     * Restore previous version
     */
    async restoreVersion(
        quoteId: string,
        version: number,
        userId: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const versions = await this.getVersionHistory(quoteId);
            const targetVersion = versions.find(v => v.version === version);

            if (!targetVersion) {
                return { success: false, error: 'Version not found' };
            }

            // Create new version from old data
            const result = await this.createVersion(
                quoteId,
                targetVersion.quote,
                userId,
                `Restored from version ${version}`
            );

            return { success: !!result.version, error: result.error };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Track quote acceptance
     */
    async trackAcceptance(
        quoteId: string,
        version: number
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('quotes')
                .update({
                    status: 'accepted',
                    accepted_version: version,
                    accepted_at: new Date().toISOString(),
                })
                .eq('id', quoteId);

            if (error) {
                return { success: false, error: error.message };
            }

            await auditLoggingService.logAction(
                'quote_accepted',
                'quote',
                quoteId,
                undefined,
                { version, accepted_at: new Date().toISOString() }
            );

            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Get quote statistics
     */
    async getQuoteStats(): Promise<{
        totalQuotes: number;
        acceptanceRate: number;
        averageRevisions: number;
        averageTimeToAcceptance: number;
    }> {
        try {
            const { data: quotes } = await supabase
                .from('quotes')
                .select('*');

            if (!quotes || quotes.length === 0) {
                return {
                    totalQuotes: 0,
                    acceptanceRate: 0,
                    averageRevisions: 0,
                    averageTimeToAcceptance: 0,
                };
            }

            const acceptedQuotes = quotes.filter(q => q.status === 'accepted');
            const acceptanceRate = (acceptedQuotes.length / quotes.length) * 100;

            const totalRevisions = quotes.reduce((sum, q) => sum + (q.version || 1), 0);
            const averageRevisions = totalRevisions / quotes.length;

            const acceptanceTimes = acceptedQuotes
                .filter(q => q.accepted_at && q.created_at)
                .map(q => {
                    const created = new Date(q.created_at);
                    const accepted = new Date(q.accepted_at);
                    return (accepted.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
                });

            const averageTimeToAcceptance = acceptanceTimes.length > 0
                ? acceptanceTimes.reduce((sum, time) => sum + time, 0) / acceptanceTimes.length
                : 0;

            return {
                totalQuotes: quotes.length,
                acceptanceRate,
                averageRevisions,
                averageTimeToAcceptance,
            };
        } catch (error) {
            console.error('Error calculating quote stats:', error);
            return {
                totalQuotes: 0,
                acceptanceRate: 0,
                averageRevisions: 0,
                averageTimeToAcceptance: 0,
            };
        }
    }

    /**
     * Auto-expire old quotes
     */
    async expireOldQuotes(): Promise<{ expired: number }> {
        try {
            const today = new Date();

            const { data: expiredQuotes } = await supabase
                .from('quotes')
                .update({ status: 'expired' })
                .lt('valid_until', today.toISOString())
                .in('status', ['draft', 'sent'])
                .select();

            return { expired: expiredQuotes?.length || 0 };
        } catch (error) {
            console.error('Error expiring quotes:', error);
            return { expired: 0 };
        }
    }
}

export const quoteVersionService = new QuoteVersionService();
