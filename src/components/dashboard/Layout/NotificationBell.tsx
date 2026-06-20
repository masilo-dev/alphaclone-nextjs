'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  IconButton,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
  Text,
  VStack,
  useColorModeValue,
} from '@chakra-ui/react';
import { Bell } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useTenant } from '@/contexts/TenantContext';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
}

/**
 * Notification bell component with realtime updates.
 */
export function NotificationBell() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const bgPopover = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'whiteAlpha.900');

  useEffect(() => {
    if (!tenantId) return;

    async function fetchNotifications() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter((n: Notification) => !n.read).length);
      }
    }

    fetchNotifications();
  }, [tenantId]);

  return (
    <Popover>
      <PopoverTrigger>
        <Box position="relative">
          <IconButton
            aria-label="Notifications"
            icon={<Bell size={20} />}
            variant="ghost"
            size="sm"
          />
          {unreadCount > 0 && (
            <Box
              position="absolute"
              top="-2px"
              right="-2px"
              w={4}
              h={4}
              borderRadius="full"
              bg="red.500"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Text fontSize="10px" fontWeight="bold" color="white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </Box>
          )}
        </Box>
      </PopoverTrigger>
      <PopoverContent bg={bgPopover} borderColor={borderColor} maxW="300px">
        <PopoverHeader borderBottomWidth="1px" borderBottomColor={borderColor}>
          <Text fontSize="sm" fontWeight="medium" color={textColor}>
            Notifications
          </Text>
        </PopoverHeader>
        <PopoverBody>
          {notifications.length === 0 ? (
            <Text fontSize="sm" color="gray.500" textAlign="center" py={4}>
              No notifications
            </Text>
          ) : (
            <VStack spacing={2} align="stretch">
              {notifications.map((notif) => (
                <Box
                  key={notif.id}
                  p={2}
                  borderRadius="md"
                  bg={notif.read ? 'transparent' : useColorModeValue('blue.50', 'blue.900')}
                >
                  <Text fontSize="sm" fontWeight="medium" color={textColor}>
                    {notif.title}
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    {notif.message}
                  </Text>
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                  </Text>
                </Box>
              ))}
            </VStack>
          )}
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}
