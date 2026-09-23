/**
 * Type definitions for AlphaClone Web Research and Lead Discovery Engine.
 */

export type ResearchJobStatus =
  | 'queued'
  | 'discovering'
  | 'crawling'
  | 'extracting'
  | 'validating'
  | 'qualifying'
  | 'completed'
  | 'partially_completed'
  | 'cancelled'
  | 'failed';

export type ReviewStatus = 'staged' | 'approved' | 'rejected' | 'in_review' | 'imported';

export type EmailStatus = 'found' | 'not_found' | 'verified' | 'invalid';

export type DedupeStatus = 'unique' | 'duplicate';

export type QualificationRules = {
  requireEmail?: boolean;
  requirePhone?: boolean;
  requireWebsite?: boolean;
  targetIndustry?: string;
  targetLocation?: string;
  businessSize?: 'small' | 'medium' | 'large' | 'any';
  ownerOperatedPreference?: boolean;
  socialPresenceRequired?: boolean;
  customInstructions?: string;
  minScore?: number;
};

export type ResearchJob = {
  id: string;
  research_job_id?: string;
  tenant_id: string;
  created_by?: string | null;
  query: string;
  industry?: string | null;
  location?: string | null;
  target_count: number;
  status: ResearchJobStatus;
  sources: string[];
  qualification_rules: QualificationRules;
  progress: number;
  discovered_count: number;
  processed_count: number;
  qualified_count: number;
  duplicate_count: number;
  error_count: number;
  started_at?: string | null;
  completed_at?: string | null;
  failed_at?: string | null;
  error_message?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type LeadResearchResult = {
  id: string;
  research_job_id: string;
  tenant_id: string;
  business_name: string;
  website?: string | null;
  domain?: string | null;
  public_email?: string | null;
  email_status: EmailStatus;
  public_phone?: string | null;
  location?: string | null;
  industry?: string | null;
  description?: string | null;
  services: string[];
  contact_page?: string | null;
  about_page?: string | null;
  linkedin_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  other_social_urls: string[];
  source_urls: string[];
  source_type: string;
  activity_signals: string[];
  qualification_signals: Array<{ signal: string; score: number; reason: string }>;
  qualification_score: number;
  confidence_score: number;
  is_qualified: boolean;
  qualification_reason?: string | null;
  disqualification_reasons: string[];
  dedupe_status: DedupeStatus;
  duplicate_reason?: string | null;
  review_status: ReviewStatus;
  imported_lead_id?: string | null;
  crawl_timestamp: string;
  raw_evidence: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ResearchSource = {
  name: string;
  type: string;
  discover(params: {
    query: string;
    location?: string;
    limit: number;
  }): Promise<Array<{
    business_name: string;
    website?: string | null;
    phone?: string | null;
    location?: string | null;
    industry?: string | null;
    source_url?: string | null;
    source_type: string;
    raw?: Record<string, unknown>;
  }>>;
};
