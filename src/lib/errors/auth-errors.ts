/**
 * Typed authentication / OAuth / MCP errors mapped to safe client responses.
 * Never put secrets, SQL, stack traces, or internal hostnames in `publicMessage`.
 */

export type OAuthErrorCode =
  | 'invalid_request'
  | 'invalid_client'
  | 'invalid_grant'
  | 'invalid_scope'
  | 'unauthorized_client'
  | 'unsupported_grant_type'
  | 'invalid_target'
  | 'temporarily_unavailable'
  | 'server_error';

export class ConfigurationError extends Error {
  readonly code = 'CONFIGURATION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class OAuthError extends Error {
  readonly oauthError: OAuthErrorCode;
  readonly status: number;
  readonly publicMessage: string;

  constructor(oauthError: OAuthErrorCode, publicMessage: string, status = 400) {
    super(publicMessage);
    this.name = 'OAuthError';
    this.oauthError = oauthError;
    this.publicMessage = publicMessage;
    this.status = status;
  }

  toJSON() {
    return {
      error: this.oauthError,
      error_description: this.publicMessage,
    };
  }
}

export class MCPAuthenticationError extends Error {
  readonly code = 'MCP_AUTHENTICATION_ERROR';
  readonly status: number;
  readonly publicMessage: string;

  constructor(publicMessage: string, status = 401) {
    super(publicMessage);
    this.name = 'MCPAuthenticationError';
    this.publicMessage = publicMessage;
    this.status = status;
  }
}

export class MCPAuthorizationError extends Error {
  readonly code = 'MCP_AUTHORIZATION_ERROR';
  readonly status: number;
  readonly publicMessage: string;

  constructor(publicMessage: string, status = 403) {
    super(publicMessage);
    this.name = 'MCPAuthorizationError';
    this.publicMessage = publicMessage;
    this.status = status;
  }
}

export class TenantAccessError extends Error {
  readonly code = 'TENANT_ACCESS_DENIED';
  readonly status = 403;

  constructor(message = 'Tenant access denied') {
    super(message);
    this.name = 'TenantAccessError';
  }
}

export class IntegrationReauthRequiredError extends Error {
  readonly code = 'INTEGRATION_REAUTH_REQUIRED';
  readonly provider: string;
  readonly status = 401;

  constructor(provider: string, message?: string) {
    super(message || `Reconnect your ${provider} account.`);
    this.name = 'IntegrationReauthRequiredError';
    this.provider = provider;
  }

  toJSON() {
    return {
      code: this.code,
      provider: this.provider,
      message: this.message,
    };
  }
}
