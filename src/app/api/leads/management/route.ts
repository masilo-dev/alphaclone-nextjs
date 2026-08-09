import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { start } from 'workflow/api';
import { leadFindingWorkflow } from '@/workflows/lead-finding';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { operationFailed, OPERATION_FAILED_MESSAGE } from '@/lib/api/operationResult';
import { freePlacesService } from '@/services/freePlacesService';
import { fetchSerpLeadsViaBrowser, hasRemoteBrowserConfigured } from '@/lib/scraper/browserSerpLeads';
import { leadsManagementSchema } from '@/schemas/validation';
import { getFacebookIntegration, getFacebookTokens } from '@/services/facebook/facebookIntegrationService';
import { z } from 'zod';
import { normalizePlatformRole } from '@/lib/platformAdmin';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const parsed = leadsManagementSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { tenantId, action, config } = parsed.data;

    const access = await requireTenantAccess(tenantId, req);
    const supabase = access.admin;
    const role = normalizePlatformRole(access.membership.role);

    const isReadOnly = action === 'get_leads';
    const isAdminAction =
      action === 'find_leads' ||
      action === 'delete_lead' ||
      action === 'convert_lead';

    if (!isReadOnly && ['client', 'visitor'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (isAdminAction && !['owner', 'admin', 'tenant_admin', 'super_admin'].includes(role)) {
      return NextResponse.json({ error: 'Insufficient workspace permissions' }, { status: 403 });
    }

    const validated = validateActionConfig(action, config);
    if (!validated.success) {
      return NextResponse.json({ error: 'Validation failed', details: validated.error.flatten() }, { status: 400 });
    }
    const validatedConfig = validated.data;

    const { error: tenantContextError } = await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
    if (tenantContextError) {
      console.warn('[api] set_tenant_context unavailable:', tenantContextError.message);
    }

    switch (action) {
      case 'find_leads':
        return NextResponse.json(await findLeads(tenantId, validatedConfig, supabase));
      case 'save_lead':
        return NextResponse.json(await saveLead(tenantId, validatedConfig, supabase));
      case 'update_lead':
        return NextResponse.json(await updateLead(tenantId, validatedConfig, supabase));
      case 'get_leads':
        return NextResponse.json(await getLeads(tenantId, validatedConfig, supabase));
      case 'convert_lead':
        return NextResponse.json(await convertLead(tenantId, validatedConfig, supabase));
      case 'delete_lead':
        return NextResponse.json(await deleteLead(tenantId, validatedConfig, supabase));
      case 'bulk_actions':
        if (!['owner', 'admin', 'tenant_admin', 'super_admin', 'member'].includes(role)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        return NextResponse.json(await bulkLeadsActions(tenantId, validatedConfig, supabase, role));
      default:
        return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('Lead management error:', error);
    return routeErrorResponse(error, undefined, req);
  }
}

const leadIdSchema = z.string().uuid();

const findLeadsSchema = z.object({
  location: z.string().trim().min(1).max(200),
  businessType: z.string().trim().min(1).max(200),
  radius: z.coerce.number().min(1).max(50).optional().default(5),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  sources: z.array(z.enum(['all', 'openstreetmap', 'facebook', 'linkedin', 'google'])).optional().default(['all']),
  filters: z.record(z.string(), z.unknown()).optional().default({}),
});

const saveLeadSchema = z.object({
  leadData: z.object({
    id: z.string().trim().min(1).max(500),
    name: z.string().trim().min(1).max(500),
    email: z.string().trim().email().max(320).optional().nullable(),
    phone: z.string().trim().max(100).optional().nullable(),
    address: z.string().trim().max(500).optional().nullable(),
    location: z.string().trim().max(500).optional().nullable(),
    website: z.string().trim().max(2000).optional().nullable(),
    type: z.string().trim().max(200).optional().nullable(),
    category: z.string().trim().max(200).optional().nullable(),
    metadata: z.record(z.string(), z.unknown()).optional().default({}),
    foundAt: z.string().optional(),
  }),
  source: z.string().trim().min(1).max(200),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateLeadSchema = z.object({
  leadId: leadIdSchema,
  updates: z.record(z.string(), z.unknown()).default({}),
});

const getLeadsSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(20),
  status: z.string().trim().max(80).optional(),
  source: z.string().trim().max(120).optional(),
  priority: z.string().trim().max(80).optional(),
  dateRange: z
    .object({
      start: z.string().min(1),
      end: z.string().min(1),
    })
    .optional(),
  search: z.string().trim().max(200).optional(),
});

const convertLeadSchema = z.object({
  leadId: leadIdSchema,
  conversionType: z.string().trim().max(80).optional(),
  dealData: z
    .object({
      name: z.string().trim().max(500).optional(),
      value: z.coerce.number().min(0).optional(),
      stage: z.string().trim().max(80).optional(),
      expectedCloseDate: z.string().optional(),
      probability: z.coerce.number().min(0).max(100).optional(),
    })
    .optional(),
});

const deleteLeadSchema = z.object({
  leadId: leadIdSchema,
});

const bulkActionsSchema = z
  .object({
    leadIds: z.array(leadIdSchema).min(1).max(200),
    action: z.enum(['update_status', 'update_priority', 'assign_to_user', 'add_tag', 'delete']),
    data: z.record(z.string(), z.unknown()).default({}),
  })
  .superRefine((value, ctx) => {
    if (value.action === 'update_status') {
      if (typeof value.data.status !== 'string' || !String(value.data.status).trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'status is required' });
      }
    }
    if (value.action === 'update_priority') {
      if (typeof value.data.priority !== 'string' || !String(value.data.priority).trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'priority is required' });
      }
    }
    if (value.action === 'assign_to_user') {
      if (typeof value.data.userId !== 'string' || !String(value.data.userId).trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'userId is required' });
      }
    }
    if (value.action === 'add_tag') {
      if (typeof value.data.tag !== 'string' || !String(value.data.tag).trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'tag is required' });
      }
    }
  });

