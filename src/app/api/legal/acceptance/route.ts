import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow } from '@/lib/apiAuth';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const acceptanceSchema = z.object({
  documentType: z.enum([
    'terms_of_service',
    'privacy_policy',
    'cookie_policy',
    'dpa',
    'acceptable_use',
    'ai_terms',
  ]),
  versionNumber: z.string().min(1).max(30),
  acceptanceContext: z.enum(['signup', 'login', 'policy_update', 'checkout', 'settings']).default('signup'),
});

/**
 * POST /api/legal/acceptance
 * Records a user's explicit legal agreement acceptance (in user_consents & compliance logs)
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    let userId: string | null = null;
    if (token) {
      const { data: userData } = await supabase.auth.getUser(token);
      userId = userData.user?.id || null;
    }

    const rawBody = await request.json().catch(() => null);
    const parsed = acceptanceSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const { documentType, versionNumber, acceptanceContext } = parsed.data;
    const admin = createAdminSupabaseClientOrThrow();

    if (userId) {
      // Record in user_consents table
      await admin.from('user_consents').insert({
        user_id: userId,
        consent_type: documentType,
        granted: true,
        consent_version: versionNumber,
        user_agent: request.headers.get('user-agent')?.slice(0, 255) || null,
        granted_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      documentType,
      versionNumber,
      acceptanceContext,
      recordedForUser: Boolean(userId),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Unable to record acceptance', details: message }, { status: 500 });
  }
}

/**
 * GET /api/legal/acceptance
 * Returns the current published policy versions and user acceptance status
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    let userId: string | null = null;
    if (token) {
      const { data: userData } = await supabase.auth.getUser(token);
      userId = userData.user?.id || null;
    }

    const admin = createAdminSupabaseClientOrThrow();

    // Query published versions
    const [ppRes, tosRes] = await Promise.all([
      admin.from('privacy_policy_versions').select('version, effective_date').eq('is_current', true).maybeSingle(),
      admin.from('terms_of_service_versions').select('version, effective_date').eq('is_current', true).maybeSingle(),
    ]);

    const currentPolicies = {
      privacy_policy: {
        version: ppRes.data?.version || '2026-10',
        effectiveDate: ppRes.data?.effective_date || '2026-10-01',
      },
      terms_of_service: {
        version: tosRes.data?.version || '2026-10',
        effectiveDate: tosRes.data?.effective_date || '2026-10-01',
      },
      cookie_policy: {
        version: '2026-10',
        effectiveDate: '2026-10-01',
      },
    };

    let userAcceptances: Record<string, { version: string; acceptedAt: string }> = {};

    if (userId) {
      const { data: consents } = await admin
        .from('user_consents')
        .select('consent_type, consent_version, granted_at')
        .eq('user_id', userId)
        .order('granted_at', { ascending: false });

      if (consents) {
        for (const c of consents) {
          if (!userAcceptances[c.consent_type]) {
            userAcceptances[c.consent_type] = {
              version: c.consent_version,
              acceptedAt: c.granted_at,
            };
          }
        }
      }
    }

    return NextResponse.json({
      currentPolicies,
      userAcceptances,
      authenticated: Boolean(userId),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Unable to query acceptances', details: message }, { status: 500 });
  }
}
