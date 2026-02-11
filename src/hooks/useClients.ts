import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { businessClientService, BusinessClient } from '../services/businessClientService';

interface UseClientsFilters {
    searchTerm?: string;
    limit?: number;
}

export function useClients(tenantId: string | undefined, filters?: UseClientsFilters) {
    const queryClient = useQueryClient();

    const {
        data,
        error,
        fetchNextPage,
        hasNextPage,
        isFetching,
        isFetchingNextPage,
        status,
        isLoading
    } = useInfiniteQuery({
        queryKey: ['clients', tenantId, filters],
        queryFn: async ({ pageParam = 1 }) => {
            if (!tenantId) return { clients: [], count: 0, error: null };

            const result = await businessClientService.getClients(
                tenantId,
                pageParam as number,
                filters?.limit || 50,
                filters?.searchTerm
            );

            if (result.error) throw new Error(result.error);
            return result;
        },
        initialPageParam: 1,
        getNextPageParam: (lastPage, allPages) => {
            const nextParam = allPages.length + 1;
            if (lastPage.clients.length < (filters?.limit || 50)) {
                return undefined;
            }
            return nextParam;
        },
        enabled: !!tenantId,
        staleTime: 60 * 1000,
    });

    const clients = data?.pages.flatMap(page => page.clients) || [];
    const totalCount = data?.pages[0]?.count || 0;

    const createClient = useMutation({
        mutationFn: async (clientData: Partial<BusinessClient>) => {
            if (!tenantId) throw new Error('No tenant ID');
            const { client, error } = await businessClientService.createClient(tenantId, clientData);
            if (error) throw new Error(error);
            return client;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
        },
    });

    const updateClient = useMutation({
        mutationFn: async ({ clientId, updates }: { clientId: string; updates: Partial<BusinessClient> }) => {
            const { error } = await businessClientService.updateClient(clientId, updates);
            if (error) throw new Error(error);
            return clientId;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
        },
    });

    const deleteClient = useMutation({
        mutationFn: async (clientId: string) => {
            const { error } = await businessClientService.deleteClient(clientId);
            if (error) throw new Error(error);
            return clientId;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
        },
    });

    return {
        clients,
        totalCount,
        isLoading,
        error,
        fetchNextPage,
        hasNextPage,
        isFetching,
        isFetchingNextPage,
        createClient,
        updateClient,
        deleteClient,
    };
}
