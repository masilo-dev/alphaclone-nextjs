import { supabase } from '../lib/supabase';


export interface Meeting {
    id: string;
    title: string;
    host_id: string;
    attendee_id?: string;
    scheduled_at: string;
    priority: 'low' | 'medium' | 'high';
    status: 'scheduled' | 'completed' | 'cancelled';
    attendee?: { name: string; email: string };
    host?: { name: string; email: string };
}

export const meetingService = {
    async getMeetings(userId: string, isAdmin: boolean) {
        let query = supabase
            .from('meetings')
            .select(`
        *,
        attendee:attendee_id(name, email),
        host:host_id(name, email)
      `)
            .order('scheduled_at', { ascending: true });

        if (!isAdmin) {
            query = query.or(`host_id.eq.${userId},attendee_id.eq.${userId}`);
        }

        const { data, error } = await query;
        return { meetings: data as Meeting[] | null, error };
    },

    async createMeeting(meeting: Omit<Meeting, 'id' | 'created_at' | 'attendee' | 'host'>) {
        const { data, error } = await supabase
            .from('meetings')
            .insert(meeting)
            .select()
            .single();
        return { meeting: data, error };
    },

    async updateStatus(id: string, status: 'completed' | 'cancelled') {
        const { error } = await supabase
            .from('meetings')
            .update({ status })
            .eq('id', id);
        return { error };
    }
};
