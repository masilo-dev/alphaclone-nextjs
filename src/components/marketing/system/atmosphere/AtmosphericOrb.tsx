import type { OrbPreset } from './atmosphere.types';

export default function AtmosphericOrb({ orb }: { orb: OrbPreset }) {
  return (
    <span
      className={`mkt-organic-orb is-${orb.tone} is-${orb.size} at-${orb.anchor}`}
      style={{ '--orb-delay': `${orb.delay}s` } as React.CSSProperties}
    >
      <span className="mkt-organic-orb__body" />
      <span className="mkt-organic-orb__highlight" />
    </span>
  );
}
