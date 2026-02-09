import { NextResponse } from 'next/server';

/**
 * OpenAPI/Swagger documentation endpoint
 * Serves interactive API documentation
 */

const openApiSpec = {
    openapi: '3.0.0',
    info: {
        title: 'AlphaClone API',
        version: '1.0.0',
        description: 'Complete Business Operating System API',
        contact: {
            name: 'API Support',
            email: 'api@alphaclone.com',
            url: 'https://alphaclone.com/support',
        },
        license: {
            name: 'Proprietary',
            url: 'https://alphaclone.com/terms',
        },
    },
    servers: [
        {
            url: 'https://alphaclone.com/api',
            description: 'Production server',
        },
        {
            url: 'https://staging.alphaclone.com/api',
            description: 'Staging server',
        },
        {
            url: 'http://localhost:3000/api',
            description: 'Development server',
        },
    ],
    components: {
        securitySchemes: {
            apiKey: {
                type: 'apiKey',
                in: 'header',
                name: 'X-API-Key',
                description: 'API key for authentication',
            },
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
            },
        },
        schemas: {
            Project: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    status: { type: 'string', enum: ['Active', 'Pending', 'Completed', 'Archived'] },
                    tenant_id: { type: 'string', format: 'uuid' },
                    created_by: { type: 'string', format: 'uuid' },
                    created_at: { type: 'string', format: 'date-time' },
                    updated_at: { type: 'string', format: 'date-time' },
                },
            },
            Invoice: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    tenant_id: { type: 'string', format: 'uuid' },
                    invoice_number: { type: 'string' },
                    client_id: { type: 'string', format: 'uuid' },
                    amount: { type: 'number' },
                    status: { type: 'string', enum: ['Pending', 'Paid', 'Overdue', 'Cancelled'] },
                    due_date: { type: 'string', format: 'date' },
                    created_at: { type: 'string', format: 'date-time' },
                },
            },
            Error: {
                type: 'object',
                properties: {
                    error: { type: 'string' },
                    message: { type: 'string' },
                    code: { type: 'string' },
                },
            },
        },
    },
    paths: {
        '/health': {
            get: {
                summary: 'Health check',
                description: 'Check API and system health',
                tags: ['System'],
                responses: {
                    '200': {
                        description: 'System is healthy',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string' },
                                        timestamp: { type: 'string' },
                                        checks: { type: 'object' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/projects': {
            get: {
                summary: 'List projects',
                description: 'Get all projects for the authenticated tenant',
                tags: ['Projects'],
                security: [{ apiKey: [] }, { bearerAuth: [] }],
                parameters: [
                    {
                        name: 'status',
                        in: 'query',
                        schema: { type: 'string' },
                        description: 'Filter by status',
                    },
                    {
                        name: 'limit',
                        in: 'query',
                        schema: { type: 'integer', default: 50 },
                        description: 'Number of results to return',
                    },
                    {
                        name: 'offset',
                        in: 'query',
                        schema: { type: 'integer', default: 0 },
                        description: 'Pagination offset',
                    },
                ],
                responses: {
                    '200': {
                        description: 'List of projects',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        data: {
                                            type: 'array',
                                            items: { $ref: '#/components/schemas/Project' },
                                        },
                                        total: { type: 'integer' },
                                        limit: { type: 'integer' },
                                        offset: { type: 'integer' },
                                    },
                                },
                            },
                        },
                    },
                    '401': {
                        description: 'Unauthorized',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Error' },
                            },
                        },
                    },
                },
            },
            post: {
                summary: 'Create project',
                description: 'Create a new project',
                tags: ['Projects'],
                security: [{ apiKey: [] }, { bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['name'],
                                properties: {
                                    name: { type: 'string' },
                                    description: { type: 'string' },
                                    status: { type: 'string', default: 'Active' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '201': {
                        description: 'Project created',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Project' },
                            },
                        },
                    },
                    '400': {
                        description: 'Bad request',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Error' },
                            },
                        },
                    },
                },
            },
        },
        '/projects/{id}': {
            get: {
                summary: 'Get project',
                description: 'Get a single project by ID',
                tags: ['Projects'],
                security: [{ apiKey: [] }, { bearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string', format: 'uuid' },
                    },
                ],
                responses: {
                    '200': {
                        description: 'Project details',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Project' },
                            },
                        },
                    },
                    '404': {
                        description: 'Project not found',
                    },
                },
            },
            patch: {
                summary: 'Update project',
                description: 'Update project details',
                tags: ['Projects'],
                security: [{ apiKey: [] }, { bearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string', format: 'uuid' },
                    },
                ],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    description: { type: 'string' },
                                    status: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '200': {
                        description: 'Project updated',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Project' },
                            },
                        },
                    },
                },
            },
            delete: {
                summary: 'Delete project',
                description: 'Delete a project',
                tags: ['Projects'],
                security: [{ apiKey: [] }, { bearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string', format: 'uuid' },
                    },
                ],
                responses: {
                    '204': { description: 'Project deleted' },
                    '404': { description: 'Project not found' },
                },
            },
        },
        '/invoices': {
            get: {
                summary: 'List invoices',
                description: 'Get all invoices for the authenticated tenant',
                tags: ['Invoices'],
                security: [{ apiKey: [] }, { bearerAuth: [] }],
                parameters: [
                    {
                        name: 'status',
                        in: 'query',
                        schema: { type: 'string' },
                        description: 'Filter by status',
                    },
                ],
                responses: {
                    '200': {
                        description: 'List of invoices',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        data: {
                                            type: 'array',
                                            items: { $ref: '#/components/schemas/Invoice' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/analytics': {
            get: {
                summary: 'Get analytics',
                description: 'Get analytics data for the tenant',
                tags: ['Analytics'],
                security: [{ apiKey: [] }, { bearerAuth: [] }],
                parameters: [
                    {
                        name: 'period',
                        in: 'query',
                        schema: { type: 'string', enum: ['7d', '30d', '90d', '1y'] },
                        description: 'Time period for analytics',
                    },
                ],
                responses: {
                    '200': {
                        description: 'Analytics data',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        revenue: { type: 'object' },
                                        projects: { type: 'object' },
                                        users: { type: 'object' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
    tags: [
        { name: 'System', description: 'System operations' },
        { name: 'Projects', description: 'Project management' },
        { name: 'Invoices', description: 'Invoice management' },
        { name: 'Analytics', description: 'Analytics and reporting' },
        { name: 'Webhooks', description: 'Webhook management' },
    ],
};

export async function GET() {
    return NextResponse.json(openApiSpec);
}
