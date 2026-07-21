import { permanentRedirect } from 'next/navigation';

/** Canonical doc lives at /terms-of-service — keep this path as a hard redirect only. */
export default function Page() {
  permanentRedirect('/terms-of-service');
}
