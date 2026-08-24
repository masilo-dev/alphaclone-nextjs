import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

// Helper to ensure gamification profile exists
async function ensureGamificationProfile(supabase: any, tenantId: string, userId: string) {
  const { data, error } = await supabase
    .from('gamification_profiles')
    .select('*')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  // Insert profile
  const { data: newProfile, error: insertError } = await supabase
    .from('gamification_profiles')
    .insert({
      user_id: userId,
      tenant_id: tenantId,
      xp: 0,
      streak: 1,
      badges: [],
    })
    .select()
    .single();

  if (insertError) throw insertError;
  return newProfile;
}

// 1. get_user_points
registerTool('gamification', {
  name: 'get_user_points',
  description: 'Retrieve the gamification profile, XP level, and streak details for a user.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(),
    user_id: z.string().uuid().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      user_id: { type: 'string', format: 'uuid' },
    },
    required: [],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const tenantId = args.tenant_id || ctx.tenantId;
    const userId = args.user_id || ctx.userId;
    const profile = await ensureGamificationProfile(supabase, tenantId, userId);
    return profile;
  },
});

// 2. award_points
registerTool('gamification', {
  name: 'award_points',
  description: 'Award XP points to a user for completing tasks, closing deals, etc.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    user_id: z.string().uuid(),
    points: z.number().int().positive(),
    reason: z.string(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      user_id: { type: 'string', format: 'uuid' },
      points: { type: 'number', description: 'XP points to award' },
      reason: { type: 'string', description: 'Reason for awarding the points' },
    },
    required: ['tenant_id', 'user_id', 'points', 'reason'],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const tenantId = args.tenant_id || ctx.tenantId;
    const userId = args.user_id || ctx.userId;

    // 1. Log the points award
    const { error: logError } = await supabase
      .from('gamification_logs')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        points: args.points,
        reason: args.reason,
      });

    if (logError) throw logError;

    // 2. Ensure profile exists and increment XP
    const currentProfile = await ensureGamificationProfile(supabase, tenantId, userId);
    const newXp = (currentProfile.xp || 0) + args.points;

    const { data: updatedProfile, error: updateError } = await supabase
      .from('gamification_profiles')
      .update({
        xp: newXp,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (updateError) throw updateError;
    return updatedProfile;
  },
});

// 3. get_gamification_leaderboard
registerTool('gamification', {
  name: 'get_gamification_leaderboard',
  description: 'Retrieve the gamification leaderboard (top active users by XP).',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('gamification_profiles')
      .select('user_id, xp, streak, badges')
      .eq('tenant_id', args.tenant_id)
      .order('xp', { ascending: false })
      .limit(10);

    if (error) throw error;

    // Join with profile names if possible
    const userIds = data.map((d: any) => d.user_id);
    if (userIds.length === 0) return [];

    const { data: profiles, error: profError } = await supabase
      .from('profiles')
      .select('id, name, avatar')
      .in('id', userIds);

    if (profError) throw profError;

    const profileMap = new Map<string, any>(profiles.map((p: any) => [p.id, p]));

    return data.map((item: any, idx: number) => {
      const p = profileMap.get(item.user_id);
      return {
        rank: idx + 1,
        user_id: item.user_id,
        name: p?.name || 'Anonymous User',
        avatar: p?.avatar || null,
        xp: item.xp,
        streak: item.streak,
        badges: item.badges,
      };
    });
  },
});
