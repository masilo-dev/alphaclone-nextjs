'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Heading,
  Icon,
  Skeleton,
  Text,
  VStack,
  useColorModeValue,
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useTenant } from '@/hooks/useTenant';
import { RealtimeService } from '@/lib/realtime-service';
import { formatDistanceToNow } from 'date-fns';
import {
  Activity,
  FileText,
  MessageSquare,
  DollarSign,
  User,
  Clock,
} from 'lucide-react';

interface ActivityLog {
  id: string;
  entity_type: string;
  action: string;
  created_at: string;
  tenant_id: string;
}

interface ActivityFeedProps {
  userId: string;
  limit?: number;
}

const ENTITY_ICONS: Record<string, React.ElementType> = {
  project: FileText,
  message: MessageSquare,
  payment: DollarSign,
  user: User,
};

const ENTITY_COLORS: Record<string, string> = {
  project: 'blue',
  message: 'purple',
  payment: 'green',
  user: 'yellow',
};

/**
 * Activity feed component showing recent audit log entries with realtime updates.
 * Uses Chakra UI for styling and Framer Motion for animations.
 */
export function ActivityFeed({ userId, limit = 20 }: ActivityFeedProps) {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(true);

  const bgCard = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'whiteAlpha.900');

  useEffect(() => {
    if (!tenantId) return;

    async function fetchActivities() {
      try {
        const supabase = createClientComponentClient();
        const { data } = await supabase
          .from('audit_logs')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(limit);

        setActivities(data || []);
      } catch (err) {
        console.error('Failed to fetch activities:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchActivities();

    // Realtime subscription
    const realtime = RealtimeService.getInstance();
    realtime.init();

    const channel = realtime.subscribe(
      'activity-feed',
      { table: 'audit_logs', filter: `tenant_id=eq.${tenantId}` },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          setActivities((prev) => [payload.new as ActivityLog, ...prev.slice(0, limit - 1)]);
        }
      }
    );

    channel.on('system', { event: 'error' }, () => {
      setIsConnected(false);
    });

    return () => {
      realtime.unsubscribe('activity-feed');
    };
  }, [tenantId, limit]);

  if (tenantLoading || isLoading) {
    return (
      <Card bg={bgCard} borderColor={borderColor} borderWidth="1px">
        <CardBody>
          <VStack spacing={3}>
            {[...Array(5)].map((_, i) => (
              <Flex key={i} gap={3} w="100%">
                <Skeleton boxSize="32px" borderRadius="lg" />
                <Box flex={1}>
                  <Skeleton height="16px" mb={2} w="75%" />
                  <Skeleton height="12px" w="50%" />
                </Box>
              </Flex>
            ))}
          </VStack>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card bg={bgCard} borderColor={borderColor} borderWidth="1px">
      <CardHeader>
        <Flex justify="space-between" align="center">
          <Heading size="md" color={textColor}>
            Recent Activity
          </Heading>
          {!isConnected && (
            <Text fontSize="xs" color="red.500">
              Disconnected
            </Text>
          )}
        </Flex>
      </CardHeader>
      <CardBody>
        {activities.length === 0 ? (
          <Box textAlign="center" py={8} color="gray.500">
            <Activity size={48} style={{ margin: '0 auto', marginBottom: '12px', opacity: 0.5 }} />
            <Text fontSize="sm">No recent activity</Text>
          </Box>
        ) : (
          <VStack spacing={1} align="stretch">
            <AnimatePresence>
              {activities.map((activity, index) => {
                const IconComponent = ENTITY_ICONS[activity.entity_type] || Activity;
                const color = ENTITY_COLORS[activity.entity_type] || 'gray';

                return (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ delay: index * 0.02 }}
                  >
                    <Flex
                      gap={3}
                      p={3}
                      borderRadius="lg"
                      _hover={{ bg: useColorModeValue('gray.50', 'gray.700') }}
                      transition="all 0.2s"
                    >
                      <Box
                        boxSize="32px"
                        borderRadius="lg"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        bg={`${color}.100`}
                        _dark={{ bg: `${color}.900` }}
                        flexShrink={0}
                      >
                        <Icon as={IconComponent} boxSize={4} color={`${color}.500`} />
                      </Box>
                      <Box flex={1} minW={0}>
                        <Text fontSize="sm" fontWeight="medium" color={textColor} noOfLines={1}>
                          {activity.action}
                        </Text>
                        <Flex align="center" gap={1} mt={1}>
                          <Clock size={12} />
                          <Text fontSize="xs" color="gray.500">
                            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                          </Text>
                        </Flex>
                      </Box>
                    </Flex>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </VStack>
        )}
      </CardBody>
    </Card>
  );
}
