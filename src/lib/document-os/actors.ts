/**
 * Actor identity — never accept model-provided actor claims.
 * Resolve from authenticated server session only.
 */

import type { ActorType, DocumentActor } from './types';

const AI_ACTOR_MAP: Record<string, ActorType> = {
  chatgpt: 'chatgpt',
  openai: 'chatgpt',
  claude: 'claude',
  anthropic: 'claude',
  gemini: 'gemini',
  google: 'gemini',
  deepseek: 'deepseek',
  bonnie: 'bonnie',
  cursor: 'cursor',
};

export interface AuthenticatedSession {
  userId: string;
  userName?: string;
  sessionId?: string;
  oauthClientId?: string;
  ipAddress?: string;
  userAgent?: string;
  /** Server-classified client channel — not model input. */
  channel?:
    | 'dashboard'
    | 'api'
    | 'mcp_chatgpt'
    | 'mcp_claude'
    | 'mcp_cursor'
    | 'mcp_bonnie'
    | 'mcp_gemini'
    | 'mcp_deepseek'
    | 'workflow'
    | 'integration'
    | 'system';
  correlationId?: string;
}

/**
 * Resolve actor from the authenticated session.
 * Model-supplied actor_type / actor_id / actor_name are ignored.
 */
export function resolveActorFromSession(
  session: AuthenticatedSession,
  _untrustedModelInput?: Record<string, unknown>
): DocumentActor {
  // Intentionally ignore _untrustedModelInput for identity fields.
  const channel = session.channel || 'dashboard';
  let actorType: ActorType = 'user';
  let actorName = session.userName || 'User';

  if (channel === 'system') {
    actorType = 'system';
    actorName = 'System';
  } else if (channel === 'workflow') {
    actorType = 'workflow';
    actorName = session.userName || 'Workflow';
  } else if (channel === 'integration') {
    actorType = 'integration';
    actorName = session.userName || 'Integration';
  } else if (channel === 'api') {
    actorType = 'api_client';
    actorName = session.userName || 'API Client';
  } else if (channel.startsWith('mcp_')) {
    const key = channel.replace('mcp_', '');
    actorType = AI_ACTOR_MAP[key] || 'api_client';
    actorName = session.userName || actorType;
  }

  return {
    actor_type: actorType,
    actor_id: session.userId,
    actor_name: actorName,
    authenticated_session_id: session.sessionId,
    oauth_client_id: session.oauthClientId,
    ip_address: session.ipAddress,
    user_agent: session.userAgent,
    correlation_id: session.correlationId,
    timestamp: new Date().toISOString(),
  };
}

export function systemActor(correlationId?: string): DocumentActor {
  return resolveActorFromSession({
    userId: 'system',
    userName: 'System',
    channel: 'system',
    correlationId,
  });
}
