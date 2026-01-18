/**
 * Documentation Service
 * Manages API documentation, component docs, and user guides
 */

import { supabase } from '../lib/supabase';

export interface DocumentationPage {
    id: string;
    title: string;
    content: string;
    category: 'api' | 'component' | 'guide' | 'tutorial';
    slug: string;
    tags: string[];
    author: string;
    createdAt: string;
    updatedAt: string;
    version?: string;
}

export interface APIDocumentation {
    endpoint: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    description: string;
    parameters?: Array<{
        name: string;
        type: string;
        required: boolean;
        description: string;
        example?: any;
    }>;
    responses: Array<{
        status: number;
        description: string;
        schema?: any;
    }>;
    examples?: Array<{
        language: string;
        code: string;
    }>;
}

export const documentationService = {
    /**
     * Generate OpenAPI/Swagger documentation
     */
    generateOpenAPISpec(): any {
        return {
            openapi: '3.0.0',
            info: {
                title: 'AlphaClone Systems API',
                version: '1.0.0',
                description: 'RESTful API for AlphaClone Systems platform',
            },
            servers: [
                {
                    url: 'https://alphaclone.tech/api/public/v1',
                    description: 'Production server',
                },
            ],
            paths: {
                '/projects': {
                    get: {
                        summary: 'Get projects',
                        description: 'Retrieve list of projects for authenticated user',
                        security: [{ ApiKeyAuth: [] }],
                        responses: {
                            '200': {
                                description: 'Successful response',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            properties: {
                                                data: {
                                                    type: 'array',
                                                    items: { $ref: '#/components/schemas/Project' },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                '/invoices': {
                    get: {
                        summary: 'Get invoices',
                        description: 'Retrieve list of invoices for authenticated user',
                        security: [{ ApiKeyAuth: [] }],
                        responses: {
                            '200': {
                                description: 'Successful response',
                            },
                        },
                    },
                },
            },
            components: {
                securitySchemes: {
                    ApiKeyAuth: {
                        type: 'apiKey',
                        in: 'header',
                        name: 'X-API-Key',
                    },
                },
                schemas: {
                    Project: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            name: { type: 'string' },
                            status: { type: 'string' },
                            progress: { type: 'number' },
                            category: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' },
                        },
                    },
                },
            },
        };
    },

    /**
     * Save documentation page
     */
    async saveDocumentationPage(
        page: Omit<DocumentationPage, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<{ page: DocumentationPage | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('documentation_pages')
                .insert({
                    title: page.title,
                    content: page.content,
                    category: page.category,
                    slug: page.slug,
                    tags: page.tags,
                    author: page.author,
                    version: page.version,
                })
                .select()
                .single();

            if (error) throw error;

            return {
                page: {
                    id: data.id,
                    title: data.title,
                    content: data.content,
                    category: data.category,
                    slug: data.slug,
                    tags: data.tags || [],
                    author: data.author,
                    createdAt: data.created_at,
                    updatedAt: data.updated_at,
                    version: data.version,
                },
                error: null,
            };
        } catch (error) {
            return {
                page: null,
                error: error instanceof Error ? error.message : 'Failed to save documentation',
            };
        }
    },

    /**
     * Get documentation page by slug
     */
    async getDocumentationPage(slug: string): Promise<{ page: DocumentationPage | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('documentation_pages')
                .select('*')
                .eq('slug', slug)
                .single();

            if (error) throw error;

            return {
                page: {
                    id: data.id,
                    title: data.title,
                    content: data.content,
                    category: data.category,
                    slug: data.slug,
                    tags: data.tags || [],
                    author: data.author,
                    createdAt: data.created_at,
                    updatedAt: data.updated_at,
                    version: data.version,
                },
                error: null,
            };
        } catch (error) {
            return {
                page: null,
                error: error instanceof Error ? error.message : 'Failed to fetch documentation',
            };
        }
    },

    /**
     * Search documentation
     */
    async searchDocumentation(query: string): Promise<{ pages: DocumentationPage[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('documentation_pages')
                .select('*')
                .or(`title.ilike.%${query}%,content.ilike.%${query}%,tags.cs.{${query}}`)
                .order('updated_at', { ascending: false });

            if (error) throw error;

            return {
                pages: (data || []).map((p: any) => ({
                    id: p.id,
                    title: p.title,
                    content: p.content,
                    category: p.category,
                    slug: p.slug,
                    tags: p.tags || [],
                    author: p.author,
                    createdAt: p.created_at,
                    updatedAt: p.updated_at,
                    version: p.version,
                })),
                error: null,
            };
        } catch (error) {
            return {
                pages: [],
                error: error instanceof Error ? error.message : 'Search failed',
            };
        }
    },
};

