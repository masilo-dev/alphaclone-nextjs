/**
 * leadQualification.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Industry-aware lead qualification engine.
 * Every lead from the scraper passes through qualifyLead() which:
 *  1. Selects an industry-specific scoring profile (weights differ by trade)
 *  2. Scores 0–100 on 5 signals: email, phone, website, rating, address
 *  3. Assigns a tier: Hot / Warm / Cold / Skip
 *  4. Generates human-readable insights (missing signals, opportunities)
 *  5. Returns a pitchAngle for AI email personalisation
 */

export type QualityTier = 'hot' | 'warm' | 'cold' | 'skip';

export interface QualificationResult {
  score:      number;        // 0–100
  tier:       QualityTier;
  label:      string;        // "🔥 Hot"
  color:      string;        // tailwind text color class
  bgColor:    string;        // tailwind bg color class
  borderColor:string;
  insights:   string[];      // human-readable signals
  pitchAngle: string;        // recommended sales angle for AI email
  canAutoSend:boolean;       // requires at least an email
}

// ── Signal Weights (per industry category) ────────────────────────────────────
// Weights are percentages of the total 100-point score.
// Different industries prioritise different signals.
interface IndustryWeights {
  email:   number;  // max pts for having email
  phone:   number;  // max pts for having phone
  website: number;  // max pts for having website
  rating:  number;  // max pts for having good rating (4.0+)
  address: number;  // max pts for having address
}

// Map industry keywords → weight profiles
// Sorted by specificity (more specific first)
const INDUSTRY_PROFILES: Array<{ keywords: string[]; weights: IndustryWeights; defaultPitch: string }> = [
  // Trades & Home Services — phone is king (clients call)
  {
    keywords: ['plumb', 'hvac', 'electric', 'roofing', 'landscap', 'pest control',
               'locksmith', 'handyman', 'gutter', 'tree service', 'solar', 'pool',
               'flooring', 'painting', 'garage door', 'cleaning', 'window cleaning'],
    weights: { email: 25, phone: 40, website: 20, rating: 10, address: 5 },
    defaultPitch: 'digital-presence',
  },
  // Healthcare & Wellness — all signals equally important, email critical
  {
    keywords: ['dentist', 'chiropr', 'optom', 'dermat', 'pediatr', 'veterinar', 'pharmacy',
               'mental health', 'massage', 'urgent care', 'acupunct', 'hearing',
               'physical therap', 'gym', 'yoga', 'pilates', 'spa', 'nail', 'hair salon', 'barber', 'tattoo'],
    weights: { email: 35, phone: 25, website: 25, rating: 10, address: 5 },
    defaultPitch: 'patient-acquisition',
  },
  // Restaurants & Food — rating and website matter most (discovery)
  {
    keywords: ['restaurant', 'cafe', 'bakery', 'bar', 'catering', 'food truck',
               'pizza', 'sushi', 'steakhouse', 'hotel', 'bed and breakfast', 'night club'],
    weights: { email: 25, phone: 20, website: 20, rating: 25, address: 10 },
    defaultPitch: 'reputation-management',
  },
  // Professional Services — email essential (formal communication)
  {
    keywords: ['law', 'lawyer', 'attorney', 'accountant', 'financial advisor', 'insurance',
               'mortgage', 'consultant', 'marketing agency', 'advertising', 'pr firm',
               'notary', 'tax consultant', 'real estate'],
    weights: { email: 45, phone: 20, website: 25, rating: 5, address: 5 },
    defaultPitch: 'strategic-partnership',
  },
  // Tech & Digital — website/email balance
  {
    keywords: ['it service', 'web design', 'software', 'cyber', 'data recovery',
               'phone repair', 'it support', 'ai consult', 'tech'],
    weights: { email: 40, phone: 15, website: 30, rating: 10, address: 5 },
    defaultPitch: 'digital-partnership',
  },
  // Auto & Transport
  {
    keywords: ['auto', 'car', 'towing', 'car wash', 'tire', 'moving', 'trucking',
               'limousine', 'auto glass', 'transport'],
    weights: { email: 25, phone: 40, website: 20, rating: 10, address: 5 },
    defaultPitch: 'online-visibility',
  },
  // Construction
  {
    keywords: ['contractor', 'cabinet', 'concrete', 'demolition', 'fencing', 'masonry',
               'insulation', 'drywall', 'excavation', 'paving', 'construction'],
    weights: { email: 25, phone: 35, website: 25, rating: 10, address: 5 },
    defaultPitch: 'digital-presence',
  },
  // Retail & Commerce
  {
    keywords: ['grocery', 'clothing', 'furniture', 'pet store', 'bookstore', 'gift shop',
               'hardware', 'jewellery', 'electronics', 'retail', 'store', 'shop'],
    weights: { email: 30, phone: 20, website: 30, rating: 15, address: 5 },
    defaultPitch: 'e-commerce-opportunity',
  },
  // Education
  {
    keywords: ['tutoring', 'driving school', 'music school', 'childcare', 'preschool',
               'language school', 'art class', 'dance studio', 'education'],
    weights: { email: 40, phone: 20, website: 25, rating: 10, address: 5 },
    defaultPitch: 'parent-outreach',
  },
  // Default fallback
  {
    keywords: [],
    weights: { email: 35, phone: 25, website: 20, rating: 15, address: 5 },
    defaultPitch: 'growth-opportunity',
  },
];

