/**
 * Resolve OAuth client redirect URIs for refresh-token client binding.
 */

type SupabaseLike = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: { redirect_uris?: unknown } | null }>;
      };
    };
  };
};

export async function lookupOAuthClientRedirectUris(
  supabase: SupabaseLike,
  clientId: string | null | undefined
): Promise<string[] | null> {
  const id = (clientId || '').trim();
  if (!id) return null;

  try {
    const { data } = await supabase
      .from('mcp_oauth_clients')
      .select('redirect_uris')
      .eq('client_id', id)
      .maybeSingle();

    if (Array.isArray(data?.redirect_uris)) {
      return data.redirect_uris.filter((u): u is string => typeof u === 'string');
    }
  } catch {
    // non-fatal — binding falls back to canonical id comparison
  }

  return null;
}
