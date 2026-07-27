import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  decryptIntegrationToken,
  encryptIntegrationToken,
} from '@/lib/integration/integrationTokenCrypto';
import crypto from 'crypto';

export interface XIntegration {
    id: string;
    tenant_id: string;
    user_id: string;
    x_user_id: string;
    x_username: string;
    access_token: string;
    refresh_token?: string;
    expires_at?: string;
    scopes?: string[];
    oauth1_access_token?: string;
    oauth1_token_secret?: string;
}

export interface XTweet {
    text: string;
    media_ids?: string[];
    reply_settings?: 'everyone' | 'following' | 'mentionedUsers';
}

async function readXSecrets(admin: ReturnType<typeof createSupabaseAdminClient>, integrationId: string) {
  const { data } = await admin
    .from('x_integration_secrets')
    .select('access_token_encrypted, refresh_token_encrypted, oauth1_access_token_encrypted, oauth1_token_secret_encrypted')
    .eq('integration_id', integrationId)
    .maybeSingle();
  if (!data) return null;
  return {
    access_token: data.access_token_encrypted ? await decryptIntegrationToken(String(data.access_token_encrypted)) : '',
    refresh_token: data.refresh_token_encrypted ? await decryptIntegrationToken(String(data.refresh_token_encrypted)) : undefined,
    oauth1_access_token: data.oauth1_access_token_encrypted ? await decryptIntegrationToken(String(data.oauth1_access_token_encrypted)) : undefined,
    oauth1_token_secret: data.oauth1_token_secret_encrypted ? await decryptIntegrationToken(String(data.oauth1_token_secret_encrypted)) : undefined,
  };
}

async function writeXSecrets(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  integrationId: string,
  tokens: Partial<Pick<XIntegration, 'access_token' | 'refresh_token' | 'oauth1_access_token' | 'oauth1_token_secret'>>
) {
  const payload: Record<string, string> = { integration_id: integrationId, updated_at: new Date().toISOString() };
  if (tokens.access_token) payload.access_token_encrypted = await encryptIntegrationToken(tokens.access_token);
  if (tokens.refresh_token) payload.refresh_token_encrypted = await encryptIntegrationToken(tokens.refresh_token);
  if (tokens.oauth1_access_token) payload.oauth1_access_token_encrypted = await encryptIntegrationToken(tokens.oauth1_access_token);
  if (tokens.oauth1_token_secret) payload.oauth1_token_secret_encrypted = await encryptIntegrationToken(tokens.oauth1_token_secret);
  await admin.from('x_integration_secrets').upsert(payload, { onConflict: 'integration_id' });
}

async function hydrateXIntegration(row: Record<string, unknown>): Promise<XIntegration> {
  const admin = createSupabaseAdminClient();
  const id = String(row.id);
  const secrets = await readXSecrets(admin, id);
  if (secrets) {
    return { ...(row as unknown as XIntegration), ...secrets };
  }
  const legacy = row as unknown as XIntegration;
  if (legacy.access_token || legacy.refresh_token || legacy.oauth1_access_token) {
    await writeXSecrets(admin, id, {
      access_token: legacy.access_token,
      refresh_token: legacy.refresh_token,
      oauth1_access_token: legacy.oauth1_access_token,
      oauth1_token_secret: legacy.oauth1_token_secret,
    });
    await admin.from('x_integrations').update({
      access_token: null,
      refresh_token: null,
      oauth1_access_token: null,
      oauth1_token_secret: null,
    }).eq('id', id);
  }
  return legacy;
}

// ── OAuth 1.0a helpers (required for v1.1 media upload) ──────────────────────
// Supports both X_API_KEY and X_CONSUMER_KEY naming conventions (Vercel uses X_CONSUMER_KEY)
const X_API_KEY    = process.env.X_API_KEY    || process.env.X_CONSUMER_KEY    || process.env.TWITTER_API_KEY    || '';
const X_API_SECRET = process.env.X_API_SECRET || process.env.X_CONSUMER_SECRET || process.env.TWITTER_API_SECRET || '';

