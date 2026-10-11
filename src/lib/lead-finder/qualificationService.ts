import {
  QualificationProfile,
  RequirementDecision,
  QualificationDecision,
  ChannelReadiness,
  QUALIFICATION_RULES_VERSION,
  COMPETITOR_KEYWORDS_FOR_WEBSITE_OFFERS,
} from './qualificationContract';
import {
  normalizeDomain,
  normalizeEmail,
  normalizePhone,
  resolveBusinessEntity,
} from './core';

export interface RawCandidateInput {
  business_name?: string | null;
  company?: string | null;
  name?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  emails?: string[] | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  category?: string | null;
  industry?: string | null;
  rating?: number | null;
  reviews_count?: number | null;
  source?: string | null;
  source_id?: string | null;
  source_url?: string | null;
  social_urls?: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    twitter?: string;
  } | null;
  crawl_evidence?: {
    accessible?: boolean;
    has_https?: boolean;
    has_viewport?: boolean;
    has_contact_cta?: boolean;
    has_booking_form?: boolean;
    broken_navigation?: boolean;
    notes?: string[];
  } | null;
  retrieved_at?: string;
}

export interface RequirementEvaluation {
  requirementId: string;
  label: string;
  decision: RequirementDecision;
  isMandatory: boolean;
  reason: string;
  evidence?: string | null;
}

export interface CandidateSeparateAssessments {
  identity_confidence: {
    score: number; // 0-100
    isRealBusiness: boolean;
    classification: 'operating_business' | 'directory_or_aggregator' | 'unrelated_organization' | 'unknown';
    reasons: string[];
  };
  data_quality: {
    score: number; // 0-100
    hasValidContact: boolean;
    freshness: string;
    sourceUrls: string[];
  };
  target_fit: {
    score: number; // 0-100
    matchesGeography: boolean;
    matchesIndustry: boolean;
    isCompetitor: boolean;
    reasons: string[];
  };
  evidence_of_need: {
    level: 'confirmed_need' | 'potential_need' | 'no_evidence_of_need' | 'unknown';
    observations: string[];
    gaps: string[];
  };
  contact_readiness: {
    channelReadiness: ChannelReadiness;
    emailValid: boolean;
    phoneValid: boolean;
    deliverabilityClaimed: boolean;
    reasons: string[];
  };
  buying_intent: {
    level: 'observed' | 'not_observed' | 'unknown';
    signals: string[];
    note: string;
  };
}

