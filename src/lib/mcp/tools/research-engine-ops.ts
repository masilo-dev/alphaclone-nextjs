// @ts-nocheck
import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { researchService } from '@/lib/research/researchService';

// 1. research_businesses
registerTool('research-engine', {
  name: 'research_businesses',
  description:
    'Start an asynchronous web research and lead discovery job using the Scrapy-powered engine. Discovers real businesses, analyzes their public websites, extracts verified contacts without guessing, checks for duplicates against your CRM, and qualifies each lead.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().describe('Tenant UUID'),
    query: z.string().min(1).describe('Target query or industry keywords, e.g. "Plumbing companies"'),
    location: z.string().optional().describe('City, region, or country, e.g. "Sydney, Australia"'),
    industry: z.string().optional().describe('Target industry classification'),
    target_count: z.number().int().min(1).max(200).optional().default(50).describe('Target number of leads to discover'),
    require_email: z.boolean().optional().default(false).describe('Only qualify leads where a public email was verified'),
    require_phone: z.boolean().optional().default(false).describe('Only qualify leads where a telephone was found'),
    require_website: z.boolean().optional().default(true).describe('Only qualify leads with an active public website'),
    min_score: z.number().min(0).max(100).optional().default(60).describe('Minimum qualification score threshold'),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
      query: { type: 'string', description: 'Target query or industry keywords' },
      location: { type: 'string', description: 'Target geographic location' },
      industry: { type: 'string', description: 'Industry classification' },
      target_count: { type: 'number', description: 'Number of leads to discover (default: 50)' },
      require_email: { type: 'boolean', description: 'Require public verified email' },
      require_phone: { type: 'boolean', description: 'Require public telephone' },
      require_website: { type: 'boolean', description: 'Require active website' },
      min_score: { type: 'number', description: 'Minimum qualification score (0-100)' },
    },
    required: ['tenant_id', 'query'],
  },
  handler: async (args) => {
    const job = await researchService.startResearchJob(args.tenant_id, null, {
      query: args.query,
      location: args.location,
      industry: args.industry,
      targetCount: args.target_count || 50,
      qualificationRules: {
        requireEmail: args.require_email,
        requirePhone: args.require_phone,
        requireWebsite: args.require_website,
        targetIndustry: args.industry,
        targetLocation: args.location,
        minScore: args.min_score,
      },
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              message: 'Research job initiated successfully',
              research_job_id: job.id,
              status: job.status,
              query: job.query,
              location: job.location,
              target_count: job.target_count,
              note: 'Use get_research_job to monitor real-time progress or get_research_results to retrieve discovered leads.',
            },
            null,
            2
          ),
        },
      ],
    };
  },
});

