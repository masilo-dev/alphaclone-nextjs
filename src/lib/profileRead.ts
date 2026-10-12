import { supabase } from './supabase';

type ProfileState = { onboarding_completed: boolean | null; walkthrough_completed: boolean | null; created_at: string; dashboard_preferences: unknown };
const pending = new Map<string, Promise<ProfileState>>();
const cache = new Map<string, { expires: number; value: ProfileState }>();
let epoch = 0;
export function invalidateProfileReads(userId?: string): void {
  epoch++;
  if (userId) { cache.delete(userId); pending.delete(userId); }
  else { cache.clear(); pending.clear(); }
}
export async function readUserProfileState(userId: string, fresh = false): Promise<ProfileState> {
  if (!fresh) {
    const cached = cache.get(userId);
    if (cached && cached.expires > Date.now()) return cached.value;
    const existing = pending.get(userId);
    if (existing) return existing;
  }
  const readEpoch = epoch;
  const request = (async () => {
    const { data, error } = await supabase.from('profiles')
      .select('onboarding_completed, walkthrough_completed, created_at, dashboard_preferences').eq('id', userId).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Profile is unavailable. Saved preferences were not changed.');
    if (epoch === readEpoch) cache.set(userId, { value: data, expires: Date.now() + 15_000 });
    return data as ProfileState;
  })();
  pending.set(userId, request);
  try { return await request; }
  finally { if (pending.get(userId) === request) pending.delete(userId); }
}
