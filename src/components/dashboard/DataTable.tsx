'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Heading,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Skeleton,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  useDisclosure,
} from '@chakra-ui/react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { Search, Download } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useTenant } from '@/contexts/TenantContext';

interface Deal {
  id: string;
  name: string;
  stage: string;
  value: number;
  client_name?: string;
  created_at: string;
}

/**
 * Data table component with sorting, filtering, and CSV export.
 * Uses TanStack Table v8 for table logic and Chakra UI for rendering.
 */
export function DataTable() {
  const { currentTenant, isLoading: tenantLoading } = useTenant();
  const tenantId = currentTenant?.id;
  const [data, setData] = useState<Deal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const bgCard = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'whiteAlpha.900');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');

  useEffect(() => {
    if (!tenantId) return;

    async function fetchDeals() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: deals } = await supabase
          .from('business_deals')
          .select('id, name, stage, value, client_name, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(50);

        setData(deals || []);
      } catch (err) {
        console.error('Failed to fetch deals:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDeals();
  }, [tenantId]);

  const columnHelper = createColumnHelper<Deal>();

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Deal Name',
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('client_name', {
        header: 'Client',
        cell: (info) => info.getValue() || '-',
      }),
      columnHelper.accessor('stage', {
        header: 'Stage',
        cell: (info) => (
          <Text
            textTransform="capitalize"
            color={
              info.getValue() === 'closed_won'
                ? 'green.500'
                : info.getValue() === 'closed_lost'
                ? 'red.500'
                : 'blue.500'
            }
          >
            {info.getValue().replace(/_/g, ' ')}
          </Text>
        ),
      }),
      columnHelper.accessor('value', {
        header: 'Value',
        cell: (info) => `$${info.getValue().toLocaleString()}`,
      }),
      columnHelper.accessor('created_at', {
        header: 'Created',
        cell: (info) => new Date(info.getValue()).toLocaleDateString(),
      }),
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const exportCSV = () => {
    const headers = columns.map((col) => col.header as string);
    const rows = data.map((deal) =>
      columns.map((col) => {
        const value = col.accessorKey ? (deal as any)[col.accessorKey] : '';
        return typeof value === 'string' ? `"${value}"` : value;
      })
    );

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deals.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (tenantLoading || isLoading) {
    return (
      <Card bg={bgCard} borderColor={borderColor} borderWidth="1px">
        <CardBody>
          <Skeleton height="300px" />
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <Card bg={bgCard} borderColor={borderColor} borderWidth="1px">
        <CardHeader>
          <Flex justify="space-between" align="center" wrap="wrap" gap={4}>
            <Heading size="md" color={textColor}>
              Deals Pipeline
            </Heading>
            <Flex gap={2}>
              <InputGroup size="sm" maxW="250px">
                <InputLeftElement pointerEvents="none">
                  <Search size={16} />
                </InputLeftElement>
                <Input
                  placeholder="Search deals..."
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  borderRadius="lg"
                />
              </InputGroup>
              <Button
                leftIcon={<Download size={16} />}
                size="sm"
                variant="outline"
                onClick={exportCSV}
              >
                Export CSV
              </Button>
            </Flex>
          </Flex>
        </CardHeader>
        <CardBody overflowX="auto">
          <Table variant="simple" size="sm">
            <Thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <Tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <Th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      cursor="pointer"
                      userSelect="none"
                      color={textColor}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {{
                        asc: ' ↑',
                        desc: ' ↓',
                      }[header.column.getIsSorted() as string] ?? null}
                    </Th>
                  ))}
                </Tr>
              ))}
            </Thead>
            <Tbody>
              {table.getRowModel().rows.map((row) => (
                <Tr
                  key={row.id}
                  _hover={{ bg: hoverBg }}
                  cursor="pointer"
                  onClick={() => {
                    setSelectedDeal(row.original);
                    onOpen();
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <Td key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </Td>
                  ))}
                </Tr>
              ))}
            </Tbody>
          </Table>
          {data.length === 0 && (
            <Box textAlign="center" py={8} color="gray.500">
              No deals found
            </Box>
          )}
        </CardBody>
      </Card>

      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent bg={bgCard}>
          <ModalHeader color={textColor}>Deal Details</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {selectedDeal && (
              <Box>
                <Text fontWeight="bold" fontSize="lg" mb={2}>
                  {selectedDeal.name}
                </Text>
                <Text color="gray.500" mb={1}>
                  Client: {selectedDeal.client_name || 'N/A'}
                </Text>
                <Text color="gray.500" mb={1}>
                  Stage: {selectedDeal.stage.replace(/_/g, ' ')}
                </Text>
                <Text color="gray.500" mb={1}>
                  Value: ${selectedDeal.value.toLocaleString()}
                </Text>
                <Text color="gray.500">
                  Created: {new Date(selectedDeal.created_at).toLocaleDateString()}
                </Text>
              </Box>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
