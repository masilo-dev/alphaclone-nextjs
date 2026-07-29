// @ts-nocheck
import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { callClaudeWithFile, uploadFileToAnthropic } from '@/services/ai/filesApiService';

// ── send_document_to_claude ───────────────────────────────────────────────────
registerTool('documents', {
  name: 'send_document_to_claude',
  description:
    'Sends a contract, invoice, or generated document from the AlphaClone workspace directly to Claude for analysis, summarization, or Q&A — without any token or length limit. Fetches the document from Supabase storage or by ID, uploads it to the Anthropic Files API, and calls Claude with your question.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    document_type: z.enum(['contract', 'invoice', 'quote', 'file']),
    document_id: z.string(),
    question: z.string().min(1),
    system_prompt: z.string().optional(),
    model: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      document_type: {
        type: 'string',
        enum: ['contract', 'invoice', 'quote', 'file'],
        description: 'Type of document to retrieve from the workspace',
      },
      document_id: { type: 'string', description: 'UUID of the contract, invoice, quote, or file' },
      question: { type: 'string', description: 'What you want Claude to do with or answer about the document' },
      system_prompt: { type: 'string', description: 'Optional custom system prompt for Claude' },
      model: { type: 'string', description: 'Optional Claude model override (default: claude-sonnet-4-20250514)' },
    },
    required: ['tenant_id', 'document_type', 'document_id', 'question'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();

    // 1. Fetch document content from DB
    let documentContent = '';
    let documentTitle = args.document_id;
    let mimeType = 'text/plain';

    if (args.document_type === 'contract') {
      const { data, error } = await supabase
        .from('contracts')
        .select('title, content, pdf_url, status, created_at, parties')
        .eq('id', args.document_id)
        .eq('tenant_id', args.tenant_id)
        .single();
      if (error) throw new Error(`Contract not found: ${error.message}`);
      documentTitle = data.title || 'Contract';
      documentContent = typeof data.content === 'string'
        ? data.content
        : JSON.stringify(data, null, 2);
    } else if (args.document_type === 'invoice') {
      const { data, error } = await supabase
        .from('business_invoices')
        .select('invoice_number, status, total_amount, currency, issued_date, due_date, line_items, notes, client:client_id(name, email)')
        .eq('id', args.document_id)
        .eq('tenant_id', args.tenant_id)
        .single();
      if (error) throw new Error(`Invoice not found: ${error.message}`);
      documentTitle = `Invoice ${data.invoice_number || args.document_id}`;
      documentContent = JSON.stringify(data, null, 2);
    } else if (args.document_type === 'quote') {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', args.document_id)
        .eq('tenant_id', args.tenant_id)
        .single();
      if (error) throw new Error(`Quote not found: ${error.message}`);
      documentTitle = `Quote ${data.quote_number || args.document_id}`;
      documentContent = JSON.stringify(data, null, 2);
    } else {
      // Generic file from file_uploads
      const { data, error } = await supabase
        .from('file_uploads')
        .select('original_filename, filename, storage_path, file_type, file_size')
        .eq('id', args.document_id)
        .eq('tenant_id', args.tenant_id)
        .single();
      if (error) throw new Error(`File not found: ${error.message}`);
      documentTitle = data.original_filename || data.filename || 'Document';
      mimeType = data.file_type || 'application/pdf';

      if (data.storage_path) {
        const { data: blob, error: downloadError } = await supabase.storage.from('uploads').download(data.storage_path);
        if (downloadError) throw new Error(`Could not download file: ${downloadError.message}`);
        const buf = Buffer.from(await blob.arrayBuffer());
        const uploaded = await uploadFileToAnthropic(buf, documentTitle, mimeType);
        const answer = await callClaudeWithFile({
          fileId: uploaded.id,
          filename: documentTitle,
          mimeType,
          userMessage: args.question,
          systemPrompt: args.system_prompt || 'You are an expert business document analyst for AlphaClone Systems. Be concise, accurate, and professionally helpful.',
          model: args.model,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify({ document: documentTitle, answer }, null, 2) }],
        };
      }
      documentContent = `[File: ${documentTitle} — could not fetch content directly]`;
    }

    // 2. Upload text content as a plain text file to Anthropic Files API
    const uploaded = await uploadFileToAnthropic(documentContent, `${documentTitle}.txt`, 'text/plain');

    // 3. Call Claude with the uploaded file
    const answer = await callClaudeWithFile({
      fileId: uploaded.id,
      filename: documentTitle,
      mimeType: 'text/plain',
      userMessage: args.question,
      systemPrompt: args.system_prompt || 'You are an expert business document analyst for AlphaClone Systems. Be concise, accurate, and professionally helpful.',
      model: args.model,
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          document_type: args.document_type,
          document_title: documentTitle,
          question: args.question,
          answer,
        }, null, 2),
      }],
    };
  },
});

