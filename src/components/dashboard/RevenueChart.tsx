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
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useTenant } from '@/contexts/TenantContext';

// Data source: `business_invoices` (status = 'paid') — same table the
// get_revenue_summary MCP tool reads, so the widget and Bonnie always agree.
// (Was legacy `invoices` table, which drifted from MCP revenue numbers.)
interface ChartData {
  month: string;
  revenue: number;
}

export function RevenueChart() {
  const { currentTenant, isLoading: tenantLoading } = useTenant();
  const tenantId = currentTenant?.id;
  const [data, setData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const bgCard = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'whiteAlpha.900');
  const gridColor = useColorModeValue('#edf2f7', '#2d3748');
  const labelColor = useColorModeValue('gray.600', 'gray.400');

  useEffect(() => {
    if (!tenantId) return;

    async function fetchRevenueData() {
      try {
        const supabase = createSupabaseBrowserClient();
        
        // Fetch last 6 months of paid invoices
        const { data: invoices } = await supabase
          .from('business_invoices')
          .select('total, created_at, status')
          .eq('tenant_id', tenantId)
          .eq('status', 'paid');

        if (invoices && invoices.length > 0) {
          // Group by month
          const monthlyMap: Record<string, number> = {};
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          
          invoices.forEach((inv: any) => {
            const date = new Date(inv.created_at);
            const key = `${monthNames[date.getMonth()]} ${date.getFullYear().toString().substring(2)}`;
            monthlyMap[key] = (monthlyMap[key] || 0) + Number(inv.total || 0);
          });

          const formatted = Object.keys(monthlyMap).map((month) => ({
            month,
            revenue: monthlyMap[month],
          }));

          setData(formatted.sort((a, b) => {
            const parseDate = (str: string) => {
              const parts = str.split(' ');
              const mIdx = monthNames.indexOf(parts[0]);
              const y = parseInt(parts[1], 10);
              return new Date(y + 2000, mIdx, 1).getTime();
            };
            return parseDate(a.month) - parseDate(b.month);
          }));
        }
      } catch (err) {
        console.error('Error fetching revenue chart data:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRevenueData();
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
          Revenue Trend (USD)
        </Heading>
        <Text fontSize="xs" color="gray.500">
          Paid invoices per month — last 6 months
        </Text>
      </Box>

      <Box flex={1} minH={0}>
        {data.length === 0 ? (
          <Box display="flex" alignItems="center" justifyContent="center" h="100%">
            <Text fontSize="sm" color="gray.500" textAlign="center">
              No paid invoices yet — revenue appears here the moment your first invoice is paid.
            </Text>
          </Box>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#319795" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#319795" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="month"
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
              formatter={(value: any) => [`$${value.toLocaleString()}`, 'Revenue']}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#319795"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorRevenue)"
            />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </Box>
    </Box>
  );
}
