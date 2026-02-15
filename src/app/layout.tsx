import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { PWAProvider } from "@/contexts/PWAContext";
import ShellSwitcher from "@/components/shells/ShellSwitcher";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AlphaClone Systems | AI-Powered Enterprise OS & Custom Software",
  description: "Premier custom software development firm specialized in AI integration, enterprise CRM architectures, and high-performance web applications. The all-in-one business operating system.",
  keywords: ["AI automation", "enterprise CRM", "custom software development", "business operating system", "Next.js development", "scalable architecture", "AlphaClone"],
  authors: [{ name: "AlphaClone Systems" }],
  openGraph: {
    title: "AlphaClone Systems | AI-Powered Enterprise OS",
    description: "The all-in-one platform for modern businesses. CRM, Finance, Tasks, and Team Management unified.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased text-base subpixel-antialiased`}
      >
        <Providers>
          <PWAProvider>
            <ShellSwitcher>
              {children}
            </ShellSwitcher>
          </PWAProvider>
        </Providers>
      </body>
    </html>
  );
}
