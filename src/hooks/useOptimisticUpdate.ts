import { useState, useCallback } from 'react';
import { useToast } from '../components/Toast';

interface OptimisticUpdateOptions<T> {
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
    successMessage?: string;
    errorMessage?: string;
}

/**
 * Hook for optimistic UI updates
 * Updates UI immediately, then syncs with server
 */
export function useOptimisticUpdate<T>() {
    const [isUpdating, setIsUpdating] = useState(false);
    const toast = useToast();

    const execute = useCallback(
        async (
            _optimisticData: T,
            updateFn: () => Promise<T>,
            options: OptimisticUpdateOptions<T> = {}
        ): Promise<T | null> => {
            setIsUpdating(true);

            try {
                // Server update
                const result = await updateFn();

                if (options.successMessage) {
                    toast.success(options.successMessage);
                }

                if (options.onSuccess) {
                    options.onSuccess(result);
                }

                return result;
            } catch (error) {
                // Rollback on error
                if (options.errorMessage) {
                    toast.error(options.errorMessage);
                } else {
                    toast.error('Update failed. Please try again.');
                }

                if (options.onError) {
                    options.onError(error as Error);
                }

                return null;
            } finally {
                setIsUpdating(false);
            }
        },
        [toast]
    );

    return { execute, isUpdating };
}

/**
 * Hook for optimistic list operations (add, update, delete)
 */
export function useOptimisticList<T extends { id: string }>() {
    const toast = useToast();

    const addOptimistic = useCallback(
        async (
            items: T[],
            setItems: (items: T[]) => void,
            newItem: T,
            addFn: () => Promise<T>
        ): Promise<boolean> => {
            // Optimistically add
            setItems([...items, newItem]);

            try {
                const result = await addFn();
                // Replace temp item with real one
                setItems(items.map(item => item.id === newItem.id ? result : item));
                return true;
            } catch (error) {
                // Rollback
                setItems(items.filter(item => item.id !== newItem.id));
                toast.error('Failed to add item');
                return false;
            }
        },
        [toast]
    );

    const updateOptimistic = useCallback(
        async (
            items: T[],
            setItems: (items: T[]) => void,
            itemId: string,
            updates: Partial<T>,
            updateFn: () => Promise<T>
        ): Promise<boolean> => {
            // Store original for rollback
            const originalItems = [...items];

            // Optimistically update
            setItems(items.map(item =>
                item.id === itemId ? { ...item, ...updates } : item
            ));

            try {
                const result = await updateFn();
                // Replace with server result
                setItems(items.map(item => item.id === itemId ? result : item));
                return true;
            } catch (error) {
                // Rollback
                setItems(originalItems);
                toast.error('Failed to update item');
                return false;
            }
        },
        [toast]
    );

    const deleteOptimistic = useCallback(
        async (
            items: T[],
            setItems: (items: T[]) => void,
            itemId: string,
            deleteFn: () => Promise<void>
        ): Promise<boolean> => {
            // Store original for rollback
            const originalItems = [...items];

            // Optimistically delete
            setItems(items.filter(item => item.id !== itemId));

            try {
                await deleteFn();
                return true;
            } catch (error) {
                // Rollback
                setItems(originalItems);
                toast.error('Failed to delete item');
                return false;
            }
        },
        [toast]
    );

    return { addOptimistic, updateOptimistic, deleteOptimistic };
}

export default useOptimisticUpdate;
