import '@/styles/product-system.css';
import type { Metadata } from 'next';

import '@/styles/alphaclone-os-v3.css';
import '@/styles/alphaclone-os-v3-pwa.css';
import '@/styles/apple-fluid-system.css';
import '@/styles/crisp-product-ui.css';

// The authenticated dashboard must never be indexed. robots.txt already
// disallows /dashboard, but search engines can still index disallowed URLs that
// are linked elsewhere — an explicit noindex meta tag is the reliable signal.
export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <div className="ac-product-system contents">{children}</div>;
}
