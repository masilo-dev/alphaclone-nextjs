/**
 * Free OSM tag mappings for local-business discovery (OpenLeads / KeeLead style).
 * Maps common niches → Overpass amenity/shop/office/craft/healthcare tags.
 */

export type OsmTag = { key: string; value: string };

const NICHE_TAG_MAP: Record<string, OsmTag[]> = {
  dentist: [
    { key: 'amenity', value: 'dentist' },
    { key: 'healthcare', value: 'dentist' },
  ],
  dental: [
    { key: 'amenity', value: 'dentist' },
    { key: 'healthcare', value: 'dentist' },
  ],
  clinic: [
    { key: 'amenity', value: 'clinic' },
    { key: 'healthcare', value: 'clinic' },
  ],
  doctor: [
    { key: 'amenity', value: 'doctors' },
    { key: 'healthcare', value: 'doctor' },
  ],
  pharmacy: [{ key: 'amenity', value: 'pharmacy' }],
  hospital: [{ key: 'amenity', value: 'hospital' }],
  restaurant: [{ key: 'amenity', value: 'restaurant' }],
  cafe: [{ key: 'amenity', value: 'cafe' }],
  coffee: [{ key: 'amenity', value: 'cafe' }],
  bar: [{ key: 'amenity', value: 'bar' }],
  pub: [{ key: 'amenity', value: 'pub' }],
  gym: [
    { key: 'leisure', value: 'fitness_centre' },
    { key: 'leisure', value: 'sports_centre' },
  ],
  fitness: [{ key: 'leisure', value: 'fitness_centre' }],
  hotel: [{ key: 'tourism', value: 'hotel' }],
  motel: [{ key: 'tourism', value: 'motel' }],
  lawyer: [
    { key: 'office', value: 'lawyer' },
    { key: 'office', value: 'attorney' },
  ],
  attorney: [{ key: 'office', value: 'lawyer' }],
  accountant: [{ key: 'office', value: 'accountant' }],
  insurance: [{ key: 'office', value: 'insurance' }],
  real_estate: [{ key: 'office', value: 'estate_agent' }],
  realtor: [{ key: 'office', value: 'estate_agent' }],
  estate: [{ key: 'office', value: 'estate_agent' }],
  plumber: [{ key: 'craft', value: 'plumber' }],
  electrician: [{ key: 'craft', value: 'electrician' }],
  hvac: [
    { key: 'craft', value: 'hvac' },
    { key: 'craft', value: 'electrician' },
    { key: 'shop', value: 'air_conditioning' },
  ],
  carpenter: [{ key: 'craft', value: 'carpenter' }],
  painter: [{ key: 'craft', value: 'painter' }],
  salon: [
    { key: 'shop', value: 'hairdresser' },
    { key: 'shop', value: 'beauty' },
  ],
  hairdresser: [{ key: 'shop', value: 'hairdresser' }],
  barber: [{ key: 'shop', value: 'hairdresser' }],
  spa: [{ key: 'leisure', value: 'spa' }],
  bakery: [{ key: 'shop', value: 'bakery' }],
  butcher: [{ key: 'shop', value: 'butcher' }],
  supermarket: [{ key: 'shop', value: 'supermarket' }],
  grocery: [{ key: 'shop', value: 'convenience' }],
  auto: [
    { key: 'shop', value: 'car_repair' },
    { key: 'amenity', value: 'car_wash' },
  ],
  mechanic: [{ key: 'shop', value: 'car_repair' }],
  garage: [{ key: 'shop', value: 'car_repair' }],
  veterinary: [{ key: 'amenity', value: 'veterinary' }],
  vet: [{ key: 'amenity', value: 'veterinary' }],
  school: [{ key: 'amenity', value: 'school' }],
  kindergarten: [{ key: 'amenity', value: 'kindergarten' }],
  daycare: [{ key: 'amenity', value: 'childcare' }],
  agency: [
    { key: 'office', value: 'advertising_agency' },
    { key: 'office', value: 'marketing' },
    { key: 'office', value: 'company' },
  ],
  marketing: [
    { key: 'office', value: 'advertising_agency' },
    { key: 'office', value: 'marketing' },
  ],
  consulting: [{ key: 'office', value: 'consulting' }],
  it: [
    { key: 'office', value: 'it' },
    { key: 'office', value: 'company' },
  ],
  software: [{ key: 'office', value: 'it' }],
  coworking: [{ key: 'amenity', value: 'coworking_space' }],
  bank: [{ key: 'amenity', value: 'bank' }],
  church: [{ key: 'amenity', value: 'place_of_worship' }],
};

/** Expand a free-text niche into OSM tag filters + name regex terms. */
export function resolveOsmNiche(niche: string): {
  tags: OsmTag[];
  nameTerms: string[];
} {
  const raw = niche.trim().toLowerCase();
  const tokens = raw.split(/[\s,/|&]+/).filter((t) => t.length > 2);
  const tags: OsmTag[] = [];
  const seen = new Set<string>();

  const pushTags = (list: OsmTag[]) => {
    for (const tag of list) {
      const id = `${tag.key}=${tag.value}`;
      if (seen.has(id)) continue;
      seen.add(id);
      tags.push(tag);
    }
  };

  if (NICHE_TAG_MAP[raw]) pushTags(NICHE_TAG_MAP[raw]);
  for (const token of tokens) {
    if (NICHE_TAG_MAP[token]) pushTags(NICHE_TAG_MAP[token]);
  }

  // Compound matches (e.g. "dental clinic", "marketing agency")
  for (const [key, list] of Object.entries(NICHE_TAG_MAP)) {
    if (raw.includes(key)) pushTags(list);
  }

  const nameTerms = Array.from(
    new Set(
      [niche.trim(), ...tokens]
        .map((t) => t.replace(/["\\]/g, '').trim())
        .filter((t) => t.length >= 3)
    )
  ).slice(0, 6);

  return { tags, nameTerms };
}

/** Build Overpass union clauses for tag + name matching inside a bbox. */
export function buildOverpassClauses(
  tags: OsmTag[],
  nameTerms: string[],
  bbox: { south: number; west: number; north: number; east: number }
): string {
  const { south, west, north, east } = bbox;
  const box = `(${south},${west},${north},${east})`;
  const parts: string[] = [];

  for (const tag of tags.slice(0, 12)) {
    parts.push(`node["${tag.key}"="${tag.value}"]${box};`);
    parts.push(`way["${tag.key}"="${tag.value}"]${box};`);
  }

  for (const term of nameTerms.slice(0, 4)) {
    const esc = term.replace(/["\\]/g, '');
    parts.push(`node["name"~"${esc}",i]${box};`);
    parts.push(`way["name"~"${esc}",i]${box};`);
    parts.push(`node["amenity"~"${esc}",i]${box};`);
    parts.push(`node["shop"~"${esc}",i]${box};`);
    parts.push(`node["office"~"${esc}",i]${box};`);
    parts.push(`node["craft"~"${esc}",i]${box};`);
  }

  return parts.join('\n  ');
}