function buildOAuth1Header(
    method: string,
    url: string,
    oauthToken: string,
    oauthTokenSecret: string,
    extraParams: Record<string, string> = {}
): string {
    const oauthParams: Record<string, string> = {
        oauth_consumer_key:     X_API_KEY,
        oauth_nonce:            crypto.randomBytes(16).toString('hex'),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp:        Math.floor(Date.now() / 1000).toString(),
        oauth_token:            oauthToken,
        oauth_version:          '1.0',
    };

    const allParams: Record<string, string> = { ...oauthParams, ...extraParams };
    const paramString = Object.keys(allParams)
        .sort()
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
        .join('&');

    const sigBase = [
        method.toUpperCase(),
        encodeURIComponent(url),
        encodeURIComponent(paramString),
    ].join('&');

    const sigKey = `${encodeURIComponent(X_API_SECRET)}&${encodeURIComponent(oauthTokenSecret)}`;
    const signature = crypto.createHmac('sha1', sigKey).update(sigBase).digest('base64');

    oauthParams.oauth_signature = signature;
    const headerValue = 'OAuth ' + Object.keys(oauthParams)
        .sort()
        .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
        .join(', ');

    return headerValue;
}

async function refreshXAccessToken(integration: XIntegration): Promise<XIntegration> {
    const clientId = process.env.X_CLIENT_ID;
    const clientSecret = process.env.X_CLIENT_SECRET;
    if (!integration.refresh_token || !clientId || !clientSecret) {
        throw new Error('X token expired. Reconnect your X account.');
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenResponse = await fetch('https://api.x.com/2/oauth2/token', {
        method: 'POST',
        headers: {
            Authorization: `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: integration.refresh_token,
            client_id: clientId,
        }),
    });

    if (!tokenResponse.ok) {
        const err = await tokenResponse.json().catch(() => ({}));
        throw new Error(`X token refresh failed: ${JSON.stringify(err)}`);
    }

    const tokens = await tokenResponse.json();
    const updated: Partial<XIntegration> = {
        expires_at: new Date(Date.now() + (tokens.expires_in || 7200) * 1000).toISOString(),
        scopes: typeof tokens.scope === 'string' ? tokens.scope.split(' ').filter(Boolean) : integration.scopes,
    };

    const supabase = createSupabaseAdminClient();
    await supabase.from('x_integrations').update({ ...updated, access_token: null, refresh_token: null, updated_at: new Date().toISOString() }).eq('tenant_id', integration.tenant_id);
    const { data: row } = await supabase.from('x_integrations').select('*').eq('tenant_id', integration.tenant_id).single();
    if (row?.id) {
      await writeXSecrets(supabase, String(row.id), {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || integration.refresh_token,
      });
    }

    return hydrateXIntegration({ ...integration, ...updated, access_token: tokens.access_token, refresh_token: tokens.refresh_token || integration.refresh_token });
}

export const xService = {
    async ensureValidAccessToken(tenantId: string): Promise<XIntegration> {
        const integration = await this.getXIntegration(tenantId);
        if (!integration) throw new Error('X integration not found');

        const expiresAt = integration.expires_at ? new Date(integration.expires_at).getTime() : 0;
        if (!expiresAt || expiresAt > Date.now() + 60_000) {
            return integration;
        }

        return refreshXAccessToken(integration);
    },

    /**
     * Get X integration for a tenant
     */
    async getXIntegration(tenantId: string) {
        const supabase = createSupabaseAdminClient();
        
        const { data, error } = await supabase
            .from('x_integrations')
            .select('id, tenant_id, user_id, x_user_id, x_username, expires_at, scopes, updated_at, access_token, refresh_token, oauth1_access_token, oauth1_token_secret')
            .eq('tenant_id', tenantId)
            .single();
        
        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching X integration:', error);
            return null;
        }
        if (!data) return null;
        return hydrateXIntegration(data);
    },

    /**
     * Save X integration
     */
    async saveXIntegration(integration: Partial<XIntegration>) {
        const supabase = createSupabaseAdminClient();
        const { access_token, refresh_token, oauth1_access_token, oauth1_token_secret, ...safeRow } = integration;
        
        const { data, error } = await supabase
            .from('x_integrations')
            .upsert({
                ...safeRow,
                access_token: null,
                refresh_token: null,
                oauth1_access_token: null,
                oauth1_token_secret: null,
                updated_at: new Date().toISOString()
            })
            .select('id, tenant_id, user_id, x_user_id, x_username, expires_at, scopes')
            .single();
        
        if (error) {
            console.error('Error saving X integration:', error);
            throw error;
        }

        if (data?.id) {
          await writeXSecrets(supabase, String(data.id), {
            access_token: access_token || '',
            refresh_token,
            oauth1_access_token,
            oauth1_token_secret,
          });
        }
        
        return hydrateXIntegration({ ...data, access_token, refresh_token, oauth1_access_token, oauth1_token_secret });
    },

    /**
     * Upload media to X using v1.1 API (requires OAuth 1.0a).
     * Returns the media_id_string to attach to a tweet.
     */
    async uploadMedia(tenantId: string, imageBuffer: Buffer, mimeType: string): Promise<string> {
        const integration = await this.getXIntegration(tenantId);
        if (!integration) throw new Error('X integration not found for media upload');

        const oauth1Token  = integration.oauth1_access_token;
        const oauth1Secret = integration.oauth1_token_secret;

        if (!oauth1Token || !oauth1Secret) {
            throw new Error(
                'X image posting requires OAuth 1.0a credentials. Please reconnect your X account from Settings → Integrations and ensure OAuth 1.0a is enabled.'
            );
        }

        const uploadUrl = 'https://upload.x.com/1.1/media/upload.json';
        const authHeader = buildOAuth1Header('POST', uploadUrl, oauth1Token, oauth1Secret);

        const formData = new FormData();
        formData.append('media_data', imageBuffer.toString('base64'));
        formData.append('media_type', mimeType);

        const uploadResp = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Authorization': authHeader },
            body: formData,
        });

        if (!uploadResp.ok) {
            const errBody = await uploadResp.text();
            throw new Error(`X media upload failed: ${errBody}`);
        }

        const uploadData = await uploadResp.json();
        const mediaId = uploadData?.media_id_string;
        if (!mediaId) throw new Error('X media upload returned no media_id_string');
        return mediaId;
    },

    /**
     * Convenience: fetch an image from a URL and upload it to X.
     */
    async uploadMediaFromUrl(tenantId: string, imageUrl: string): Promise<string> {
        const resp = await fetch(imageUrl);
        if (!resp.ok) throw new Error(`Failed to fetch image from URL: ${imageUrl}`);
        const contentType = resp.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await resp.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return this.uploadMedia(tenantId, buffer, contentType);
    },

    /**
     * Post a tweet (v2) — now supports media_ids for image/video attachments.
     */
    async postTweet(tenantId: string, tweet: XTweet) {
        const integration = await this.ensureValidAccessToken(tenantId);

        const body: Record<string, unknown> = {
            text: tweet.text,
            ...(tweet.reply_settings && { reply_settings: tweet.reply_settings }),
            ...(tweet.media_ids && tweet.media_ids.length > 0 && {
                media: { media_ids: tweet.media_ids }
            }),
        };

        const response = await fetch('https://api.x.com/2/tweets', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${integration.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

    if (!response.ok) {
      const error = await response.json();
      const errBody = error as { title?: string; detail?: string; message?: string };
      if (errBody.title === 'CreditsDepleted') {
        throw new Error('X_API_CREDITS_DEPLETED');
      }
      throw new Error(`X API error: ${JSON.stringify(error)}`);
    }

        const data = await response.json();

        // Log interaction
        const supabase = createSupabaseAdminClient();
        await supabase.from('social_interactions').insert({
            tenant_id: tenantId,
            user_id: integration.user_id,
            platform: 'x',
            interaction_type: 'post',
            external_id: data.data.id,
            content: tweet.text
        });

        return data;
    },

    async getTweet(tenantId: string, tweetId: string) {
        const integration = await this.ensureValidAccessToken(tenantId);
        const response = await fetch(`https://api.x.com/2/tweets/${encodeURIComponent(tweetId)}`, {
            headers: { 'Authorization': `Bearer ${integration.access_token}` }
        });
        if (!response.ok) {
            throw new Error(`X post verification failed (${response.status})`);
        }
        return response.json();
    },

    /**
     * Send a Direct Message (v2)
     */
    async sendDirectMessage(tenantId: string, recipientId: string, text: string) {
        const integration = await this.getXIntegration(tenantId);
        if (!integration) throw new Error('X integration not found');

            const response = await fetch(`https://api.x.com/2/dm_conversations/with/${recipientId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${integration.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: {
                    text: text
                }
            })
        });

    if (!response.ok) {
      const error = await response.json();
      const errBody = error as { title?: string; detail?: string; message?: string };
      if (errBody.title === 'CreditsDepleted') {
        throw new Error('X_API_CREDITS_DEPLETED');
      }
      throw new Error(`X API error: ${JSON.stringify(error)}`);
    }

        const data = await response.json();

        // Log interaction
        const supabase = createSupabaseAdminClient();
        await supabase.from('social_interactions').insert({
            tenant_id: tenantId,
            user_id: integration.user_id,
            platform: 'x',
            interaction_type: 'dm',
            external_id: data.data.id,
            recipient_id: recipientId,
            content: text
        });

        return data;
    },

    /**
     * Read Tweets (v2) - User Timeline
     */
    async getUserTweets(tenantId: string) {
        const integration = await this.ensureValidAccessToken(tenantId);

        const response = await fetch(`https://api.x.com/2/users/${integration.x_user_id}/tweets`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${integration.access_token}`
            }
        });

    if (!response.ok) {
      const error = await response.json();
      const errBody = error as { title?: string; detail?: string; message?: string };
      if (errBody.title === 'CreditsDepleted') {
        throw new Error('X_API_CREDITS_DEPLETED');
      }
      throw new Error(`X API error: ${JSON.stringify(error)}`);
    }

        return await response.json();
    },

    /**
     * Reply to a tweet (v2)
     */
    async replyToTweet(tenantId: string, tweetId: string, text: string) {
        const integration = await this.getXIntegration(tenantId);
        if (!integration) throw new Error('X integration not found');

        const response = await fetch('https://api.x.com/2/tweets', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${integration.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                reply: {
                    in_reply_to_tweet_id: tweetId
                }
            })
        });

    if (!response.ok) {
      const error = await response.json();
      const errBody = error as { title?: string; detail?: string; message?: string };
      if (errBody.title === 'CreditsDepleted') {
        throw new Error('X_API_CREDITS_DEPLETED');
      }
      throw new Error(`X API error: ${JSON.stringify(error)}`);
    }

        const data = await response.json();

        // Log interaction
        const supabase = createSupabaseAdminClient();
        await supabase.from('social_interactions').insert({
            tenant_id: tenantId,
            user_id: integration.user_id,
            platform: 'x',
            interaction_type: 'reply',
            external_id: data.data.id,
            metadata: { in_reply_to_tweet_id: tweetId },
            content: text
        });

        return data;
    },

    /**
     * Search tweets (v2) - Useful for lead hunting
     */
    async searchTweets(tenantId: string, query: string, maxResults: number = 10) {
        const integration = await this.getXIntegration(tenantId);
        if (!integration) throw new Error('X integration not found');

        const url = new URL('https://api.x.com/2/tweets/search/recent');
        url.searchParams.append('query', query);
        url.searchParams.append('max_results', maxResults.toString());
        url.searchParams.append('tweet.fields', 'created_at,author_id,public_metrics,entities');
        url.searchParams.append('expansions', 'author_id');
        url.searchParams.append('user.fields', 'username,name,description,profile_image_url');

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${integration.access_token}`
            }
        });

    if (!response.ok) {
      const error = await response.json();
      const errBody = error as { title?: string; detail?: string; message?: string };
      if (errBody.title === 'CreditsDepleted') {
        throw new Error('X_API_CREDITS_DEPLETED');
      }
      throw new Error(`X API error: ${JSON.stringify(error)}`);
    }

        const data = await response.json();

        // Persist captured content and authors
        const supabase = createSupabaseAdminClient();
        if (data.data && Array.isArray(data.data)) {
            for (const tweet of data.data) {
                const author = data.includes?.users?.find((u: any) => u.id === tweet.author_id);
                
                await supabase.from('captured_content').upsert({
                    tenant_id: tenantId,
                    platform: 'x',
                    external_id: tweet.id,
                    author_id: tweet.author_id,
                    author_username: author?.username,
                    content: tweet.text,
                    published_at: tweet.created_at,
                    metadata: { metrics: tweet.public_metrics }
                }, { onConflict: 'tenant_id,platform,external_id' });

                if (author) {
                    await supabase.from('social_leads').upsert({
                        tenant_id: tenantId,
                        platform: 'x',
                        external_user_id: author.id,
                        username: author.username,
                        display_name: author.name,
                        bio: author.description,
                        location: author.location,
                        profile_image_url: author.profile_image_url,
                        follower_count: author.public_metrics?.followers_count,
                        metadata: { source: 'search', query }
                    }, { onConflict: 'tenant_id,platform,external_user_id' });
                }
            }
        }

        return data;
    },

    /**
     * Get mentions (v2)
     */
    async getMentions(tenantId: string) {
        const integration = await this.getXIntegration(tenantId);
        if (!integration) throw new Error('X integration not found');

        const response = await fetch(`https://api.x.com/2/users/${integration.x_user_id}/mentions`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${integration.access_token}`
            }
        });

    if (!response.ok) {
      const error = await response.json();
      const errBody = error as { title?: string; detail?: string; message?: string };
      if (errBody.title === 'CreditsDepleted') {
        throw new Error('X_API_CREDITS_DEPLETED');
      }
      throw new Error(`X API error: ${JSON.stringify(error)}`);
    }

        return await response.json();
    },

    /**
     * Get user profile (v2)
     */
    async getProfile(tenantId: string, usernameOrId?: string) {
        const integration = await this.getXIntegration(tenantId);
        if (!integration) throw new Error('X integration not found');

        const identifier = usernameOrId || integration.x_user_id;
        const url = usernameOrId && isNaN(Number(usernameOrId))
            ? `https://api.x.com/2/users/by/username/${usernameOrId}`
            : `https://api.x.com/2/users/${identifier}`;

        const response = await fetch(`${url}?user.fields=description,public_metrics,profile_image_url,location`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${integration.access_token}`
            }
        });

    if (!response.ok) {
      const error = await response.json();
      const errBody = error as { title?: string; detail?: string; message?: string };
      if (errBody.title === 'CreditsDepleted') {
        throw new Error('X_API_CREDITS_DEPLETED');
      }
      throw new Error(`X API error: ${JSON.stringify(error)}`);
    }

        return await response.json();
    },

    /**
     * Search users (v2) - Useful for finding leads by bio/location
     */
    async searchUsers(tenantId: string, query: string, maxResults: number = 10) {
        const integration = await this.getXIntegration(tenantId);
        if (!integration) throw new Error('X integration not found');

        // Note: User search in v2 is currently limited to certain access levels or specific endpoints.
        // If not available, we can fallback to searching tweets and extracting users.
        const url = new URL('https://api.x.com/2/users/search');
        url.searchParams.append('query', query);
        url.searchParams.append('max_results', maxResults.toString());
        url.searchParams.append('user.fields', 'username,name,description,profile_image_url,location,public_metrics');

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${integration.access_token}`
            }
        });

    if (!response.ok) {
      const error = await response.json();
      const errBody = error as { title?: string; detail?: string; message?: string };
      if (errBody.title === 'CreditsDepleted') {
        throw new Error('X_API_CREDITS_DEPLETED');
      }
      throw new Error(`X API error: ${JSON.stringify(error)}`);
    }

        return await response.json();
    }
};
