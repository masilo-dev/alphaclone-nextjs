'use client';

import { Box, Flex, IconButton, Text, VStack, useColorModeValue } from '@chakra-ui/react';
import { LayoutDashboard, Users, Briefcase, Settings, LogOut } from 'lucide-react';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Clients', icon: Users, href: '/dashboard/clients' },
  { label: 'Projects', icon: Briefcase, href: '/dashboard/projects' },
  { label: 'Settings', icon: Settings, href: '/dashboard/settings' },
];

/**
 * Sidebar navigation component with collapsible behavior.
 */
export function Sidebar({ sidebarOpen }: SidebarProps) {
  const bgSidebar = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'whiteAlpha.900');
  const hoverBg = useColorModeValue('gray.100', 'gray.700');

  return (
    <Box
      h="100vh"
      bg={bgSidebar}
      borderRightWidth="1px"
      borderRightColor={borderColor}
      display="flex"
      flexDirection="column"
      overflow="hidden"
    >
      {/* Logo area */}
      <Flex
        h="64px"
        align="center"
        justify={sidebarOpen ? 'flex-start' : 'center'}
        px={sidebarOpen ? 6 : 2}
        borderBottomWidth="1px"
        borderBottomColor={borderColor}
      >
        <Text
          fontSize="xl"
          fontWeight="bold"
          color="brand.500"
          display={sidebarOpen ? 'block' : 'none'}
        >
          AlphaClone
        </Text>
        {!sidebarOpen && (
          <Text fontSize="xl" fontWeight="bold" color="brand.500">
            AC
          </Text>
        )}
      </Flex>

      {/* Navigation */}
      <VStack spacing={1} flex={1} p={sidebarOpen ? 4 : 2}>
        {NAV_ITEMS.map((item) => (
          <Box
            key={item.label}
            as="a"
            href={item.href}
            w="100%"
            p={3}
            borderRadius="lg"
            display="flex"
            alignItems="center"
            gap={3}
            _hover={{ bg: hoverBg }}
            transition="all 0.2s"
          >
            <item.icon size={20} />
            {sidebarOpen && (
              <Text fontSize="sm" fontWeight="medium" color={textColor}>
                {item.label}
              </Text>
            )}
          </Box>
        ))}
      </VStack>

      {/* Logout */}
      <Box p={sidebarOpen ? 4 : 2} borderTopWidth="1px" borderTopColor={borderColor}>
        <Box
          as="button"
          w="100%"
          p={3}
          borderRadius="lg"
          display="flex"
          alignItems="center"
          gap={3}
          _hover={{ bg: hoverBg }}
          transition="all 0.2s"
        >
          <LogOut size={20} />
          {sidebarOpen && (
            <Text fontSize="sm" fontWeight="medium" color={textColor}>
              Logout
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  );
}
