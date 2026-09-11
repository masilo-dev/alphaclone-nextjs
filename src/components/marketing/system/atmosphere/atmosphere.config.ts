import type { AtmosphereVariant, OrbPreset } from './atmosphere.types';

const hero: OrbPreset[] = [
  { id: 'hero-coral', tone: 'coral', size: 'large', anchor: 'north-west', delay: -7 },
  { id: 'hero-teal', tone: 'teal', size: 'medium', anchor: 'north-east', delay: -15 },
  { id: 'hero-neutral', tone: 'neutral', size: 'large', anchor: 'south-east', delay: -2 },
];

export const ATMOSPHERE_PRESETS: Record<AtmosphereVariant, OrbPreset[]> = {
  hero,
  quiet: [
    { id: 'quiet-neutral', tone: 'neutral', size: 'large', anchor: 'north-east', delay: -11 },
    { id: 'quiet-teal', tone: 'teal', size: 'small', anchor: 'south-west', delay: -4 },
  ],
  editorial: [
    { id: 'editorial-coral', tone: 'coral', size: 'medium', anchor: 'south-west', delay: -9 },
    { id: 'editorial-neutral', tone: 'neutral', size: 'large', anchor: 'north-east', delay: -18 },
  ],
  product: [
    { id: 'product-teal', tone: 'teal', size: 'large', anchor: 'north-east', delay: -5 },
    { id: 'product-coral', tone: 'coral', size: 'small', anchor: 'south-west', delay: -14 },
    { id: 'product-navy', tone: 'navy', size: 'medium', anchor: 'south-east', delay: -21 },
  ],
  conversion: [
    { id: 'conversion-coral', tone: 'coral', size: 'large', anchor: 'south-east', delay: -8 },
    { id: 'conversion-teal', tone: 'teal', size: 'medium', anchor: 'north-west', delay: -19 },
  ],
  dark: [
    { id: 'dark-navy', tone: 'navy', size: 'large', anchor: 'north-west', delay: -12 },
    { id: 'dark-coral', tone: 'coral', size: 'small', anchor: 'south-east', delay: -3 },
  ],
  footer: [
    { id: 'footer-neutral', tone: 'neutral', size: 'large', anchor: 'south-west', delay: -16 },
  ],
  transition: hero,
};

export function variantForPath(pathname: string): AtmosphereVariant {
  if (pathname === '/') return 'hero';
  if (/^\/(crm|lead-management|project-management|ai-agents|ecosystem|marketing)/.test(pathname)) {
    return 'product';
  }
  if (/^\/(pricing|book-demo|contact|login|reset-password|auth)/.test(pathname)) {
    return 'conversion';
  }
  if (/^\/(blog|guide|docs|faq|about|results)/.test(pathname)) return 'editorial';
  if (/^\/(privacy|terms|cookie|legal|dpa|sla|security|compliance|data-deletion)/.test(pathname)) {
    return 'quiet';
  }
  return 'dark';
}
