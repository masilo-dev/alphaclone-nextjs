import { permanentRedirect } from 'next/navigation';

/** Canonical doc lives at /sla — keep this path as a hard redirect only. */
export default function Page() {
  permanentRedirect('/sla');
}
