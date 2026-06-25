export async function refreshMicrosoftTokenIfNeeded(force = false): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/microsoft/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok && data.success === true;
  } catch {
    return false;
  }
}

export async function refreshZohoTokenIfNeeded(force = false): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/zoho/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok && data.success === true;
  } catch {
    return false;
  }
}

export function isAuthErrorMessage(message: string): boolean {
  return /401|403|InvalidAuthenticationToken|expired|Unauthorized|ZOHO_RECONNECT|session expired|reconnect/i.test(
    message
  );
}
