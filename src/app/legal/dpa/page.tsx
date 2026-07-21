import { permanentRedirect } from 'next/navigation';

/** Canonical doc lives at /dpa — keep this path as a hard redirect only. */
export default function Page() {
  permanentRedirect('/dpa');
}
