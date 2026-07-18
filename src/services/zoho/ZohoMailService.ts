import { ZohoService } from './ZohoService';
import { routeAIRequest } from '@/services/aiRouter';
import { cleanAIJSONResponse } from '@/lib/utils';
import { ensureFooter, normalizeEmailSubject } from '@/lib/email/emailComposition';
import { extractEmailAddress, formatMailFrom } from '@/lib/email/parseEmailHeader';
import { syncExternalMessageAdmin, resolveContactByEmailAdmin } from '@/services/unified/unifiedMessageAdmin';
import { isAIProviderUnavailableError } from '@/lib/ai/providerHealth';

export interface ZohoMessage {
    messageId: string;
    threadId?: string;
    sender: string;
    subject: string;
    receivedTime: string;
    snippet: string;
    content?: string;
    hasAttachment: boolean;
    folderId: string;
}

export interface ZohoFullMessage {
    id: string;
    thread_id: string | null;
    subject: string;
    from: string;
    to: string[];
    cc: string[];
    date: string | null;
    is_read: boolean;
    body_html: string;
    body_text: string;
    attachments: Array<{ filename: string; size?: number; attachment_id?: string }>;
    folder_id?: string;
}

export interface ZohoFolder {
    folderId: string;
    folderName: string;
    unreadCount: number;
    totalCount: number;
}

export interface ZohoAccount {
    accountId: string;
    mailAddress: string;
    isPrimary: boolean;
    status: string;
}

function normalizeReplySubject(subject: string): string {
    const cleaned = normalizeEmailSubject(subject);
    if (!cleaned) return 'Re: Conversation';
    return /^re:/i.test(cleaned) ? cleaned : `Re: ${cleaned}`;
}

function autoReplyCooldownDays(): number {
    const parsed = Number(process.env.EMAIL_AUTO_REPLY_COOLDOWN_DAYS || '7');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
}

function normalizeSenderEmail(email: string): string {
    return String(email || '').trim().toLowerCase();
}

export class ZohoMailService extends ZohoService {
    private async ensureAccountId() {
        const accessToken = await this.getValidAccessToken();
        const config = await this.getConfig();
        if (!accessToken || !config?.mailApiHost) {
            return { accessToken: null, config: null };
        }

        if (config.accountId) {
            return { accessToken, config };
        }

        const accountsData = await this.getAccounts();
        const accountId = accountsData?.data?.[0]?.accountId;
        if (accountId) {
            await this.saveConfig({ accountId: String(accountId) });
            config.accountId = String(accountId);
        }

        return { accessToken, config };
    }

    private async getMailBase(): Promise<{ base: string; accountId: string }> {
        let config = await this.getConfig();
        if (!config?.mailApiHost) {
            // Attempt to recover if we have the accountsServer
            if (config?.accountsServer) {
                const accountsServer = config.accountsServer.toLowerCase();
                let inferredHost = 'mail.zoho.com';
                if (accountsServer.includes('.eu')) inferredHost = 'mail.zoho.eu';
                else if (accountsServer.includes('.in')) inferredHost = 'mail.zoho.in';
                else if (accountsServer.includes('.com.au')) inferredHost = 'mail.zoho.com.au';
                else if (accountsServer.includes('.jp')) inferredHost = 'mail.zoho.jp';
                else if (accountsServer.includes('.ca')) inferredHost = 'mail.zoho.ca';
                
                console.log(`[ZohoMailService] Inferring missing mailApiHost: ${inferredHost}`);
                await this.saveConfig({ mailApiHost: inferredHost });
                config = await this.getConfig(); // Refresh config after save
            }
            
            if (!config?.mailApiHost) {
                throw new Error('Zoho Mail is not fully configured. Please reconnect your account.');
            }
        }
        
        let accountId = config?.accountId;
        if (!accountId) {
            const { config: updatedConfig } = await this.ensureAccountId();
            accountId = updatedConfig?.accountId;
            if (!accountId) throw new Error('Zoho Mail not configured: missing accountId');
        }

        return {
            base: `https://${config.mailApiHost}/api/accounts/${accountId}`,
            accountId: accountId,
        };
    }

