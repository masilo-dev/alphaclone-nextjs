# Complete Business OS Implementation Plan

## 🎯 CRITICAL FIXES + NEW FEATURES

### CRITICAL FIXES (Priority 1)
1. ✅ Portfolio Editor - Image upload timeout/failure
2. ✅ Invoice Creation - Stuck on "creating"
3. ✅ Onboarding Pipelines - Static page not working
4. ✅ Resource Allocation - Page not working
5. ✅ Calendar UX - Hard to read, improve visibility
6. ✅ Update CalendarTab - Use new meeting adapter
7. ✅ Update ConferenceTab - Use new meeting adapter

### AI STUDIO FEATURES (Priority 2)
8. ✅ AI Studio - Full generation capabilities
   - Image generation (DALL-E 3 or Stable Diffusion)
   - Logo generation
   - Content generation (Claude)
   - Design suggestions

9. ✅ Logo Generation - Admin dashboard feature
   - Professional logo generation
   - Multiple style options
   - SVG export
   - Brand color suggestions

10. ✅ Rate Limiting - Client usage limits
    - 3 generations per day for clients
    - Unlimited for admin
    - Usage tracking in database
    - Reset at midnight

### AI INTEGRATIONS (Priority 3)
11. ✅ Claude API Service - Base layer
12. ✅ Sales Agent AI - Lead insights, email drafting
13. ✅ Leads Agent AI - Scoring, qualification
14. ✅ Contract Generation AI - Auto-generate from deals
15. ✅ Email Campaigns - With SendGrid + AI

---

## 📊 DATABASE SCHEMA

### Rate Limiting Table
```sql
CREATE TABLE IF NOT EXISTS public.generation_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    generation_type VARCHAR(50) NOT NULL, -- 'logo', 'image', 'content'
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(user_id, generation_type, date)
);

CREATE INDEX idx_generation_usage_user_date ON public.generation_usage(user_id, date);
CREATE INDEX idx_generation_usage_type ON public.generation_usage(generation_type);

-- Function to check rate limit
CREATE OR REPLACE FUNCTION check_generation_limit(
    p_user_id UUID,
    p_generation_type VARCHAR,
    p_user_role VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Admin has unlimited
    IF p_user_role = 'admin' THEN
        RETURN TRUE;
    END IF;

    -- Get today's count
    SELECT COALESCE(count, 0) INTO v_count
    FROM public.generation_usage
    WHERE user_id = p_user_id
    AND generation_type = p_generation_type
    AND date = CURRENT_DATE;

    -- Client limit: 3 per day
    RETURN v_count < 3;
END;
$$ LANGUAGE plpgsql;

-- Function to increment generation count
CREATE OR REPLACE FUNCTION increment_generation_count(
    p_user_id UUID,
    p_generation_type VARCHAR
) RETURNS INTEGER AS $$
DECLARE
    v_new_count INTEGER;
BEGIN
    INSERT INTO public.generation_usage (user_id, generation_type, date, count)
    VALUES (p_user_id, p_generation_type, CURRENT_DATE, 1)
    ON CONFLICT (user_id, generation_type, date)
    DO UPDATE SET
        count = generation_usage.count + 1,
        updated_at = NOW()
    RETURNING count INTO v_new_count;

    RETURN v_new_count;
END;
$$ LANGUAGE plpgsql;
```

### Generated Assets Table
```sql
CREATE TABLE IF NOT EXISTS public.generated_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    asset_type VARCHAR(50) NOT NULL, -- 'logo', 'image', 'content'
    prompt TEXT NOT NULL,
    url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_generated_assets_user ON public.generated_assets(user_id);
CREATE INDEX idx_generated_assets_type ON public.generated_assets(asset_type);
```

---

## 🔧 IMPLEMENTATION

### 1. Rate Limiting Service

**File:** `services/rateLimitService.ts`

