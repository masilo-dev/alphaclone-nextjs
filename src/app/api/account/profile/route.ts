import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthenticatedUser, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const schema = z.object({
  fullName: z.string().trim().min(1).max(200).optional(),
  company: z.string().trim().max(300).optional(),
  phone: z.string().trim().max(50).optional(),
  onboardingRole: z.string().trim().max(100).optional(),
  onboardingCompleted: z.boolean().optional(),
}).strict();

export async function PATCH(req: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(req);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid profile details', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data: existing, error: readError } = await admin.from('profiles').select('custom_fields').eq('id', user.id).maybeSingle();
    if (readError) throw readError;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.fullName !== undefined) updates.full_name = parsed.data.fullName;
    if (parsed.data.company !== undefined) updates.company = parsed.data.company;
    if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;
    if (parsed.data.onboardingRole !== undefined) updates.custom_fields = { ...(existing?.custom_fields || {}), onboarding_role: parsed.data.onboardingRole };
    if (parsed.data.onboardingCompleted !== undefined) {
      updates.onboarding_completed = parsed.data.onboardingCompleted;
      if (parsed.data.onboardingCompleted) updates.onboarding_completed_at = new Date().toISOString();
    }
    const { data, error } = await admin.from('profiles').update(updates).eq('id', user.id).select('id, full_name, company, phone, onboarding_completed, custom_fields').single();
    if (error) throw error;
    return NextResponse.json({ success: true, profile: data });
  } catch (error) { return routeErrorResponse(error, 'Profile could not be updated', req); }
}