function validateActionConfig(action: string, config: unknown) {
  if (action === 'find_leads') return findLeadsSchema.safeParse(config);
  if (action === 'save_lead') return saveLeadSchema.safeParse(config);
  if (action === 'update_lead') return updateLeadSchema.safeParse(config);
  if (action === 'get_leads') return getLeadsSchema.safeParse(config);
  if (action === 'convert_lead') return convertLeadSchema.safeParse(config);
  if (action === 'delete_lead') return deleteLeadSchema.safeParse(config);
  if (action === 'bulk_actions') return bulkActionsSchema.safeParse(config);
  return z.record(z.string(), z.unknown()).safeParse(config);
}

async function findLeads(tenantId: string, config: any, supabase: any) {
  try {
    const { 
      location, 
      businessType, 
      radius = 5, 
      limit = 50, 
      sources = ['all'],
      filters = {}
    } = config;

    const leads = [];

    // Search different lead sources
    if (sources.includes('openstreetmap') || sources.includes('all')) {
      const osmLeads = await searchOpenStreetMapLeads(location, businessType, radius, limit, filters);
      leads.push(...osmLeads);
    }

    if (sources.includes('facebook') || sources.includes('all')) {
      const fbLeads = await searchFacebookLeads(tenantId, businessType, limit, filters, supabase);
      leads.push(...fbLeads);
    }

    if (sources.includes('linkedin') || sources.includes('all')) {
      const linkedinLeads = await searchLinkedInLeads(businessType, location, limit, filters);
      leads.push(...linkedinLeads);
    }

    if (sources.includes('google') || sources.includes('all')) {
      const googleLeads = await searchGoogleLeads(businessType, location, radius, limit, filters);
      leads.push(...googleLeads);
    }

    // Remove duplicates and limit results
    const uniqueLeads = removeDuplicateLeads(leads).slice(0, limit);

    // Save search results to database for tracking
    await saveLeadSearchResults(tenantId, uniqueLeads, config, supabase);

    const { runId } = await start(leadFindingWorkflow, [{ query: businessType, location, tenantId }]);

    return {
      success: true,
      data: {
        leads: uniqueLeads,
        total: uniqueLeads.length,
        sources: sources,
        location: location,
        searchTime: new Date().toISOString(),
        runId
      },
      message: `Found ${uniqueLeads.length} leads`
    };
  } catch (error: any) {
    return operationFailed('leads/management', error);
  }
}

