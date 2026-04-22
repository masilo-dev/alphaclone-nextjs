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
}

export interface StateDistribution {
  hot: number;
  warm: number;
  cold: number;
  irrelevant: number;
}

export interface LeadIntelligenceResult {
  qualifiedProbability: number;
  confidence: number;
  stateDistribution: StateDistribution;
  recommendations: string[];
  psychologyProfile: string[];
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

function inferPsychologyProfile(input: LeadIntelligenceInput): string[] {
  const profile: string[] = [];

  if (input.touchedProductPage && input.touchedPricingPage) {
    profile.push('high_conscientiousness');
  }

  if (input.role?.toLowerCase().includes('director') || input.role?.toLowerCase().includes('vp')) {
    profile.push('strategic_decision_maker');
  }

  if (input.openedEmail && input.silentDays !== undefined && input.silentDays <= 2) {
    profile.push('responsive_communication_style');
  }

  if (!profile.length) {
    profile.push('insufficient_behavioral_signals');
  }

  return profile;
}

function buildRecommendations(input: LeadIntelligenceInput, probability: number, profile: string[]): string[] {
  const recommendations: string[] = [];

  if (probability >= 0.7) {
    recommendations.push('Prioritize direct outreach in the next 24 hours.');
  } else if (probability >= 0.45) {
    recommendations.push('Move to nurture sequence with personalized content.');
  } else {
    recommendations.push('De-prioritize active outreach and monitor for new engagement.');
  }

  if (profile.includes('high_conscientiousness')) {
    recommendations.push('Send a detailed ROI breakdown and technical proof.');
  }

  if (!input.email && input.phone) {
    recommendations.push('Use phone-first outreach because no direct email is available.');
  }

  if (input.silentDays !== undefined && input.silentDays >= 7) {
    recommendations.push('Switch from push messaging to low-friction reactivation.');
  }

  return recommendations;
}

class IntelligenceScoringService {
  scoreLead(input: LeadIntelligenceInput): LeadIntelligenceResult {
    let probability = 0.3;
    let confidence = 0.5;

    if (input.industry?.toLowerCase().includes('tech')) {
      probability += 0.08;
      confidence += 0.05;
    }

    if (input.openedEmail) {
      probability += 0.15;
      confidence += 0.08;
    }

    if (input.touchedPricingPage) {
      probability += 0.17;
      confidence += 0.1;
    }

    if (input.touchedProductPage) {
      probability += 0.12;
      confidence += 0.08;
    }

    if (!input.email && !input.phone) {
      probability -= 0.2;
      confidence -= 0.1;
    }

    if (input.silentDays !== undefined) {
      if (input.silentDays >= 7) {
        probability -= 0.2;
      } else if (input.silentDays >= 4) {
        probability -= 0.1;
      } else {
        probability += 0.03;
      }
    }

    probability = clamp(probability, 0.01, 0.99);
    confidence = clamp(confidence, 0.2, 0.98);

    const stateDistribution = normalizeDistribution({
      hot: clamp(probability * 0.95, 0.01, 1),
      warm: clamp((1 - Math.abs(probability - 0.5)) * 0.55, 0.01, 1),
      cold: clamp((1 - probability) * 0.7, 0.01, 1),
      irrelevant: clamp((1 - probability) * 0.3, 0.01, 1)
    });

    const psychologyProfile = inferPsychologyProfile(input);
    const recommendations = buildRecommendations(input, probability, psychologyProfile);

    return {
      qualifiedProbability: round(probability),
      confidence: round(confidence),
      stateDistribution,
      recommendations,
      psychologyProfile
    };
  }
}

export const intelligenceScoringService = new IntelligenceScoringService();
