import type { Metadata } from 'next';

// The authenticated dashboard must never be indexed. robots.txt already
// disallows /dashboard, but search engines can still index disallowed URLs that
// are linked elsewhere — an explicit noindex meta tag is the reliable signal.
export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
