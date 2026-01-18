import { z } from 'zod';

/**
 * Validation schemas for API endpoints
 */

// Stripe Payment Intent Request
export const stripePaymentSchema = z.object({
    invoiceId: z.string().uuid(),
    amount: z.number().positive().max(999999),
    currency: z.string().length(3).default('usd')
});

/**
 * Validates request body against a Zod schema
 */
export function validateRequest<T>(
    schema: z.ZodSchema<T>,
    data: unknown
): { success: true; data: T } | { success: false; error: string } {
    try {
        const validated = schema.parse(data);
        return { success: true, data: validated };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const issues = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);
            return {
                success: false,
                error: `Validation failed: ${issues.join(', ')}`
            };
        }
        return {
            success: false,
            error: 'Invalid request data'
        };
    }
}