async function searchOpenStreetMapLeads(location: string, businessType: string, radius: number, limit: number, filters: any) {
  try {
    const leads: any[] = [];
    
    // Geocode location
    const geoResponse = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`
    );
    const geoData = await geoResponse.json();
    
    if (geoData.length === 0) {
      return leads;
    }

    const { lat, lon } = geoData[0];
    const bbox = [
      parseFloat(lon) - (radius / 111),
      parseFloat(lat) - (radius / 111),
      parseFloat(lon) + (radius / 111),
      parseFloat(lat) + (radius / 111)
    ].join(',');

    // Search for businesses
    const businessTypes = getBusinessTypeTags(businessType);
    
    for (const businessTag of businessTypes) {
      const query = `
        [out:json][timeout:25];
        (
          node["${businessTag}"~".*"](${bbox});
          way["${businessTag}"~".*"](${bbox});
          relation["${businessTag}"~".*"](${bbox});
        );
        out geom;
      `;

      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query
      });

      const data = await response.json();
      
      if (data.elements) {
        for (const element of data.elements) {
          const lead = processOSMElement(element, businessType, lat, lon);
          if (lead && passesFilters(lead, filters)) {
            leads.push(lead);
          }
        }
      }
    }

    return leads;
  } catch (error) {
    console.error('OSM search error:', error);
    return [];
  }
}

async function searchFacebookLeads(tenantId: string, businessType: string, limit: number, filters: any, supabase: any) {
  try {
    const integration = await getFacebookIntegration(supabase, { tenantId });

    if (!integration) {
      return [];
    }

    const tokens = await getFacebookTokens(supabase, integration);
    const leads = [];
    const token = tokens.userAccessToken || tokens.pageAccessToken;
    if (!token) return [];

    // Search for Facebook pages related to business type
    const searchQuery = `${businessType} business`;
    const response = await fetch(
      `https://graph.facebook.com/v18.0/search?type=page&q=${encodeURIComponent(searchQuery)}&limit=${limit}&fields=id,name,category,category_list,location,website,phone,fan_count,verified,talking_about_count,cover,rating&access_token=${encodeURIComponent(token)}`
    );

    const data = await response.json();

    if (data.data) {
      for (const page of data.data) {
        const lead = {
          id: `fb_${page.id}`,
          name: page.name,
          source: 'facebook',
          type: 'business_page',
          location: page.location?.city ? `${page.location.city}, ${page.location.country}` : null,
          website: page.website || null,
          phone: page.phone || null,
          category: page.category,
          followers: page.fan_count || 0,
          verified: page.verified || false,
          metadata: {
            pageId: page.id,
            category_list: page.category_list,
            talking_about_count: page.talking_about_count,
            rating: page.rating,
            cover_photo_url: page.cover?.source
          },
          foundAt: new Date().toISOString()
        };

        if (passesFilters(lead, filters)) {
          leads.push(lead);
        }
      }
    }

    return leads;
  } catch (error) {
    console.error('Facebook search error:', error);
    return [];
  }
}

async function searchLinkedInLeads(businessType: string, location: string, limit: number, filters: any) {
  try {
    if (!hasRemoteBrowserConfigured()) {
      return [];
    }

    const rows = await fetchSerpLeadsViaBrowser(businessType, location, Math.min(Math.max(limit, 5), 20), {
      searchQuery: `${businessType} ${location} site:linkedin.com/company`,
    });

    const leads = rows.map((row, index) => ({
      id: `li_${index + 1}_${Buffer.from(`${row.business_name}:${row.website}`).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`,
      name: row.business_name,
      source: 'linkedin',
      type: 'company_profile',
      location: row.address || location,
      industry: businessType,
      website: row.website || null,
      phone: row.phone || null,
      email: row.email || null,
      description: row.snippet || 'Public company profile discovered from LinkedIn search.',
      metadata: {
        publicProfileUrl: row.website || null,
        contact_discovery_method: 'public_search',
      },
      foundAt: new Date().toISOString()
    }));

    return leads.filter((lead) => passesFilters(lead, filters));
  } catch (error) {
    console.error('LinkedIn search error:', error);
    return [];
  }
}

async function searchGoogleLeads(businessType: string, location: string, radius: number, limit: number, filters: any) {
  try {
    const result = await freePlacesService.searchPlacesForLeads(businessType, location, undefined, {
      radiusKm: Math.min(Math.max(radius || 15, 2), 50),
      maxResults: Math.min(Math.max(limit, 5), 20),
    });

    if (result.error && result.places.length === 0) {
      console.warn('[leads/management] Free places:', result.error);
      return [];
    }

    const leads = result.places.map((p) => ({
      id: `place_${p.placeId}`,
      name: p.businessName,
      source: p.source || 'free_places',
      type: 'place',
      location: p.formattedAddress || location,
      address: p.formattedAddress,
      phone: p.phone || null,
      website: p.website || null,
      rating: p.rating ?? null,
      reviews: p.userRatingCount ?? null,
      metadata: {
        placeId: p.placeId,
        googleMapsUri: p.googleMapsUri,
        industry: p.industry,
        lat: p.lat,
        lng: p.lng,
        location_validated: result.locationValidated,
        formatted_location: result.formattedLocation,
        geocode_warning: result.geocodeError,
      },
      foundAt: new Date().toISOString(),
    }));

    return leads.filter((lead) => passesFilters(lead, filters));
  } catch (error) {
    console.error('Free places search error:', error);
    return [];
  }
}

