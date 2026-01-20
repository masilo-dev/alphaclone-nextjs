import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { tenantService } from '../services/tenancy/TenantService';

interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  recipient_id?: string;
  text: string;
  is_thinking: boolean;
  created_at: string;
}

/**
 * Real-time message hook - Auto-updates without refresh
 * Works for both admin and clients
 */
export function useRealTimeMessages(userId: string, role: 'admin' | 'client') {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let channel: any;

    const setupRealTime = async () => {
      try {
        // Get tenant context
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) {
          throw new Error('No active tenant');
        }

        // Initial load of messages
        const { data, error: fetchError } = await supabase
          .from('messages')
          .select('*')
          .eq('tenant_id', tenantId)
          .or(
            role === 'admin'
              ? `sender_id.eq.${userId},recipient_id.eq.${userId},recipient_id.is.null`
              : `sender_id.eq.${userId},recipient_id.eq.${userId}`
          )
          .order('created_at', { ascending: true });

        if (fetchError) throw fetchError;

        if (mounted) {
          setMessages(data || []);
          setIsLoading(false);
        }

        // Set up real-time subscription
        channel = supabase
          .channel(`messages_${userId}_${tenantId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `tenant_id=eq.${tenantId}`
            },
            (payload: any) => {
              const newMessage = payload.new as Message;

              // Only add message if user should see it
              const shouldAdd =
                role === 'admin' ||
                newMessage.sender_id === userId ||
                newMessage.recipient_id === userId;

              if (shouldAdd && mounted) {
                setMessages((prev) => {
                  // Avoid duplicates
                  if (prev.some(m => m.id === newMessage.id)) {
                    return prev;
                  }
                  return [...prev, newMessage];
                });
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'messages',
              filter: `tenant_id=eq.${tenantId}`
            },
            (payload: any) => {
              const updatedMessage = payload.new as Message;

              if (mounted) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === updatedMessage.id ? updatedMessage : msg
                  )
                );
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'DELETE',
              schema: 'public',
              table: 'messages',
              filter: `tenant_id=eq.${tenantId}`
            },
            (payload: any) => {
              const deletedId = payload.old.id;

              if (mounted) {
                setMessages((prev) => prev.filter((msg) => msg.id !== deletedId));
              }
            }
          )
          .subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              console.log('✅ Real-time messages connected');
            } else if (status === 'CLOSED') {
              console.log('🔌 Real-time messages disconnected');
            } else if (status === 'CHANNEL_ERROR') {
              console.error('❌ Real-time messages error');
              setError('Real-time connection failed');
            }
          });
      } catch (err) {
        console.error('Failed to setup real-time:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setIsLoading(false);
        }
      }
    };

    setupRealTime();

    // Cleanup
    return () => {
      mounted = false;
      if (channel) {
        supabase.removeChannel(channel);
        console.log('🔌 Real-time messages cleaned up');
      }
    };
  }, [userId, role]);

  return { messages, isLoading, error };
}

/**
 * Real-time project updates - Auto-refresh project data
 */
export function useRealTimeProjects(userId: string, role: 'admin' | 'client') {
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let channel: any;

    const setupRealTime = async () => {
      try {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) return;

        // Initial load
        let query = supabase
          .from('projects')
          .select('*')
          .eq('tenant_id', tenantId);

        if (role !== 'admin') {
          query = query.eq('owner_id', userId);
        }

        const { data } = await query.order('created_at', { ascending: false });

        if (mounted) {
          setProjects(data || []);
          setIsLoading(false);
        }

        // Real-time subscription
        channel = supabase
          .channel(`projects_${userId}_${tenantId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'projects',
              filter: `tenant_id=eq.${tenantId}`
            },
            (payload: any) => {
              if (!mounted) return;

              if (payload.eventType === 'INSERT') {
                setProjects((prev) => [payload.new, ...prev]);
              } else if (payload.eventType === 'UPDATE') {
                setProjects((prev) =>
                  prev.map((p) => (p.id === payload.new.id ? payload.new : p))
                );
              } else if (payload.eventType === 'DELETE') {
                setProjects((prev) => prev.filter((p) => p.id !== payload.old.id));
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.error('Failed to setup real-time projects:', err);
        if (mounted) setIsLoading(false);
      }
    };

    setupRealTime();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, role]);

  return { projects, isLoading };
}

/**
 * Real-time tasks - Auto-refresh task list
 */
export function useRealTimeTasks(userId: string, role: 'admin' | 'client') {
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let channel: any;

    const setupRealTime = async () => {
      try {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) return;

        // Initial load
        let query = supabase
          .from('tasks')
          .select('*')
          .eq('tenant_id', tenantId);

        if (role !== 'admin') {
          query = query.eq('assigned_to', userId);
        }

        const { data } = await query.order('created_at', { ascending: false });

        if (mounted) {
          setTasks(data || []);
          setIsLoading(false);
        }

        // Real-time subscription
        channel = supabase
          .channel(`tasks_${userId}_${tenantId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'tasks',
              filter: `tenant_id=eq.${tenantId}`
            },
            (payload: any) => {
              if (!mounted) return;

              if (payload.eventType === 'INSERT') {
                setTasks((prev) => [payload.new, ...prev]);
              } else if (payload.eventType === 'UPDATE') {
                setTasks((prev) =>
                  prev.map((t) => (t.id === payload.new.id ? payload.new : t))
                );
              } else if (payload.eventType === 'DELETE') {
                setTasks((prev) => prev.filter((t) => t.id !== payload.old.id));
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.error('Failed to setup real-time tasks:', err);
        if (mounted) setIsLoading(false);
      }
    };

    setupRealTime();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, role]);

  return { tasks, isLoading };
}

/**
 * Real-time notifications - Bell icon updates automatically
 */
export function useRealTimeNotifications(userId: string) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    let channel: any;

    const setupRealTime = async () => {
      try {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) return;

        // Initial load
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (mounted) {
          setNotifications(data || []);
          setUnreadCount(data?.filter((n: any) => !n.read).length || 0);
        }

        // Real-time subscription
        channel = supabase
          .channel(`notifications_${userId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${userId}`
            },
            (payload: any) => {
              if (!mounted) return;

              if (payload.eventType === 'INSERT') {
                setNotifications((prev) => [payload.new, ...prev]);
                setUnreadCount((prev) => prev + 1);
              } else if (payload.eventType === 'UPDATE') {
                setNotifications((prev) =>
                  prev.map((n) => (n.id === payload.new.id ? payload.new : n))
                );
                // Recalculate unread count
                setNotifications((current) => {
                  const newUnread = current.filter((n: any) => !n.read).length;
                  setUnreadCount(newUnread);
                  return current;
                });
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.error('Failed to setup real-time notifications:', err);
      }
    };

    setupRealTime();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId]);

  return { notifications, unreadCount };
}
