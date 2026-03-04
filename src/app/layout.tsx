import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Dancing_Script, Sacramento, Inter, Plus_Jakarta_Sans, Sora, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { PWAProvider } from "@/contexts/PWAContext";
import ShellSwitcher from "@/components/shells/ShellSwitcher";
import { Analytics } from "@vercel/analytics/next";
import CookieConsent from "@/components/common/CookieConsent";
import NativeInteractions from "@/components/common/NativeInteractions";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const dancingScript = Dancing_Script({
  variable: "--font-dancing-script",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const sacramento = Sacramento({
  variable: "--font-sacramento",
  subsets: ["latin"],
  weight: "400",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://alphaclone.tech'),
  title: {
    default: "AlphaClone Systems | AI-Powered Business Operating System",
    template: "%s | AlphaClone Systems",
  },
  description: "AlphaClone Systems is the AI-powered Business OS that replaces 10+ SaaS tools with one unified platform. CRM, invoicing, contracts, AI growth agent, video meetings, and accounting — starting at $15/month.",
  keywords: ["AI business operating system", "AI automation for small business", "enterprise CRM software", "all-in-one business platform", "replace QuickBooks HubSpot Zoom", "AI growth agent", "business software suite", "AlphaClone", "AI-powered CRM", "business management software"],
  authors: [{ name: "AlphaClone Systems", url: "https://alphaclone.tech" }],
  creator: "AlphaClone Systems",
  publisher: "AlphaClone Systems",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  alternates: { canonical: 'https://alphaclone.tech' },
  openGraph: {
    title: "AlphaClone Systems | AI-Powered Business Operating System",
    description: "Replace 10+ SaaS tools with one AI-powered platform. CRM, finance, contracts, AI sales agent, video meetings — all unified. Starting at $15/month.",
    type: "website",
    url: "https://alphaclone.tech",
    siteName: "AlphaClone Systems",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "AlphaClone Systems | AI-Powered Business Operating System",
    description: "Replace 10+ SaaS tools with one AI-powered Business OS. CRM, finance, contracts, AI sales, meetings — unified.",
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

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'AlphaClone Systems',
  url: 'https://alphaclone.tech',
  logo: 'https://alphaclone.tech/favicon.ico',
  description: 'AlphaClone Systems is an AI-powered Business Operating System that unifies CRM, invoicing, contracts, AI growth automation, video meetings, and financial accounting into a single platform for modern businesses.',
  foundingDate: '2020',
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'support@alphaclone.tech',
    contactType: 'customer support',
    availableLanguage: 'English',
  },
  sameAs: [
    'https://www.linkedin.com/company/alphaclone-systems',
    'https://www.g2.com/products/alphaclone',
    'https://www.crunchbase.com/organization/alphaclone-systems',
  ],
  offers: {
    '@type': 'AggregateOffer',
    priceCurrency: 'USD',
    lowPrice: '15',
    highPrice: '80',
    offerCount: '3',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${dancingScript.variable} ${sacramento.variable} ${inter.variable} ${plusJakartaSans.variable} ${sora.variable} ${jetbrainsMono.variable} antialiased text-base subpixel-antialiased`}
      >
        <WebVitals />
        <Providers>
          <PWAProvider>
            <NativeInteractions />
            <ShellSwitcher>
              {children}
            </ShellSwitcher>
          </PWAProvider>
          <CookieConsent />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
