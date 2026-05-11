import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';
import { rateLimitService } from './rateLimitService';

/**
 * AI Generation Service
 *
 * Handles AI-powered content generation:
 * - Logo generation (DALL-E 3)
 * - Image generation (DALL-E 3)
 * - Content generation (Claude API)
 *
 * Rate Limited: 3 generations/day for clients, unlimited for admin
 */

interface GenerationResult {
    success: boolean;
    url?: string;
    content?: string;
    error?: string;
    remaining?: number;
}

class AIGenerationService {
    private readonly OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

    /**
     * Generate logo using DALL-E 3
     */
    async generateLogo(
        userId: string,
        userRole: string,
        prompt: string,
        style: 'modern' | 'minimalist' | 'vintage' | 'abstract' = 'modern'
    ): Promise<GenerationResult> {
        try {
            const enhancedPrompt = `Professional ${style} logo design: ${prompt}. Clean, vector-style, suitable for business branding. High quality, simple background, modern aesthetic.`;

            const response = await fetch('https://api.openai.com/v1/images/generations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'dall-e-3',
                    prompt: enhancedPrompt,
                    n: 1,
                    size: '1024x1024',
                    quality: 'hd',
                    style: 'vivid'
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Failed to generate logo');
            }

            const data = await response.json();
            const imageUrl = data.data[0].url;

            // Increment usage
            await rateLimitService.incrementCount(userId, 'logo');

            // Save to database
            await supabase.from('generated_assets').insert({
                user_id: userId,
                asset_type: 'logo',
                prompt: prompt,
                url: imageUrl,
                metadata: { style, model: 'dall-e-3' },
                tenant_id: tenantService.getCurrentTenantId()
            });

            const newRemaining = await rateLimitService.getRemainingGenerations(userId, userRole, 'logo');

            return {
                success: true,
                url: imageUrl,
                remaining: newRemaining
            };
        } catch (error) {
            console.error('Logo generation error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to generate logo'
            };
        }
    }

    /**
     * Generate image using DALL-E 3 and store it permanently.
     */
    async generateImage(
        userId: string,
        userRole: string,
        prompt: string,
        size: '1024x1024' | '1792x1024' | '1024x1792' = '1024x1024',
        provider: 'openai' | 'xai' = 'openai'
    ): Promise<GenerationResult> {
        try {
            // 1. Generate via selected Provider
            let tempUrl = '';
            
            if (provider === 'xai' && process.env.XAI_API_KEY) {
                const response = await fetch('https://api.x.ai/v1/images/generations', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.XAI_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: 'grok-2-latest', // Or the current supported image model
                        prompt: prompt,
                        n: 1,
                        size: size
                    })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    tempUrl = data.data[0].url;
                }
            }
            
            // Fallback to OpenAI if xAI failed or wasn't chosen
            if (!tempUrl) {
                const response = await fetch('https://api.openai.com/v1/images/generations', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.OPENAI_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: 'dall-e-3',
                        prompt: prompt,
                        n: 1,
                        size: size,
                        quality: 'hd'
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    const msg = error.error?.message || 'Failed to generate image';
                    const code = error.error?.code;
                    
                    if (code === 'billing_hard_limit_reached' || msg.toLowerCase().includes('billing')) {
                        throw new Error(`AI Billing Limit: The platform's OpenAI credits are exhausted. Please try using 'xai' provider or contact support to top up.`);
                    }
                    throw new Error(msg);
                }

                const data = await response.json();
                tempUrl = data.data[0].url;
            }

            // 2. Download and Store in Supabase (Permanent Storage)
            const imgRes = await fetch(tempUrl);
            const arrayBuffer = await imgRes.arrayBuffer();
            const fileName = `generated/${userId}/${Date.now()}.png`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('social-assets')
                .upload(fileName, arrayBuffer, {
                    contentType: 'image/png',
                    cacheControl: '3600'
                });

            if (uploadError) {
                // If bucket doesn't exist, fallback to 'uploads' or just use tempUrl
                console.warn('Storage upload failed, falling back to temp URL:', uploadError);
            }

            const finalUrl = uploadData 
                ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/social-assets/${fileName}`
                : tempUrl;

            // 3. Increment usage
            await rateLimitService.incrementCount(userId, 'image');

            // 4. Save to database
            await supabase.from('generated_assets').insert({
                user_id: userId,
                asset_type: 'image',
                prompt: prompt,
                url: finalUrl,
                metadata: { size, model: 'dall-e-3', openai_temp_url: tempUrl },
                tenant_id: tenantService.getCurrentTenantId(),
                storage_path: fileName,
                bucket_id: 'social-assets'
            });

            const newRemaining = await rateLimitService.getRemainingGenerations(userId, userRole, 'image');

            return {
                success: true,
                url: finalUrl,
                remaining: newRemaining
            };
        } catch (error) {
            console.error('Image generation error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to generate image'
            };
        }
    }

    /**
     * Generate content using Secure Server-side Proxy
     */
    async generateContent(
        userId: string,
        userRole: string,
        prompt: string,
        type: 'blog' | 'email' | 'social' | 'general' = 'general',
        model: string = 'claude-sonnet-4-5-20250929'
    ): Promise<GenerationResult> {
        try {
            const systemPrompts = {
                blog: 'You are a professional blog writer. Create engaging, SEO-optimized content with clear structure and compelling narrative.',
                email: 'You are an email marketing expert. Write compelling, conversion-focused emails with clear CTAs.',
                social: 'You are a social media manager. Create engaging, platform-optimized posts that drive engagement.',
                general: 'You are a professional content writer. Create high-quality, engaging content tailored to the request.'
            };

            // Call the secure server-side AI proxy
            const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt,
                    systemPrompt: systemPrompts[type],
                    model,
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate content');
            }

            const data = await response.json();
            const content = data.text;

            // Increment usage
            await rateLimitService.incrementCount(userId, 'content');

            // Save to database
            await supabase.from('generated_assets').insert({
                user_id: userId,
                asset_type: 'content',
                prompt: prompt,
                metadata: { type, model, content },
                tenant_id: tenantService.getCurrentTenantId()
            });

            const newRemaining = await rateLimitService.getRemainingGenerations(userId, userRole, 'content');

            return {
                success: true,
                content: content,
                remaining: newRemaining
            };
        } catch (error) {
            console.error('Content generation error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to generate content'
            };
        }
    }

    /**
     * Get user's generation history
     */
    async getGenerationHistory(userId: string, limit: number = 20) {
        try {
            const { data, error } = await supabase
                .from('generated_assets')
                .select('*')
                .eq('user_id', userId)
                .eq('tenant_id', tenantService.getCurrentTenantId())
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) {
                console.error('Get history error:', error);
                return { assets: [], error: error.message };
            }

            return { assets: data || [], error: null };
        } catch (err) {
            console.error('Get history error:', err);
            return { assets: [], error: 'Failed to load history' };
        }
    }

    /**
     * Delete generated asset
     */
    async deleteAsset(assetId: string, userId: string) {
        try {
            const { error } = await supabase
                .from('generated_assets')
                .delete()
                .eq('id', assetId)
                .eq('user_id', userId)
                .eq('tenant_id', tenantService.getCurrentTenantId());

            if (error) {
                console.error('Delete asset error:', error);
                return { success: false, error: error.message };
            }

            return { success: true, error: null };
        } catch (err) {
            console.error('Delete asset error:', err);
            return { success: false, error: 'Failed to delete asset' };
        }
    }
}

export const aiGenerationService = new AIGenerationService();

