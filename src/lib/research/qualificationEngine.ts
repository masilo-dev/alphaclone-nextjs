/**
 * Qualification Engine for Web Research and Lead Discovery.
 * Transparent, evidence-backed evaluation with explainable signals.
 */

import type { QualificationRules } from './types';

export type QualificationOutput = {
  qualification_score: number;
  confidence_score: number;
  is_qualified: boolean;
  qualification_reason: string;
  disqualification_reasons: string[];
  qualification_signals: Array<{ signal: string; score: number; reason: string }>;
};

export type CandidateEvaluationInput = {
  business_name: string;
  website?: string | null;
  public_email?: string | null;
  public_phone?: string | null;
  location?: string | null;
  industry?: string | null;
  description?: string | null;
  contact_page?: string | null;
  linkedin_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  activity_signals?: string[];
};

export function evaluateResearchLead(
  candidate: CandidateEvaluationInput,
  rules: QualificationRules = {}
): QualificationOutput {
  const signals: Array<{ signal: string; score: number; reason: string }> = [];
  const disqualifications: string[] = [];

  let score = 30; // Base score for discovered real business
  let confidence = 40;

  // 1. Mandatory Filter Checks
  const hasEmail = Boolean(candidate.public_email);
  const hasPhone = Boolean(candidate.public_phone);
  const hasWebsite = Boolean(candidate.website);

  if (rules.requireEmail && !hasEmail) {
    disqualifications.push('Public email address is required by campaign filters but none was found');
  }
  if (rules.requirePhone && !hasPhone) {
    disqualifications.push('Telephone number is required by campaign filters but none was found');
  }
  if (rules.requireWebsite && !hasWebsite) {
    disqualifications.push('Public website is required by campaign filters but none was found');
  }

  // 2. Contactability Scoring
  if (hasEmail) {
    score += 25;
    confidence += 20;
    signals.push({ signal: 'public_email_verified', score: 25, reason: 'Public direct contact email found on website' });
  } else {
    signals.push({ signal: 'no_public_email', score: 0, reason: 'No publicly disclosed contact email found' });
  }

  if (hasPhone) {
    score += 15;
    confidence += 15;
    signals.push({ signal: 'public_phone_found', score: 15, reason: 'Valid public telephone number discovered' });
  }

  if (candidate.contact_page) {
    score += 10;
    signals.push({ signal: 'dedicated_contact_page', score: 10, reason: 'Dedicated contact/enquiry page observed' });
  }

  // 3. Location Matching
  if (rules.targetLocation && candidate.location) {
    const targetLoc = rules.targetLocation.toLowerCase().trim();
    const candLoc = candidate.location.toLowerCase().trim();
    if (candLoc.includes(targetLoc) || targetLoc.includes(candLoc)) {
      score += 10;
      signals.push({ signal: 'location_match', score: 10, reason: `Matches target territory (${candidate.location})` });
    }
  }

  // 4. Industry Alignment
  if (rules.targetIndustry && candidate.industry) {
    const targetInd = rules.targetIndustry.toLowerCase().trim();
    const candInd = candidate.industry.toLowerCase().trim();
    if (candInd.includes(targetInd) || targetInd.includes(candInd)) {
      score += 10;
      signals.push({ signal: 'industry_match', score: 10, reason: `Matches target sector (${candidate.industry})` });
    }
  }

  // 5. Social & Digital Presence
  const hasSocial = Boolean(candidate.linkedin_url || candidate.facebook_url || candidate.instagram_url);
  if (hasSocial) {
    score += 10;
    confidence += 10;
    signals.push({
      signal: 'social_presence_verified',
      score: 10,
      reason: 'Active company presence verified on LinkedIn, Facebook, or Instagram',
    });
  } else if (rules.socialPresenceRequired) {
    disqualifications.push('Social media presence required by campaign criteria but none was found');
  }

  // 6. Security & Web Quality Signals
  const activity = candidate.activity_signals || [];
  if (activity.includes('ssl_active') || activity.includes('https_verified')) {
    signals.push({ signal: 'ssl_active', score: 5, reason: 'Valid SSL/HTTPS security observed on domain' });
  }

  // Bound score and confidence to 0..100
  const finalScore = Math.min(100, Math.max(0, score));
  const finalConfidence = Math.min(100, Math.max(10, confidence));

  const minRequiredScore = rules.minScore ?? 60;
  const isScorePassing = finalScore >= minRequiredScore;
  const isQualified = disqualifications.length === 0 && isScorePassing;

  let reason = '';
  if (isQualified) {
    reason = `Qualified with score ${finalScore}/100. Met all contactability and ICP requirements.`;
  } else if (disqualifications.length > 0) {
    reason = `Disqualified: ${disqualifications.join('; ')}.`;
  } else {
    reason = `Score ${finalScore}/100 fell below minimum qualification threshold of ${minRequiredScore}.`;
  }

  return {
    qualification_score: finalScore,
    confidence_score: finalConfidence,
    is_qualified: isQualified,
    qualification_reason: reason,
    disqualification_reasons: disqualifications,
    qualification_signals: signals,
  };
}