// 2. get_research_job
registerTool('research-engine', {
  name: 'get_research_job',
  description:
    'Retrieve the live execution status, discovery counts, crawl progress, and qualification metrics of a research job.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().describe('Tenant UUID'),
    research_job_id: z.string().uuid().describe('Research job ID'),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
      research_job_id: { type: 'string', description: 'Research job ID' },
    },
    required: ['tenant_id', 'research_job_id'],
  },
  handler: async (args) => {
    const job = await researchService.getResearchJob(args.tenant_id, args.research_job_id);
    if (!job) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Research job '${args.research_job_id}' not found for this tenant.` }],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              research_job_id: job.id,
              status: job.status,
              progress: job.progress,
              metrics: {
                discovered: job.discovered_count,
                analyzed: job.processed_count,
                qualified: job.qualified_count,
                duplicates: job.duplicate_count,
                errors: job.error_count,
              },
              query: job.query,
              location: job.location,
              started_at: job.started_at,
              completed_at: job.completed_at,
            },
            null,
            2
          ),
        },
      ],
    };
  },
});

// 3. get_research_results
registerTool('research-engine', {
  name: 'get_research_results',
  description:
    'Fetch discovered leads from a research job with qualification scores, public emails, phone numbers, evidence, and deduplication status.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().describe('Tenant UUID'),
    research_job_id: z.string().uuid().describe('Research job ID'),
    is_qualified: z.boolean().optional().describe('Filter by qualified status'),
    search: z.string().optional().describe('Search filter for company name or email'),
    limit: z.number().int().min(1).max(200).optional().default(50).describe('Max results to return'),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
      research_job_id: { type: 'string', description: 'Research job ID' },
      is_qualified: { type: 'boolean', description: 'Only return qualified leads' },
      search: { type: 'string', description: 'Search keywords' },
      limit: { type: 'number', description: 'Max leads to return' },
    },
    required: ['tenant_id', 'research_job_id'],
  },
  handler: async (args) => {
    const { results, total } = await researchService.getResearchResults(args.tenant_id, args.research_job_id, {
      isQualified: args.is_qualified,
      search: args.search,
      limit: args.limit || 50,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              total,
              returned_count: results.length,
              leads: results.map((r) => ({
                id: r.id,
                business_name: r.business_name,
                website: r.website,
                email: r.public_email,
                email_status: r.email_status,
                phone: r.public_phone,
                location: r.location,
                industry: r.industry,
                qualification_score: r.qualification_score,
                is_qualified: r.is_qualified,
                qualification_reason: r.qualification_reason,
                dedupe_status: r.dedupe_status,
                duplicate_reason: r.duplicate_reason,
                review_status: r.review_status,
                source_urls: r.source_urls,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  },
});

// 4. cancel_research_job
registerTool('research-engine', {
  name: 'cancel_research_job',
  description: 'Cancel an active, in-flight research crawl job safely.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().describe('Tenant UUID'),
    research_job_id: z.string().uuid().describe('Research job ID to cancel'),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
      research_job_id: { type: 'string', description: 'Research job ID' },
    },
    required: ['tenant_id', 'research_job_id'],
  },
  handler: async (args) => {
    const cancelled = await researchService.cancelResearchJob(args.tenant_id, args.research_job_id);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ research_job_id: args.research_job_id, cancelled }, null, 2),
        },
      ],
    };
  },
});

// 5. qualify_research_results
registerTool('research-engine', {
  name: 'qualify_research_results',
  description: 'Evaluate or filter research results against custom criteria and ICP parameters.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().describe('Tenant UUID'),
    research_job_id: z.string().uuid().describe('Research job ID'),
    require_email: z.boolean().optional(),
    require_phone: z.boolean().optional(),
    min_score: z.number().min(0).max(100).optional().default(70),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
      research_job_id: { type: 'string', description: 'Research job ID' },
      require_email: { type: 'boolean' },
      require_phone: { type: 'boolean' },
      min_score: { type: 'number' },
    },
    required: ['tenant_id', 'research_job_id'],
  },
  handler: async (args) => {
    const { results } = await researchService.getResearchResults(args.tenant_id, args.research_job_id, {
      limit: 200,
    });

    const matching = results.filter((r) => {
      if (args.require_email && !r.public_email) return false;
      if (args.require_phone && !r.public_phone) return false;
      if (r.qualification_score < (args.min_score || 70)) return false;
      return true;
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              total_evaluated: results.length,
              matching_count: matching.length,
              qualified_leads: matching.map((m) => ({
                id: m.id,
                business_name: m.business_name,
                website: m.website,
                email: m.public_email,
                phone: m.public_phone,
                score: m.qualification_score,
                reason: m.qualification_reason,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  },
});

// 6. import_research_leads
registerTool('research-engine', {
  name: 'import_research_leads',
  description:
    'Import approved staged leads from a research job into the AlphaClone CRM leads table. Preserves provenance, job ID, source URLs, and qualification signals.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().describe('Tenant UUID'),
    research_job_id: z.string().uuid().describe('Research job ID'),
    result_ids: z.array(z.string().uuid()).optional().describe('Optional list of specific lead result IDs to import (imports all qualified if omitted)'),
    default_stage: z.string().optional().default('new').describe('Default CRM stage for the imported leads'),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
      research_job_id: { type: 'string', description: 'Research job ID' },
      result_ids: { type: 'array', items: { type: 'string' }, description: 'Specific IDs to import' },
      default_stage: { type: 'string', description: 'Target CRM lead stage' },
    },
    required: ['tenant_id', 'research_job_id'],
  },
  handler: async (args) => {
    const res = await researchService.importResearchLeadsToCrm(
      args.tenant_id,
      null,
      args.research_job_id,
      args.result_ids,
      { defaultStage: args.default_stage || 'new' }
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              message: `Successfully imported ${res.importedCount} leads into CRM`,
              imported_count: res.importedCount,
              lead_ids: res.leadIds,
              errors: res.errors,
            },
            null,
            2
          ),
        },
      ],
    };
  },
});
