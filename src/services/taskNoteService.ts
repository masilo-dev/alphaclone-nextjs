import { supabase } from '../lib/supabase';

export interface TaskNote {
    id: string;
    taskId: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
}

export const taskNoteService = {
    /**
     * Get all notes for a specific task
     */
    async getTaskNotes(taskId: string): Promise<{ notes: TaskNote[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('task_notes')
                .select('*')
                .eq('task_id', taskId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const notes = (data || []).map((n: any) => ({
                id: n.id,
                taskId: n.task_id,
                content: n.content,
                createdAt: n.created_at,
                updatedAt: n.updated_at,
                createdBy: n.created_by
            }));

            return { notes, error: null };
        } catch (err: any) {
            console.error('Error fetching task notes:', err);
            return { notes: [], error: err.message };
        }
    },

    /**
     * Create a new note for a task
     */
    async createNote(taskId: string, content: string, userId: string): Promise<{ note: TaskNote | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('task_notes')
                .insert({
                    task_id: taskId,
                    content,
                    created_by: userId
                })
                .select()
                .single();

            if (error) throw error;

            const newNote: TaskNote = {
                id: data.id,
                taskId: data.task_id,
                content: data.content,
                createdAt: data.created_at,
                updatedAt: data.updated_at,
                createdBy: data.created_by
            };

            return { note: newNote, error: null };
        } catch (err: any) {
            console.error('Error creating task note:', err);
            return { note: null, error: err.message };
        }
    },

    /**
     * Delete a note
     */
    async deleteNote(noteId: string): Promise<{ error: string | null }> {
        try {
            const { error } = await supabase
                .from('task_notes')
                .delete()
                .eq('id', noteId);

            if (error) throw error;
            return { error: null };
        } catch (err: any) {
            console.error('Error deleting task note:', err);
            return { error: err.message };
        }
    }
};
