import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export interface AccountDeletionResult {
    success: boolean;
    userId: string;
    error?: string;
}

const GRACE_PERIOD_DAYS = 30;
export const INACTIVE_ACCOUNT_DISABLE_DAYS = 60;
export const DISABLED_ACCOUNT_PURGE_DAYS = 6;

function normalizeEmail(email: string | null | undefined): string | null {
    if (!email) return null;
    const normalized = email.trim().toLowerCase();
    return normalized || null;
}

async function safeDelete(admin: ReturnType<typeof createSupabaseAdminClient>, table: string, column: string, userId: string) {
    const { error } = await admin.from(table).delete().eq(column, userId);
    if (error) {
        console.warn(`[accountDeletion] skipped ${table}:`, error.message);
    }
}

async function safeUpdate(
    admin: ReturnType<typeof createSupabaseAdminClient>,
    table: string,
    column: string,
    userId: string,
    values: Record<string, unknown>
) {
    const { error } = await admin.from(table).update(values).eq(column, userId);
    if (error) {
        console.warn(`[accountDeletion] skipped update ${table}:`, error.message);
    }
}

/**
 * Server-side account lifecycle: schedule, cancel, and full purge.
 * Uses the service-role client so auth.users can be removed and sessions invalidated.
 */
export const accountDeletionService = {
    async scheduleAccountDeletion(userId: string): Promise<AccountDeletionResult> {
        const admin = createSupabaseAdminClient();
        const scheduledAt = new Date();
        scheduledAt.setDate(scheduledAt.getDate() + GRACE_PERIOD_DAYS);

        const { error } = await admin
            .from('profiles')
            .update({
                account_status: 'pending_deletion',
                scheduled_deletion_at: scheduledAt.toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

        if (error) {
            return { success: false, userId, error: error.message };
        }

        await safeUpdate(admin, 'notification_preferences', 'user_id', userId, {
            email_enabled: false,
            push_enabled: false,
            sms_enabled: false,
        });

        return { success: true, userId };
    },

    async cancelAccountDeletion(userId: string): Promise<AccountDeletionResult> {
        const admin = createSupabaseAdminClient();

        const { error } = await admin
            .from('profiles')
            .update({
                account_status: 'active',
                scheduled_deletion_at: null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

        if (error) {
            return { success: false, userId, error: error.message };
        }

        return { success: true, userId };
    },

    /**
     * Permanently remove a user and anonymize or delete associated records.
     */
    async purgeUserAccount(userId: string, reason = 'admin_delete'): Promise<AccountDeletionResult> {
        const admin = createSupabaseAdminClient();

        try {
            let userEmail: string | null = null;
            const authUserResult = await admin.auth.admin.getUserById(userId);
            userEmail = normalizeEmail(authUserResult.data.user?.email);

            if (!userEmail) {
                const { data: profileRow } = await admin
                    .from('profiles')
                    .select('email')
                    .eq('id', userId)
                    .maybeSingle();
                userEmail = normalizeEmail((profileRow as { email?: string | null } | null)?.email);
            }

            if (userEmail) {
                const { error: blockError } = await admin
                    .from('blocked_account_emails')
                    .upsert({
                        normalized_email: userEmail,
                        reason,
                        user_id: userId,
                        blocked_at: new Date().toISOString(),
                        metadata: { source: 'accountDeletionService' },
                    }, { onConflict: 'normalized_email' });

                if (blockError) {
                    return { success: false, userId, error: `Failed to block deleted email: ${blockError.message}` };
                }
            }

            await safeDelete(admin, 'user_api_keys', 'user_id', userId);
            await safeDelete(admin, 'notification_preferences', 'user_id', userId);
            await safeDelete(admin, 'notification_queue', 'user_id', userId);
            await safeDelete(admin, 'calendar_events', 'user_id', userId);
            await safeDelete(admin, 'calendar_sync_tokens', 'user_id', userId);
            await safeDelete(admin, 'user_consents', 'user_id', userId);
            await safeDelete(admin, 'upgrade_prompts', 'user_id', userId);
            await safeDelete(admin, 'department_members', 'user_id', userId);
            await safeDelete(admin, 'tenant_users', 'user_id', userId);
            await safeDelete(admin, 'tenant_members', 'user_id', userId);
            await safeDelete(admin, 'mcp_sessions', 'user_id', userId);

            await safeUpdate(admin, 'tasks', 'assigned_to', userId, { assigned_to: null });
            await safeUpdate(admin, 'documents', 'created_by', userId, {
                created_by: null,
                updated_by: null,
                is_deleted: true,
            });
            await safeUpdate(admin, 'contracts', 'client_id', userId, {
                client_id: null,
                client_email: '[REDACTED]',
                client_name: '[REDACTED - User Deleted]',
            });
            await safeUpdate(admin, 'invoices', 'client_id', userId, {
                client_email: '[REDACTED]',
                client_name: '[REDACTED - User Deleted]',
            });
            await safeUpdate(admin, 'audit_logs', 'user_id', userId, {
                user_id: null,
                metadata: { anonymized: true, reason },
            });
            await safeUpdate(admin, 'conversion_events', 'user_id', userId, { user_id: null });

            const { error: profileError } = await admin.from('profiles').delete().eq('id', userId);
            if (profileError) {
                console.warn('[accountDeletion] profile delete:', profileError.message);
            }

            const { error: authError } = await admin.auth.admin.deleteUser(userId);
            if (authError) {
                return { success: false, userId, error: `Auth user deletion failed: ${authError.message}` };
            }

            return { success: true, userId };
        } catch (err) {
            return {
                success: false,
                userId,
                error: err instanceof Error ? err.message : 'Unknown error during account purge',
            };
        }
    },

    /**
     * Company policy:
     * - Accounts with no sign-in activity for 60 days are disabled.
     * - Disabled inactive accounts are permanently purged 6 days later.
     *
     * Uses Supabase Auth's last_sign_in_at as the source of truth, because a
     * normal logged-in super-admin session cannot delete auth.users.
     */
    async processInactiveAccounts(options?: {
        disableAfterDays?: number;
        purgeAfterDays?: number;
        maxUsers?: number;
    }): Promise<{
        disabled: number;
        purged: number;
        skippedAdmins: number;
        failed: string[];
    }> {
        const admin = createSupabaseAdminClient();
        const disableAfterDays = options?.disableAfterDays ?? INACTIVE_ACCOUNT_DISABLE_DAYS;
        const purgeAfterDays = options?.purgeAfterDays ?? DISABLED_ACCOUNT_PURGE_DAYS;
        const maxUsers = Math.max(1, Math.min(options?.maxUsers ?? 1000, 1000));
        const now = new Date();
        const disableCutoff = new Date(now.getTime() - disableAfterDays * 24 * 60 * 60 * 1000);
        const purgeCutoff = new Date(now.getTime() - purgeAfterDays * 24 * 60 * 60 * 1000);
        const failed: string[] = [];
        let disabled = 0;
        let purged = 0;
        let skippedAdmins = 0;

        const { data: disabledRows, error: disabledError } = await admin
            .from('profiles')
            .select('id, disabled_at')
            .eq('account_status', 'disabled')
            .lte('disabled_at', purgeCutoff.toISOString())
            .limit(maxUsers);

        if (disabledError) {
            failed.push(`disabled-list: ${disabledError.message}`);
        } else {
            for (const row of disabledRows || []) {
                const result = await this.purgeUserAccount(row.id, 'inactive_account_policy_purge');
                if (result.success) purged += 1;
                else failed.push(`${row.id}: ${result.error}`);
            }
        }

        let page = 1;
        const perPage = 100;
        while (disabled + purged + skippedAdmins + failed.length < maxUsers) {
            const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
            if (error) {
                failed.push(`auth-list: ${error.message}`);
                break;
            }
            const users = data.users || [];
            if (!users.length) break;

            const ids = users.map((user) => user.id);
            const { data: profiles, error: profileError } = await admin
                .from('profiles')
                .select('id, role, account_status')
                .in('id', ids);
            if (profileError) {
                failed.push(`profile-list:${page}: ${profileError.message}`);
                break;
            }
            const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));

            for (const user of users) {
                if (disabled + purged + skippedAdmins + failed.length >= maxUsers) break;
                const profile = profileById.get(user.id);
                if (!profile || profile.account_status !== 'active') continue;
                if (['admin', 'super_admin', 'platform_admin', 'platform_owner'].includes(String(profile.role || '').toLowerCase())) {
                    skippedAdmins += 1;
                    continue;
                }

                const lastActivity = user.last_sign_in_at || user.created_at;
                if (!lastActivity || new Date(lastActivity) > disableCutoff) continue;

                const disabledAt = now.toISOString();
                const scheduledDeletionAt = new Date(now.getTime() + purgeAfterDays * 24 * 60 * 60 * 1000).toISOString();
                const { error: banError } = await admin.auth.admin.updateUserById(user.id, {
                    ban_duration: '876000h',
                    app_metadata: {
                        ...(user.app_metadata || {}),
                        account_status: 'disabled',
                        disabled_reason: 'inactive_60_days',
                        disabled_at: disabledAt,
                    },
                });
                if (banError) {
                    failed.push(`${user.id}: auth disable failed: ${banError.message}`);
                    continue;
                }

                const { error: profileUpdateError } = await admin
                    .from('profiles')
                    .update({
                        account_status: 'disabled',
                        disabled_at: disabledAt,
                        disabled_reason: 'inactive_60_days',
                        scheduled_deletion_at: scheduledDeletionAt,
                        updated_at: disabledAt,
                    })
                    .eq('id', user.id);
                if (profileUpdateError) {
                    failed.push(`${user.id}: ${profileUpdateError.message}`);
                    await admin.auth.admin.updateUserById(user.id, {
                        ban_duration: 'none',
                        app_metadata: {
                            ...(user.app_metadata || {}),
                            account_status: 'active',
                            disabled_reason: null,
                            disabled_at: null,
                        },
                    });
                    continue;
                }
                disabled += 1;
            }

            if (users.length < perPage) break;
            page += 1;
        }

        return { disabled, purged, skippedAdmins, failed };
    },

    /** Process accounts whose grace period has expired. */
    async processScheduledDeletions(): Promise<{ processed: number; failed: string[] }> {
        const admin = createSupabaseAdminClient();
        const now = new Date().toISOString();

        const { data: due, error } = await admin
            .from('profiles')
            .select('id')
            .eq('account_status', 'pending_deletion')
            .lte('scheduled_deletion_at', now);

        if (error) {
            console.error('[accountDeletion] failed to list scheduled deletions:', error.message);
            return { processed: 0, failed: [] };
        }

        const failed: string[] = [];
        let processed = 0;

        for (const row of due || []) {
            const result = await this.purgeUserAccount(row.id, 'scheduled_deletion');
            if (result.success) {
                processed += 1;
            } else {
                failed.push(`${row.id}: ${result.error}`);
            }
        }

        return { processed, failed };
    },

    /**
     * Process GDPR/CCPA data_deletion_requests that were email-verified and are due.
     * Links to profiles by email and schedules or purges as configured.
     */
    async processVerifiedDataDeletionRequests(): Promise<{
        processed: number;
        scheduled: number;
        failed: string[];
    }> {
        const admin = createSupabaseAdminClient();
        const now = new Date().toISOString();
        const { data: due, error } = await admin
            .from('data_deletion_requests')
            .select('id, email, status, confirmation_code, user_id')
            .in('status', ['verified', 'confirmed', 'pending_purge'])
            .or(`scheduled_purge_at.is.null,scheduled_purge_at.lte.${now}`)
            .limit(50);

        if (error) {
            console.error('[accountDeletion] data_deletion_requests list failed:', error.message);
            return { processed: 0, scheduled: 0, failed: [] };
        }

        const failed: string[] = [];
        let processed = 0;
        let scheduled = 0;

        for (const row of due || []) {
            try {
                const email = normalizeEmail(row.email);
                let userId = row.user_id as string | null;
                if (!userId && email) {
                    const { data: profile } = await admin
                        .from('profiles')
                        .select('id')
                        .eq('email', email)
                        .maybeSingle();
                    userId = profile?.id || null;
                }

                if (userId) {
                    const schedule = await this.scheduleAccountDeletion(userId);
                    if (!schedule.success) {
                        failed.push(`${row.id}: ${schedule.error}`);
                        continue;
                    }
                    scheduled += 1;
                }

                await admin
                    .from('data_deletion_requests')
                    .update({
                        status: userId ? 'scheduled' : 'completed_no_account',
                        processed_at: now,
                        updated_at: now,
                        user_id: userId,
                    })
                    .eq('id', row.id);
                processed += 1;
            } catch (err) {
                failed.push(
                    `${row.id}: ${err instanceof Error ? err.message : 'unknown error'}`
                );
            }
        }

        return { processed, scheduled, failed };
    },
};
