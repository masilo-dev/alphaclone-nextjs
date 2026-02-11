import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskService, Task, CreateTaskInput } from '../services/taskService';

interface UseTasksFilters {
    assignedTo?: string;
    status?: string;
    relatedToContact?: string;
    relatedToProject?: string;
    relatedToDeal?: string;
    relatedToLead?: string;
    limit?: number;
}

export function useTasks(filters?: UseTasksFilters) {
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
        queryKey: ['tasks', filters],
        queryFn: async ({ pageParam = 1 }) => {
            const result = await taskService.getTasks({
                ...filters,
                page: pageParam as number,
                limit: filters?.limit || 50
            });
            if (result.error) throw new Error(result.error);
            return result;
        },
        initialPageParam: 1,
        getNextPageParam: (lastPage, allPages) => {
            const nextParam = allPages.length + 1;
            // If the last page had fewer items than the limit, we've reached the end
            if (lastPage.tasks.length < (filters?.limit || 50)) {
                return undefined;
            }
            return nextParam;
        },
        staleTime: 60 * 1000, // 1 minute
    });

    const tasks = data?.pages.flatMap(page => page.tasks) || [];
    const totalCount = data?.pages[0]?.count || 0;

    const createTask = useMutation({
        mutationFn: async (input: { userId: string; taskData: CreateTaskInput }) => {
            const { task, error } = await taskService.createTask(input.userId, input.taskData);
            if (error) throw new Error(error);
            return task;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
        },
    });

    const updateTask = useMutation({
        mutationFn: async ({ taskId, updates }: { taskId: string; updates: Partial<Task> }) => {
            const { task, error } = await taskService.updateTask(taskId, updates);
            if (error) throw new Error(error);
            return task;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
        },
    });

    const deleteTask = useMutation({
        mutationFn: async (taskId: string) => {
            const { success, error } = await taskService.deleteTask(taskId);
            if (!success) throw new Error(error || 'Failed to delete');
            return taskId;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
        },
    });

    return {
        tasks,
        totalCount,
        isLoading,
        error,
        fetchNextPage,
        hasNextPage,
        isFetching,
        isFetchingNextPage,
        createTask,
        updateTask,
        deleteTask,
    };
}