```typescript
import { supabase } from '../lib/supabase';

interface RateLimitCheck {
    allowed: boolean;
    remaining: number;
    limit: number;
    resetAt: Date;
}

class RateLimitService {
    private readonly CLIENT_DAILY_LIMIT = 3;

    async checkLimit(
        userId: string,
        userRole: string,
        generationType: 'logo' | 'image' | 'content'
    ): Promise<RateLimitCheck> {
        // Admin has unlimited
        if (userRole === 'admin') {
            return {
                allowed: true,
                remaining: 999,
                limit: 999,
                resetAt: this.getNextMidnight()
            };
        }

        // Check client limit
        const { data, error } = await supabase.rpc('check_generation_limit', {
            p_user_id: userId,
            p_generation_type: generationType,
            p_user_role: userRole
        });

        if (error) {
            console.error('Rate limit check error:', error);
            return { allowed: false, remaining: 0, limit: this.CLIENT_DAILY_LIMIT, resetAt: this.getNextMidnight() };
        }

        const allowed = data as boolean;

        // Get current count
        const { data: usageData } = await supabase
            .from('generation_usage')
            .select('count')
            .eq('user_id', userId)
            .eq('generation_type', generationType)
            .eq('date', new Date().toISOString().split('T')[0])
            .single();

        const currentCount = usageData?.count || 0;
        const remaining = Math.max(0, this.CLIENT_DAILY_LIMIT - currentCount);

        return {
            allowed,
            remaining,
            limit: this.CLIENT_DAILY_LIMIT,
            resetAt: this.getNextMidnight()
        };
    }

    async incrementCount(
        userId: string,
        generationType: 'logo' | 'image' | 'content'
    ): Promise<number> {
        const { data, error } = await supabase.rpc('increment_generation_count', {
            p_user_id: userId,
            p_generation_type: generationType
        });

        if (error) {
            console.error('Increment count error:', error);
            return 0;
        }

        return data as number;
    }

    async getRemainingGenerations(
        userId: string,
        userRole: string,
        generationType: 'logo' | 'image' | 'content'
    ): Promise<number> {
        if (userRole === 'admin') return 999;

        const { data } = await supabase
            .from('generation_usage')
            .select('count')
            .eq('user_id', userId)
            .eq('generation_type', generationType)
            .eq('date', new Date().toISOString().split('T')[0])
            .single();

        const currentCount = data?.count || 0;
        return Math.max(0, this.CLIENT_DAILY_LIMIT - currentCount);
    }

    private getNextMidnight(): Date {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow;
    }
}

export const rateLimitService = new RateLimitService();
```

---

### 2. AI Generation Service

**File:** `services/aiGenerationService.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { supabase } from '../lib/supabase';
import { rateLimitService } from './rateLimitService';

const anthropic = new Anthropic({
    apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY
});

const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true // Only for client-side, move to backend in production
});

interface GenerationResult {
    success: boolean;
    url?: string;
    content?: string;
    error?: string;
    remaining?: number;
}

class AIGenerationService {
    /**
     * Generate logo using DALL-E 3
     */
    async generateLogo(
        userId: string,
        userRole: string,
        prompt: string,
        style: 'modern' | 'minimalist' | 'vintage' | 'abstract' = 'modern'
    ): Promise<GenerationResult> {
        // Check rate limit
        const { allowed, remaining } = await rateLimitService.checkLimit(userId, userRole, 'logo');
        if (!allowed) {
            return {
                success: false,
                error: 'Daily generation limit reached (3/day). Resets at midnight.',
                remaining: 0
            };
        }

        try {
            const enhancedPrompt = `Professional ${style} logo: ${prompt}. Clean, vector-style, suitable for business branding. High quality, simple background.`;

            const response = await openai.images.generate({
                model: 'dall-e-3',
                prompt: enhancedPrompt,
                n: 1,
                size: '1024x1024',
                quality: 'hd',
                style: 'vivid'
            });

            const imageUrl = response.data[0].url;

            // Increment usage
            await rateLimitService.incrementCount(userId, 'logo');

            // Save to database
            await supabase.from('generated_assets').insert({
                user_id: userId,
                asset_type: 'logo',
                prompt: prompt,
                url: imageUrl,
                metadata: { style, model: 'dall-e-3' }
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
     * Generate image using DALL-E 3
     */
    async generateImage(
        userId: string,
        userRole: string,
        prompt: string,
        size: '1024x1024' | '1792x1024' | '1024x1792' = '1024x1024'
    ): Promise<GenerationResult> {
        // Check rate limit
        const { allowed, remaining } = await rateLimitService.checkLimit(userId, userRole, 'image');
        if (!allowed) {
            return {
                success: false,
                error: 'Daily generation limit reached (3/day). Resets at midnight.',
                remaining: 0
            };
        }

        try {
            const response = await openai.images.generate({
                model: 'dall-e-3',
                prompt: prompt,
                n: 1,
                size: size,
                quality: 'hd'
            });

            const imageUrl = response.data[0].url;

            // Increment usage
            await rateLimitService.incrementCount(userId, 'image');

            // Save to database
            await supabase.from('generated_assets').insert({
                user_id: userId,
                asset_type: 'image',
                prompt: prompt,
                url: imageUrl,
                metadata: { size, model: 'dall-e-3' }
            });

            const newRemaining = await rateLimitService.getRemainingGenerations(userId, userRole, 'image');

            return {
                success: true,
                url: imageUrl,
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
     * Generate content using Claude
     */
    async generateContent(
        userId: string,
        userRole: string,
        prompt: string,
        type: 'blog' | 'email' | 'social' | 'general' = 'general'
    ): Promise<GenerationResult> {
        // Check rate limit
        const { allowed, remaining } = await rateLimitService.checkLimit(userId, userRole, 'content');
        if (!allowed) {
            return {
                success: false,
                error: 'Daily generation limit reached (3/day). Resets at midnight.',
                remaining: 0
            };
        }

        try {
            const systemPrompts = {
                blog: 'You are a professional blog writer. Create engaging, SEO-optimized content.',
                email: 'You are an email marketing expert. Write compelling, conversion-focused emails.',
                social: 'You are a social media manager. Create engaging, platform-optimized posts.',
                general: 'You are a professional content writer. Create high-quality, engaging content.'
            };

            const response = await anthropic.messages.create({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 2048,
                system: systemPrompts[type],
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            });

            const content = response.content[0].text;

            // Increment usage
            await rateLimitService.incrementCount(userId, 'content');

            // Save to database
            await supabase.from('generated_assets').insert({
                user_id: userId,
                asset_type: 'content',
                prompt: prompt,
                metadata: { type, model: 'claude-3-5-sonnet', content }
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
        const { data, error } = await supabase
            .from('generated_assets')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Get history error:', error);
            return { assets: [], error: error.message };
        }

        return { assets: data || [], error: null };
    }
}

export const aiGenerationService = new AIGenerationService();
```

