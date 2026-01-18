import { z } from 'zod';

/**
 * Authentication Schemas
 */
export const signUpSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    name: z.string()
        .min(2, 'Name must be at least 2 characters')
        .max(100, 'Name must be less than 100 characters')
        .regex(/^[a-zA-Z\s'-]+$/, 'Name contains invalid characters'),
});

export const signInSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
});

/**
 * Project Schemas
 */
export const projectSchema = z.object({
    name: z.string()
        .min(3, 'Project name must be at least 3 characters')
        .max(100, 'Project name must be less than 100 characters'),
    category: z.string().min(1, 'Category is required'),
    description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
    image: z.string().url('Invalid image URL').optional(),
    dueDate: z.string().optional(),
});

export const projectUpdateSchema = z.object({
    name: z.string().min(3).max(100).optional(),
    category: z.string().optional(),
    status: z.enum(['Active', 'Pending', 'Completed', 'Declined']).optional(),
    currentStage: z.enum(['Discovery', 'Design', 'Development', 'Testing', 'Deployment', 'Maintenance']).optional(),
    progress: z.number().min(0).max(100).optional(),
    description: z.string().max(1000).optional(),
});

/**
 * Message Schemas
 */
export const messageSchema = z.object({
    text: z.string()
        .min(1, 'Message cannot be empty')
        .max(5000, 'Message must be less than 5000 characters'),
    recipientId: z.string().uuid().optional(),
});

/**
 * Contact Form Schema
 */
export const contactSchema = z.object({
    name: z.string()
        .min(2, 'Name must be at least 2 characters')
        .max(100, 'Name must be less than 100 characters'),
    email: z.string().email('Invalid email format'),
    message: z.string()
        .min(10, 'Message must be at least 10 characters')
        .max(2000, 'Message must be less than 2000 characters'),
});

/**
 * Type exports
 */
export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
export type MessageInput = z.infer<typeof messageSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
