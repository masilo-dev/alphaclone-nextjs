import { Metadata } from 'next';

// Project access is resolved by the password-aware route handler. Metadata is
// intentionally generic so an anonymous server render cannot incorrectly mark
// a valid protected portal as "Project Not Found" or leak a project name.
export const metadata: Metadata = {
    title: 'Project Portal | AlphaClone Systems',
    description: 'Secure project updates from AlphaClone Systems.',
    robots: { index: false, follow: false },
};

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
