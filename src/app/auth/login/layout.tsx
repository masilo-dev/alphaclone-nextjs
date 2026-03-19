import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Login | AlphaClone',
    description: 'Sign in to AlphaClone to access your CRM, billing, scheduling, contracts, messaging, documents, and business operations workspace.',
    keywords: [
        'AlphaClone login',
        'business software login',
        'CRM login',
        'client portal login',
        'business operations platform login',
        'AlphaClone sign in',
    ],
    alternates: { canonical: 'https://alphaclone.tech/auth/login' },
    openGraph: {
        title: 'Login | AlphaClone',
        description: 'Sign in to AlphaClone to access your connected CRM, billing, scheduling, contracts, and operations workspace.',
        url: 'https://alphaclone.tech/auth/login',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Login | AlphaClone',
        description: 'Sign in to your AlphaClone workspace.',
    },
    robots: { index: true, follow: true },
};

export default function LoginLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return children;
}
