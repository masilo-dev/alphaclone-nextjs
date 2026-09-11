type SectionAmbientLightProps = {
  variant?: 'hero' | 'how' | 'subtle';
};

/** Controlled radial lighting — not random glow blobs. */
export default function SectionAmbientLight({ variant = 'subtle' }: SectionAmbientLightProps) {
  return (
    <div
      className={`mkt-section-ambient mkt-section-ambient--${variant}`}
      aria-hidden="true"
    />
  );
}
