import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';

export type RecurrenceFrequency = 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';

export interface TaskRecurrence {
    id: string;
    taskId: string;
    frequency: RecurrenceFrequency;
    interval: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    endDate?: string;
    nextOccurrence?: string;
}

export const taskRecurrenceService = {
    /**
     * Set recurrence for a task
     */
    async setRecurrence(taskId: string, recurrence: Omit<TaskRecurrence, 'id' | 'taskId'>) {
        try {
            const nextDate = this.calculateNextOccurrence(new Date(), recurrence);

            const { data, error } = await supabase
                .from('recurring_tasks')
                .upsert({
                    task_id: taskId,
                    frequency: recurrence.frequency,
                    interval: recurrence.interval,
                    days_of_week: recurrence.daysOfWeek,
                    day_of_month: recurrence.dayOfMonth,
                    end_date: recurrence.endDate,
                    next_occurrence: nextDate.toISOString()
                }, { onConflict: 'task_id' })
                .select()
                .single();

            if (error) throw error;
            return { data, error: null };
        } catch (err) {
            console.error('Error setting recurrence:', err);
            return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get recurrence settings for a task
     */
    async getRecurrence(taskId: string) {
        try {
            const { data, error } = await supabase
                .from('recurring_tasks')
                .select('*')
                .eq('task_id', taskId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return { data, error: null };
        } catch (err) {
            return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Logic to calculate the next date based on pattern
     */
    calculateNextOccurrence(from: Date, pattern: Omit<TaskRecurrence, 'id' | 'taskId'>): Date {
        const next = new Date(from);
        const interval = pattern.interval || 1;

        switch (pattern.frequency) {
            case 'Daily':
                next.setDate(next.getDate() + interval);
                break;
            case 'Weekly':
                if (pattern.daysOfWeek && pattern.daysOfWeek.length > 0) {
                    // Find next day of week
                    let dayFound = false;
                    for (let i = 1; i <= 7; i++) {
                        const checkDate = new Date(from);
                        checkDate.setDate(checkDate.getDate() + i);
                        if (pattern.daysOfWeek.includes(checkDate.getDay())) {
                            return checkDate;
                        }
                    }
                }
                next.setDate(next.getDate() + (7 * interval));
                break;
            case 'Monthly':
                if (pattern.dayOfMonth) {
                    next.setMonth(next.getMonth() + interval);
                    next.setDate(pattern.dayOfMonth);
                } else {
                    next.setMonth(next.getMonth() + interval);
                }
                break;
            case 'Yearly':
                next.setFullYear(next.getFullYear() + interval);
                break;
        }

        return next;
    },

    /**
     * Remove recurrence from a task
     */
    async removeRecurrence(taskId: string) {
        const { error } = await supabase
            .from('recurring_tasks')
            .delete()
            .eq('task_id', taskId);

        return { error };
    }
};
