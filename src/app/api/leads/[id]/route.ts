import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * GET /api/leads/[id]
 * Get a single lead by ID with proper error handling and tenant isolation
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    if (!id) {
      return NextResponse.json({ error: 'Lead ID required' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's tenant
    const { data: tenantUser, error: tenantError } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    if (tenantError || !tenantUser) {
      return NextResponse.json({ error: 'No tenant access' }, { status: 403 });
    }

    // Get lead with tenant isolation
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select(`
        *,
        lead_activities(*),
        deals(id, name, stage, value)
      `)
      .eq('id', id)
      .eq('tenant_id', tenantUser.tenant_id)
      .single();

    if (leadError) {
      console.error('[API] Lead fetch error:', leadError);
      return NextResponse.json(
        { error: leadError.code === 'PGRST116' ? 'Lead not found' : 'Failed to fetch lead' }, 
        { status: leadError.code === 'PGRST116' ? 404 : 500 }
      );
    }

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true,
      lead,
      related: {
        activities: lead.lead_activities || [],
        deals: lead.deals || []
      }
    });

  } catch (error: any) {
    console.error('[API] GET /api/leads/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message }, 
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/leads/[id]
 * Update a lead with validation
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    if (!id) {
      return NextResponse.json({ error: 'Lead ID required' }, { status: 400 });
    }

    const body = await req.json();
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's tenant
    const { data: tenantUser, error: tenantError } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    if (tenantError || !tenantUser) {
      return NextResponse.json({ error: 'No tenant access' }, { status: 403 });
    }

    // Build update payload
    const updateData: any = {};
    if (body.businessName !== undefined) updateData.business_name = body.businessName;
    if (body.industry !== undefined) updateData.industry = body.industry;
    if (body.location !== undefined) updateData.location = body.location;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.website !== undefined) updateData.website = body.website;
    if (body.stage !== undefined) updateData.stage = body.stage;
    if (body.value !== undefined) updateData.value = body.value;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.outreachStatus !== undefined) updateData.outreach_status = body.outreachStatus;

    // Check stage transition rules
    if (body.stage) {
      const { data: currentLead } = await supabase
        .from('leads')
        .select('stage')
        .eq('id', id)
        .eq('tenant_id', tenantUser.tenant_id)
        .single();

      if (currentLead) {
        const stageOrder = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
        const currentIdx = stageOrder.indexOf(currentLead.stage);
        const newIdx = stageOrder.indexOf(body.stage);

        if (newIdx < currentIdx && body.stage !== 'lost') {
          return NextResponse.json(
            { error: 'Cannot move lead back to previous stage' }, 
            { status: 400 }
          );
        }
      }
    }

    // Update lead
    const { data: lead, error: updateError } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantUser.tenant_id)
      .select()
      .single();

    if (updateError) {
      console.error('[API] Lead update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update lead' }, 
        { status: 500 }
      );
    }

    // Log activity
    await supabase.from('lead_activities').insert({
      lead_id: id,
      user_id: user.id,
      type: 'update',
      description: `Lead updated: ${Object.keys(updateData).join(', ')}`,
      metadata: { updates: Object.keys(updateData) }
    });

    return NextResponse.json({ 
      success: true,
      lead,
      message: 'Lead updated successfully'
    });

  } catch (error: any) {
    console.error('[API] PATCH /api/leads/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message }, 
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/leads/[id]
 * Delete a lead
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    if (!id) {
      return NextResponse.json({ error: 'Lead ID required' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's tenant
    const { data: tenantUser, error: tenantError } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    if (tenantError || !tenantUser) {
      return NextResponse.json({ error: 'No tenant access' }, { status: 403 });
    }

    // Delete lead (tenant isolated)
    const { error: deleteError } = await supabase
      .from('leads')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantUser.tenant_id);

    if (deleteError) {
      console.error('[API] Lead delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete lead' }, 
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'Lead deleted successfully'
    });

  } catch (error: any) {
    console.error('[API] DELETE /api/leads/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message }, 
      { status: 500 }
    );
  }
}