---

### 3. Enhanced AI Studio Component

**File:** `components/dashboard/AIStudioTab.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Wand2, Image, FileText, Sparkles, Download, Clock, AlertCircle } from 'lucide-react';
import { aiGenerationService } from '../../services/aiGenerationService';
import { rateLimitService } from '../../services/rateLimitService';
import { User } from '../../types';
import toast from 'react-hot-toast';

interface AIStudioTabProps {
    user: User;
}

const AIStudioTab: React.FC<AIStudioTabProps> = ({ user }) => {
    const [activeTab, setActiveTab] = useState<'logo' | 'image' | 'content'>('logo');
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedResult, setGeneratedResult] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [remaining, setRemaining] = useState({ logo: 3, image: 3, content: 3 });

    // Load remaining generations and history
    useEffect(() => {
        loadRemainingGenerations();
        loadHistory();
    }, []);

    const loadRemainingGenerations = async () => {
        const logoRemaining = await rateLimitService.getRemainingGenerations(user.id, user.role, 'logo');
        const imageRemaining = await rateLimitService.getRemainingGenerations(user.id, user.role, 'image');
        const contentRemaining = await rateLimitService.getRemainingGenerations(user.id, user.role, 'content');

        setRemaining({
            logo: logoRemaining,
            image: imageRemaining,
            content: contentRemaining
        });
    };

    const loadHistory = async () => {
        const { assets } = await aiGenerationService.getGenerationHistory(user.id, 20);
        setHistory(assets);
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            toast.error('Please enter a prompt');
            return;
        }

        setIsGenerating(true);
        setGeneratedResult(null);

        try {
            let result;

            switch (activeTab) {
                case 'logo':
                    result = await aiGenerationService.generateLogo(user.id, user.role, prompt, 'modern');
                    break;
                case 'image':
                    result = await aiGenerationService.generateImage(user.id, user.role, prompt);
                    break;
                case 'content':
                    result = await aiGenerationService.generateContent(user.id, user.role, prompt, 'general');
                    break;
            }

            if (result.success) {
                setGeneratedResult(result);
                toast.success('Generated successfully!');
                loadRemainingGenerations(); // Update remaining count
                loadHistory(); // Refresh history
            } else {
                toast.error(result.error || 'Generation failed');
            }
        } catch (error) {
            toast.error('Generation failed');
            console.error(error);
        } finally {
            setIsGenerating(false);
        }
    };

    const tabs = [
        { id: 'logo' as const, label: 'Logo Generator', icon: Sparkles },
        { id: 'image' as const, label: 'Image Generator', icon: Image },
        { id: 'content' as const, label: 'Content Writer', icon: FileText }
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-2">AI Studio</h2>
                    <p className="text-slate-400">Generate logos, images, and content with AI</p>
                </div>

                {/* Rate Limit Display for Clients */}
                {user.role !== 'admin' && (
                    <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-xl p-4">
                        <div className="flex items-center gap-2 text-orange-400 mb-2">
                            <Clock className="w-5 h-5" />
                            <span className="font-semibold">Daily Limit</span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <div className="text-2xl font-bold text-white">{remaining.logo}</div>
                                <div className="text-xs text-slate-400">Logos</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white">{remaining.image}</div>
                                <div className="text-xs text-slate-400">Images</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white">{remaining.content}</div>
                                <div className="text-xs text-slate-400">Content</div>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 mt-2 text-center">Resets at midnight</p>
                    </div>
                )}
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-slate-700">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-6 py-3 flex items-center gap-2 font-medium transition-colors border-b-2 ${
                            activeTab === tab.id
                                ? 'text-teal-400 border-teal-400'
                                : 'text-slate-400 border-transparent hover:text-white'
                        }`}
                    >
                        <tab.icon className="w-5 h-5" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Generation Interface */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Input Section */}
                <div className="glass-panel p-6 space-y-4">
                    <h3 className="text-xl font-bold text-white mb-4">
                        {activeTab === 'logo' && 'Describe Your Logo'}
                        {activeTab === 'image' && 'Describe Your Image'}
                        {activeTab === 'content' && 'What Do You Need?'}
                    </h3>

                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={
                            activeTab === 'logo'
                                ? 'e.g., Modern tech startup logo with blue and silver colors'
                                : activeTab === 'image'
                                ? 'e.g., Futuristic office space with holographic displays'
                                : 'e.g., Write a professional email introducing our new service'
                        }
                        className="w-full h-40 bg-slate-800 border border-slate-700 rounded-lg p-4 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 resize-none"
                        disabled={isGenerating}
                    />

                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !prompt.trim()}
                        className="w-full py-3 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-lg font-semibold hover:from-teal-500 hover:to-teal-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                        {isGenerating ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Wand2 className="w-5 h-5" />
                                Generate
                            </>
                        )}
                    </button>

                    {user.role !== 'admin' && remaining[activeTab] === 0 && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-red-400 font-semibold">Daily limit reached</p>
                                <p className="text-sm text-slate-400 mt-1">
                                    You've used all 3 {activeTab} generations today. Resets at midnight.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Result Section */}
                <div className="glass-panel p-6">
                    <h3 className="text-xl font-bold text-white mb-4">Result</h3>

                    {generatedResult ? (
                        <div className="space-y-4">
                            {(activeTab === 'logo' || activeTab === 'image') && generatedResult.url && (
                                <div className="relative">
                                    <img
                                        src={generatedResult.url}
                                        alt="Generated"
                                        className="w-full rounded-lg border border-slate-700"
                                    />
                                    <a
                                        href={generatedResult.url}
                                        download
                                        className="absolute top-4 right-4 p-2 bg-teal-600 hover:bg-teal-500 rounded-lg transition-colors"
                                    >
                                        <Download className="w-5 h-5 text-white" />
                                    </a>
                                </div>
                            )}

                            {activeTab === 'content' && generatedResult.content && (
                                <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                                    <pre className="text-white whitespace-pre-wrap font-sans">
                                        {generatedResult.content}
                                    </pre>
                                </div>
                            )}

                            {generatedResult.remaining !== undefined && user.role !== 'admin' && (
                                <p className="text-sm text-slate-400 text-center">
                                    {generatedResult.remaining} generations remaining today
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="h-64 border-2 border-dashed border-slate-700 rounded-lg flex items-center justify-center text-slate-500">
                            <div className="text-center">
                                <Wand2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p>Your generated content will appear here</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Generation History */}
            <div className="glass-panel p-6">
                <h3 className="text-xl font-bold text-white mb-4">Recent Generations</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {history.map(asset => (
                        <div
                            key={asset.id}
                            className="bg-slate-800 border border-slate-700 rounded-lg p-3 hover:border-teal-500 transition-colors cursor-pointer"
                            onClick={() => {
                                if (asset.url) {
                                    window.open(asset.url, '_blank');
                                }
                            }}
                        >
                            {asset.url && (
                                <img
                                    src={asset.url}
                                    alt={asset.prompt}
                                    className="w-full h-32 object-cover rounded mb-2"
                                />
                            )}
                            <p className="text-xs text-slate-400 truncate">{asset.prompt}</p>
                            <p className="text-xs text-slate-500 mt-1">
                                {new Date(asset.created_at).toLocaleDateString()}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AIStudioTab;
```

---

## 📦 REQUIRED PACKAGES

```bash
npm install @anthropic-ai/sdk openai browser-image-compression @sendgrid/mail
```

## 🔐 ENVIRONMENT VARIABLES

Add to `.env`:
```
VITE_ANTHROPIC_API_KEY=sk-ant-...
VITE_OPENAI_API_KEY=sk-...
SENDGRID_API_KEY=SG....
```

---

## ✅ DEPLOYMENT CHECKLIST

1. [ ] Run database migration for rate limiting tables
2. [ ] Install npm packages
3. [ ] Add API keys to environment
4. [ ] Deploy AI Studio component
5. [ ] Test rate limiting (3 generations/day for clients)
6. [ ] Test all generation types (logo, image, content)
7. [ ] Verify admin has unlimited access

**Status:** Ready to implement
**Features:** Complete Business OS with AI Studio + Rate Limiting
