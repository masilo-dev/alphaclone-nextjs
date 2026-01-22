import { supabase } from '../lib/supabase';
import { auditLoggingService } from './auditLoggingService';

export interface Contract {
    id: string;
    client_id: string;
    project_id?: string;
    title: string;
    content: string;
    status: 'draft' | 'sent' | 'signed' | 'expired' | 'terminated';
    start_date: string;
    end_date: string;
    auto_renew: boolean;
    renewal_notice_days: number;
    created_at: string;
    updated_at: string;
    signed_at?: string;
}

export interface ExpirationAlert {
    contract: Contract;
    daysUntilExpiration: number;
    alertLevel: 'info' | 'warning' | 'urgent';
    recommendedAction: string;
}

class ContractExpirationService {
    /**
     * Get contracts expiring soon
     */
    async getExpiringContracts(daysAhead: number = 90): Promise<Contract[]> {
        try {
            const today = new Date();
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + daysAhead);

            const { data: contracts } = await supabase
                .from('contracts')
                .select('*')
                .eq('status', 'signed')
                .gte('end_date', today.toISOString())
                .lte('end_date', futureDate.toISOString())
                .order('end_date', { ascending: true });

            return contracts || [];
        } catch (error) {
            console.error('Error fetching expiring contracts:', error);
            return [];
        }
    }

    /**
     * Get expiration alerts with priority levels
     */
    async getExpirationAlerts(): Promise<ExpirationAlert[]> {
        try {
            const contracts = await this.getExpiringContracts(90);
            const today = new Date();

            return contracts.map((contract: any) => {
                const endDate = new Date(contract.end_date);
                const daysUntilExpiration = Math.ceil(
                    (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                );

                let alertLevel: 'info' | 'warning' | 'urgent';
                let recommendedAction: string;

                if (daysUntilExpiration <= 30) {
                    alertLevel = 'urgent';
                    recommendedAction = contract.auto_renew
                        ? 'Prepare renewal documents immediately'
                        : 'Contact client urgently about renewal or termination';
                } else if (daysUntilExpiration <= 60) {
                    alertLevel = 'warning';
                    recommendedAction = contract.auto_renew
                        ? 'Review renewal terms and notify client'
                        : 'Schedule renewal discussion with client';
                } else {
                    alertLevel = 'info';
                    recommendedAction = 'Monitor and plan for renewal discussion';
                }

                return {
                    contract,
                    daysUntilExpiration,
                    alertLevel,
                    recommendedAction,
                };
            });
        } catch (error) {
            console.error('Error generating expiration alerts:', error);
            return [];
        }
    }

    /**
     * Send expiration notifications
     */
    async sendExpirationNotifications(): Promise<{ sent: number; errors: number }> {
        try {
            const alerts = await this.getExpirationAlerts();
            let sent = 0;
            let errors = 0;

            for (const alert of alerts) {
                try {
                    // Send notification based on alert level
                    if (alert.alertLevel === 'urgent' || alert.alertLevel === 'warning') {
                        await this.notifyContractExpiration(alert);
                        sent++;
                    }
                } catch (error) {
                    console.error('Error sending notification:', error);
                    errors++;
                }
            }

            return { sent, errors };
        } catch (error) {
            console.error('Error in notification batch:', error);
            return { sent: 0, errors: 0 };
        }
    }

    /**
     * Notify admin and client of contract expiration
     */
    private async notifyContractExpiration(alert: ExpirationAlert): Promise<void> {
        try {
            const { contract, daysUntilExpiration, recommendedAction } = alert;

            // Create notification message
            const message = {
                sender_id: 'system',
                recipient_id: contract.client_id,
                text: `Your contract "${contract.title}" will expire in ${daysUntilExpiration} days. ${recommendedAction}`,
                priority: alert.alertLevel === 'urgent' ? 'high' : 'normal',
                created_at: new Date().toISOString(),
            };

            await supabase.from('messages').insert(message);

            // Log notification
            await auditLoggingService.logAction(
                'contract_expiration_notification_sent',
                'contract',
                contract.id,
                undefined,
                { days_until_expiration: daysUntilExpiration, alert_level: alert.alertLevel }
            );

            // In production, also send email
            // await emailService.sendContractExpirationEmail(contract, daysUntilExpiration);
        } catch (error) {
            console.error('Error sending contract expiration notification:', error);
        }
    }

    /**
     * Auto-renew eligible contracts
     */
    async processAutoRenewals(): Promise<{ renewed: number; errors: number }> {
        try {
            const today = new Date();
            const renewalWindow = new Date();
            renewalWindow.setDate(renewalWindow.getDate() + 30);

            const { data: contracts } = await supabase
                .from('contracts')
                .select('*')
                .eq('status', 'signed')
                .eq('auto_renew', true)
                .gte('end_date', today.toISOString())
                .lte('end_date', renewalWindow.toISOString());

            if (!contracts || contracts.length === 0) {
                return { renewed: 0, errors: 0 };
            }

            let renewed = 0;
            let errors = 0;

            for (const contract of contracts) {
                try {
                    await this.renewContract(contract.id);
                    renewed++;
                } catch (error) {
                    console.error(`Error renewing contract ${contract.id}:`, error);
                    errors++;
                }
            }

            return { renewed, errors };
        } catch (error) {
            console.error('Error processing auto-renewals:', error);
            return { renewed: 0, errors: 0 };
        }
    }

    /**
     * Renew a contract
     */
    async renewContract(contractId: string, newEndDate?: Date): Promise<{ success: boolean; error?: string }> {
        try {
            const { data: contract } = await supabase
                .from('contracts')
                .select('*')
                .eq('id', contractId)
                .single();

            if (!contract) {
                return { success: false, error: 'Contract not found' };
            }

            // Calculate new end date (1 year from current end date by default)
            const currentEndDate = new Date(contract.end_date);
            const renewedEndDate = newEndDate || new Date(currentEndDate.setFullYear(currentEndDate.getFullYear() + 1));

            // Update contract
            const { error } = await supabase
                .from('contracts')
                .update({
                    end_date: renewedEndDate.toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', contractId);

            if (error) {
                return { success: false, error: error.message };
            }

            // Log renewal
            await auditLoggingService.logAction(
                'contract_renewed',
                'contract',
                contractId,
                { end_date: contract.end_date },
                { end_date: renewedEndDate.toISOString() }
            );

            // Notify client
            await this.notifyContractRenewal(contract, renewedEndDate);

            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Notify client of contract renewal
     */
    private async notifyContractRenewal(contract: Contract, newEndDate: Date): Promise<void> {
        try {
            const message = {
                sender_id: 'system',
                recipient_id: contract.client_id,
                text: `Your contract "${contract.title}" has been renewed until ${newEndDate.toLocaleDateString()}.`,
                priority: 'normal',
                created_at: new Date().toISOString(),
            };

            await supabase.from('messages').insert(message);
        } catch (error) {
            console.error('Error sending renewal notification:', error);
        }
    }

    /**
     * Terminate contract
     */
    async terminateContract(
        contractId: string,
        reason: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('contracts')
                .update({
                    status: 'terminated',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', contractId);

            if (error) {
                return { success: false, error: error.message };
            }

            // Log termination
            await auditLoggingService.logAction(
                'contract_terminated',
                'contract',
                contractId,
                { status: 'signed' },
                { status: 'terminated', reason }
            );

            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Get contract renewal statistics
     */
    async getRenewalStats(): Promise<{
        totalActive: number;
        expiringIn30Days: number;
        expiringIn60Days: number;
        expiringIn90Days: number;
        autoRenewEnabled: number;
    }> {
        try {
            const today = new Date();
            const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
            const in60Days = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
            const in90Days = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);

            const [total, exp30, exp60, exp90, autoRenew] = await Promise.all([
                supabase.from('contracts').select('id', { count: 'exact' }).eq('status', 'signed'),
                supabase.from('contracts').select('id', { count: 'exact' }).eq('status', 'signed').lte('end_date', in30Days.toISOString()),
                supabase.from('contracts').select('id', { count: 'exact' }).eq('status', 'signed').lte('end_date', in60Days.toISOString()),
                supabase.from('contracts').select('id', { count: 'exact' }).eq('status', 'signed').lte('end_date', in90Days.toISOString()),
                supabase.from('contracts').select('id', { count: 'exact' }).eq('status', 'signed').eq('auto_renew', true),
            ]);

            return {
                totalActive: total.count || 0,
                expiringIn30Days: exp30.count || 0,
                expiringIn60Days: exp60.count || 0,
                expiringIn90Days: exp90.count || 0,
                autoRenewEnabled: autoRenew.count || 0,
            };
        } catch (error) {
            console.error('Error fetching renewal stats:', error);
            return {
                totalActive: 0,
                expiringIn30Days: 0,
                expiringIn60Days: 0,
                expiringIn90Days: 0,
                autoRenewEnabled: 0,
            };
        }
    }
}

export const contractExpirationService = new ContractExpirationService();
