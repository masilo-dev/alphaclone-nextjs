import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

// 1. send_tenant_message
registerTool('messaging', {
  name: 'send_tenant_message',
  description: 'Send a message to a recipient user within the tenant workspace.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    sender_id: z.string().uuid(),
    sender_name: z.string(),
    sender_role: z.enum(['user', 'model', 'system']).optional().default('user'),
    recipient_id: z.string().uuid(),
    body: z.string(),
    priority: z.enum(['normal', 'high', 'urgent']).optional().default('normal'),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      sender_id: { type: 'string', format: 'uuid' },
      sender_name: { type: 'string' },
      sender_role: { type: 'string', enum: ['user', 'model', 'system'], default: 'user' },
      recipient_id: { type: 'string', format: 'uuid' },
      body: { type: 'string', description: 'Message body content' },
      priority: { type: 'string', enum: ['normal', 'high', 'urgent'], default: 'normal' },
    },
    required: ['tenant_id', 'sender_id', 'sender_name', 'recipient_id', 'body'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('messages')
      .insert({
        tenant_id: args.tenant_id,
        sender_id: args.sender_id,
        sender_name: args.sender_name,
        sender_role: args.sender_role,
        recipient_id: args.recipient_id,
        text: args.body,
        priority: args.priority,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
});

// 2. get_tenant_messages
registerTool('messaging', {
  name: 'get_tenant_messages',
  description: 'Retrieve direct messages within the tenant workspace.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    limit: z.number().int().positive().optional().default(50),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      limit: { type: 'number', default: 50 },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('tenant_id', args.tenant_id)
      .order('created_at', { ascending: false })
      .limit(args.limit);

    if (error) throw error;
    return data;
  },
});

// 3. mark_message_read
registerTool('messaging', {
  name: 'mark_message_read',
  description: 'Mark a message as read.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    message_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      message_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'message_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('messages')
      .update({
        read_at: new Date().toISOString(),
      })
      .eq('id', args.message_id)
      .eq('tenant_id', args.tenant_id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
});

// 4. create_in_app_notification
registerTool('messaging', {
  name: 'create_in_app_notification',
  description: 'Create an in-app notification for a user.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    user_id: z.string().uuid(),
    title: z.string(),
    message: z.string(),
    type: z.enum(['contact', 'project', 'message', 'system']).optional().default('system'),
    link: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      user_id: { type: 'string', format: 'uuid' },
      title: { type: 'string' },
      message: { type: 'string' },
      type: { type: 'string', enum: ['contact', 'project', 'message', 'system'], default: 'system' },
      link: { type: 'string', description: 'Action link when clicked' },
    },
    required: ['tenant_id', 'user_id', 'title', 'message'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        tenant_id: args.tenant_id,
        user_id: args.user_id,
        title: args.title,
        message: args.message,
        type: args.type,
        link: args.link || null,
        read: false,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
});
