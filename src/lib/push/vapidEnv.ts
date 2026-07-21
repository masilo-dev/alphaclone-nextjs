/**
 * Shared VAPID (Web Push) env resolution.
 * Accepts either NEXT_PUBLIC_ or VITE_ public key aliases used across Railway.
 */

export function getVapidPublicKey(): string {
  return (
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ||
    process.env.VITE_VAPID_PUBLIC_KEY?.trim() ||
    ''
  );
}

export function getVapidPrivateKey(): string {
  return process.env.VAPID_PRIVATE_KEY?.trim() || '';
}

export function getVapidEmail(): string {
  return process.env.VAPID_EMAIL?.trim() || 'mailto:sales@alphaclonesystems.com';
}

export function isVapidConfigured(): boolean {
  return Boolean(getVapidPublicKey() && getVapidPrivateKey());
}