    async getAccounts() {
        const config = await this.getConfig();
        if (!config?.mailApiHost) throw new Error('Zoho Mail not configured: missing mailApiHost');
        return await this.callZohoAPI(`https://${config.mailApiHost}/api/accounts`);
    }

    async getSenderAddresses(): Promise<string[]> {
        try {
            const data = await this.getAccounts();
            const accounts = (data?.data || []) as any[];
            const addresses: string[] = [];
            
            for (const acc of accounts) {
                if (acc.primaryEmailAddress) addresses.push(acc.primaryEmailAddress);
                if (acc.incomingUserName) addresses.push(acc.incomingUserName);
                if (acc.mailAddress) addresses.push(acc.mailAddress);
                if (Array.isArray(acc.sendAsAddress)) {
                    addresses.push(...acc.sendAsAddress.map((s: any) => s.mailId || s.emailAddress || s).filter(Boolean));
                }
            }
            
            return [...new Set(addresses)].filter(Boolean);
        } catch (err) {
            console.error('[ZohoMailService] Failed to fetch sender addresses:', err);
            return [];
        }
    }

    async getFolders(): Promise<ZohoFolder[]> {
        const { base } = await this.getMailBase();
        const data = await this.callZohoAPI(`${base}/folders`);
        return (data?.data ?? []) as ZohoFolder[];
    }

    async getMessages(folderId: string, limit = 20, start = 1): Promise<ZohoMessage[]> {
        const { base } = await this.getMailBase();
        const url = `${base}/messages/view?folderId=${encodeURIComponent(folderId)}&limit=${limit}&start=${start}`;
        const data = await this.callZohoAPI(url);
        return (data?.data ?? []) as ZohoMessage[];
    }

