import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';
import { rateLimitService } from './rateLimitService';

const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';

/**
 * AI Generation Service
 *
 * Handles AI-powered content generation:
 * - Logo generation (OpenAI GPT Image)
 * - Image generation (OpenAI GPT Image)
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
     * Generate logo using OpenAI GPT Image
     */
    async generateLogo(
        userId: string,
        userRole: string,
        prompt: string,
        style: 'modern' | 'minimalist' | 'vintage' | 'abstract' = 'modern'
    ): Promise<GenerationResult> {
        try {
            const enhancedPrompt = `Professional ${style} logo design: ${prompt}. Clean, vector-style, suitable for business branding. High quality, simple background, modern aesthetic.`;

            if (typeof window !== 'undefined') {
                const tenantId = tenantService.getCurrentTenantId();
                if (!tenantId) throw new Error('Select a workspace before generating a logo');
                const response = await fetch('/api/ai/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, prompt: enhancedPrompt, size: '1024x1024', provider: 'openai', assetType: 'logo', metadata: { style } }) });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok || !payload.url) throw new Error(payload.error || 'Failed to generate logo');
                return { success: true, url: payload.url, remaining: payload.freeUsage?.remaining ?? undefined };
            }

            const response = await fetch('https://api.openai.com/v1/images/generations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: OPENAI_IMAGE_MODEL,
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
                metadata: { style, model: OPENAI_IMAGE_MODEL },
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
<<<<<<< HEAD
     * Generate image using OpenAI GPT Image and store it permanently.
=======
     * Generate image using DALL-E 3 and store it permanently.
>>>>>>> d657f822 (feat: implement Autonomous Business Operator suite with Grok, Claude, and OpenAI strengths-based routing)
     */
    async generateImage(
        userId: string,
        userRole: string,
        prompt: string,
        size: '1024x1024' | '1792x1024' | '1024x1792' = '1024x1024',
        provider: 'openai' | 'xai' = 'openai'
    ): Promise<GenerationResult> {
        try {
<<<<<<< HEAD
            if (typeof window !== 'undefined') {
                const tenantId = tenantService.getCurrentTenantId();
                if (!tenantId) throw new Error('Select a workspace before generating an image');
                const response = await fetch('/api/ai/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, prompt, size, provider, assetType: 'image' }) });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok || !payload.url) throw new Error(payload.error || 'Failed to generate image');
                return { success: true, url: payload.url, remaining: payload.freeUsage?.remaining ?? undefined };
            }

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
                        model: OPENAI_IMAGE_MODEL,
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

=======
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
                    throw new Error(error.error?.message || 'Failed to generate image');
                }

                const data = await response.json();
                tempUrl = data.data[0].url;
            }

            // 2. Download and Store in Supabase (Permanent Storage)
            const imgRes = await fetch(tempUrl);
            const arrayBuffer = await imgRes.arrayBuffer();
            const fileName = `generated/${userId}/${Date.now()}.png`;

>>>>>>> d657f822 (feat: implement Autonomous Business Operator suite with Grok, Claude, and OpenAI strengths-based routing)
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('social-assets')
                .upload(fileName, arrayBuffer, {
                    contentType: 'image/png',
                    cacheControl: '3600'
                });

<<<<<<< HEAD
            if (uploadError || !uploadData) throw new Error(uploadError?.message || 'Generated image could not be stored permanently');

            const finalUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/social-assets/${fileName}`;
=======
            if (uploadError) {
                // If bucket doesn't exist, fallback to 'uploads' or just use tempUrl
                console.warn('Storage upload failed, falling back to temp URL:', uploadError);
            }

            const finalUrl = uploadData 
                ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/social-assets/${fileName}`
                : tempUrl;
>>>>>>> d657f822 (feat: implement Autonomous Business Operator suite with Grok, Claude, and OpenAI strengths-based routing)

            // 3. Increment usage
            await rateLimitService.incrementCount(userId, 'image');

            // 4. Save to database
            await supabase.from('generated_assets').insert({
                user_id: userId,
                asset_type: 'image',
                prompt: prompt,
                url: finalUrl,
<<<<<<< HEAD
                metadata: { size, model: OPENAI_IMAGE_MODEL, openai_temp_url: tempUrl },
=======
                metadata: { size, model: 'dall-e-3', openai_temp_url: tempUrl },
>>>>>>> d657f822 (feat: implement Autonomous Business Operator suite with Grok, Claude, and OpenAI strengths-based routing)
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
                    tenantId: tenantService.getCurrentTenantId(),
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate content');
            }

            const data = await response.json();
            const content = data.text;

            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) throw new Error('Select a workspace before saving generated content');
            const saveResponse = await fetch(`/api/tenant/${tenantId}/generated-assets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetType: 'content', prompt, content, metadata: { type, model } }) });
            const savePayload = await saveResponse.json().catch(() => ({}));
            if (!saveResponse.ok) throw new Error(savePayload.error || 'Generated content could not be saved');

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
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) throw new Error('Select a workspace to view generation history');
            const response = await fetch(`/api/tenant/${tenantId}/generated-assets?limit=${Math.min(Math.max(limit, 1), 100)}`, { cache: 'no-store' });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Generation history could not be loaded');
            return { assets: payload.assets || [], error: null };
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
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) throw new Error('Select a workspace before deleting an asset');
            const response = await fetch(`/api/tenant/${tenantId}/generated-assets?assetId=${encodeURIComponent(assetId)}`, { method: 'DELETE' });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Generated asset could not be deleted');
            return { success: true, error: null };
        } catch (err) {
            console.error('Delete asset error:', err);
            return { success: false, error: 'Failed to delete asset' };
        }
    }
}

export const aiGenerationService = new AIGenerationService();
