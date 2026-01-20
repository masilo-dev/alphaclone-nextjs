import { supabase } from '../lib/supabase';

/**
 * Rate Limiting Service
 *
 * Manages AI generation limits:
 * - Clients: 3 generations per day per type
 * - Admins: Unlimited
 * - Resets: Midnight daily
 */

export interface RateLimitCheck {
    allowed: boolean;
    remaining: number;
    limit: number;
    resetAt: Date;
}

class RateLimitService {
    private readonly CLIENT_DAILY_LIMIT = 3;

    /**
     * Check if user can generate (rate limit check)
     */
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

        try {
            // Check via database function
            const { data, error } = await supabase.rpc('check_generation_limit', {
                p_user_id: userId,
                p_generation_type: generationType,
                p_user_role: userRole
            });

            if (error) {
                console.error('Rate limit check error:', error);
                return {
                    allowed: false,
                    remaining: 0,
                    limit: this.CLIENT_DAILY_LIMIT,
                    resetAt: this.getNextMidnight()
                };
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
        } catch (err) {
            console.error('Rate limit check error:', err);
            return {
                allowed: false,
                remaining: 0,
                limit: this.CLIENT_DAILY_LIMIT,
                resetAt: this.getNextMidnight()
            };
        }
    }

    /**
     * Increment generation count for user
     */
    async incrementCount(
        userId: string,
        generationType: 'logo' | 'image' | 'content'
    ): Promise<number> {
        try {
            const { data, error } = await supabase.rpc('increment_generation_count', {
                p_user_id: userId,
                p_generation_type: generationType
            });

            if (error) {
                console.error('Increment count error:', error);
                return 0;
            }

            return data as number;
        } catch (err) {
            console.error('Increment count error:', err);
            return 0;
        }
    }

    /**
     * Get remaining generations for user today
     */
    async getRemainingGenerations(
        userId: string,
        userRole: string,
        generationType: 'logo' | 'image' | 'content'
    ): Promise<number> {
        // Admin has unlimited
        if (userRole === 'admin') return 999;

        try {
            const { data, error } = await supabase.rpc('get_remaining_generations', {
                p_user_id: userId,
                p_generation_type: generationType,
                p_user_role: userRole
            });

            if (error) {
                console.error('Get remaining error:', error);
                return 0;
            }

            return data as number;
        } catch (err) {
            console.error('Get remaining error:', err);
            return 0;
        }
    }

    /**
     * Get usage stats for user
     */
    async getUsageStats(userId: string, date?: string): Promise<{
        logo: number;
        image: number;
        content: number;
    }> {
        const targetDate = date || new Date().toISOString().split('T')[0];

        try {
            const { data, error } = await supabase
                .from('generation_usage')
                .select('generation_type, count')
                .eq('user_id', userId)
                .eq('date', targetDate);

            if (error) {
                console.error('Get usage stats error:', error);
                return { logo: 0, image: 0, content: 0 };
            }

            const stats = { logo: 0, image: 0, content: 0 };
            data?.forEach((item: any) => {
                if (item.generation_type in stats) {
                    stats[item.generation_type as keyof typeof stats] = item.count;
                }
            });

            return stats;
        } catch (err) {
            console.error('Get usage stats error:', err);
            return { logo: 0, image: 0, content: 0 };
        }
    }

    /**
     * Get next midnight (when limits reset)
     */
    private getNextMidnight(): Date {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow;
    }

    /**
     * Format time until reset
     */
    getTimeUntilReset(): string {
        const now = new Date();
        const midnight = this.getNextMidnight();
        const diff = midnight.getTime() - now.getTime();

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        return `${hours}h ${minutes}m`;
    }
}

export const rateLimitService = new RateLimitService();
