'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { authorizeClient } from './actions';
import { validateScopes } from '@/services/mcp/MCPOAuthScopes';

type OAuthRequestParams = {
  clientId: string | null;
  redirectUri: string | null;
  state: string | null;
  scope: string | null;
};

function parseMalformedRedirectUri(rawSearch: string): string | null {
  const marker = 'redirect_uri:';
  const idx = rawSearch.indexOf(marker);
  if (idx < 0) return null;

  const valueStart = idx + marker.length;
  const remainder = rawSearch.slice(valueStart);
  const end = remainder.search(/&(?:state|scope|client_id|clientId|response_type)=/);
  const encoded = end >= 0 ? remainder.slice(0, end) : remainder;
  if (!encoded) return null;

  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

function AuthorizeForm() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthParams, setOauthParams] = useState<OAuthRequestParams>({
    clientId: null,
    redirectUri: null,
    state: null,
    scope: null,
  });

  useEffect(() => {
    const fromQueryClientId = searchParams?.get('client_id') || searchParams?.get('clientId') || null;
    const fromQueryRedirectUri = searchParams?.get('redirect_uri') || searchParams?.get('redirectUri') || null;
    const fromQueryState = searchParams?.get('state') || null;
    const fromQueryScope = searchParams?.get('scope') || null;
    const malformedRedirectUri =
      typeof window !== 'undefined' ? parseMalformedRedirectUri(window.location.search) : null;

    const nextParams: OAuthRequestParams = {
      clientId: fromQueryClientId,
      redirectUri: fromQueryRedirectUri || malformedRedirectUri,
      state: fromQueryState,
      scope: fromQueryScope,
    };

    // Some OAuth clients may send parameters in the URL hash fragment.
    if (typeof window !== 'undefined' && window.location.hash.length > 1) {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      nextParams.clientId =
        nextParams.clientId || hashParams.get('client_id') || hashParams.get('clientId');
      nextParams.redirectUri =
        nextParams.redirectUri || hashParams.get('redirect_uri') || hashParams.get('redirectUri');
      nextParams.state = nextParams.state || hashParams.get('state');
      nextParams.scope = nextParams.scope || hashParams.get('scope');
    }

    setOauthParams(nextParams);

    if (!nextParams.clientId || !nextParams.redirectUri) {
      setError('Missing required parameters: client_id and redirect_uri are required.');
    } else {
      setError(null);
    }
  }, [searchParams]);

  const requestedScopes = validateScopes(oauthParams.scope || '');

  const handleApprove = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      if (oauthParams.clientId) formData.append('client_id', oauthParams.clientId);
      if (oauthParams.redirectUri) formData.append('redirect_uri', oauthParams.redirectUri);
      if (oauthParams.state) formData.append('state', oauthParams.state);
      if (oauthParams.scope) formData.append('scope', oauthParams.scope);

      const result = await authorizeClient(formData);
      
      if (result.error) {
        setError(result.error);
        setLoading(false);
      } else if (result.redirect) {
        // eslint-disable-next-line react-hooks/immutability
        window.location.href = result.redirect;
      }
    } catch (err) {
      setError('An unexpected error occurred.');
      setLoading(false);
    }
  };

  const handleDeny = () => {
    if (oauthParams.redirectUri) {
      let url = `${oauthParams.redirectUri}?error=access_denied`;
      if (oauthParams.state) url += `&state=${encodeURIComponent(oauthParams.state)}`;
      // eslint-disable-next-line react-hooks/immutability
      window.location.href = url;
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8 text-center ring-1 ring-gray-900/5 dark:ring-gray-100/10">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
            <svg className="h-6 w-6 text-red-600 dark:text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Authorization Error</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{error}</p>
          {oauthParams.redirectUri && (
            <button
              onClick={handleDeny}
              className="w-full flex justify-center py-2.5 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Return to App
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-8">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl overflow-hidden ring-1 ring-gray-900/5 dark:ring-gray-100/10">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 bg-primary-100 dark:bg-primary-900/20 rounded-xl flex items-center justify-center">
              <svg className="w-8 h-8 text-primary-600 dark:text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
            Authorize Connection
          </h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-8 text-sm">
            An external application is requesting access to your AlphaClone workspace data.
          </p>

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-8">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              This application will be able to:
            </h3>
            <ul className="space-y-3">
              {requestedScopes.length > 0 ? (
                requestedScopes.map((s) => (
                  <li key={s} className="flex items-start">
                    <svg className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {s.replace(':', ' ')}
                    </span>
                  </li>
                ))
              ) : (
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-gray-400 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    Basic account access
                  </span>
                </li>
              )}
            </ul>
          </div>

          <div className="flex flex-col space-y-3">
            <button
              onClick={handleApprove}
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                'Authorize Setup'
              )}
            </button>
            <button
              onClick={handleDeny}
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 px-8 py-4 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
            By authorizing, you allow this application to connect to your AlphaClone account in accordance with their privacy policy.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthorizePage() {
  return (
    <React.Suspense fallback={<div className="flex flex-col items-center justify-center min-h-screen bg-gray-50"><div className="animate-spin h-8 w-8 text-primary-600"><svg fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg></div></div>}>
      <AuthorizeForm />
    </React.Suspense>
  )
}
