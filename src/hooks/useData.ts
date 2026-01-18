import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService } from '../services/projectService';
import { messageService } from '../services/messageService';
import { Project, UserRole } from '../types';

/**
 * Hook to fetch projects with caching
 */
export function useProjects(userId: string, role: UserRole) {
    return useQuery({
        queryKey: ['projects', userId, role],
        queryFn: async () => {
            const { projects, error } = await projectService.getProjects(userId, role);
            if (error) throw new Error(error);
            return projects;
        },
    });
}

/**
 * Hook to create a project
 */
export function useCreateProject() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (projectData: Omit<Project, 'id'>) => {
            const { project, error } = await projectService.createProject(projectData);
            if (error) throw new Error(error);
            return project;
        },
        onSuccess: () => {
            // Invalidate and refetch projects
            queryClient.invalidateQueries({ queryKey: ['projects'] });
        },
    });
}

/**
 * Hook to update a project
 */
export function useUpdateProject() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ projectId, updates }: { projectId: string; updates: Partial<Project> }) => {
            const { error } = await projectService.updateProject(projectId, updates);
            if (error) throw new Error(error);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
        },
    });
}

/**
 * Hook to fetch messages with caching
 */
export function useMessages(currentUserId: string, viewAsAdmin: boolean = false) {
    return useQuery({
        queryKey: ['messages', currentUserId, viewAsAdmin],
        queryFn: async () => {
            const { messages, error } = await messageService.getMessages(currentUserId, viewAsAdmin);
            if (error) throw new Error(error);
            return messages;
        },
    });
}

/**
 * Hook to send a message
 */
export function useSendMessage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            senderId,
            senderName,
            senderRole,
            text,
            recipientId,
        }: {
            senderId: string;
            senderName: string;
            senderRole: 'user' | 'model' | 'system';
            text: string;
            recipientId?: string;
        }) => {
            const { message, error } = await messageService.sendMessage(
                senderId,
                senderName,
                senderRole,
                text,
                recipientId
            );
            if (error) throw new Error(error);
            return message;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['messages'] });
        },
    });
}