export interface CandidateEvidenceRecord {
  runId: string;
  rulesVersion: string;
  businessName: string;
  originalData: {
    name?: string | null;
    website?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    category?: string | null;
    rating?: number | null;
    source?: string | null;
  };
  normalizedData: {
    domain: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  officialWebsite: {
    url: string | null;
    status: 'identified' | 'absent_in_sources' | 'unverified';
  };
  sourceEvidence: {
    sourceType: string;
    sourceUrl: string | null;
    retrievedAt: string;
  };
  requirements: RequirementEvaluation[];
  assessments: CandidateSeparateAssessments;
  decision: QualificationDecision;
  decisionReasons: string[];
  missingEvidence: string[];
  recommendedNextStep: string;
  numericRankScore: number;
}

export interface QualificationBatchSummary {
  runId: string;
  rulesVersion: string;
  totalSourceItems: number;
  totalAssessed: number;
  counts: {
    qualified: number;
    reviewNeeded: number;
    notAFit: number;
    insufficientData: number;
  };
  channelCounts: {
    emailReady: number;
    phoneReady: number;
    noValidatedChannel: number;
  };
  invariantsHold: boolean;
  explanation: string;
  records: CandidateEvidenceRecord[];
}

/** Check if a business name or category matches web design competitor patterns */
export function isWebDesignCompetitor(businessName?: string | null, category?: string | null): boolean {
  const haystack = `${businessName || ''} ${category || ''}`.toLowerCase();
  return COMPETITOR_KEYWORDS_FOR_WEBSITE_OFFERS.some((keyword) =>
    haystack.includes(keyword.toLowerCase())
  );
}

/**
 * Single Authoritative Lead Qualification Function
 * Evaluates an individual candidate against a QualificationProfile without hallucinating facts.
 */
export function qualifyCandidate(
  candidate: RawCandidateInput,
  profile: QualificationProfile,
  runId = `qual_run_${Date.now()}`
): CandidateEvidenceRecord {
  const rawName = candidate.business_name || candidate.company || candidate.name || '';
  const countryContext = candidate.country || profile.targetGeography.country || profile.targetGeography.rawLocation;

  // 1. Identity validation
  const entity = resolveBusinessEntity({
    businessName: rawName,
    website: candidate.website,
    sourceUrl: candidate.source_url,
  });

  const isRealBusiness = entity.isRealBusiness;
  const classification = isRealBusiness
    ? 'operating_business'
    : ('directory_or_aggregator' as const);

  // 2. Contact normalization
  let rawEmail = candidate.email;
  if (!rawEmail && Array.isArray(candidate.emails) && candidate.emails.length > 0) {
    rawEmail = candidate.emails[0];
  }
  const normEmail = normalizeEmail(rawEmail);
  const normPhone = normalizePhone(candidate.phone, countryContext);
  const normDomain = normalizeDomain(candidate.website);

  // 3. Competitor check
  const isCompetitor = profile.excludeCompetitorsSameService
    ? isWebDesignCompetitor(rawName, candidate.category || candidate.industry)
    : false;

  // 4. Target geography check
  const targetCity = profile.targetGeography.city?.toLowerCase();
  const targetCountry = profile.targetGeography.country?.toLowerCase();
  const candidateLoc = `${candidate.address || ''} ${candidate.city || ''} ${candidate.country || ''}`.toLowerCase();

  let matchesGeography = true;
  if (targetCity && candidateLoc && !candidateLoc.includes(targetCity)) {
    // If city is specified and location exists but doesn't include the city
    matchesGeography = false;
  }
  if (targetCountry && candidateLoc && !candidateLoc.includes(targetCountry)) {
    matchesGeography = false;
  }

  // 5. Channel readiness derivation
  const emailValid = Boolean(normEmail);
  const phoneValid = Boolean(normPhone);
  let channelReadiness: ChannelReadiness = 'no_validated_channel';
  if (emailValid) {
    channelReadiness = 'email_ready';
  } else if (phoneValid) {
    channelReadiness = 'phone_ready';
  }

  // 6. Evidence of Need Evaluation (for website offers)
  const needObservations: string[] = [];
  const needGaps: string[] = [];
  let needLevel: CandidateSeparateAssessments['evidence_of_need']['level'] = 'unknown';

  if (profile.offer === 'website_design_and_development') {
    if (!normDomain) {
      needLevel = 'potential_need';
      needObservations.push('No website URL present in directory source records.');
      needGaps.push('Requires verification: Confirm business has no independent domain.');
    } else {
      // Website is present. Check for observable weakness evidence
      const crawl = candidate.crawl_evidence;
      if (crawl) {
        if (crawl.accessible === false) {
          needLevel = 'confirmed_need';
          needObservations.push('Website was inaccessible or returned an error.');
        } else if (crawl.has_viewport === false) {
          needLevel = 'confirmed_need';
          needObservations.push('Website lacks a mobile-responsive viewport declaration.');
        } else if (crawl.has_contact_cta === false || crawl.has_booking_form === false) {
          needLevel = 'confirmed_need';
          needObservations.push('Website lacks a clear contact enquiry or booking call-to-action.');
        } else {
          needLevel = 'no_evidence_of_need';
          needObservations.push('Active website with mobile viewport and contact options detected.');
        }
      } else {
        // Website exists, but no crawl was conducted
        needLevel = 'unknown';
        needObservations.push('Website is listed; detailed usability and mobile capability have not been audited.');
        needGaps.push('Requires website crawl to evaluate mobile friendliness and lead-capture capability.');
      }
    }
  } else {
    needLevel = 'unknown';
    needObservations.push('General B2B offer: need requires specific discovery interaction.');
  }

  // 7. Requirement-level decisions (PASS | FAIL | UNKNOWN | NOT_APPLICABLE)
  const reqEvals: RequirementEvaluation[] = [];

  for (const req of profile.mandatoryRequirements) {
    if (req.id === 'real_operating_business') {
      reqEvals.push({
        requirementId: req.id,
        label: req.label,
        isMandatory: true,
        decision: isRealBusiness ? 'PASS' : 'FAIL',
        reason: isRealBusiness
          ? 'Confirmed real operating commercial business.'
          : 'Failed: Classified as aggregator, directory listicle, or search page.',
        evidence: candidate.source_url || candidate.website,
      });
    } else if (req.id === 'no_competitor_same_service') {
      reqEvals.push({
        requirementId: req.id,
        label: req.label,
        isMandatory: true,
        decision: isCompetitor ? 'FAIL' : 'PASS',
        reason: isCompetitor
          ? 'Failed: Sells website design, web development, or digital agency services (competitor).'
          : 'Confirmed: Business does not operate as a web design or agency competitor.',
        evidence: `${rawName} (${candidate.category || 'General'})`,
      });
    } else if (req.id === 'target_geography') {
      reqEvals.push({
        requirementId: req.id,
        label: req.label,
        isMandatory: true,
        decision: matchesGeography ? 'PASS' : 'FAIL',
        reason: matchesGeography
          ? `Operating within target geography (${profile.targetGeography.rawLocation || 'specified market'}).`
          : `Failed: Location does not match target ${profile.targetGeography.rawLocation}.`,
        evidence: candidate.address || candidate.city || candidate.country,
      });
    } else if (req.id === 'valid_public_email') {
      reqEvals.push({
        requirementId: req.id,
        label: req.label,
        isMandatory: true,
        decision: emailValid ? 'PASS' : 'FAIL',
        reason: emailValid
          ? `Verified public business email syntax: ${normEmail}.`
          : 'Failed: Public business email address is missing or malformed.',
        evidence: normEmail,
      });
    } else if (req.id === 'valid_contact_channel') {
      reqEvals.push({
        requirementId: req.id,
        label: req.label,
        isMandatory: true,
        decision: emailValid || phoneValid ? 'PASS' : 'FAIL',
        reason: emailValid || phoneValid
          ? `Reachable via ${emailValid && phoneValid ? 'email and phone' : emailValid ? 'email' : 'phone'}.`
          : 'Failed: No validated phone or email contact method available.',
        evidence: normEmail || normPhone,
      });
    }
  }

  // 8. Separate assessments
  const assessments: CandidateSeparateAssessments = {
    identity_confidence: {
      score: isRealBusiness ? 90 : 10,
      isRealBusiness,
      classification,
      reasons: isRealBusiness
        ? ['Entity resolution confirmed distinct operating commercial business.']
        : ['Identified as directory, aggregator, or search listing.'],
    },
    data_quality: {
      score: (normDomain ? 25 : 0) + (normPhone ? 35 : 0) + (normEmail ? 40 : 0),
      hasValidContact: emailValid || phoneValid,
      freshness: 'Retrieved during active search session.',
      sourceUrls: [candidate.source_url, candidate.website].filter((u): u is string => Boolean(u)),
    },
    target_fit: {
      score: isCompetitor ? 0 : matchesGeography ? 80 : 30,
      matchesGeography,
      matchesIndustry: !isCompetitor,
      isCompetitor,
      reasons: isCompetitor
        ? ['Business sells the same service (competitor).']
        : matchesGeography
        ? ['Operates in the requested region and target commercial category.']
        : ['Geographic location uncertain or outside target bounds.'],
    },
    evidence_of_need: {
      level: needLevel,
      observations: needObservations,
      gaps: needGaps,
    },
    contact_readiness: {
      channelReadiness,
      emailValid,
      phoneValid,
      deliverabilityClaimed: false, // Rule: never claim deliverability from syntax alone!
      reasons:
        channelReadiness === 'email_ready'
          ? ['Public business email format validated. Deliverability not guaranteed without SMTP check.']
          : channelReadiness === 'phone_ready'
          ? ['Valid phone format. No public email found for automated email outreach.']
          : ['No verified phone or email found.'],
    },
    buying_intent: {
      level: 'not_observed',
      signals: [],
      note: 'No inbound inquiry or explicit buying intent observed in public directory data.',
    },
  };

  // 9. Overall Honest Decision
  const mandatoryFails = reqEvals.filter((r) => r.isMandatory && r.decision === 'FAIL');
  const mandatoryUnknowns = reqEvals.filter((r) => r.isMandatory && r.decision === 'UNKNOWN');

  let decision: QualificationDecision;
  const decisionReasons: string[] = [];
  const missingEvidence: string[] = [];

  if (mandatoryFails.length > 0) {
    decision = 'NOT_A_FIT';
    decisionReasons.push(...mandatoryFails.map((r) => r.reason));
  } else if (mandatoryUnknowns.length > 0) {
    decision = 'REVIEW_NEEDED';
    decisionReasons.push('Mandatory requirements require additional verification.');
    missingEvidence.push(...mandatoryUnknowns.map((r) => `Verify ${r.label}`));
  } else if (!isRealBusiness) {
    decision = 'NOT_A_FIT';
    decisionReasons.push('Entity is not an operating business.');
  } else if (isCompetitor) {
    decision = 'NOT_A_FIT';
    decisionReasons.push('Business provides the same web design / agency service as the user.');
  } else if (profile.offer === 'website_design_and_development') {
    // For website offers:
    if (needLevel === 'no_evidence_of_need') {
      decision = 'NOT_A_FIT';
      decisionReasons.push('Business already has an established, mobile-friendly website with contact mechanisms.');
    } else if (needLevel === 'potential_need' || needLevel === 'confirmed_need') {
      // If user requires email, but candidate only has phone:
      if (profile.requiredContactChannels.includes('email') && !emailValid) {
        decision = 'NOT_A_FIT';
        decisionReasons.push('Public email is required but absent.');
      } else {
        decision = 'QUALIFIED';
        decisionReasons.push(
          normDomain
            ? 'Observable website weaknesses present an improvement opportunity.'
            : 'No active website found in public sources; candidate for custom web presence.'
        );
      }
    } else {
      decision = 'REVIEW_NEEDED';
      decisionReasons.push('Website presence exists but requires usability research before qualifying.');
      missingEvidence.push('Manual or automated website audit of mobile layout and forms.');
    }
  } else {
    // Non-website offers
    decision = 'QUALIFIED';
    decisionReasons.push('Meets all configured mandatory criteria.');
  }

  // 10. Explainable Numeric Rank Score (ranks candidates, never overrides decision!)
  let rankScore = 0;
  if (decision === 'QUALIFIED') {
    rankScore = 70;
    if (emailValid) rankScore += 15;
    if (phoneValid) rankScore += 10;
    if (needLevel === 'confirmed_need') rankScore += 5;
  } else if (decision === 'REVIEW_NEEDED') {
    rankScore = 45;
  } else if ((decision as QualificationDecision) === 'INSUFFICIENT_DATA') {
    rankScore = 25;
  } else {
    rankScore = 0;
  }

  const recommendedNextStep =
    decision === 'QUALIFIED'
      ? channelReadiness === 'email_ready'
        ? 'Review evidence and draft email outreach.'
        : 'Prepare phone outreach or manual contact discovery.'
      : decision === 'REVIEW_NEEDED'
      ? 'Perform website usability review before qualifying.'
      : 'Exclude from campaign.';

  return {
    runId,
    rulesVersion: QUALIFICATION_RULES_VERSION,
    businessName: rawName,
    originalData: {
      name: candidate.name,
      website: candidate.website,
      phone: candidate.phone,
      email: rawEmail,
      address: candidate.address,
      category: candidate.category,
      rating: candidate.rating,
      source: candidate.source,
    },
    normalizedData: {
      domain: normDomain,
      email: normEmail,
      phone: normPhone,
      address: candidate.address || null,
    },
    officialWebsite: {
      url: normDomain ? candidate.website || null : null,
      status: normDomain ? 'identified' : 'absent_in_sources',
    },
    sourceEvidence: {
      sourceType: candidate.source || 'directory',
      sourceUrl: candidate.source_url || null,
      retrievedAt: candidate.retrieved_at || new Date().toISOString(),
    },
    requirements: reqEvals,
    assessments,
    decision,
    decisionReasons,
    missingEvidence,
    recommendedNextStep,
    numericRankScore: rankScore,
  };
}

/**
 * Evaluates a batch of candidates and provides mathematically invariant counts:
 * qualified + reviewNeeded + notAFit + insufficientData === totalAssessed
 */
export function qualifyCandidateBatch(
  candidates: RawCandidateInput[],
  profile: QualificationProfile,
  runId = `batch_${Date.now()}`
): QualificationBatchSummary {
  const records = candidates.map((c) => qualifyCandidate(c, profile, runId));

  const qualifiedCount = records.filter((r) => r.decision === 'QUALIFIED').length;
  const reviewCount = records.filter((r) => r.decision === 'REVIEW_NEEDED').length;
  const notAFitCount = records.filter((r) => r.decision === 'NOT_A_FIT').length;
  const insufficientCount = records.filter((r) => r.decision === 'INSUFFICIENT_DATA').length;

  const emailReadyCount = records.filter((r) => r.assessments.contact_readiness.channelReadiness === 'email_ready').length;
  const phoneReadyCount = records.filter((r) => r.assessments.contact_readiness.channelReadiness === 'phone_ready').length;
  const noChannelCount = records.filter((r) => r.assessments.contact_readiness.channelReadiness === 'no_validated_channel').length;

  const totalAssessed = records.length;
  const sumMutuallyExclusive = qualifiedCount + reviewCount + notAFitCount + insufficientCount;
  const invariantsHold = sumMutuallyExclusive === totalAssessed;

  let explanation = '';
  if (qualifiedCount === 0 && totalAssessed > 0) {
    if (records.some((r) => r.assessments.target_fit.isCompetitor)) {
      explanation = 'Zero qualified leads: Discovered candidates sell the same service as the user (competitors excluded).';
    } else if (profile.requiredContactChannels.includes('email') && emailReadyCount === 0) {
      explanation = 'Zero qualified leads: Search required public email, but discovered candidates lacked public emails.';
    } else {
      explanation = 'Zero qualified leads: Discovered candidates did not satisfy mandatory qualification rules.';
    }
  } else {
    explanation = `Evaluated ${totalAssessed} candidates: ${qualifiedCount} qualified, ${reviewCount} review needed, ${notAFitCount} not a fit.`;
  }

  return {
    runId,
    rulesVersion: QUALIFICATION_RULES_VERSION,
    totalSourceItems: candidates.length,
    totalAssessed,
    counts: {
      qualified: qualifiedCount,
      reviewNeeded: reviewCount,
      notAFit: notAFitCount,
      insufficientData: insufficientCount,
    },
    channelCounts: {
      emailReady: emailReadyCount,
      phoneReady: phoneReadyCount,
      noValidatedChannel: noChannelCount,
    },
    invariantsHold,
    explanation,
    records,
  };
}
