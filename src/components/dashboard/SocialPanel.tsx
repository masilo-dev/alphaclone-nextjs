'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Grid,
  GridItem,
  Heading,
  Icon,
  Skeleton,
  Text,
  Badge,
  useColorModeValue,
} from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useTenant } from '@/hooks/useTenant';
import { RealtimeService } from '@/lib/realtime-service';
import {
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Globe,
  MessageCircle,
} from 'lucide-react';
import { format } from 'date-fns';

interface SocialPost {
  id: string;
  platform: string;
  content: string;
  scheduled_for: string;
  status: string;
  created_at: string;
}

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  facebook: Facebook,
  twitter: Twitter,
  instagram: Instagram,
  linkedin: Linkedin,
  whatsapp: MessageCircle,
  default: Globe,
};

const PLATFORM_COLORS: Record<string, string> = {
  facebook: 'blue',
  twitter: 'cyan',
  instagram: 'pink',
  linkedin: 'blue',
  whatsapp: 'green',
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'yellow',
  published: 'green',
  failed: 'red',
  draft: 'gray',
};

/**
 * Social panel component showing scheduled and published posts.
 * Displays posts in a calendar-like grid with platform icons.
 */
export function SocialPanel() {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const bgCard = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'whiteAlpha.900');

  useEffect(() => {
    if (!tenantId) return;

    async function fetchPosts() {
      try {
        const supabase = createClientComponentClient();
        const { data } = await supabase
          .from('social_posts')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('scheduled_for', { ascending: true })
          .limit(20);

        setPosts(data || []);
      } catch (err) {
        console.error('Failed to fetch social posts:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPosts();

    const realtime = RealtimeService.getInstance();
    realtime.init();

    const channel = realtime.subscribe(
      'social-posts',
      { table: 'social_posts', filter: `tenant_id=eq.${tenantId}` },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          setPosts((prev) => [payload.new as SocialPost, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setPosts((prev) =>
            prev.map((p) =>
              p.id === (payload.new as SocialPost).id
                ? (payload.new as SocialPost)
                : p
            )
          );
        } else if (payload.eventType === 'DELETE') {
          setPosts((prev) =>
            prev.filter((p) => p.id !== (payload.old as SocialPost).id)
          );
        }
      }
    );

    return () => {
      realtime.unsubscribe('social-posts');
    };
  }, [tenantId]);

  if (tenantLoading || isLoading) {
    return (
      <Card bg={bgCard} borderColor={borderColor} borderWidth="1px">
        <CardBody>
          <Skeleton height="200px" />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card bg={bgCard} borderColor={borderColor} borderWidth="1px">
      <CardHeader>
        <Heading size="md" color={textColor}>
          Social Posts
        </Heading>
      </CardHeader>
      <CardBody>
        {posts.length === 0 ? (
          <Box textAlign="center" py={8} color="gray.500">
            <Globe size={40} style={{ margin: '0 auto', marginBottom: '12px', opacity: 0.5 }} />
            <Text fontSize="sm">No social posts scheduled</Text>
          </Box>
        ) : (
          <Grid templateColumns="repeat(auto-fill, minmax(200px, 1fr))" gap={4}>
            {posts.map((post, index) => {
              const PlatformIcon = PLATFORM_ICONS[post.platform] || PLATFORM_ICONS.default;
              const platformColor = PLATFORM_COLORS[post.platform] || 'gray';
              const statusColor = STATUS_COLORS[post.status] || 'gray';

              return (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Box
                    p={3}
                    borderRadius="lg"
                    borderWidth="1px"
                    borderColor={borderColor}
                    _hover={{ borderColor: `${platformColor}.500` }}
                    transition="all 0.2s"
                  >
                    <Flex justify="space-between" align="center" mb={2}>
                      <Flex align="center" gap={2}>
                        <Icon
                          as={PlatformIcon}
                          boxSize={4}
                          color={`${platformColor}.500`}
                        />
                        <Text
                          fontSize="xs"
                          fontWeight="medium"
                          textTransform="capitalize"
                          color={textColor}
                        >
                          {post.platform}
                        </Text>
                      </Flex>
                      <Badge
                        colorScheme={statusColor}
                        fontSize="xs"
                        variant="subtle"
                      >
                        {post.status}
                      </Badge>
                    </Flex>
                    <Text
                      fontSize="sm"
                      color="gray.500"
                      noOfLines={2}
                      mb={2}
                    >
                      {post.content}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {post.scheduled_for
                        ? format(new Date(post.scheduled_for), 'MMM d, yyyy')
                        : 'No date'}
                    </Text>
                  </Box>
                </motion.div>
              );
            })}
          </Grid>
        )}
      </CardBody>
    </Card>
  );
}
