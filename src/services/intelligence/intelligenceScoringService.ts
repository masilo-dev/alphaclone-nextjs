export type LeadThermalState = 'hot' | 'warm' | 'cold' | 'irrelevant';

export interface LeadIntelligenceInput {
  industry?: string;
  email?: string;
  phone?: string;
  website?: string;
  touchedPricingPage?: boolean;
  touchedProductPage?: boolean;
  openedEmail?: boolean;
  silentDays?: number;
  role?: string;
  // Extended compound scoring inputs
  companySize?: 'startup' | 'smb' | 'mid_market' | 'enterprise';
  annualRevenue?: number;
  techStack?: string[];
  fundingRound?: string;
  clickedEmail?: boolean;
  downloadedAsset?: boolean;
  attendedWebinar?: boolean;
  requestedDemo?: boolean;
  returnVisitCount?: number;
  lastActivityTimestamp?: number;
  referralSource?: string;
}

export interface StateDistribution {
  hot: number;
  warm: number;
  cold: number;
  irrelevant: number;
}

export interface CompoundScoreBreakdown {
  fitScore: number;
  intentScore: number;
  engagementScore: number;
  recencyMultiplier: number;
  rawCompound: number;
  finalScore: number;
}

export interface LeadIntelligenceResult {
  qualifiedProbability: number;
  confidence: number;
  stateDistribution: StateDistribution;
  recommendations: string[];
  psychologyProfile: string[];
  // New compound scoring output
  compoundBreakdown?: CompoundScoreBreakdown;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const round = (value: number): number => Math.round(value * 100) / 100;

function normalizeDistribution(distribution: StateDistribution): StateDistribution {
  const total = distribution.hot + distribution.warm + distribution.cold + distribution.irrelevant;
  if (total <= 0) {
    return { hot: 0.25, warm: 0.25, cold: 0.25, irrelevant: 0.25 };
  }

  return {
    hot: round(distribution.hot / total),
    warm: round(distribution.warm / total),
    cold: round(distribution.cold / total),
    irrelevant: round(distribution.irrelevant / total)
  };
}

/**
 * Compute recency decay factor using exponential decay.
 * Recent activity (within hours) → multiplier near 1.0
 * Stale activity (>14 days) → multiplier drops toward 0.3
 */
function computeRecencyMultiplier(silentDays?: number, lastActivityTimestamp?: number): number {
  let daysSinceActivity = silentDays ?? 0;

  if (lastActivityTimestamp && lastActivityTimestamp > 0) {
    const msSince = Date.now() - lastActivityTimestamp;
    daysSinceActivity = Math.max(0, msSince / (1000 * 60 * 60 * 24));
  }

  // Exponential decay: e^(-lambda * t), lambda = 0.08 gives ~50% at 9 days
  const lambda = 0.08;
  const decay = Math.exp(-lambda * daysSinceActivity);
  // Floor at 0.15 so completely stale leads still have some score
  return clamp(decay, 0.15, 1.0);
}

/**
 * Firmographic Fit Score (0–1)
 * Evaluates how well the lead matches ideal customer profile
 */
function computeFitScore(input: LeadIntelligenceInput): number {
  let fit = 0.35; // Base fit for any lead with minimal info

  // Contactability: having both email + phone is critical
  if (input.email && input.phone) {
    fit += 0.2;
  } else if (input.email || input.phone) {
    fit += 0.1;
  } else {
    fit *= 0.3; // Massive penalty — can't reach them
  }

  // Company size / ICP match
  const sizeScores: Record<string, number> = {
    enterprise: 0.15,
    mid_market: 0.18,
    smb: 0.12,
    startup: 0.08
  };
  if (input.companySize) {
    fit += sizeScores[input.companySize] ?? 0.08;
  }

  // Industry match (tech-adjacent industries score higher)
  const industryLower = (input.industry ?? '').toLowerCase();
  const highFitIndustries = ['tech', 'saas', 'software', 'fintech', 'consulting', 'agency', 'marketing'];
  if (highFitIndustries.some(ind => industryLower.includes(ind))) {
    fit += 0.12;
  } else if (industryLower.length > 0) {
    fit += 0.04;
  }

  // Role / seniority signal
  const roleLower = (input.role ?? '').toLowerCase();
  if (roleLower.includes('ceo') || roleLower.includes('founder') || roleLower.includes('owner')) {
    fit += 0.12;
  } else if (roleLower.includes('director') || roleLower.includes('vp') || roleLower.includes('head')) {
    fit += 0.1;
  } else if (roleLower.includes('manager') || roleLower.includes('lead')) {
    fit += 0.06;
  }

  // Website presence suggests established business
  if (input.website) {
    fit += 0.05;
  }

  // Funding signal
  if (input.fundingRound) {
    fit += 0.06;
  }

  return clamp(fit, 0.01, 1.0);
}

/**
 * Behavioral Intent Score (0–1)
 * Measures how strongly the lead is signaling purchase intent
 */
function computeIntentScore(input: LeadIntelligenceInput): number {
  let intent = 0.05; // Near-zero base — intent must be earned

  // High-intent behaviors (multiplicative weight)
  if (input.requestedDemo) {
    intent += 0.35;
  }
  if (input.touchedPricingPage) {
    intent += 0.25;
  }
  if (input.touchedProductPage) {
    intent += 0.15;
  }
  if (input.downloadedAsset) {
    intent += 0.12;
  }
  if (input.attendedWebinar) {
    intent += 0.1;
  }

  // Return visits compound intent
  if (input.returnVisitCount !== undefined) {
    if (input.returnVisitCount >= 5) {
      intent += 0.18;
    } else if (input.returnVisitCount >= 3) {
      intent += 0.12;
    } else if (input.returnVisitCount >= 1) {
      intent += 0.05;
    }
  }

  return clamp(intent, 0.01, 1.0);
}

/**
 * Engagement Score (0–1)
 * Measures active two-way interaction (not just passive browsing)
 */
function computeEngagementScore(input: LeadIntelligenceInput): number {
  let engagement = 0.05; // Near-zero base

  if (input.openedEmail) {
    engagement += 0.2;
  }
  if (input.clickedEmail) {
    engagement += 0.25;
  }

  // Responsiveness (low silent days = high engagement)
  if (input.silentDays !== undefined) {
    if (input.silentDays <= 1) {
      engagement += 0.25;
    } else if (input.silentDays <= 3) {
      engagement += 0.15;
    } else if (input.silentDays <= 7) {
      engagement += 0.05;
    }
    // >7 days silent = no engagement boost
  }

  // Referral source quality
  if (input.referralSource) {
    const src = input.referralSource.toLowerCase();
    if (src.includes('referral') || src.includes('partner')) {
      engagement += 0.15;
    } else if (src.includes('organic') || src.includes('seo')) {
      engagement += 0.08;
    } else if (src.includes('paid') || src.includes('ad')) {
      engagement += 0.05;
    }
  }

  return clamp(engagement, 0.01, 1.0);
}

function inferPsychologyProfile(input: LeadIntelligenceInput): string[] {
  const profile: string[] = [];

  if (input.touchedProductPage && input.touchedPricingPage) {
    profile.push('high_conscientiousness');
  }

  if (input.requestedDemo && input.touchedPricingPage) {
    profile.push('active_evaluator');
  }

  const roleLower = (input.role ?? '').toLowerCase();
  if (roleLower.includes('director') || roleLower.includes('vp') || roleLower.includes('ceo') || roleLower.includes('founder')) {
    profile.push('strategic_decision_maker');
  }

  if (input.openedEmail && input.silentDays !== undefined && input.silentDays <= 2) {
    profile.push('responsive_communication_style');
  }

  if (input.returnVisitCount !== undefined && input.returnVisitCount >= 3) {
    profile.push('deliberate_researcher');
  }

  if (input.downloadedAsset || input.attendedWebinar) {
    profile.push('education_driven_buyer');
  }

  if (!profile.length) {
    profile.push('insufficient_behavioral_signals');
  }

  return profile;
}

function buildRecommendations(
  input: LeadIntelligenceInput,
  probability: number,
  profile: string[],
  breakdown: CompoundScoreBreakdown
): string[] {
  const recommendations: string[] = [];

  // Score-based primary action
  if (probability >= 0.7) {
    recommendations.push('Prioritize direct outreach in the next 24 hours.');
  } else if (probability >= 0.45) {
    recommendations.push('Move to nurture sequence with personalized content.');
  } else if (probability >= 0.2) {
    recommendations.push('Add to drip campaign and monitor for engagement spikes.');
  } else {
    recommendations.push('De-prioritize active outreach and monitor for new engagement.');
  }

  // Compound-score-aware recommendations
  if (breakdown.fitScore >= 0.6 && breakdown.intentScore < 0.2) {
    recommendations.push('High-fit lead with low intent: trigger awareness content to drive product discovery.');
  }

  if (breakdown.intentScore >= 0.5 && breakdown.engagementScore < 0.2) {
    recommendations.push('Strong intent but low engagement: try alternate channel (phone, LinkedIn, or retargeting).');
  }

  if (breakdown.fitScore >= 0.5 && breakdown.intentScore >= 0.4 && breakdown.engagementScore >= 0.3) {
    recommendations.push('Triple-qualified lead (fit + intent + engagement): fast-track to sales team immediately.');
  }

  if (breakdown.recencyMultiplier < 0.5) {
    recommendations.push('Lead is going stale: deploy low-friction reactivation (case study, industry report).');
  }

  if (profile.includes('high_conscientiousness')) {
    recommendations.push('Send a detailed ROI breakdown and technical proof.');
  }

  if (profile.includes('education_driven_buyer')) {
    recommendations.push('Invite to upcoming webinar or send industry benchmark report.');
  }

  if (!input.email && input.phone) {
    recommendations.push('Use phone-first outreach because no direct email is available.');
  }

  return recommendations.slice(0, 6); // Cap at 6 recommendations
}

class IntelligenceScoringService {
  /**
   * COMPOUND SCORING ENGINE (Fit × Intent × Engagement × Recency)
   *
   * Unlike additive scoring where high fit + zero engagement = medium score,
   * compound scoring ensures that ANY zero dimension collapses the final score.
   * This eliminates false positives from leads that look good on paper but show
   * no actual buying behavior.
   *
   * Formula: Score = (Fit^0.35) × (Intent^0.30) × (Engagement^0.25) × (Recency^0.10)
   * Exponents weight each dimension's relative importance.
   */
  scoreLead(input: LeadIntelligenceInput): LeadIntelligenceResult {
    const fitScore = computeFitScore(input);
    const intentScore = computeIntentScore(input);
    const engagementScore = computeEngagementScore(input);
    const recencyMultiplier = computeRecencyMultiplier(input.silentDays, input.lastActivityTimestamp);

    // Compound multiplicative scoring with weighted exponents
    // Using geometric mean with weights ensures zero in any dimension crushes the score
    const fitWeight = 0.35;
    const intentWeight = 0.30;
    const engagementWeight = 0.25;
    const recencyWeight = 0.10;

    const rawCompound =
      Math.pow(fitScore, fitWeight) *
      Math.pow(intentScore, intentWeight) *
      Math.pow(engagementScore, engagementWeight) *
      Math.pow(recencyMultiplier, recencyWeight);

    // Normalize to 0-1 range (compound of sub-1 values is always <1)
    const probability = clamp(rawCompound, 0.01, 0.99);

    // Confidence is based on signal density — more data points = higher confidence
    let signalCount = 0;
    if (input.email) signalCount++;
    if (input.phone) signalCount++;
    if (input.industry) signalCount++;
    if (input.role) signalCount++;
    if (input.website) signalCount++;
    if (input.companySize) signalCount++;
    if (input.openedEmail) signalCount++;
    if (input.clickedEmail) signalCount++;
    if (input.touchedPricingPage) signalCount++;
    if (input.touchedProductPage) signalCount++;
    if (input.requestedDemo) signalCount++;
    if (input.downloadedAsset) signalCount++;
    if (input.returnVisitCount !== undefined) signalCount++;
    if (input.silentDays !== undefined) signalCount++;
    if (input.referralSource) signalCount++;

    // Confidence scales with signal density (max 15 signals)
    const confidence = clamp(0.25 + (signalCount / 15) * 0.7, 0.25, 0.95);

    const stateDistribution = normalizeDistribution({
      hot: clamp(probability * 1.1, 0.01, 1),
      warm: clamp((1 - Math.abs(probability - 0.45)) * 0.65, 0.01, 1),
      cold: clamp((1 - probability) * 0.75, 0.01, 1),
      irrelevant: clamp(Math.pow(1 - probability, 2) * 0.5, 0.01, 1)
    });

    const breakdown: CompoundScoreBreakdown = {
      fitScore: round(fitScore),
      intentScore: round(intentScore),
      engagementScore: round(engagementScore),
      recencyMultiplier: round(recencyMultiplier),
      rawCompound: round(rawCompound),
      finalScore: round(probability)
    };

    const psychologyProfile = inferPsychologyProfile(input);
    const recommendations = buildRecommendations(input, probability, psychologyProfile, breakdown);

    return {
      qualifiedProbability: round(probability),
      confidence: round(confidence),
      stateDistribution,
      recommendations,
      psychologyProfile,
      compoundBreakdown: breakdown
    };
  }
}

export const intelligenceScoringService = new IntelligenceScoringService();
