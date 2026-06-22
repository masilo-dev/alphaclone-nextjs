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
 * Main dashboard page content rendered client-side only.
 * Keeping this behind a dynamic import avoids server prerender crashes
 * from third-party dashboard widgets during the build step.
 */
export default function HomeDashboard() {
  const textColor = useColorModeValue('gray.800', 'whiteAlpha.900');

  return (
    <Box>
      <Box mb={8}>
        <Heading size="lg" color={textColor} mb={2}>
          Dashboard
        </Heading>
        <Text color="gray.500">
          Welcome back! Here's your business overview.
        </Text>
      </Box>

      <Box mb={8}>
        <KPICards />
      </Box>

      <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={6} mb={8}>
        <GridItem>
          <RevenueChart />
        </GridItem>
        <GridItem>
          <PipelineChart />
        </GridItem>
      </Grid>

      <Box mb={8}>
        <ActivityFeed userId="current" limit={10} />
      </Box>

      <Box mb={8}>
        <DataTable />
      </Box>

      <Box mb={8}>
        <SocialPanel />
      </Box>
    </Box>
  );
}