    async getMessageContent(messageId: string, folderId: string) {
        const { base } = await this.getMailBase();
        const url = `${base}/folders/${encodeURIComponent(folderId)}/messages/${encodeURIComponent(messageId)}/content`;
        try {
            const data = await this.callZohoAPI(url);
            let contentStr = '';
            if (typeof data === 'string') contentStr = data;
            else if (data?.data) contentStr = typeof data.data === 'string' ? data.data : data.data.content || '';
            else if (data?.content) contentStr = data.content;

            if (contentStr) {
                contentStr = contentStr.replace(
                    /src=["'](?:https?:\/\/[^\/]+)?(\/api\/accounts\/[^"']+\/messages\/[^"']+\/attachments\/[^"']+)["']/gi,
                    (match, path) => {
                        return `src="/api/zoho/mail?action=proxy-image&path=${encodeURIComponent(path)}"`;
                    }
                );
            }
            return { content: contentStr };
        } catch (err: any) {
            if (err?.status === 404) {
                console.warn('[ZohoMailService] Message not found:', messageId);
                return { content: '', error: 'Retrieved failed.', status: 404 };
            }
            throw err;
        }
    }

    async getAttachmentInfo(messageId: string, folderId: string) {
        const { base } = await this.getMailBase();
        const data = await this.callZohoAPI(`${base}/folders/${encodeURIComponent(folderId)}/messages/${encodeURIComponent(messageId)}/attachmentinfo?includeInline=false`);
        const attachments = data?.data?.attachments || data?.attachments || [];
        return attachments.map((attachment: any) => ({
            fileName: attachment.attachmentName || attachment.fileName || 'attachment',
            fileSize: Number(attachment.attachmentSize || attachment.fileSize || 0),
            attachmentId: String(attachment.attachmentId || attachment.attachmentID || ''),
        })).filter((attachment: any) => attachment.attachmentId);
    }

    async downloadAttachment(messageId: string, folderId: string, attachmentId: string) {
        const { accountId } = await this.getMailBase();
        return this.proxyImage(`/api/accounts/${encodeURIComponent(accountId)}/folders/${encodeURIComponent(folderId)}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`);
    }

    async getFullMessagePayload(message: any, folderId?: string): Promise<ZohoFullMessage> {
        const resolvedFolderId = folderId || message.folderId || message.folder_id || '';
        const id = String(message.messageId || message.id || message.message_id || '');
        const { content } = resolvedFolderId && id
            ? await this.getMessageContent(id, resolvedFolderId)
            : { content: message.content || message.body || '' };
        const html = String(content || message.htmlContent || message.body_html || '');
        const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        const attachments = Array.isArray(message.attachments || message.attachmentInfo)
            ? (message.attachments || message.attachmentInfo).map((attachment: any) => ({
                filename: attachment.fileName || attachment.filename || attachment.name || 'attachment',
                size: Number(attachment.size || attachment.fileSize || 0) || undefined,
                attachment_id: attachment.attachmentId || attachment.id || attachment.storeName,
            }))
            : [];

        return {
            id,
            thread_id: String(message.threadId || message.thread_id || message.conversationId || id || '') || null,
            subject: String(message.subject || ''),
            from: formatMailFrom({
                name: String(message.sender || ''),
                address: String(message.fromAddress || message.from || ''),
                raw: String(message.sender || message.fromAddress || message.from || ''),
            }),
            to: String(message.toAddress || message.to || '').split(',').map((item) => item.trim()).filter(Boolean),
            cc: String(message.ccAddress || message.cc || '').split(',').map((item) => item.trim()).filter(Boolean),
            date: String(message.receivedTime || message.sentDateInGMT || message.date || message.createdTime || '') || null,
            is_read: Boolean(message.isRead ?? message.read ?? !message.unread),
            body_html: html,
            body_text: text,
            attachments,
            folder_id: resolvedFolderId || undefined,
        };
    }

    async getThread(threadId: string): Promise<ZohoFullMessage[]> {
        const folders = await this.getFolders();
        const allMessages: ZohoFullMessage[] = [];
        for (const folder of folders.slice(0, 8)) {
            const messages = await this.getMessages(folder.folderId, 100, 1).catch(() => []);
            const matches = messages.filter((message: any) =>
                String(message.threadId || message.conversationId || message.messageId) === threadId
            );
            for (const message of matches) {
                allMessages.push(await this.getFullMessagePayload(message, folder.folderId));
            }
        }
        return allMessages.sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
    }

    async proxyImage(path: string) {
        const config = await this.getConfig();
        const accessToken = await this.getValidAccessToken();
        if (!accessToken || !config?.mailApiHost) throw new Error('Unauthorized');
        if (!path.startsWith('/api/accounts')) throw new Error('Invalid proxy path');

        const url = `https://${config.mailApiHost}${path}`;
        const res = await fetch(url, {
            headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
        });
        if (!res.ok) throw new Error(`Failed to proxy image: ${res.status}`);
        return res;
    }

    async sendEmail(params: {
        fromAddress?: string;
        toAddress: string;
        subject: string;
        content: string;
        ccAddress?: string;
        bccAddress?: string;
        inReplyTo?: string;
        references?: string;
        attachments?: Array<{ filename: string; content: string; contentType?: string }>;
    }) {
        const { base } = await this.getMailBase();
        const validAddresses = await this.getSenderAddresses();
        
        if (!params.fromAddress || (validAddresses.length > 0 && !validAddresses.includes(params.fromAddress))) {
            const primary = validAddresses.length > 0 ? validAddresses[0] : null;
            if (primary) params.fromAddress = primary;
        }

        const subject = normalizeEmailSubject(params.subject);
        if (!subject) {
            throw new Error('Email subject is required.');
        }
        const toAddress = extractEmailAddress(params.toAddress);
        if (!toAddress.includes('@')) {
            throw new Error('Recipient email address is invalid.');
        }

        const result = await this.callZohoAPI(`${base}/messages`, {
            method: 'POST',
            body: JSON.stringify({
                ...params,
                toAddress,
                subject,
                content: ensureFooter(String(params.content || '')),
                attachments: params.attachments?.map((attachment) => ({
                    fileName: attachment.filename,
                    content: attachment.content,
                    contentType: attachment.contentType || 'application/octet-stream',
                })),
            }),
        });

        // Log the outbound email in unified_messages for contact/CRM sync
        try {
            const tenantId = this.tenantId;
            if (tenantId) {
                const supabase = this.getSupabaseClient();
                const { contact_id, company_id } = await resolveContactByEmailAdmin(supabase, tenantId, toAddress);
                
                await syncExternalMessageAdmin(supabase, {
                    tenant_id: tenantId,
                    contact_id,
                    company_id,
                    source: 'zoho',
                    external_id: result?.data?.messageId || result?.messageId || `zoho-outbound-${Date.now()}`,
                    direction: 'outbound',
                    channel: 'email',
                    subject,
                    body: params.content,
                    from_address: params.fromAddress,
                    to_address: toAddress,
                    cc_address: params.ccAddress,
                    bcc_address: params.bccAddress,
                    sent_at: new Date().toISOString(),
                });
            }
        } catch (logErr) {
            console.error('[ZohoMailService] Failed to log outbound email to unified_messages:', logErr);
        }

        return result;
    }

    async replyToMessage(params: {
        messageId: string;
        bodyHtml: string;
        bodyText?: string;
        attachments?: Array<{ filename: string; content: string; contentType?: string }>;
    }) {
        const folders = await this.getFolders();
        let original: ZohoFullMessage | null = null;
        for (const folder of folders.slice(0, 8)) {
            const messages = await this.getMessages(folder.folderId, 100, 1).catch(() => []);
            const hit = messages.find((message: any) => String(message.messageId || message.id) === params.messageId);
            if (hit) {
                original = await this.getFullMessagePayload(hit, folder.folderId);
                break;
            }
        }
        if (!original) throw new Error('Original Zoho message not found');
        const sentResult = await this.sendEmail({
            toAddress: original.from,
            subject: normalizeReplySubject(original.subject),
            content: params.bodyHtml || params.bodyText || '',
            inReplyTo: original.id,
            references: original.thread_id || original.id,
            attachments: params.attachments,
        });
        return { ...sentResult, original };
    }

    async searchMessages(query: string): Promise<ZohoMessage[]> {
        const { base } = await this.getMailBase();
        const data = await this.callZohoAPI(`${base}/messages/search?searchKey=${encodeURIComponent(query)}`);
        return (data?.data ?? []) as ZohoMessage[];
    }

    async deleteMessage(messageId: string, folderId: string) {
        const { base } = await this.getMailBase();
        try {
            return await this.callZohoAPI(
                `${base}/folders/${encodeURIComponent(folderId)}/messages/${encodeURIComponent(messageId)}`,
                { method: 'DELETE' }
            );
        } catch (err: any) {
            if (err?.status === 404) return { success: true };
            throw err;
        }
    }

    async archiveMessage(messageId: string, currentFolderId: string) {
        const folders = await this.getFolders();
        const archiveFolder = folders.find(f => f.folderName.toLowerCase().includes('archive'));
        if (!archiveFolder) throw new Error('Archive folder not found');

        const { base } = await this.getMailBase();
        return await this.callZohoAPI(
            `${base}/messages`,
            {
                method: 'PUT',
                body: JSON.stringify({ 
                    mode: 'moveMessage',
                    messageId: [messageId],
                    destfolderId: archiveFolder.folderId
                }),
            }
        );
    }

    private async resolveIncomingMessageMeta(
        messageId: string,
        folderId: string
    ): Promise<{ sender: string; subject: string; senderEmail: string }> {
        const { base } = await this.getMailBase();
        const detailsUrl = `${base}/folders/${encodeURIComponent(folderId)}/messages/${encodeURIComponent(messageId)}`;
        try {
            const data = await this.callZohoAPI(detailsUrl);
            const message = (data?.data ?? data) as Record<string, unknown>;
            const sender = formatMailFrom({
                name: String(message.fromName || message.senderName || ''),
                address: String(message.fromAddress || message.sender || message.from || ''),
                raw: String(message.sender || message.fromAddress || message.from || ''),
            });
            const subject = String(message.subject || 'No Subject');
            const senderEmail = extractEmailAddress(sender);
            if (senderEmail) {
                return { sender, subject, senderEmail };
            }
        } catch {
            // Fall back to inbox listing below.
        }

        const recent = await this.getMessages(folderId, 50, 1);
        const hit = recent.find((message) => message.messageId === messageId);
        if (hit) {
            const senderEmail = extractEmailAddress(hit.sender);
            return {
                sender: hit.sender,
                subject: hit.subject || 'No Subject',
                senderEmail,
            };
        }

        return { sender: 'Unknown', subject: 'No Subject', senderEmail: '' };
    }

    async markAsRead(messageId: string, folderId: string, isRead = true) {
        const { base } = await this.getMailBase();
        return await this.callZohoAPI(
            `${base}/messages`,
            {
                method: 'PUT',
                body: JSON.stringify({ 
                    mode: isRead ? 'markAsRead' : 'markAsUnRead',
                    messageId: [messageId]
                }),
            }
        );
    }

    async triageIncomingEmail(messageId: string, folderId: string) {
        try {
            const { createSupabaseAdminClient } = await import('@/lib/supabase-admin');
            const supabase = createSupabaseAdminClient();

            const { data: existingLog } = await supabase
                .from('zoho_auto_responder_logs')
                .select('id, triage_status')
                .eq('user_id', this.userId)
                .eq('message_id', messageId)
                .in('triage_status', ['scheduled', 'replied', 'pending', 'qualified', 'ignored', 'error'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (existingLog) {
                return { status: 'already_processed', triage_status: existingLog.triage_status };
            }

            const { content } = await this.getMessageContent(messageId, folderId);
            const { sender, subject, senderEmail } = await this.resolveIncomingMessageMeta(messageId, folderId);
            const normalizedSenderEmail = normalizeSenderEmail(senderEmail);

            if (!content) return { status: 'ignored', reason: 'empty_content' };

            if (!normalizedSenderEmail.includes('@')) {
                await supabase.from('zoho_auto_responder_logs').insert({
                    user_id: this.userId,
                    message_id: messageId,
                    sender,
                    sender_email: null,
                    subject,
                    triage_status: 'ignored',
                    ai_analysis: { reason: 'invalid_sender_email' },
                });
                return { status: 'ignored', reason: 'invalid_sender_email' };
            }

            const ownAddresses = (await this.getSenderAddresses())
                .map((address) => normalizeSenderEmail(address))
                .filter(Boolean);
            if (ownAddresses.includes(normalizedSenderEmail)) {
                await supabase.from('zoho_auto_responder_logs').insert({
                    user_id: this.userId,
                    message_id: messageId,
                    sender,
                    sender_email: normalizedSenderEmail,
                    subject,
                    triage_status: 'ignored',
                    ai_analysis: { reason: 'self_sent' },
                });
                return { status: 'ignored', reason: 'self_sent' };
            }

            const cooldownSince = new Date();
            cooldownSince.setDate(cooldownSince.getDate() - autoReplyCooldownDays());
            const { data: recentRecipientReply } = await supabase
                .from('zoho_auto_responder_logs')
                .select('id')
                .eq('user_id', this.userId)
                .eq('sender_email', normalizedSenderEmail)
                .in('triage_status', ['scheduled', 'replied'])
                .gte('created_at', cooldownSince.toISOString())
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (recentRecipientReply) {
                await supabase.from('zoho_auto_responder_logs').insert({
                    user_id: this.userId,
                    message_id: messageId,
                    sender,
                    sender_email: normalizedSenderEmail,
                    subject,
                    triage_status: 'ignored',
                    ai_analysis: {
                        reason: 'recipient_cooldown',
                        cooldown_days: autoReplyCooldownDays(),
                    },
                });
                return { status: 'ignored', reason: 'recipient_cooldown' };
            }

            try {
                const { captureUnifiedMessageFromWebhook } = await import('@/services/intelligence/signalCaptureAdminService');
                const admin = createSupabaseAdminClient();
                const { data: zohoIntegration } = await admin
                    .from('integrations')
                    .select('tenant_id, id')
                    .eq('tenant_id', this.tenantId)
                    .eq('user_id', this.userId)
                    .eq('type', 'zoho')
                    .eq('enabled', true)
                    .order('updated_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (zohoIntegration?.tenant_id) {
                    await captureUnifiedMessageFromWebhook({
                        supabase: admin as any,
                        tenantId: zohoIntegration.tenant_id,
                        source: 'zoho',
                        channel: 'email',
                        direction: 'inbound',
                        externalId: messageId,
                        threadId: messageId,
                        from: normalizedSenderEmail || sender,
                        to: `zoho:${this.userId}`,
                        subject,
                        text: content,
                        html: null,
                        receivedAt: new Date().toISOString(),
                        metadata: {
                            folderId,
                            integrationId: zohoIntegration.id,
                        },
                    });

                    try {
                        const { searchEmailContext } = await import('@/lib/scraper/emailLeadAutoSearch');
                        await searchEmailContext(zohoIntegration.tenant_id, sender, {
                            subject,
                            queueEnrichment: true,
                        });
                    } catch {
                        // Auto lead search is best-effort during inbox sync
                    }
                }
            } catch {
            }

            const triagePrompt = `
Analyze for AlphaClone Systems:
Subject: ${subject}
From: ${sender}
Content: ${content.substring(0, 2000)}

Your goal is to determine if this is a high-intent business inquiry or lead.
Return ONLY a valid JSON object in this format: 
{ "status": "qualified" | "ignored", "draft_reply": "Professional, helpful response moving the discussion forward" }

Rules:
- Respond in plain text. No markdown.
- Qualified if it's a real lead, commercial question, or partnership inquiry.
- Ignored if it's spam, newsletter, or irrelevant personal mail.
`;
            
            // Use the unified AI router which tries Claude -> GPT-4 -> Gemini
            const aiResponse = await routeAIRequest({
                prompt: triagePrompt,
                maxTokens: 1000,
                temperature: 0.3
            });

            if (!aiResponse.success || !aiResponse.content) {
                throw new Error('AI Triage failed: ' + aiResponse.error);
            }

            const cleaned = cleanAIJSONResponse(aiResponse.content);
            const data = JSON.parse(cleaned || '{"status":"ignored"}');

            if (data.status === 'qualified') {
                const draftReply = ensureFooter(String(data.draft_reply || '').trim());
                if (!draftReply) {
                    await supabase.from('zoho_auto_responder_logs').insert({
                        user_id: this.userId,
                        message_id: messageId,
                        sender,
                        sender_email: normalizedSenderEmail,
                        subject,
                        triage_status: 'ignored',
                        ai_analysis: { classification: 'qualified', reason: 'empty_draft_reply' },
                    });
                    return { status: 'ignored', reason: 'empty_draft_reply' };
                }

                const { data: log } = await supabase.from('zoho_auto_responder_logs').insert({
                    user_id: this.userId,
                    message_id: messageId,
                    sender,
                    sender_email: normalizedSenderEmail,
                    subject,
                    triage_status: 'scheduled',
                    draft_reply: draftReply,
                    ai_analysis: { classification: 'qualified' },
                }).select().single();

                if (log) {
                    const { Client } = await import('@upstash/qstash');
                    const qstash = new Client({ token: process.env.QSTASH_TOKEN || '' });
                    const autoReplyDelaySeconds = Number(process.env.EMAIL_AUTO_REPLY_DELAY_SECONDS || '3600');
                    await qstash.publishJSON({
                        url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/zoho/process-reply`,
                        body: {
                            userId: this.userId,
                            tenantId: this.tenantId,
                            messageId,
                            folderId,
                            senderEmail: normalizedSenderEmail,
                            originalSubject: normalizeReplySubject(subject),
                            replyText: draftReply,
                            logId: log.id,
                        },
                        delay: autoReplyDelaySeconds,
                    });
                }
            } else {
                await supabase.from('zoho_auto_responder_logs').insert({
                    user_id: this.userId,
                    message_id: messageId,
                    sender,
                    sender_email: normalizedSenderEmail,
                    subject,
                    triage_status: 'ignored',
                    ai_analysis: { classification: 'ignored' },
                });
            }
            return data;
        } catch (e) {
            if (isAIProviderUnavailableError(e)) {
                console.warn('[ZohoMailService] Triage skipped: AI provider cooldown active');
                return { status: 'deferred_provider_blocked' };
            }
            console.error('[ZohoMailService] Triage error:', e);
            return { status: 'error' };
        }
    }

    async subscribeToNotifications() {
        const config = await this.getConfig();
        if (!config) throw new Error('Zoho config not found');
        const url = `https://${config.mailApiHost}/api/notifications/v1/subscriptions`;
        return await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Zoho-oauthtoken ${await this.getValidAccessToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                channelId: `zoho:${this.tenantId}:${this.userId}`,
                notifyUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/zoho/incoming`,
                resource: '/api/v1/messages',
                event: 'NEW_MAIL'
            })
        }).then(r => r.json());
    }
}
