import { ATMOSPHERE_PRESETS } from './atmosphere.config';
import type { AtmosphereVariant } from './atmosphere.types';
import AtmosphericOrb from './AtmosphericOrb';

export default function OrbField({ variant }: { variant: AtmosphereVariant }) {
  return (
    <div className="mkt-orb-field">
      {ATMOSPHERE_PRESETS[variant].map((orb) => (
        <AtmosphericOrb key={orb.id} orb={orb} />
      ))}
    </div>
  );
}
