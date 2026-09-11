'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Heading,
  Text,
  useColorModeValue,
  Skeleton,
} from '@chakra-ui/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useTenant } from '@/contexts/TenantContext';

// Data source: `deals` table (same source as the get_pipeline_summary MCP tool and DealsTab).
// Previously queried non-existent `business_deals`, silently showing demo data.
interface PipelineData {
  stage: string;
  value: number;
  count: number;
}

const COLORS = ['#3182ce', '#4299e1', '#63b3ed', '#805ad5', '#319795'];

export function PipelineChart() {
  const { currentTenant, isLoading: tenantLoading } = useTenant();
  const tenantId = currentTenant?.id;
  const [data, setData] = useState<PipelineData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const bgCard = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'whiteAlpha.900');
  const gridColor = useColorModeValue('#edf2f7', '#2d3748');
  const labelColor = useColorModeValue('gray.600', 'gray.400');

  useEffect(() => {
    if (!tenantId) return;

    async function fetchPipelineData() {
      try {
        const supabase = createSupabaseBrowserClient();

        const { data: deals } = await supabase
          .from('deals')
          .select('stage, value')
          .eq('tenant_id', tenantId);

        if (deals && deals.length > 0) {
          const stageMap: Record<string, { value: number; count: number }> = {};
          
          deals.forEach((deal: any) => {
            const rawStage = deal.stage || 'lead';
            let stageName = rawStage.replace(/_/g, ' ');
            // Capitalize
            stageName = stageName.charAt(0).toUpperCase() + stageName.slice(1);

            if (!stageMap[stageName]) {
              stageMap[stageName] = { value: 0, count: 0 };
            }
            stageMap[stageName].value += Number(deal.value || 0);
            stageMap[stageName].count += 1;
          });

          const formatted = Object.keys(stageMap).map((stage) => ({
            stage,
            value: stageMap[stage].value,
            count: stageMap[stage].count,
          }));

          setData(formatted);
        }
      } catch (err) {
        console.error('Error fetching pipeline data:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPipelineData();
  }, [tenantId]);

  if (tenantLoading || isLoading) {
    return (
      <Box
        bg={bgCard}
        p={5}
        borderRadius="xl"
        borderWidth="1px"
        borderColor={borderColor}
        h="350px"
      >
        <Skeleton height="24px" w="30%" mb={6} />
        <Skeleton height="240px" />
      </Box>
    );
  }

  return (
    <Box
      bg={bgCard}
      p={5}
      borderRadius="xl"
      borderWidth="1px"
      borderColor={borderColor}
      boxShadow="sm"
      h="350px"
      display="flex"
      flexDirection="column"
    >
      <Box mb={4}>
        <Heading size="sm" color={textColor} mb={1}>
          Deals Pipeline Value (USD)
        </Heading>
        <Text fontSize="xs" color="gray.500">
          Open + closed deal value by stage — all time
        </Text>
      </Box>

      <Box flex={1} minH={0}>
        {data.length === 0 ? (
          <Box display="flex" alignItems="center" justifyContent="center" h="100%">
            <Text fontSize="sm" color="gray.500" textAlign="center">
              No deals in the pipeline yet — create your first deal and watch it climb.
            </Text>
          </Box>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="stage"
              stroke={labelColor}
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke={labelColor}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: any) => `$${v.toLocaleString()}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: bgCard,
                borderColor: borderColor,
                borderRadius: '8px',
                color: textColor,
                fontSize: '12px',
              }}
              formatter={(value: any, name: any, props: any) => [
                `$${value.toLocaleString()} (${props.payload.count} deals)`,
                'Pipeline Value',
              ]}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={45}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        )}
      </Box>
    </Box>
  );
}
