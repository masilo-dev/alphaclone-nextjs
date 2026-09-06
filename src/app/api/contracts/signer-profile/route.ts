import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthenticatedUser, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  MAX_SIGNATURE_DATA_URL_LENGTH,
  SIGNER_PROFILE_CUSTOM_FIELD,
  mergeSignerProfile,
  normalizeSignerProfile,
  type ContractSignerProfile,
} from '@/lib/contracts/signerProfile';

/**
 * The signed-in owner's reusable contract signer profile (provider details,
 * default governing law and the adopted signature). Lives in
 * `profiles.custom_fields.contract_signer_profile`; no tenant scoping because a
 * signature belongs to the person, not the workspace.
 */

const text = z.string().trim().max(300);

const PatchSchema = z
  .object({
    providerName: text.optional(),
    providerAddress: text.optional(),
    providerEmail: text.optional(),
    providerPhone: text.optional(),
    providerRegistration: text.optional(),
    jurisdiction: text.optional(),
    governingLaw: text.optional(),
    signature: z
      .object({
        dataUrl: z.string().max(MAX_SIGNATURE_DATA_URL_LENGTH),
        fullName: z.string().trim().min(1).max(200),
      })
      .nullable()
      .optional(),
  })
  .strict();

async function loadProfile(userId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from('profiles').select('custom_fields').eq('id', userId).maybeSingle();
  if (error) throw error;
  const customFields = (data?.custom_fields && typeof data.custom_fields === 'object' ? data.custom_fields : {}) as Record<string, unknown>;
  return { admin, customFields, profile: normalizeSignerProfile(customFields[SIGNER_PROFILE_CUSTOM_FIELD]) };
}

async function persistProfile(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  customFields: Record<string, unknown>,
  profile: ContractSignerProfile,
) {
  const { error } = await admin
    .from('profiles')
    .update({
      custom_fields: { ...customFields, [SIGNER_PROFILE_CUSTOM_FIELD]: profile },
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (error) throw error;
}

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(req);
    const { profile } = await loadProfile(user.id);
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    return routeErrorResponse(error, 'Signer profile could not be loaded', req);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(req);
    const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid signer profile', fields: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const { admin, customFields, profile } = await loadProfile(user.id);
    let next: ContractSignerProfile;
    try {
      next = mergeSignerProfile(profile, parsed.data);
    } catch (mergeError) {
      return NextResponse.json({ error: (mergeError as Error).message }, { status: 400 });
    }
    await persistProfile(admin, user.id, customFields, next);
    return NextResponse.json({ success: true, profile: next });
  } catch (error) {
    return routeErrorResponse(error, 'Signer profile could not be saved', req);
  }
}

/** Remove the saved signature only; provider details stay. */
export async function DELETE(req: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(req);
    const { admin, customFields, profile } = await loadProfile(user.id);
    const next = mergeSignerProfile(profile, { signature: null });
    await persistProfile(admin, user.id, customFields, next);
    return NextResponse.json({ success: true, profile: next });
  } catch (error) {
    return routeErrorResponse(error, 'Saved signature could not be removed', req);
  }
}
