'use client';

import {
  Box,
  Grid,
  GridItem,
  Heading,
  Text,
  useColorModeValue,
} from '@chakra-ui/react';
import { KPICards } from '@/components/dashboard/KPICards';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { PipelineChart } from '@/components/dashboard/PipelineChart';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { DataTable } from '@/components/dashboard/DataTable';
import { SocialPanel } from '@/components/dashboard/SocialPanel';

/**
 * Main dashboard page composing all dashboard widgets.
 * Displays KPI cards, charts, activity feed, data table, and social panel.
 */
export default function DashboardPage() {
  const textColor = useColorModeValue('gray.800', 'whiteAlpha.900');

  return (
    <Box>
      {/* Page header */}
      <Box mb={8}>
        <Heading size="lg" color={textColor} mb={2}>
          Dashboard
        </Heading>
        <Text color="gray.500">
          Welcome back! Here's your business overview.
        </Text>
      </Box>

      {/* KPI Cards */}
      <Box mb={8}>
        <KPICards />
      </Box>

      {/* Charts row */}
      <Grid
        templateColumns={{ base: '1fr', lg: '1fr 1fr' }}
        gap={6}
        mb={8}
      >
        <GridItem>
          <RevenueChart />
        </GridItem>
        <GridItem>
          <PipelineChart />
        </GridItem>
      </Grid>

      {/* Activity Feed */}
      <Box mb={8}>
        <ActivityFeed userId="current" limit={10} />
      </Box>

      {/* Data Table */}
      <Box mb={8}>
        <DataTable />
      </Box>

      {/* Social Panel */}
      <Box mb={8}>
        <SocialPanel />
      </Box>
    </Box>
  );
}
