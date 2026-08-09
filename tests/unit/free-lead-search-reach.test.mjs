import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const { resolveOsmNiche, buildOverpassClauses } = await import('../../src/lib/scraper/osmNicheTags.ts');
const { haversineKm, geocodeFree } = await import('../../src/lib/scraper/freeGeoSources.ts');
const { hasPhoneOrEmail } = await import('../../src/lib/scraper/contactGate.ts');

describe('osm niche tags', () => {
  it('maps dentist niche to amenity tags', () => {
    const { tags, nameTerms } = resolveOsmNiche('dental clinics');
    assert.ok(tags.some((t) => t.key === 'amenity' && t.value === 'dentist'));
    assert.ok(nameTerms.length > 0);
  });

  it('builds overpass clauses for tags', () => {
    const { tags, nameTerms } = resolveOsmNiche('plumber');
    const clauses = buildOverpassClauses(tags, nameTerms, {
      south: 1,
      west: 2,
      north: 3,
      east: 4,
    });
    assert.match(clauses, /craft"="plumber"/);
    assert.match(clauses, /\(1,2,3,4\)/);
  });
});

describe('reach helpers', () => {
  it('computes haversine distance roughly', () => {
    const km = haversineKm(40.7128, -74.006, 40.758, -73.9855);
    assert.ok(km > 4 && km < 8);
  });
});

describe('contact gate', () => {
  it('rejects website-only leads', () => {
    assert.equal(hasPhoneOrEmail({ phone: '', email: '' }), false);
    assert.equal(hasPhoneOrEmail({ phone: '512-555-0100', email: '' }), true);
    assert.equal(hasPhoneOrEmail({ phone: '', email: 'owner@clinic.com' }), true);
  });
});

describe('geocode free (network optional)', () => {
  it('returns a point or null without throwing', async () => {
    const geo = await geocodeFree('Austin, TX');
    if (geo) {
      assert.ok(Number.isFinite(geo.lat));
      assert.ok(Number.isFinite(geo.lng));
    } else {
      assert.equal(geo, null);
    }
  });
});
