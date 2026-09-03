import type { Metadata } from 'next';
import { absoluteUrl, SITE_URL } from '@/lib/siteUrl';

type MarketingMetadataInput = {
  title: string;
  description: string;
  pathname: string;
  keywords?: string[];
  /** Defaults to indexable marketing page */
  index?: boolean;
  ogType?: 'website' | 'article';
};

const DEFAULT_OG_IMAGE = '/opengraph-image';
const DEFAULT_TWITTER_IMAGE = '/twitter-image';

/**
 * Consistent metadata builder for public marketing routes.
 * Always uses absoluteUrl for canonical — never hard-code production origin in pages.
 */
export function buildMarketingMetadata(input: MarketingMetadataInput): Metadata {
  const canonical = absoluteUrl(input.pathname);
  const index = input.index !== false;

  return {
    title: input.title,
    description: input.description,
    ...(input.keywords?.length ? { keywords: input.keywords } : {}),
    alternates: { canonical },
    openGraph: {
      title: input.title,
      description: input.description,
      url: canonical,
      type: input.ogType ?? 'website',
      siteName: 'AlphaClone Systems',
      locale: 'en_US',
      images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: input.title,
      description: input.description,
      creator: '@AlphaCloneSys',
      images: [DEFAULT_TWITTER_IMAGE],
    },
    robots: index
      ? { index: true, follow: true, googleBot: { index: true, follow: true } }
      : { index: false, follow: false, googleBot: { index: false, follow: false } },
  };
}

/** Metadata for authenticated or utility routes that must not rank. */
export function buildPrivateMetadata(title: string, description: string): Metadata {
  return {
    title,
    description,
    metadataBase: new URL(SITE_URL),
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  };
}
