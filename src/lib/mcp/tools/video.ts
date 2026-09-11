import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

// 1. get_meetings
registerTool('video', {
  name: 'get_meetings',
  description: 'Retrieve video calls / meetings scheduled within the tenant workspace.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    status: z.enum(['scheduled', 'active', 'ended', 'cancelled']).optional(),
    limit: z.number().int().positive().optional().default(50),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      status: { type: 'string', enum: ['scheduled', 'active', 'ended', 'cancelled'] },
      limit: { type: 'number', default: 50 },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from('video_calls')
      .select('*')
      .eq('tenant_id', args.tenant_id);

    if (args.status) {
      query = query.eq('status', args.status);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(args.limit);

    if (error) throw error;
    return data;
  },
});

// 2. create_meeting
registerTool('video', {
  name: 'create_meeting',
  description: 'Schedule a new video call / meeting room.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    host_id: z.string().uuid(),
    title: z.string(),
    max_participants: z.number().int().positive().optional().default(10),
    recording_enabled: z.boolean().optional().default(false),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      host_id: { type: 'string', format: 'uuid' },
      title: { type: 'string' },
      max_participants: { type: 'number', default: 10 },
      recording_enabled: { type: 'boolean', default: false },
    },
    required: ['tenant_id', 'host_id', 'title'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const roomId = `room-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const dailyRoomUrl = `https://alphaclone.daily.co/${roomId}`;

    const { data, error } = await supabase
      .from('video_calls')
      .insert({
        tenant_id: args.tenant_id,
        host_id: args.host_id,
        title: args.title,
        room_id: roomId,
        daily_room_url: dailyRoomUrl,
        daily_room_name: roomId,
        max_participants: args.max_participants,
        recording_enabled: args.recording_enabled,
        status: 'scheduled',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
});

// 3. cancel_meeting
registerTool('video', {
  name: 'cancel_meeting',
  description: 'Cancel an existing video call / meeting.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    meeting_id: z.string().uuid(),
    cancelled_by: z.string().uuid(),
    reason: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      meeting_id: { type: 'string', format: 'uuid' },
      cancelled_by: { type: 'string', format: 'uuid' },
      reason: { type: 'string', description: 'Reason for cancellation' },
    },
    required: ['tenant_id', 'meeting_id', 'cancelled_by'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('video_calls')
      .update({
        status: 'cancelled',
        cancelled_by: args.cancelled_by,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: args.reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', args.meeting_id)
      .eq('tenant_id', args.tenant_id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
});
