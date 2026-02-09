import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';

/**
 * GDPR Data Export Service
 * Allows users to export all their personal data (GDPR Article 15 & 20)
 */

export interface UserDataExport {
    user: any;
    profile: any;
    tenantMemberships: any[];
    projects: any[];
    tasks: any[];
    documents: any[];
    contracts: any[];
    invoices: any[];
    calendar_events: any[];
    notifications: any[];
    activity_logs: any[];
    consents: any[];
    exportedAt: string;
}

export const dataExportService = {
    /**
     * Export all user data in machine-readable format (JSON)
     * GDPR Article 20: Right to data portability
     */
    async exportUserData(userId: string): Promise<UserDataExport> {
        try {
            // Get user basic info
            const { data: user } = await supabase.auth.admin.getUserById(userId);

            // Get profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            // Get tenant memberships
            const { data: tenantMemberships } = await supabase
                .from('tenant_users')
                .select(`
                    *,
                    tenants (
                        id,
                        name,
                        subscription_plan
                    )
                `)
                .eq('user_id', userId);

            // Get all tenant IDs user belongs to
            const tenantIds = tenantMemberships?.map(tm => tm.tenant_id) || [];

            // Get projects (user is member of)
            const { data: projects } = await supabase
                .from('projects')
                .select('*')
                .in('tenant_id', tenantIds);

            // Get tasks assigned to user
            const { data: tasks } = await supabase
                .from('tasks')
                .select('*')
                .eq('assigned_to', userId);

            // Get documents created by user
            const { data: documents } = await supabase
                .from('documents')
                .select('*')
                .eq('created_by', userId);

            // Get contracts involving user
            const { data: contracts } = await supabase
                .from('contracts')
                .select('*')
                .or(`client_id.eq.${userId},created_by.eq.${userId}`);

            // Get invoices
            const { data: invoices } = await supabase
                .from('invoices')
                .select('*')
                .in('tenant_id', tenantIds);

            // Get calendar events
            const { data: calendar_events } = await supabase
                .from('calendar_events')
                .select('*')
                .eq('user_id', userId);

            // Get notifications
            const { data: notifications } = await supabase
                .from('notification_queue')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(1000); // Last 1000 notifications

            // Get activity logs (if exists)
            const { data: activity_logs } = await supabase
                .from('audit_logs')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(1000); // Last 1000 activities

            // Get consent records
            const { data: consents } = await supabase
                .from('user_consents')
                .select('*')
                .eq('user_id', userId);

            // Log the export request
            await this.logExportRequest(userId);

            return {
                user: {
                    id: user?.user?.id,
                    email: user?.user?.email,
                    created_at: user?.user?.created_at,
                    last_sign_in_at: user?.user?.last_sign_in_at,
                },
                profile,
                tenantMemberships: tenantMemberships || [],
                projects: projects || [],
                tasks: tasks || [],
                documents: documents || [],
                contracts: contracts || [],
                invoices: invoices || [],
                calendar_events: calendar_events || [],
                notifications: notifications || [],
                activity_logs: activity_logs || [],
                consents: consents || [],
                exportedAt: new Date().toISOString(),
            };
        } catch (error) {
            console.error('Error exporting user data:', error);
            throw new Error('Failed to export user data');
        }
    },

    /**
     * Generate downloadable JSON file
     */
    async generateExportFile(userId: string): Promise<Blob> {
        const data = await this.exportUserData(userId);
        const json = JSON.stringify(data, null, 2);
        return new Blob([json], { type: 'application/json' });
    },

    /**
     * Generate human-readable HTML report
     */
    async generateHtmlReport(userId: string): Promise<string> {
        const data = await this.exportUserData(userId);

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Personal Data Export - AlphaClone</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 40px auto; padding: 20px; }
        h1 { color: #1e40af; }
        h2 { color: #3b82f6; border-bottom: 2px solid #ddd; padding-bottom: 10px; margin-top: 30px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f3f4f6; font-weight: 600; }
        .section { margin-bottom: 40px; }
        .meta { color: #666; font-size: 14px; }
        .count { color: #10b981; font-weight: bold; }
    </style>
</head>
<body>
    <h1>Personal Data Export</h1>
    <p class="meta">Exported on: ${format(new Date(), 'PPpp')}</p>
    <p class="meta">User ID: ${data.user.id}</p>

    <div class="section">
        <h2>Account Information</h2>
        <table>
            <tr><th>Field</th><th>Value</th></tr>
            <tr><td>Email</td><td>${data.user.email}</td></tr>
            <tr><td>Account Created</td><td>${data.user.created_at ? format(new Date(data.user.created_at), 'PPpp') : 'N/A'}</td></tr>
            <tr><td>Last Sign In</td><td>${data.user.last_sign_in_at ? format(new Date(data.user.last_sign_in_at), 'PPpp') : 'N/A'}</td></tr>
        </table>
    </div>

    <div class="section">
        <h2>Profile Information</h2>
        <table>
            <tr><th>Field</th><th>Value</th></tr>
            <tr><td>Full Name</td><td>${data.profile?.full_name || 'N/A'}</td></tr>
            <tr><td>Company</td><td>${data.profile?.company || 'N/A'}</td></tr>
            <tr><td>Phone</td><td>${data.profile?.phone || 'N/A'}</td></tr>
        </table>
    </div>

    <div class="section">
        <h2>Tenant Memberships</h2>
        <p class="count">${data.tenantMemberships.length} tenant(s)</p>
        <table>
            <tr><th>Tenant Name</th><th>Role</th><th>Joined</th></tr>
            ${data.tenantMemberships.map(tm => `
                <tr>
                    <td>${tm.tenants?.name || 'Unknown'}</td>
                    <td>${tm.role}</td>
                    <td>${tm.joined_at ? format(new Date(tm.joined_at), 'PP') : 'N/A'}</td>
                </tr>
            `).join('')}
        </table>
    </div>

    <div class="section">
        <h2>Projects</h2>
        <p class="count">${data.projects.length} project(s)</p>
    </div>

    <div class="section">
        <h2>Tasks</h2>
        <p class="count">${data.tasks.length} task(s)</p>
    </div>

    <div class="section">
        <h2>Documents</h2>
        <p class="count">${data.documents.length} document(s)</p>
    </div>

    <div class="section">
        <h2>Contracts</h2>
        <p class="count">${data.contracts.length} contract(s)</p>
    </div>

    <div class="section">
        <h2>Calendar Events</h2>
        <p class="count">${data.calendar_events.length} event(s)</p>
    </div>

    <div class="section">
        <h2>Notifications</h2>
        <p class="count">${data.notifications.length} notification(s) (last 1000)</p>
    </div>

    <div class="section">
        <h2>Activity Logs</h2>
        <p class="count">${data.activity_logs.length} log entries (last 1000)</p>
    </div>

    <div class="section">
        <h2>Consent Records</h2>
        <p class="count">${data.consents.length} consent(s)</p>
        <table>
            <tr><th>Type</th><th>Granted</th><th>Date</th></tr>
            ${data.consents.map((c: any) => `
                <tr>
                    <td>${c.consent_type}</td>
                    <td>${c.granted ? '✅ Yes' : '❌ No'}</td>
                    <td>${c.granted_at ? format(new Date(c.granted_at), 'PPpp') : 'N/A'}</td>
                </tr>
            `).join('')}
        </table>
    </div>

    <hr style="margin: 40px 0;">
    <p class="meta">
        This export contains all personal data AlphaClone has stored about you.
        For questions, contact privacy@alphaclone.com
    </p>
</body>
</html>
        `;
    },

    /**
     * Log data export request for compliance audit trail
     */
    async logExportRequest(userId: string): Promise<void> {
        try {
            await supabase.from('data_processing_logs').insert({
                user_id: userId,
                action: 'export',
                requested_at: new Date().toISOString(),
                completed_at: new Date().toISOString(),
                status: 'completed',
            });
        } catch (error) {
            console.error('Error logging export request:', error);
        }
    },

    /**
     * Check if user has pending export request
     */
    async hasPendingExport(userId: string): Promise<boolean> {
        const { data } = await supabase
            .from('data_processing_logs')
            .select('id')
            .eq('user_id', userId)
            .eq('action', 'export')
            .eq('status', 'pending')
            .limit(1);

        return (data?.length || 0) > 0;
    },
};