async function saveLead(tenantId: string, config: any, supabase: any) {
  try {
    const { leadData, source, metadata } = config;

    // Check if lead already exists
    const { data: existingLead, error: existingError } = await supabase
      .from('leads')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('external_id', leadData.id)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existingLead) {
      return { success: false, error: 'Lead already exists' };
    }

    // Save lead to database
    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        tenant_id: tenantId,
        business_name: leadData.name,
        email: leadData.email || null,
        phone: leadData.phone || null,
        location: leadData.address || leadData.location || null,
        website: leadData.website || null,
        industry: leadData.type || leadData.category || null,
        source: source,
        status: 'new',
        stage: 'lead',
        priority: calculateLeadPriority(leadData),
        external_id: leadData.id,
        value: estimateLeadValue(leadData),
        metadata: {
          ...leadData.metadata,
          original_source: source,
          found_at: leadData.foundAt
        },
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Update lead search tracking
    await supabase
      .from('lead_search_results')
      .update({ saved_to_database: true })
      .eq('tenant_id', tenantId)
      .eq('lead_external_id', leadData.id);

    return {
      success: true,
      data: lead,
      message: 'Lead saved successfully'
    };
  } catch (error: any) {
    return operationFailed('leads/management', error);
  }
}

async function updateLead(tenantId: string, config: any, supabase: any) {
  try {
    const { leadId, updates } = config;

    const { data: lead, error } = await supabase
      .from('leads')
      .update({
        ...(updates.name ? { business_name: updates.name } : {}),
        ...(updates.status ? { status: updates.status, stage: updates.status } : {}),
        ...(updates.address ? { location: updates.address } : {}),
        ...(updates.priority ? { priority: updates.priority } : {}),
        ...Object.fromEntries(Object.entries(updates).filter(([key]) => !['name', 'status', 'address', 'priority'].includes(key))),
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data: lead,
      message: 'Lead updated successfully'
    };
  } catch (error: any) {
    return operationFailed('leads/management', error);
  }
}

async function getLeads(tenantId: string, config: any, supabase: any) {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      source, 
      priority,
      dateRange,
      search
    } = config;

    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (status) {
      query = query.eq('stage', status);
    }

    if (source) {
      query = query.eq('source', source);
    }

    if (priority) {
      query = query.eq('priority', priority);
    }

    if (dateRange) {
      query = query.gte('created_at', dateRange.start).lte('created_at', dateRange.end);
    }

    if (search) {
      query = query.or(`business_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data: leads, error, count } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) throw error;

    return {
      success: true,
      data: {
        leads: leads || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          pages: Math.ceil((count || 0) / limit)
        }
      }
    };
  } catch (error: any) {
    return operationFailed('leads/management', error);
  }
}

async function convertLead(tenantId: string, config: any, supabase: any) {
  try {
    const { leadId, conversionType, dealData } = config;

    const { data: leadBefore, error: leadLookupError } = await supabase
      .from('leads')
      .select('id, tenant_id, business_name, value, email')
      .eq('id', leadId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (leadLookupError) throw leadLookupError;
    if (!leadBefore) return { success: false, error: 'Lead not found' };

    const { data: conversion, error: conversionError } = await supabase.rpc('convert_lead_to_contact', {
      lead_id: leadId,
      create_company: false,
      company_name: null,
      contact_name_override: null,
    });

    if (conversionError) throw conversionError;

    const conversionPayload =
      typeof conversion === 'string'
        ? JSON.parse(conversion)
        : (conversion || {});

    const { data: lead, error: refreshedLeadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('tenant_id', tenantId)
      .single();

    if (refreshedLeadError) throw refreshedLeadError;

    // Create deal if dealData provided
    if (dealData) {
      const { data: deal, error: dealError } = await supabase
        .from('deals')
        .insert({
          tenant_id: tenantId,
          name: dealData.name || `Deal from ${leadBefore.business_name}`,
          value: dealData.value || leadBefore.value || 0,
          stage: dealData.stage || 'lead',
          expected_close_date: dealData.expectedCloseDate,
          probability: dealData.probability || 50,
          contact_id: conversionPayload.contact_id || null,
          metadata: {
            source: 'lead_conversion',
            conversion_type: conversionType || null,
            original_lead_id: leadId,
            business_client_id: conversionPayload.client_id || null,
          },
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (dealError) throw dealError;

      return {
        success: true,
        data: { lead, deal, conversion: conversionPayload },
        message: 'Lead converted to deal successfully'
      };
    }

    return {
      success: true,
      data: { lead, conversion: conversionPayload },
      message: 'Lead converted successfully'
    };
  } catch (error: any) {
    return operationFailed('leads/management', error);
  }
}

async function deleteLead(tenantId: string, config: any, supabase: any) {
  try {
    const { leadId } = config;

    try {
      const { data, error } = await supabase.rpc('delete_tenant_lead', { p_lead_id: leadId });
      if (error) throw error;
      if (data && typeof data === 'object' && data.ok === true) {
        return { success: true, message: 'Lead deleted successfully' };
      }
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (!/function|does not exist|delete_tenant_lead/i.test(msg)) throw err;
    }

    const { error } = await supabase.from('leads').delete().eq('id', leadId).eq('tenant_id', tenantId);
    if (error) throw error;

    return {
      success: true,
      message: 'Lead deleted successfully'
    };
  } catch (error: any) {
    return operationFailed('leads/management', error);
  }
}

async function bulkLeadsActions(tenantId: string, config: any, supabase: any, role: string) {
  try {
    const { leadIds, action, data } = config;

    if (!Array.isArray(leadIds)) {
      return { success: false, error: 'leadIds must be an array' };
    }
    if (leadIds.length > 200) {
      return { success: false, error: 'Too many leads selected' };
    }
    if ((action === 'delete' || action === 'assign_to_user') && !['owner', 'admin', 'tenant_admin', 'super_admin'].includes(role)) {
      return { success: false, error: 'Insufficient workspace permissions' };
    }

    const results = [];
    const uniqueIds: string[] = Array.from(new Set(leadIds.map((value: unknown) => String(value).trim()).filter(Boolean)));

    for (const leadId of uniqueIds) {
      try {
        let result;

        switch (action) {
          case 'update_status':
            result = await updateLead(tenantId, { leadId, updates: { status: data.status } }, supabase);
            break;
          case 'update_priority':
            result = await updateLead(tenantId, { leadId, updates: { priority: data.priority } }, supabase);
            break;
          case 'assign_to_user':
            result = await updateLead(tenantId, { leadId, updates: { assigned_to: data.userId } }, supabase);
            break;
          case 'add_tag': {
            const tag: string = typeof (data as any)?.tag === 'string' ? String((data as any).tag).trim() : '';
            if (!tag) {
              result = { success: false, error: 'Tag is required' };
              break;
            }
            result = await addLeadTag(tenantId, leadId, tag, supabase);
            break;
          }
          case 'delete':
            result = await deleteLead(tenantId, { leadId }, supabase);
            break;
          default:
            result = { success: false, error: 'Unsupported bulk action' };
        }

        results.push({ leadId, result });
      } catch (error: unknown) {
        console.error('[leads/management.bulk]', leadId, error);
        results.push({ leadId, success: false, error: OPERATION_FAILED_MESSAGE });
      }
    }

    return {
      success: true,
      data: results,
      message: `Bulk action completed for ${uniqueIds.length} leads`
    };
  } catch (error: any) {
    return operationFailed('leads/management', error);
  }
}

// Helper functions
function getBusinessTypeTags(businessType: string): string[] {
  const tagMap: { [key: string]: string[] } = {
    'restaurant': ['amenity', 'amenity=restaurant', 'amenity=cafe', 'amenity=fast_food'],
    'retail': ['shop', 'shop=supermarket', 'shop=convenience', 'shop=mall'],
    'service': ['office', 'office=company', 'office=consulting', 'office=lawyer'],
    'healthcare': ['amenity', 'amenity=hospital', 'amenity=clinic', 'amenity=pharmacy'],
    'education': ['amenity', 'amenity=school', 'amenity=university', 'amenity=college'],
    'automotive': ['shop', 'shop=car_repair', 'shop=car_parts', 'amenity=fuel'],
    'beauty': ['shop', 'shop=hairdresser', 'shop=beauty', 'shop=nail_salon'],
    'fitness': ['amenity', 'amenity=gym', 'leisure', 'leisure=fitness_centre'],
    'hotel': ['tourism', 'tourism=hotel', 'tourism=motel', 'tourism=guest_house']
  };

  return tagMap[businessType.toLowerCase()] || ['shop', 'office', 'amenity'];
}

function processOSMElement(element: any, businessType: string, searchLat: number, searchLon: number): any {
  const tags = element.tags || {};
  const name = tags.name || tags['brand'] || tags['operator'] || 'Unknown Business';
  
  // Calculate distance
  let distance = 0;
  if (element.lat && element.lon) {
    distance = calculateDistance(searchLat, searchLon, element.lat, element.lon);
  }

  return {
    id: `osm_${element.type}_${element.id}`,
    name: name,
    source: 'openstreetmap',
    type: element.type,
    location: tags['addr:city'] || tags['addr:postcode'] || null,
    address: tags['addr:housenumber'] && tags['addr:street'] 
      ? `${tags['addr:housenumber']} ${tags['addr:street']}, ${tags['addr:city'] || ''}` 
      : null,
    phone: tags.phone || tags['contact:phone'] || null,
    website: tags.website || tags['contact:website'] || null,
    email: tags.email || tags['contact:email'] || null,
    business_type: businessType,
    distance: distance,
    coordinates: element.lat && element.lon ? { lat: element.lat, lon: element.lon } : null,
    metadata: {
      osmId: element.id,
      osmType: element.type,
      tags: tags,
      openingHours: tags['opening_hours'] || null
    },
    foundAt: new Date().toISOString()
  };
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function passesFilters(lead: any, filters: any): boolean {
  if (!filters) return true;

  // Distance filter
  if (filters.maxDistance && lead.distance > filters.maxDistance) {
    return false;
  }

  // Minimum followers filter
  if (filters.minFollowers && lead.followers < filters.minFollowers) {
    return false;
  }

  // Verified filter
  if (filters.verifiedOnly && !lead.verified) {
    return false;
  }

  // Has website filter
  if (filters.hasWebsite && !lead.website) {
    return false;
  }

  // Has phone filter
  if (filters.hasPhone && !lead.phone) {
    return false;
  }

  return true;
}

function removeDuplicateLeads(leads: any[]): any[] {
  const seen = new Set();
  return leads.filter(lead => {
    const key = `${lead.name}_${lead.phone}_${lead.email}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function calculateLeadPriority(lead: any): string {
  let score = 0;

  // Has contact info
  if (lead.phone) score += 2;
  if (lead.email) score += 2;
  if (lead.website) score += 1;

  // Social media presence
  if (lead.followers > 1000) score += 1;
  if (lead.verified) score += 2;

  // Location proximity
  if (lead.distance < 5) score += 2;
  else if (lead.distance < 10) score += 1;

  if (score >= 6) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

function estimateLeadValue(lead: any): number {
  let baseValue = 1000;

  // Adjust based on business size
  if (lead.followers > 10000) baseValue *= 2;
  if (lead.verified) baseValue *= 1.5;

  // Adjust based on contact info completeness
  if (lead.phone && lead.email && lead.website) baseValue *= 1.3;

  return Math.round(baseValue);
}

async function saveLeadSearchResults(tenantId: string, leads: any[], config: any, supabase: any) {
  try {
    const searchResults = leads.map(lead => ({
      tenant_id: tenantId,
      search_query: config.location,
      business_type: config.businessType,
      lead_external_id: lead.id,
      lead_name: lead.name,
      lead_source: lead.source,
      lead_data: lead,
      saved_to_database: false,
      created_at: new Date().toISOString()
    }));

    await supabase.from('lead_search_results').insert(searchResults);
  } catch (error) {
    console.error('Failed to save search results:', error);
  }
}

async function addLeadTag(tenantId: string, leadId: string, tag: string, supabase: any) {
  try {
    const { data: lead } = await supabase
      .from('leads')
      .select('tags')
      .eq('id', leadId)
      .eq('tenant_id', tenantId)
      .single();

    const tags = lead?.tags || [];
    if (!tags.includes(tag)) {
      tags.push(tag);
      
      await supabase
        .from('leads')
        .update({ tags: tags })
        .eq('id', leadId)
        .eq('tenant_id', tenantId);
    }

    return { success: true };
  } catch (error: any) {
    return operationFailed('leads/management', error);
  }
}
