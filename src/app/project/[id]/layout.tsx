import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    return {
        title: 'Project Portal | AlphaClone Systems',
        description: 'Secure project portal redirect.',
        robots: { index: false, follow: false },
    };
}

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