<<<<<<< HEAD
registerTool('documents', {
  name: 'document_qa',
  description:
    'Plain-English document Q&A for contracts, invoices, quotes, and uploaded files. Same behavior as send_document_to_claude, but easier to discover in ChatGPT and other MCP clients.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    document_type: z.enum(['contract', 'invoice', 'quote', 'file']),
    document_id: z.string(),
    question: z.string().min(1),
    system_prompt: z.string().optional(),
    model: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      document_type: {
        type: 'string',
        enum: ['contract', 'invoice', 'quote', 'file'],
        description: 'Type of document to retrieve from the workspace',
      },
      document_id: { type: 'string', description: 'UUID of the contract, invoice, quote, or file' },
      question: { type: 'string', description: 'What you want Claude to answer about the document' },
      system_prompt: { type: 'string', description: 'Optional custom system prompt for Claude' },
      model: { type: 'string', description: 'Optional Claude model override' },
    },
    required: ['tenant_id', 'document_type', 'document_id', 'question'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();

    let documentContent = '';
    let documentTitle = args.document_id;
    let mimeType = 'text/plain';

    if (args.document_type === 'contract') {
      const { data, error } = await supabase
        .from('contracts')
        .select('title, content, pdf_url, status, created_at, parties')
        .eq('id', args.document_id)
        .eq('tenant_id', args.tenant_id)
        .single();
      if (error) throw new Error(`Contract not found: ${error.message}`);
      documentTitle = data.title || 'Contract';
      documentContent = typeof data.content === 'string' ? data.content : JSON.stringify(data, null, 2);
    } else if (args.document_type === 'invoice') {
      const { data, error } = await supabase
        .from('business_invoices')
        .select('invoice_number, status, total_amount, currency, issued_date, due_date, line_items, notes, client:client_id(name, email)')
        .eq('id', args.document_id)
        .eq('tenant_id', args.tenant_id)
        .single();
      if (error) throw new Error(`Invoice not found: ${error.message}`);
      documentTitle = `Invoice ${data.invoice_number || args.document_id}`;
      documentContent = JSON.stringify(data, null, 2);
    } else if (args.document_type === 'quote') {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', args.document_id)
        .eq('tenant_id', args.tenant_id)
        .single();
      if (error) throw new Error(`Quote not found: ${error.message}`);
      documentTitle = `Quote ${data.quote_number || args.document_id}`;
      documentContent = JSON.stringify(data, null, 2);
    } else {
      const { data, error } = await supabase
        .from('file_uploads')
        .select('original_filename, filename, storage_path, file_type, file_size')
        .eq('id', args.document_id)
        .eq('tenant_id', args.tenant_id)
        .single();
      if (error) throw new Error(`File not found: ${error.message}`);
      documentTitle = data.original_filename || data.filename || 'Document';
      mimeType = data.file_type || 'application/pdf';

      if (data.storage_path) {
        const { data: blob, error: downloadError } = await supabase.storage.from('uploads').download(data.storage_path);
        if (downloadError) throw new Error(`Could not download file: ${downloadError.message}`);
        const buf = Buffer.from(await blob.arrayBuffer());
        const uploaded = await uploadFileToAnthropic(buf, documentTitle, mimeType);
        const answer = await callClaudeWithFile({
          fileId: uploaded.id,
          filename: documentTitle,
          mimeType,
          userMessage: args.question,
          systemPrompt: args.system_prompt || 'You are an expert business document analyst for AlphaClone Systems. Be concise, accurate, and professionally helpful.',
          model: args.model,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify({ document: documentTitle, answer }, null, 2) }],
        };
      }
      documentContent = `[File: ${documentTitle} — could not fetch content directly]`;
    }

    const uploaded = await uploadFileToAnthropic(documentContent, `${documentTitle}.txt`, 'text/plain');
    const answer = await callClaudeWithFile({
      fileId: uploaded.id,
      filename: documentTitle,
      mimeType: 'text/plain',
      userMessage: args.question,
      systemPrompt: args.system_prompt || 'You are an expert business document analyst for AlphaClone Systems. Be concise, accurate, and professionally helpful.',
      model: args.model,
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          document_type: args.document_type,
          document_title: documentTitle,
          question: args.question,
          answer,
        }, null, 2),
      }],
    };
  },
});

