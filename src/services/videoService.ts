import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';

export const videoService = {
    // Create a new call room
    async createCall(hostId: string, title: string = 'Video Meeting') {
        const { data, error } = await supabase
            .from('video_calls')
            .insert({
                host_id: hostId,
                title: title, // Required field
                room_id: Math.random().toString(36).substring(7), // Simple room ID generation
                status: 'active',
                started_at: new Date().toISOString(),
                tenant_id: tenantService.getCurrentTenantId()
            })
            .select()
            .single();

        if (data) {
            // Add host as participant (approved)
            await supabase.from('call_participants').insert({
                call_id: data.id,
                user_id: hostId,
                is_host: true,
                status: 'approved'
            });
        }

        return { call: data, error };
    },

    // Join a call
    async joinCall(callId: string, userId: string, isHost: boolean = false) {
        // Check if user is already in call
        const { data: existing } = await supabase
            .from('call_participants')
            .select('*')
            .eq('call_id', callId)
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .eq('user_id', userId)
            .single();

        if (existing) return { participant: existing, error: null };

        const status = isHost ? 'approved' : 'waiting';

        const { data, error } = await supabase
            .from('call_participants')
            .insert({
                call_id: callId,
                user_id: userId,
                is_host: isHost,
                status: status,
                tenant_id: tenantService.getCurrentTenantId()
            })
            .select()
            .single();

        return { participant: data, error };
    },

    // Get participants for a call (real-time helper)
    async getParticipants(callId: string) {
        return await supabase
            .from('call_participants')
            .select(`
        *,
        profiles:user_id (name, avatar_url, role)
      `)
            .eq('call_id', callId)
            .eq('tenant_id', tenantService.getCurrentTenantId());
    },

    // Admin/Host admits a participant
    async admitParticipant(participantId: string) {
        return await supabase
            .from('call_participants')
            .update({ status: 'approved' })
            .eq('id', participantId)
            .eq('tenant_id', tenantService.getCurrentTenantId());
    },

    // Admin/Host rejects a participant
    async rejectParticipant(participantId: string) {
        return await supabase
            .from('call_participants')
            .update({ status: 'rejected' })
            .eq('id', participantId)
            .eq('tenant_id', tenantService.getCurrentTenantId());
    },

    // End call
    async endCall(callId: string) {
        return await supabase
            .from('video_calls')
            .update({ status: 'ended', ended_at: new Date().toISOString() })
            .eq('id', callId)
            .eq('tenant_id', tenantService.getCurrentTenantId());
    }
};
