import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter, Plus_Jakarta_Sans, Sora } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { PWAProvider } from "@/contexts/PWAContext";
import ShellSwitcher from "@/components/shells/ShellSwitcher";
import { Analytics } from "@vercel/analytics/next";
import CookieConsent from "@/components/common/CookieConsent";
import NativeInteractions from "@/components/common/NativeInteractions";
import GlobalAlpha from "@/components/alpha/GlobalAlpha";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://alphaclone.tech'),
  title: {
    default: "AlphaClone Systems | Unified AI Business Operating System",
    template: "%s | AlphaClone Systems",
  },
  description: "Eliminate SaaS bloat and operational friction with AlphaClone. The technically superior, AI-powered Business OS that unifies CRM, invoicing, contracts, AI growth automation, video meetings, and accounting into one high-performance architecture.",
  keywords: [
    "AI Business OS",
    "Unified Business Platform",
    "Autonomous Growth Agent",
    "Enterprise CRM Intelligence",
    "Mission Control Software",
    "SaaS Consolidation",
    "Operational Excellence AI",
    "AlphaClone Systems",
    "Business Automation",
    "Project Operations Hub",
    "Data Sovereignty",
    "Custom AI Integration"
  ],
  authors: [{ name: "AlphaClone Systems", url: "https://alphaclone.tech" }],
  creator: "AlphaClone Systems",
  publisher: "AlphaClone Systems",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  alternates: { canonical: 'https://alphaclone.tech' },
  openGraph: {
    title: "AlphaClone Systems | Unified AI Business Operating System",
    description: "Eliminate SaaS bloat and operational friction. Replace 10+ tools with one unified AI Business OS. CRM, finance, contracts, AI sales agent, video meetings — unified.",
    type: "website",
    url: "https://alphaclone.tech",
    siteName: "AlphaClone Systems",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "AlphaClone Systems | Unified AI Business Operating System",
    description: "Eliminate SaaS bloat with the AI-powered Business OS. Replace 10+ tools with one unified platform. CRM, finance, contracts, AI sales, meetings — unified.",
    creator: "@AlphaCloneSys",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import { WebVitals } from "@/components/common/WebVitals";
import PrismBackground from "@/components/common/PrismBackground";

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'AlphaClone Systems Business OS',
  operatingSystem: 'Web-based',
  applicationCategory: 'BusinessApplication',
  url: 'https://alphaclone.tech',
  logo: 'https://alphaclone.tech/favicon.ico',
  description: 'Unified AI-powered Business Operating System that unifies CRM, invoicing, contracts, AI growth automation, video meetings, and financial accounting into a single high-performance architecture.',
  offers: {
    '@type': 'AggregateOffer',
    priceCurrency: 'USD',
    lowPrice: '15',
    highPrice: '80',
    offerCount: '3',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.9',
    ratingCount: '125',
  },
  publisher: {
    '@type': 'Organization',
    name: 'AlphaClone Systems',
    url: 'https://alphaclone.tech',
    logo: 'https://alphaclone.tech/favicon.ico',
    sameAs: [
      'https://www.linkedin.com/company/alphaclone-systems',
      'https://www.g2.com/products/alphaclone',
      'https://www.crunchbase.com/organization/alphaclone-systems',
    ],
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${plusJakartaSans.variable} ${sora.variable} antialiased text-base subpixel-antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <WebVitals />
        <Providers>
          <PrismBackground />
          <PWAProvider>
            <NativeInteractions />
            <ShellSwitcher>
              {children}
            </ShellSwitcher>
            <GlobalAlpha />
          </PWAProvider>
          <CookieConsent />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
