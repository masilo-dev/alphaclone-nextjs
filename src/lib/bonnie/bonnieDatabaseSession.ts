import type { AgentInputItem, Session } from '@openai/agents';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

type SessionRow = { id: number; item: AgentInputItem };

/**
 * Persistent Agents SDK session scoped to one tenant/user pair.
 * It deliberately survives UI conversation boundaries so tool results and
 * unfinished model work can be resumed without browser-supplied chat history.
 */
export class BonnieDatabaseSession implements Session {
  readonly sessionId: string;
  private readonly tenantId: string;
  private readonly userId: string;

  constructor(params: { tenantId: string; userId: string }) {
    this.tenantId = params.tenantId;
    this.userId = params.userId;
    this.sessionId = `bonnie:${params.tenantId}:${params.userId}`;
  }

  async getSessionId(): Promise<string> {
    return this.sessionId;
  }

  async getItems(limit = 60): Promise<AgentInputItem[]> {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('bonnie_sdk_session_items')
      .select('id, item')
      .eq('tenant_id', this.tenantId)
      .eq('user_id', this.userId)
      .order('id', { ascending: false })
      .limit(Math.max(1, Math.min(limit, 200)));
    if (error) throw new Error(`Unable to load Bonnie SDK session: ${error.message}`);
    return ((data || []) as SessionRow[]).reverse().map((row) => row.item);
  }

  async addItems(items: AgentInputItem[]): Promise<void> {
    if (!items.length) return;
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from('bonnie_sdk_session_items').insert(
      items.map((item) => ({
        tenant_id: this.tenantId,
        user_id: this.userId,
        session_id: this.sessionId,
        item,
      }))
    );
    if (error) throw new Error(`Unable to persist Bonnie SDK session: ${error.message}`);
  }

  async popItem(): Promise<AgentInputItem | undefined> {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('bonnie_sdk_session_items')
      .select('id, item')
      .eq('tenant_id', this.tenantId)
      .eq('user_id', this.userId)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Unable to read Bonnie SDK session tail: ${error.message}`);
    if (!data) return undefined;
    const { error: deleteError } = await admin
      .from('bonnie_sdk_session_items')
      .delete()
      .eq('id', data.id)
      .eq('tenant_id', this.tenantId)
      .eq('user_id', this.userId);
    if (deleteError) throw new Error(`Unable to update Bonnie SDK session: ${deleteError.message}`);
    return data.item as AgentInputItem;
  }

  async clearSession(): Promise<void> {
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from('bonnie_sdk_session_items')
      .delete()
      .eq('tenant_id', this.tenantId)
      .eq('user_id', this.userId);
    if (error) throw new Error(`Unable to clear Bonnie SDK session: ${error.message}`);
  }
}