=======
>>>>>>> origin/main
// ── analyze_workspace_document_url ────────────────────────────────────────────
registerTool('documents', {
  name: 'analyze_workspace_document_url',
  description:
    'Fetches any publicly accessible document URL (PDF, text, contract, invoice) and sends it directly to Claude for analysis. No size limits — Claude reads the full document.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    document_url: z.string().url(),
    document_name: z.string().optional(),
    mime_type: z.string().optional().default('application/pdf'),
    question: z.string().min(1),
    system_prompt: z.string().optional(),
    model: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      document_url: { type: 'string', description: 'Public URL of the document to analyze (PDF, TXT, etc.)' },
      document_name: { type: 'string', description: 'Optional display name for the document' },
      mime_type: { type: 'string', description: 'MIME type (default: application/pdf)', default: 'application/pdf' },
      question: { type: 'string', description: 'What you want Claude to do with the document' },
      system_prompt: { type: 'string', description: 'Optional system prompt for Claude' },
      model: { type: 'string', description: 'Optional Claude model override' },
    },
    required: ['tenant_id', 'document_url', 'question'],
  },
  handler: async (args) => {
    const res = await fetch(args.document_url);
    if (!res.ok) throw new Error(`Failed to fetch document URL: ${res.status} ${res.statusText}`);

    const buf = Buffer.from(await res.arrayBuffer());
    const filename = args.document_name || args.document_url.split('/').pop() || 'document';
    const mimeType = args.mime_type || 'application/pdf';

    // Upload to Anthropic Files API
    const uploaded = await uploadFileToAnthropic(buf, filename, mimeType);

    // Call Claude with the file
    const answer = await callClaudeWithFile({
      fileId: uploaded.id,
      filename,
      mimeType,
      userMessage: args.question,
      systemPrompt: args.system_prompt || 'You are an expert business document analyst. Be concise, accurate, and actionable.',
      model: args.model,
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          document_url: args.document_url,
          document_name: filename,
          question: args.question,
          answer,
        }, null, 2),
      }],
    };
  },
});
<<<<<<< HEAD

registerTool('documents', {
  name: 'document_url_qa',
  description:
    'Plain-English URL-based document Q&A. Same behavior as analyze_workspace_document_url, optimized for discovery in assistant connectors.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    document_url: z.string().url(),
    document_name: z.string().optional(),
    mime_type: z.string().optional().default('application/pdf'),
    question: z.string().min(1),
    system_prompt: z.string().optional(),
    model: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      document_url: { type: 'string', description: 'Public URL of the document to analyze (PDF, TXT, etc.)' },
      document_name: { type: 'string', description: 'Optional display name for the document' },
      mime_type: { type: 'string', description: 'MIME type (default: application/pdf)', default: 'application/pdf' },
      question: { type: 'string', description: 'What you want Claude to do with the document' },
      system_prompt: { type: 'string', description: 'Optional system prompt for Claude' },
      model: { type: 'string', description: 'Optional Claude model override' },
    },
    required: ['tenant_id', 'document_url', 'question'],
  },
  handler: async (args) => {
    const res = await fetch(args.document_url);
    if (!res.ok) throw new Error(`Failed to fetch document URL: ${res.status} ${res.statusText}`);

    const buf = Buffer.from(await res.arrayBuffer());
    const filename = args.document_name || args.document_url.split('/').pop() || 'document';
    const mimeType = args.mime_type || 'application/pdf';

    const uploaded = await uploadFileToAnthropic(buf, filename, mimeType);
    const answer = await callClaudeWithFile({
      fileId: uploaded.id,
      filename,
      mimeType,
      userMessage: args.question,
      systemPrompt: args.system_prompt || 'You are an expert business document analyst. Be concise, accurate, and actionable.',
      model: args.model,
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          document_url: args.document_url,
          document_name: filename,
          question: args.question,
          answer,
        }, null, 2),
      }],
    };
  },
});
=======
>>>>>>> origin/main
