import { supabase } from '../lib/supabase';
import { GalleryItem } from '../types';

export const galleryService = {
    /**
     * Upload item to gallery
     */
    async uploadToGallery(
        userId: string,
        type: 'image' | 'video',
        url: string,
        prompt: string
    ): Promise<{ item: GalleryItem | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('gallery_items')
                .insert({
                    user_id: userId,
                    type,
                    url,
                    prompt,
                })
                .select()
                .single();

            if (error) {
                return { item: null, error: error.message };
            }

            const item: GalleryItem = {
                id: data.id,
                userId: data.user_id,
                type: data.type,
                url: data.url,
                prompt: data.prompt,
                createdAt: new Date(data.created_at),
            };

            return { item, error: null };
        } catch (err) {
            return { item: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get user's gallery items
     */
    async getGalleryItems(userId: string): Promise<{ items: GalleryItem[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('gallery_items')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                return { items: [], error: error.message };
            }

            const items: GalleryItem[] = (data || []).map((item) => ({
                id: item.id,
                userId: item.user_id,
                type: item.type,
                url: item.url,
                prompt: item.prompt,
                createdAt: new Date(item.created_at),
            }));

            return { items, error: null };
        } catch (err) {
            return { items: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Delete gallery item
     */
    async deleteGalleryItem(itemId: string): Promise<{ error: string | null }> {
        try {
            const { error } = await supabase
                .from('gallery_items')
                .delete()
                .eq('id', itemId);

            return { error: error ? error.message : null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Upload file to storage bucket
     */
    async uploadFile(
        userId: string,
        bucket: 'avatars' | 'project-files' | 'gallery',
        file: File
    ): Promise<{ url: string | null; error: string | null }> {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}/${Date.now()}.${fileExt}`;

            const { data, error } = await supabase.storage
                .from(bucket)
                .upload(fileName, file);

            if (error) {
                return { url: null, error: error.message };
            }

            const { data: { publicUrl } } = supabase.storage
                .from(bucket)
                .getPublicUrl(data.path);

            return { url: publicUrl, error: null };
        } catch (err) {
            return { url: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },
};
