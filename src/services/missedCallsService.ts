import { supabase } from '../lib/supabase';

/**
 * Missed Calls Service
 * Handles missed call tracking and notifications (MS Teams-like)
 */

export interface MissedCall {
    id: string;
    caller_id: string;
    caller_name?: string;
    caller_avatar?: string;
    callee_id: string;
    call_type: 'video' | 'audio';
    attempted_at: string;
    seen_at?: string;
    call_id?: string;
}

export interface CallAttempt {
    id: string;
    caller_id: string;
    callee_id: string;
    call_type: 'video' | 'audio';
    status: 'ringing' | 'answered' | 'declined' | 'missed' | 'cancelled' | 'failed';
    started_at: string;
    answered_at?: string;
    ended_at?: string;
    duration_seconds?: number;
    call_id?: string;
}

class MissedCallsService {
    /**
     * Create a missed call record
     */
    async createMissedCall(
        callerId: string,
        calleeId: string,
        callType: 'video' | 'audio' = 'video',
        callId?: string
    ): Promise<{ missedCallId: string | null; error: string | null }> {
        try {
            const { data, error } = await supabase.rpc('create_missed_call', {
                p_caller_id: callerId,
                p_callee_id: calleeId,
                p_call_type: callType,
                p_call_id: callId || null
            });

            if (error) {
                return { missedCallId: null, error: error.message };
            }

            return { missedCallId: data, error: null };
        } catch (err) {
            return { missedCallId: null, error: err instanceof Error ? err.message : 'Failed to create missed call' };
        }
    }

    /**
     * Mark missed call as seen
     */
    async markMissedCallSeen(
        missedCallId: string,
        userId: string
    ): Promise<{ error: string | null }> {
        try {
            const { error } = await supabase.rpc('mark_missed_call_seen', {
                p_missed_call_id: missedCallId,
                p_user_id: userId
            });

            if (error) {
                return { error: error.message };
            }

            return { error: null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Failed to mark missed call as seen' };
        }
    }

    /**
     * Get unseen missed calls count
     */
    async getUnseenMissedCallsCount(userId: string): Promise<{ count: number; error: string | null }> {
        try {
            const { data, error } = await supabase.rpc('get_unseen_missed_calls_count', {
                p_user_id: userId
            });

            if (error) {
                return { count: 0, error: error.message };
            }

            return { count: data || 0, error: null };
        } catch (err) {
            return { count: 0, error: err instanceof Error ? err.message : 'Failed to get missed calls count' };
        }
    }

    /**
     * Get missed calls for user
     */
    async getMissedCallsForUser(
        userId: string,
        limit: number = 50
    ): Promise<{ missedCalls: MissedCall[]; error: string | null }> {
        try {
            const { data, error } = await supabase.rpc('get_missed_calls_for_user', {
                p_user_id: userId,
                p_limit: limit
            });

            if (error) {
                return { missedCalls: [], error: error.message };
            }

            return { missedCalls: data || [], error: null };
        } catch (err) {
            return { missedCalls: [], error: err instanceof Error ? err.message : 'Failed to get missed calls' };
        }
    }

    /**
     * Create a call attempt record
     */
    async createCallAttempt(
        callerId: string,
        calleeId: string,
        callType: 'video' | 'audio' = 'video',
        callId?: string
    ): Promise<{ callAttemptId: string | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('call_attempts')
                .insert({
                    caller_id: callerId,
                    callee_id: calleeId,
                    call_type: callType,
                    status: 'ringing',
                    call_id: callId,
                    started_at: new Date().toISOString()
                })
                .select('id')
                .single();

            if (error) {
                return { callAttemptId: null, error: error.message };
            }

            return { callAttemptId: data.id, error: null };
        } catch (err) {
            return { callAttemptId: null, error: err instanceof Error ? err.message : 'Failed to create call attempt' };
        }
    }

    /**
     * Update call attempt status
     */
    async updateCallAttempt(
        callAttemptId: string,
        status: CallAttempt['status'],
        additionalData?: {
            answeredAt?: string;
            endedAt?: string;
            durationSeconds?: number;
        }
    ): Promise<{ error: string | null }> {
        try {
            const updateData: any = { status };

            if (additionalData?.answeredAt) {
                updateData.answered_at = additionalData.answeredAt;
            }
            if (additionalData?.endedAt) {
                updateData.ended_at = additionalData.endedAt;
            }
            if (additionalData?.durationSeconds !== undefined) {
                updateData.duration_seconds = additionalData.durationSeconds;
            }

            const { error } = await supabase
                .from('call_attempts')
                .update(updateData)
                .eq('id', callAttemptId);

            if (error) {
                return { error: error.message };
            }

            return { error: null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Failed to update call attempt' };
        }
    }

    /**
     * Get call history for user
     */
    async getCallHistory(
        userId: string,
        limit: number = 50
    ): Promise<{ callAttempts: CallAttempt[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('call_attempts')
                .select('*')
                .or(`caller_id.eq.${userId},callee_id.eq.${userId}`)
                .order('started_at', { ascending: false })
                .limit(limit);

            if (error) {
                return { callAttempts: [], error: error.message };
            }

            return { callAttempts: data || [], error: null };
        } catch (err) {
            return { callAttempts: [], error: err instanceof Error ? err.message : 'Failed to get call history' };
        }
    }

    /**
     * Subscribe to new missed calls
     */
    subscribeToMissedCalls(
        userId: string,
        onNewMissedCall: (missedCall: MissedCall) => void
    ): () => void {
        const subscription = supabase
            .channel(`missed-calls-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'missed_calls',
                    filter: `callee_id=eq.${userId}`,
                },
                (payload) => {
                    if (payload.new) {
                        onNewMissedCall(payload.new as MissedCall);
                    }
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }

    /**
     * Mark all missed calls as seen
     */
    async markAllMissedCallsSeen(userId: string): Promise<{ error: string | null }> {
        try {
            const { error } = await supabase
                .from('missed_calls')
                .update({ seen_at: new Date().toISOString() })
                .eq('callee_id', userId)
                .is('seen_at', null);

            if (error) {
                return { error: error.message };
            }

            return { error: null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Failed to mark all missed calls as seen' };
        }
    }

    /**
     * Delete old missed calls (cleanup)
     */
    async cleanupOldMissedCalls(daysOld: number = 30): Promise<{ error: string | null }> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const { error } = await supabase
                .from('missed_calls')
                .delete()
                .lt('attempted_at', cutoffDate.toISOString());

            if (error) {
                return { error: error.message };
            }

            return { error: null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Failed to cleanup old missed calls' };
        }
    }
}

export const missedCallsService = new MissedCallsService();
