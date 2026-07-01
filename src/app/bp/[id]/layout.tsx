import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Client-facing project pages — never index as AlphaClone marketing content.
export const metadata: Metadata = {
    robots: { index: false, follow: false },
};

export default function PublicBusinessProjectLayout({ children }: { children: ReactNode }) {
    return <>{children}</>;
}
