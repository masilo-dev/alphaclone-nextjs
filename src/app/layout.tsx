import type { Metadata, Viewport } from "next";
import { Geist, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { PWAProvider } from "@/contexts/PWAContext";
import ShellSwitcher from "@/components/shells/ShellSwitcher";
import { Analytics } from "@vercel/analytics/next";
import CookieConsent from "@/components/common/CookieConsent";
import NativeInteractions from "@/components/common/NativeInteractions";
// import GlobalAlpha from "@/components/alpha/GlobalAlpha";
import { WebVitals } from "@/components/common/WebVitals";
import PrismBackground from "@/components/common/PrismBackground";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://alphaclone.tech"),
  title: {
    default: "AlphaClone | The Unified Business OS & Operations Platform",
    template: "%s | AlphaClone Systems",
  },
  description:
    "AlphaClone is the definitive Business OS for service providers. A unified platform for CRM, billing, contracts, scheduling, and AI-powered growth—all in one connected system.",
  keywords: [
    "Business OS",
    "Business Operating System",
    "Unified Business Platform",
    "AlphaClone Business OS",
    "Service Business CRM",
    "Unified Billing & Contracts",
    "Business Management System",
    "AI Business Platform",
    "SaaS operations platform",
    "enterprise business OS for small business",
    "AlphaClone Systems",
    "client operations system",
  ],
  authors: [{ name: "AlphaClone Systems", url: "https://alphaclone.tech" }],
  creator: "AlphaClone Systems",
  publisher: "AlphaClone Systems",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  alternates: { canonical: "https://alphaclone.tech" },
  openGraph: {
    title: "AlphaClone Systems | Unified Business Operating Platform",
    description:
      "AlphaClone unifies CRM, billing, contracts, scheduling, messaging, documents, meetings, and operations in one platform for service businesses.",
    type: "website",
    url: "https://alphaclone.tech",
    siteName: "AlphaClone Systems",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "AlphaClone Systems | Unified Business Operating Platform",
    description:
      "CRM, billing, contracts, scheduling, messaging, documents, meetings, and operations in one platform.",
    creator: "@AlphaCloneSys",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "AlphaClone Systems",
  operatingSystem: "Web-based",
  applicationCategory: "BusinessApplication",
  url: "https://alphaclone.tech",
  logo: "https://alphaclone.tech/favicon.ico",
  description:
    "Unified business operating platform for service businesses with CRM, billing, contracts, scheduling, messaging, documents, meetings, and operations.",
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: "15",
    highPrice: "80",
    offerCount: "3",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    ratingCount: "125",
  },
  publisher: {
    "@type": "Organization",
    name: "AlphaClone Systems",
    url: "https://alphaclone.tech",
    logo: "https://alphaclone.tech/favicon.ico",
  },
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "AlphaClone Systems",
  url: "https://alphaclone.tech",
  description: "Unified business operating platform for service businesses.",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://alphaclone.tech/docs?query={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

const navigationSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Primary Site Navigation",
  itemListElement: [
    { "@type": "SiteNavigationElement", position: 1, name: "About", url: "https://alphaclone.tech/about" },
    { "@type": "SiteNavigationElement", position: 2, name: "Documentation", url: "https://alphaclone.tech/docs" },
    { "@type": "SiteNavigationElement", position: 3, name: "Pricing", url: "https://alphaclone.tech/pricing" },
    { "@type": "SiteNavigationElement", position: 4, name: "Contact", url: "https://alphaclone.tech/contact" },
    { "@type": "SiteNavigationElement", position: 5, name: "Login", url: "https://alphaclone.tech/auth/login" },
  ],
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
        className={`${geistSans.variable} ${inter.variable} antialiased text-base subpixel-antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(navigationSchema) }}
        />
        <WebVitals />
        <Providers>
          <PrismBackground />
          <PWAProvider>
            <NativeInteractions />
            <ShellSwitcher>
              {children}
            </ShellSwitcher>
            {/* <GlobalAlpha /> */}
          </PWAProvider>
          <CookieConsent />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
