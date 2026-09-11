import { permanentRedirect } from 'next/navigation';

/** Canonical doc lives at /cookie-policy — keep this path as a hard redirect only. */
export default function Page() {
  permanentRedirect('/cookie-policy');
}
