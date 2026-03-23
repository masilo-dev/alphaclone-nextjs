import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter, Plus_Jakarta_Sans, Sora } from "next/font/google";
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
  metadataBase: new URL("https://alphaclone.tech"),
  title: {
    default: "AlphaClone Systems | CRM, Billing, Scheduling, and Operations in One Platform",
    template: "%s | AlphaClone Systems",
  },
  description:
    "AlphaClone is all-in-one business software for service businesses. Manage CRM, invoicing, contracts, scheduling, messaging, documents, meetings, and operations in one connected platform.",
  keywords: [
    "all in one business software",
    "service business software",
    "CRM invoicing scheduling platform",
    "business operations platform",
    "client management software",
    "billing and contracts software",
    "workflow automation platform",
    "small business operating system",
    "AlphaClone Systems",
    "business automation",
    "CRM and billing software",
    "project and client management platform",
  ],
  authors: [{ name: "AlphaClone Systems", url: "https://alphaclone.tech" }],
  creator: "AlphaClone Systems",
  publisher: "AlphaClone Systems",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  alternates: { canonical: "https://alphaclone.tech" },
  openGraph: {
    title: "AlphaClone Systems | CRM, Billing, Scheduling, and Operations in One Platform",
    description:
      "AlphaClone combines CRM, invoicing, contracts, scheduling, messaging, documents, meetings, and operations in one connected platform for service businesses.",
    type: "website",
    url: "https://alphaclone.tech",
    siteName: "AlphaClone Systems",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "AlphaClone Systems | CRM, Billing, Scheduling, and Operations in One Platform",
    description:
      "CRM, invoicing, contracts, scheduling, messaging, documents, meetings, and operations in one connected platform.",
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
    "All-in-one business software for service businesses that combines CRM, invoicing, contracts, scheduling, messaging, documents, meetings, and operations in one platform.",
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
  description: "All-in-one business software for service businesses.",
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
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${plusJakartaSans.variable} ${sora.variable} antialiased text-base subpixel-antialiased`}
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