// ── Pitch angle descriptions (used by AI email generator) ─────────────────────
export const PITCH_ANGLES: Record<string, { label: string; hook: string }> = {
  'digital-presence':      { label: 'No Online Presence', hook: 'We noticed you don\'t have a website — 87% of customers look online before calling a local business. We can fix that.' },
  'reputation-management': { label: 'Reputation Boost',  hook: 'We help local businesses build strong online reputations that attract more customers.' },
  'patient-acquisition':   { label: 'New Patient Growth', hook: 'We specialize in helping practices grow their patient base through targeted digital campaigns.' },
  'strategic-partnership': { label: 'Strategic Alliance', hook: 'We work with firms like yours to generate qualified inbound leads without ads.' },
  'digital-partnership':   { label: 'Tech Partnership',   hook: 'We\'d love to explore a white-label or referral partnership that benefits both our clients.' },
  'online-visibility':     { label: 'Online Visibility',  hook: 'We help auto businesses rank on Google Maps and get more calls from local customers.' },
  'e-commerce-opportunity':{ label: 'E-Commerce Growth',  hook: 'We help retail businesses launch or optimize online stores to sell beyond their local area.' },
  'parent-outreach':       { label: 'Parent Outreach',    hook: 'We help education providers reach parents actively looking for learning support for their children.' },
  'growth-opportunity':    { label: 'Business Growth',    hook: 'We help local businesses like yours attract more customers through proven digital strategies.' },
  'low-rating-recovery':   { label: 'Rating Recovery',    hook: 'We help businesses improve their online rating and turn unhappy customers into promoters.' },
  'no-email-follow-up':    { label: 'Phone Follow-Up',    hook: 'No email found — recommend calling directly. Let us draft a call script instead.' },
};

// ── Core qualifier ─────────────────────────────────────────────────────────────
export function qualifyLead(
  lead: {
    business_name?: string;
    email?:   string;
    phone?:   string;
    website?: string;
    rating?:  number;
    address?: string;
    category?:string;
    source?:  string;
  },
  industry: string
): QualificationResult {
  // 1. Pick profile
  const industryLower = industry.toLowerCase();
  const profile = INDUSTRY_PROFILES.find(p =>
    p.keywords.some(k => industryLower.includes(k) || k.includes(industryLower.slice(0, 5)))
  ) ?? INDUSTRY_PROFILES[INDUSTRY_PROFILES.length - 1];

  const { weights } = profile;
  const insights: string[] = [];

  // 2. Score each signal
  let score = 0;

  // Email (most important signal across all industries)
  const hasEmail = !!(lead.email?.trim());
  if (hasEmail) {
    score += weights.email;
  } else {
    insights.push('No email — auto-outreach unavailable, use phone or website contact');
  }

  // Phone
  const hasPhone = !!(lead.phone?.trim());
  if (hasPhone) {
    score += weights.phone;
  } else {
    insights.push('No phone number — harder to reach directly');
  }

  // Website
  const hasWebsite = !!(lead.website?.trim());
  if (hasWebsite) {
    score += weights.website;
  } else {
    insights.push('No website — strong digital service opportunity');
  }

  // Rating
  const rating = lead.rating;
  let ratingPts = 0;
  if (rating !== undefined && rating !== null) {
    if (rating >= 4.0)      { ratingPts = weights.rating; insights.push(`Rated ${rating.toFixed(1)}★ — established business`); }
    else if (rating >= 3.0) { ratingPts = Math.round(weights.rating * 0.5); }
    else if (rating >= 2.0) { ratingPts = 0; insights.push(`Low rating (${rating.toFixed(1)}★) — reputation management opportunity`); }
    // < 2.0 = 0 pts
  } else {
    // No rating: industries where rating matters a lot get penalised
    if (weights.rating >= 15) {
      insights.push('No reviews yet — early opportunity to build reputation');
    }
    ratingPts = Math.round(weights.rating * 0.3); // partial credit for unrated
  }
  score += ratingPts;

  // Address
  const hasAddress = !!(lead.address?.trim());
  if (hasAddress) score += weights.address;

  // Clamp
  score = Math.max(0, Math.min(100, score));

  // 3. Determine pitch angle
  let pitchAngle = profile.defaultPitch;
  if (!hasWebsite) pitchAngle = 'digital-presence';
  else if ((rating !== undefined) && rating < 3.0) pitchAngle = 'low-rating-recovery';
  else if (!hasEmail && hasPhone) pitchAngle = 'no-email-follow-up';

  // 4. Assign tier
  let tier: QualityTier;
  if      (score >= 75) tier = 'hot';
  else if (score >= 50) tier = 'warm';
  else if (score >= 25) tier = 'cold';
  else                  tier = 'skip';

  const TIER_META: Record<QualityTier, { label: string; color: string; bgColor: string; borderColor: string }> = {
    hot:  { label: '🔥 Hot',  color: 'text-orange-400',  bgColor: 'bg-orange-500/10',  borderColor: 'border-orange-500/30' },
    warm: { label: '🌡 Warm', color: 'text-yellow-400',  bgColor: 'bg-yellow-500/10',  borderColor: 'border-yellow-500/30' },
    cold: { label: '🧊 Cold', color: 'text-blue-400',    bgColor: 'bg-blue-500/10',    borderColor: 'border-blue-500/30'   },
    skip: { label: '✗ Skip',  color: 'text-slate-500',   bgColor: 'bg-slate-800/50',   borderColor: 'border-slate-700'     },
  };

  return {
    score,
    tier,
    ...TIER_META[tier],
    insights,
    pitchAngle,
    canAutoSend: hasEmail,
  };
}
