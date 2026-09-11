import { permanentRedirect } from 'next/navigation';

/** Canonical doc lives at /privacy-policy — keep this path as a hard redirect only. */
export default function Page() {
  permanentRedirect('/privacy-policy');
}
