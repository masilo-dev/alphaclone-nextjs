'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import toast from 'react-hot-toast';

const TASKS_STORAGE_KEY = 'alphaclone_background_tasks_v1';

export type BackgroundTaskStatus = 'pending' | 'running' | 'completed' | 'error';

export interface BackgroundTask {
    id: string;
    name: string;
    status: BackgroundTaskStatus;
    progress?: number;
    result?: any;
    error?: string;
}

interface BackgroundTaskContextType {
    tasks: BackgroundTask[];
    startTask: <T>(id: string, name: string, taskFn: () => Promise<T>, onSuccess?: (result: T) => void, onError?: (error: any) => void) => void;
    getTask: (id: string) => BackgroundTask | undefined;
    dismissTask: (id: string) => void;
}

const BackgroundTaskContext = createContext<BackgroundTaskContextType | undefined>(undefined);

export function BackgroundTaskProvider({ children }: { children: ReactNode }) {
    const [tasks, setTasks] = useState<BackgroundTask[]>([]);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(TASKS_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as BackgroundTask[];
                if (Array.isArray(parsed)) {
                    setTasks(parsed);
                }
            }
        } catch {
            /* ignore corrupt storage */
        }
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        try {
            sessionStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
        } catch {
            /* ignore quota */
        }
    }, [tasks, hydrated]);

    const startTask = async <T,>(
        id: string,
        name: string,
        taskFn: () => Promise<T>,
        onSuccess?: (result: T) => void,
        onError?: (error: any) => void
    ) => {
        // Add to state
        setTasks(prev => {
            if (prev.find(t => t.id === id)) return prev;
            return [...prev, { id, name, status: 'running' }];
        });

        try {
            // Validate that taskFn is actually a function
            if (typeof taskFn !== 'function') {
                throw new Error('Task function is not callable');
            }

            const result = await taskFn();

            setTasks(prev => prev.map(t =>
                t.id === id ? { ...t, status: 'completed', result } : t
            ));

            toast.success(`${name} completed successfully!`);

            if (onSuccess) onSuccess(result);

        } catch (error: any) {
            console.error(`Background task failed: ${name}`, error);
            
            // Better error handling for different types of errors
            let errorMessage = 'Unknown error';
            if (error?.message) {
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            } else if (error && typeof error === 'object') {
                errorMessage = 'Task execution failed';
            }

            setTasks(prev => prev.map(t =>
                t.id === id ? { ...t, status: 'error', error: errorMessage } : t
            ));

            toast.error(`${name} failed: ${errorMessage}`);

            if (onError) onError(error);
        }
    };

    const getTask = (id: string) => tasks.find(t => t.id === id);

    const dismissTask = (id: string) => {
        setTasks(prev => prev.filter(t => t.id !== id));
    };

    return (
        <BackgroundTaskContext.Provider value={{ tasks, startTask, getTask, dismissTask }}>
            {children}
        </BackgroundTaskContext.Provider>
    );
}

export function useBackgroundTasks() {
    const context = useContext(BackgroundTaskContext);
    if (context === undefined) {
        throw new Error('useBackgroundTasks must be used within a BackgroundTaskProvider');
    }
    return context;
}
