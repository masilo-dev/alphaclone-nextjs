'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Grid,
  GridItem,
  IconButton,
  useColorMode,
  useColorModeValue,
} from '@chakra-ui/react';
import { Moon, Sun, Menu, X } from 'lucide-react';
import { Sidebar } from '@/components/dashboard/Layout/Sidebar';
import { Header } from '@/components/dashboard/Layout/Header';
import { SearchBar } from '@/components/dashboard/Layout/SearchBar';
import { NotificationBell } from '@/components/dashboard/Layout/NotificationBell';
import { NexusWidget } from '@/components/dashboard/NexusWidget';

/**
 * Dashboard layout with collapsible sidebar, header, and main content area.
 * Supports dark mode toggle and responsive design.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { colorMode, toggleColorMode } = useColorMode();

  const bgMain = useColorModeValue('gray.50', 'gray.900');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  // Load sidebar state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-open');
    if (stored !== null) {
      setSidebarOpen(stored === 'true');
    }
  }, []);

  // Save sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar-open', String(sidebarOpen));
  }, [sidebarOpen]);

  return (
    <Grid
      templateColumns={sidebarOpen ? '260px 1fr' : '80px 1fr'}
      transition="all 0.3s"
      minH="100vh"
      bg={bgMain}
    >
      {/* Sidebar */}
      <GridItem
        as="aside"
        position="fixed"
        left={0}
        top={0}
        h="100vh"
        w={sidebarOpen ? '260px' : '80px'}
        transition="all 0.3s"
        zIndex={100}
        borderRightWidth="1px"
        borderRightColor={borderColor}
      >
        <Sidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />
      </GridItem>

      {/* Main content */}
      <GridItem
        gridColumn={2}
        ml={sidebarOpen ? '260px' : '80px'}
        transition="all 0.3s"
      >
        {/* Header */}
        <Box
          as="header"
          position="sticky"
          top={0}
          zIndex={50}
          bg={bgMain}
          borderBottomWidth="1px"
          borderBottomColor={borderColor}
          px={6}
          py={3}
        >
          <Flex justify="space-between" align="center">
            <Flex align="center" gap={4}>
              <IconButton
                aria-label="Toggle sidebar"
                icon={sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              />
              <SearchBar />
            </Flex>
            <Flex align="center" gap={3}>
              <NotificationBell />
              <IconButton
                aria-label="Toggle color mode"
                icon={colorMode === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                variant="ghost"
                size="sm"
                onClick={toggleColorMode}
              />
              <Header />
            </Flex>
          </Flex>
        </Box>

        {/* Page content */}
        <Box as="main" p={6}>
          {children}
        </Box>
      </GridItem>

      {/* Nexus AI Widget */}
      <NexusWidget />
    </Grid>
  );
}
