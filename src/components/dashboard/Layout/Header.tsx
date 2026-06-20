'use client';

import {
  Avatar,
  Box,
  Flex,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
  useColorModeValue,
} from '@chakra-ui/react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';

interface UserProfile {
  name?: string;
  email?: string;
  avatar_url?: string;
}

/**
 * Header component showing user avatar and profile menu.
 */
export function Header() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const bgMenu = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.800', 'whiteAlpha.900');

  useEffect(() => {
    async function fetchUser() {
      const supabase = createClientComponentClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        setUser({
          name: authUser.user_metadata?.name || authUser.email?.split('@')[0],
          email: authUser.email,
          avatar_url: authUser.user_metadata?.avatar_url,
        });
      }
    }

    fetchUser();
  }, []);

  const handleLogout = async () => {
    const supabase = createClientComponentClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <Menu>
      <MenuButton>
        <Flex align="center" gap={2} cursor="pointer">
          <Avatar
            size="sm"
            name={user?.name || 'User'}
            src={user?.avatar_url}
          />
        </Flex>
      </MenuButton>
      <MenuList bg={bgMenu}>
        <Box px={3} py={2}>
          <Text fontSize="sm" fontWeight="medium" color={textColor}>
            {user?.name || 'User'}
          </Text>
          <Text fontSize="xs" color="gray.500">
            {user?.email}
          </Text>
        </Box>
        <MenuItem onClick={handleLogout}>Logout</MenuItem>
      </MenuList>
    </Menu>
  );
}
