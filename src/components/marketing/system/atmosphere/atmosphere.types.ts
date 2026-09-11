export type AtmosphereVariant =
  | 'hero'
  | 'quiet'
  | 'editorial'
  | 'product'
  | 'conversion'
  | 'dark'
  | 'footer'
  | 'transition';

export type AtmosphereIntensity = 'subtle' | 'balanced';
export type PerformanceTier = 'full' | 'reduced' | 'static';

export type OrbPreset = {
  id: string;
  tone: 'coral' | 'teal' | 'navy' | 'neutral';
  size: 'small' | 'medium' | 'large';
  anchor: 'north-west' | 'north-east' | 'south-west' | 'south-east';
  delay: number;
};
