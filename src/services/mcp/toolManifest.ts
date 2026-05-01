/**
 * Static tool manifest for the AlphaClone MCP Server.
 * Consolidated for use in both the standard JSON-RPC flow and stateless discovery endpoints.
 */
export const MCP_TOOLS = [
  // ── CRM & Clients ──────────────────────────────────────────────────
  {
    name: 'get_clients',
    description: 'Fetch CRM clients for a tenant. Use to look up existing clients or filter by status.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: {
          type: 'string',
          description:
            'Workspace UUID. Omit when your MCP connection URL already includes the workspace through its API key.',
        },
        status: { type: 'string', description: 'lead | prospect | active | churned' },
        limit: { type: 'number', description: 'Max records (default 100, max 1000)' },
        offset: { type: 'number', description: 'Pagination offset (default 0)' },
      },
      required: [],
    },
  },
  {
    name: 'create_client',
    description: 'Create a new CRM client/contact record.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        industry: { type: 'string' },
        website: { type: 'string' },
        location: { type: 'string', description: 'Physical address or location' },
        sales_stage: { type: 'string', description: 'lead | prospect | customer | lost' },
        value: { type: 'number', description: 'Estimated client value' },
        source: { type: 'string' },
        notes: { type: 'string' },
        metadata: {
          type: 'object',
          description:
            'Optional extra fields stored on the client (e.g. rating, review_count, source_url, maps_place_id) for imports from Maps or outreach.',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_client_by_id',
    description: 'Fetch a single client record by UUID for update or review flows.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        client_id: { type: 'string', description: 'UUID from get_clients or search_clients' },
      },
      required: ['client_id'],
    },
  },
  {
    name: 'search_clients',
    description: 'Search clients by name, email, phone, website, or location.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        query: { type: 'string', description: 'Free-text search query' },
        limit: { type: 'number', description: 'Max records (default 100, max 1000)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'update_client',
    description: 'Update core client fields including stage, value, and notes.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        client_id: { type: 'string', description: 'UUID from get_clients/get_client_by_id' },
        name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        industry: { type: 'string' },
        website: { type: 'string' },
        location: { type: 'string' },
        sales_stage: { type: 'string', description: 'lead | prospect | customer | lost' },
        value: { type: 'number' },
        notes: { type: 'string' },
        is_active: { type: 'boolean' },
        metadata: { type: 'object' },
      },
      required: ['client_id'],
    },
  },
  {
    name: 'get_contacts',
    description: 'Fetch individual people/contacts for a tenant. Use to look up specific people within organizations.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        limit: { type: 'number', description: 'Max records (default 100, max 1000)' },
        offset: { type: 'number', description: 'Pagination offset (default 0)' },
      },
      required: [],
    },
  },
  {
    name: 'search_contacts',
    description: 'Search people/contacts by name, email, or phone.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        query: { type: 'string', description: 'Free-text search query' },
        limit: { type: 'number', description: 'Max records (default 100, max 1000)' },
      },
      required: ['query'],
    },
  },
  // ── Leads Pipeline ─────────────────────────────────────────────────
  {
    name: 'get_leads',
    description: 'Fetch leads from the sales pipeline. Use to review, qualify, or prioritize leads.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        status: { type: 'string', description: 'new | contacted | qualified | converted | disqualified' },
        stage: { type: 'string', description: 'lead | prospect | opportunity | negotiation | closed_won | closed_lost' },
        limit: { type: 'number', description: 'Max records (default 20, max 100)' },
        offset: { type: 'number', description: 'Pagination offset (default 0)' },
      },
      required: [],
    },
  },
  {
    name: 'backfill_contact_phone_country_codes',
    description:
      'Normalize existing lead and client phone numbers to include country code (E.164-style). Supports dry-run mode.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        dry_run: { type: 'boolean', description: 'If true, only report changes without writing updates (default true).' },
        default_country_code: { type: 'string', description: 'Default country code used for local 10-digit numbers (default 1).' },
        limit: { type: 'number', description: 'Max rows scanned per table (default 5000, max 20000).' },
      },
      required: [],
    },
  },
  {
    name: 'list_playbooks',
    description: 'List built-in backend automation playbooks available to MCP clients.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'run_playbook',
    description: 'Run a backend automation playbook. Low-risk steps auto-run; high-risk steps require approval unless auto_high_risk=true.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        playbook_id: { type: 'string' },
        inputs: { type: 'object' },
        auto_high_risk: { type: 'boolean', description: 'If true, high-risk steps execute automatically.' },
        idempotency_key: { type: 'string', description: 'Optional de-duplication key.' },
      },
      required: ['playbook_id'],
    },
  },
  {
    name: 'get_run_status',
    description: 'Get run and step-level status for an automation playbook execution.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        run_id: { type: 'string' },
      },
      required: ['run_id'],
    },
  },
  {
    name: 'retry_run_step',
    description: 'Retry a failed or pending step in an automation run.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        run_id: { type: 'string' },
        step_id: { type: 'string' },
        auto_high_risk: { type: 'boolean' },
      },
      required: ['run_id', 'step_id'],
    },
  },
  {
    name: 'cancel_run',
    description: 'Cancel an in-progress automation run.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        run_id: { type: 'string' },
      },
      required: ['run_id'],
    },
  },
  {
    name: 'verify_lead_created',
    description: 'Verify that a lead exists in CRM with evidence metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        lead_id: { type: 'string' },
      },
      required: ['lead_id'],
    },
  },
  {
    name: 'verify_outreach_delivery',
    description: 'Verify outreach delivery/open state using outreach log evidence.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        log_id: { type: 'string' },
        tracking_id: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'verify_social_post_published',
    description: 'Verify social post publish state and return evidence.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        social_post_id: { type: 'string' },
      },
      required: ['social_post_id'],
    },
  },
  {
    name: 'verify_invoice_sent',
    description: 'Verify invoice send state and evidence.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        invoice_id: { type: 'string' },
      },
      required: ['invoice_id'],
    },
  },
  {
    name: 'get_automation_health',
    description: 'Automation run health summary for the last 24 hours.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'get_failure_report',
    description: 'Recent automation step failures with error details.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        limit: { type: 'number' },
      },
      required: [],
    },
  },
  {
    name: 'get_throughput_report',
    description: 'Automation throughput summary for a selected hour window.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        hours: { type: 'number' },
      },
      required: [],
    },
  },
  {
    name: 'reconcile_outreach_vs_logs',
    description: 'Check outreach logs for stale queued/failed patterns.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        limit: { type: 'number' },
      },
      required: [],
    },
  },
  {
    name: 'create_lead',
    description: 'Add a new lead into the CRM pipeline.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        business_name: { type: 'string' },
        contact_name: { type: 'string', description: 'Full name of the contact' },
        email: { type: 'string' },
        phone: { type: 'string' },
        industry: { type: 'string' },
        location: { type: 'string', description: 'Physical address or location' },
        source: { type: 'string', description: 'Where this lead came from (e.g. AI Agent, Referral, LinkedIn)' },
        notes: { type: 'string', description: 'Qualifying notes about this lead' },
      },
      required: ['contact_name'],
    },
  },
  {
    name: 'update_lead_status',
    description: 'Qualify, disqualify, or advance a lead through the pipeline. Use when a lead is ready to be moved to the next stage.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        lead_id: { type: 'string', description: 'UUID of the lead to update' },
        status: { type: 'string', description: 'new | contacted | qualified | converted | disqualified' },
        stage: { type: 'string', description: 'lead | prospect | opportunity | negotiation | closed_won | closed_lost' },
        notes: { type: 'string', description: 'Reason for the status change or qualifying notes' },
      },
      required: ['lead_id'],
    },
  },
  {
    name: 'update_lead',
    description: 'Update lead details including contact info, source, notes, status, and stage.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        lead_id: { type: 'string', description: 'UUID of the lead to update' },
        business_name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        industry: { type: 'string' },
        location: { type: 'string' },
        source: { type: 'string' },
        notes: { type: 'string' },
        status: { type: 'string', description: 'new | contacted | qualified | converted | disqualified' },
        stage: { type: 'string', description: 'lead | prospect | opportunity | negotiation | closed_won | closed_lost' },
      },
      required: ['lead_id'],
    },
  },
  // ── Deals ──────────────────────────────────────────────────────────
  {
    name: 'get_deals',
    description: 'Fetch deals/opportunities from the CRM pipeline.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        stage: { type: 'string', description: 'lead | qualified | proposal | negotiation | closed_won | closed_lost' },
        limit: { type: 'number' },
      },
      required: [],
    },
  },
  {
    name: 'create_deal',
    description: 'Create a new deal in the CRM pipeline from a qualified lead.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        name: { type: 'string', description: 'Deal name/title' },
        value: { type: 'number', description: 'Estimated deal value in USD' },
        stage: { type: 'string', description: 'lead | qualified | proposal | negotiation | closed_won | closed_lost (default: qualified)' },
        description: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_deal',
    description: 'Update deal details, amount, pipeline stage, and metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        deal_id: { type: 'string', description: 'UUID from get_deals' },
        name: { type: 'string' },
        value: { type: 'number' },
        stage: { type: 'string', description: 'lead | qualified | proposal | negotiation | closed_won | closed_lost' },
        description: { type: 'string' },
        source: { type: 'string' },
        metadata: { type: 'object' },
      },
      required: ['deal_id'],
    },
  },
  {
    name: 'create_invoice',
    description: 'Create a draft invoice in accounting for a client in this workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        client_id: { type: 'string', description: 'UUID from get_clients' },
        issue_date: { type: 'string', description: 'YYYY-MM-DD (defaults to today)' },
        due_date: { type: 'string', description: 'YYYY-MM-DD' },
        subtotal: { type: 'number' },
        tax: { type: 'number' },
        total: { type: 'number' },
        notes: { type: 'string' },
        line_items: { type: 'array', items: { type: 'object' } },
      },
      required: ['client_id', 'due_date', 'total'],
    },
  },
  {
    name: 'get_invoices',
    description: 'List invoices for this workspace with optional filters.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        status: { type: 'string', description: 'draft | sent | paid | overdue | cancelled | void' },
        client_id: { type: 'string', description: 'Optional client UUID' },
        limit: { type: 'number', description: 'Max records (default 20, max 100)' },
      },
      required: [],
    },
  },
  {
    name: 'update_invoice',
    description: 'Update an invoice after creation (status, totals, due date, notes, line items).',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        invoice_id: { type: 'string', description: 'UUID from create_invoice or get_invoices' },
        due_date: { type: 'string' },
        subtotal: { type: 'number' },
        tax: { type: 'number' },
        total: { type: 'number' },
        notes: { type: 'string' },
        status: { type: 'string', description: 'draft | sent | paid | overdue | cancelled | void' },
        line_items: { type: 'array', items: { type: 'object' } },
      },
      required: ['invoice_id'],
    },
  },
  {
    name: 'send_invoice',
    description: 'Mark an invoice as sent and queue email delivery metadata for follow-up tracking.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        invoice_id: { type: 'string', description: 'UUID from create_invoice or invoice list' },
        recipient_email: { type: 'string', description: 'Optional override email for recipient' },
      },
      required: ['invoice_id'],
    },
  },
  {
    name: 'send_receipt',
    description: 'Send a formal payment receipt for a paid invoice using the specified email provider (Brevo, Resend, Zoho, or SendGrid).',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        invoice_id: { type: 'string', description: 'UUID of the PAID invoice' },
        recipient_email: { type: 'string', description: 'Optional override email for recipient' },
        provider: { type: 'string', enum: ['brevo', 'resend', 'zoho', 'sendgrid'], description: 'Preferred email provider for this send' }
      },
      required: ['invoice_id'],
    },
  },
  {
    name: 'create_bulk_email_campaign',
    description: 'Draft and optionally send a personalized bulk email campaign using connected providers (SendGrid, Resend, Brevo, Zoho Mail, Gmail) with optional daily-limit balancing.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        name: { type: 'string', description: 'Internal name of the campaign' },
        subject: { type: 'string', description: 'Subject line of the email' },
        body_html: { type: 'string', description: 'Full HTML body of the email. You may use {{name}}, {{firstName}}, {{lastName}}, {{company}}, {{fromName}} variables.' },
        target_audience: { type: 'string', description: 'Who to send this to. EXACTLY "all_leads" or "all_clients".' },
        from_name: { type: 'string', description: 'The sender display name (e.g. your username).' },
        from_email: { type: 'string', description: 'The verified sender email address.' },
        publish_now: { type: 'boolean', description: 'If true, will SEND IMMEDIATELY. If false, will save as draft in the dashboard.' },
        delivery_providers: {
          type: 'array',
          items: { type: 'string', enum: ['sendgrid', 'resend', 'brevo', 'zoho', 'gmail'] },
          description: 'Optional provider order/filter for campaign delivery. Example: ["sendgrid","brevo","zoho"]',
        },
        balance_by_daily_limit: {
          type: 'boolean',
          description: 'If true, distribute sends across selected providers based on remaining daily limit.',
        },
      },
      required: ['name', 'subject', 'body_html', 'target_audience', 'from_email', 'from_name'],
    },
  },
  {
    name: 'send_batch_outreach',
    description: 'Autonomous Outreach: Generates personalized AI messages and sends them to a specific batch of leads or clients in parallel (max 20).',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        lead_ids: { type: 'array', items: { type: 'string' }, description: 'UUIDs of leads from get_leads' },
        client_ids: { type: 'array', items: { type: 'string' }, description: 'UUIDs of clients from get_clients' },
        tone: { type: 'string', description: 'professional | friendly | direct | creative' },
        custom_context: { type: 'string', description: 'Specific instructions for personalization (e.g. "Mention the new product feature")' },
        delivery_provider: { type: 'string', enum: ['sendgrid', 'resend', 'brevo', 'zoho', 'gmail'], description: 'Default: sendgrid' }
      },
      required: [],
    },
  },
  {
    name: 'send_message',
    description: 'Send a workspace message to a teammate or group thread.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        recipient_id: { type: 'string', description: 'Optional user UUID recipient' },
        group_id: { type: 'string', description: 'Optional group/thread UUID' },
        text: { type: 'string' },
        priority: { type: 'string', description: 'low | normal | high | urgent' },
        reply_to: { type: 'string', description: 'Optional parent message UUID' },
      },
      required: ['text'],
    },
  },
  {
    name: 'upload_media_asset',
    description: 'Upload an image or video binary payload into workspace media storage and return the stored media asset id and URL.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        file_name: { type: 'string', description: 'Original file name with extension' },
        mime_type: { type: 'string', description: 'MIME type such as image/png or video/mp4' },
        file_base64: { type: 'string', description: 'Raw base64 string or data URL (data:*;base64,...)' },
        alt_text: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['file_name', 'mime_type', 'file_base64'],
    },
  },
  {
    name: 'upload_document',
    description: 'Upload a document or file (PDF, Docx, Text) into the workspace document management system. Includes automated cyber-security scanning.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        filename: { type: 'string', description: 'Original file name with extension' },
        mime_type: { type: 'string', description: 'MIME type such as application/pdf' },
        file_base64: { type: 'string', description: 'Raw base64 string or data URL (data:*;base64,...)' },
        category: { type: 'string', description: 'Optional category (e.g. "Invoice", "Contract")' },
        tags: { type: 'array', items: { type: 'string' } },
        entity_type: { type: 'string', description: 'Optional entity type (e.g. "client", "lead")' },
        entity_id: { type: 'string', description: 'Optional entity UUID' },
      },
      required: ['filename', 'mime_type', 'file_base64'],
    },
  },
  {
    name: 'get_facebook_identities',
    description: 'List connected Facebook page identities and whether each page can publish.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'create_social_post',
    description: 'Create and optionally publish a social post. Facebook supports immediate publish; LinkedIn, Instagram, X, and TikTok are stored/scheduled for downstream publishing.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        platforms: { type: 'array', items: { type: 'string' }, description: 'facebook | linkedin | instagram | x | tiktok (default: facebook)' },
        page_id: { type: 'string', description: 'Optional connected Facebook Page ID. If omitted, MCP auto-selects a publishable page.' },
        caption: { type: 'string' },
        link_url: { type: 'string' },
        media_urls: { type: 'array', items: { type: 'string' }, description: 'Optional image URLs' },
        media_asset_ids: { type: 'array', items: { type: 'string' }, description: 'Optional media asset UUIDs uploaded to the workspace library' },
        hashtags: { type: 'array', items: { type: 'string' } },
        publish_now: { type: 'boolean' },
        scheduled_at: { type: 'string', description: 'Required ISO datetime when publish_now is false' },
        task_id: { type: 'string', description: 'Optional task UUID to update with execution notes' },
        task_title: { type: 'string', description: 'Optional task title to create when task_id is not provided' },
        task_note: { type: 'string', description: 'Optional note describing what was posted/scheduled' },
        mark_task_done: { type: 'boolean', description: 'If true, mark task as completed after action.' },
      },
      required: ['caption'],
    },
  },
  {
    name: 'create_post',
    description: 'Alias of create_social_post for agent compatibility.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        platforms: { type: 'array', items: { type: 'string' }, description: 'facebook | linkedin | instagram | x | tiktok (default: facebook)' },
        page_id: { type: 'string', description: 'Optional connected Facebook Page ID. If omitted, MCP auto-selects a publishable page.' },
        caption: { type: 'string' },
        link_url: { type: 'string' },
        media_urls: { type: 'array', items: { type: 'string' } },
        media_asset_ids: { type: 'array', items: { type: 'string' } },
        hashtags: { type: 'array', items: { type: 'string' } },
        publish_now: { type: 'boolean' },
        scheduled_at: { type: 'string', description: 'Required ISO datetime when publish_now is false' },
      },
      required: ['caption'],
    },
  },
  {
    name: 'get_linkedin_identities',
    description: 'List posting identities for LinkedIn: personal profile and any connected company pages.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'create_linkedin_post',
    description: 'Create and optionally publish a LinkedIn post using the connected LinkedIn account.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        text: { type: 'string', description: 'Post text content' },
        post_as: { type: 'string', description: 'personal | company | all_pages (default: personal)' },
        media_urls: { type: 'array', items: { type: 'string' }, description: 'Optional image URLs for scheduled publishing' },
        media_asset_ids: { type: 'array', items: { type: 'string' }, description: 'Optional media asset UUIDs uploaded to the workspace library' },
        publish_now: { type: 'boolean' },
        scheduled_at: { type: 'string', description: 'Required ISO datetime when publish_now is false' },
        linkedin_organization_id: { type: 'string', description: 'Optional LinkedIn organization ID to post as company page' },
        task_id: { type: 'string', description: 'Optional task UUID to update with execution notes' },
        task_title: { type: 'string', description: 'Optional task title to create when task_id is not provided' },
        task_note: { type: 'string', description: 'Optional note describing what was posted/scheduled' },
        mark_task_done: { type: 'boolean', description: 'If true, mark task as completed after action.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'get_linkedin_posts',
    description: 'Get recent LinkedIn posts created from this workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        limit: { type: 'number' },
      },
      required: [],
    },
  },
  {
    name: 'get_linkedin_post_stats',
    description: 'Get LinkedIn metrics per post (likes/comments plus impressions/clicks when available for organization posts).',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        post_urn: { type: 'string', description: 'LinkedIn activity or ugcPost URN' },
        linkedin_organization_id: { type: 'string', description: 'Optional organization ID for organization analytics lookup' },
      },
      required: ['post_urn'],
    },
  },
  {
    name: 'capture_linkedin_comment_leads',
    description: 'Read comments from LinkedIn posts and auto-create CRM leads from new commenters.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        post_urn: { type: 'string', description: 'Optional specific LinkedIn post URN to scan' },
        limit_posts: { type: 'number', description: 'How many recent LinkedIn posts to scan (default 10, max 30)' },
        limit_comments_per_post: { type: 'number', description: 'How many comments per post to inspect (default 30, max 100)' },
        source: { type: 'string', description: 'Lead source label (default LinkedIn Comment)' },
      },
      required: [],
    },
  },
  {
    name: 'create_linkedin_comment',
    description: 'Create a comment on a LinkedIn post URN.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        post_urn: { type: 'string', description: 'LinkedIn activity or ugcPost URN' },
        text: { type: 'string' },
      },
      required: ['post_urn', 'text'],
    },
  },
  {
    name: 'create_linkedin_reaction',
    description: 'React to a LinkedIn post URN with a supported reaction type.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        post_urn: { type: 'string', description: 'LinkedIn activity or ugcPost URN' },
        reaction_type: { type: 'string', description: 'LIKE | PRAISE | MAYBE | EMPATHY | INTEREST | APPRECIATION' },
      },
      required: ['post_urn'],
    },
  },
  // ── Projects ───────────────────────────────────────────────────────
  {
    name: 'get_projects',
    description:
      'List business projects for the workspace. tenant_id must be the workspace UUID from your MCP URL (never a name or slug).',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'Workspace UUID' },
        status: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'create_project',
    description:
      'Create a new project in the workspace. Use for new initiatives, client workstreams, or internal execution plans.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        name: { type: 'string', description: 'Project name/title' },
        description: { type: 'string', description: 'Optional project brief' },
        status: { type: 'string', description: 'planning | active | on_hold | completed | cancelled' },
        due_date: { type: 'string', description: 'Optional ISO date or datetime' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_project_status',
    description:
      'Update a project status. project_id must be the UUID from get_projects, not the project name.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        project_id: { type: 'string', description: 'UUID from get_projects' },
        status: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['project_id', 'status'],
    },
  },
  // ── Tasks & Scheduling ─────────────────────────────────────────────
  {
    name: 'get_tasks',
    description: 'Retrieve tasks. Use to see what is pending, what is due, or what is assigned to a team member.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        project_id: {
          type: 'string',
          description: 'Optional. UUID of the linked business project (same as tasks.related_to_project).',
        },
        assigned_to: { type: 'string' },
        completed: { type: 'boolean', description: 'If true, only completed tasks; if false, only open tasks.' },
        due_after: {
          type: 'string',
          description: 'ISO date or datetime; return tasks with due_date on or after this instant (for "this week" windows).',
        },
        due_before: {
          type: 'string',
          description: 'ISO date or datetime; return tasks with due_date on or before this instant.',
        },
      },
      required: [],
    },
  },
  {
    name: 'create_task',
    description: 'Create a task or schedule a follow-up. Use for reminders, action items, and scheduled calls.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        project_id: {
          type: 'string',
          description: 'Optional. UUID of business project to link (stored as related_to_project).',
        },
        assigned_to: { type: 'string' },
        due_date: { type: 'string', description: 'ISO 8601 datetime (e.g. 2026-04-15T09:00:00Z)' },
        priority: { type: 'string', description: 'low | medium | high | urgent' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_task',
    description: 'Update task fields such as status, due date, assignee, title, and priority.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        task_id: { type: 'string', description: 'Task UUID from get_tasks' },
        title: { type: 'string' },
        description: { type: 'string' },
        assigned_to: { type: 'string', description: 'Optional assignee user UUID' },
        due_date: { type: 'string', description: 'ISO 8601 datetime or date string' },
        priority: { type: 'string', description: 'low | medium | high | urgent' },
        status: { type: 'string', description: 'ideas | todo | in_progress | review | completed | cancelled' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'write_task_note',
    description:
      'Append a timestamped note to a task. Use for progress logs, blockers, handoff notes, and AI-generated summaries.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        task_id: { type: 'string', description: 'Task UUID from get_tasks' },
        note: { type: 'string', description: 'Plain text note to append' },
      },
      required: ['task_id', 'note'],
    },
  },
  // ── Finance & Expenses ─────────────────────────────────────────────
  {
    name: 'get_expenses',
    description: 'Read-only: Fetch expense records for a tenant. Use to review spending or find receipts.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        status: { type: 'string', description: 'pending | approved | rejected' },
        from_date: { type: 'string', description: 'YYYY-MM-DD' },
        to_date: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: [],
    },
  },
  {
    name: 'create_expense',
    description: 'Log a new business expense. Use when the user describes a purchase or receipt they want recorded.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        description: { type: 'string', description: 'What was purchased / vendor name' },
        amount: { type: 'number', description: 'Amount in USD' },
        category: { type: 'string', description: 'Office Supplies | Travel | Software | Marketing | Meals | Utilities | Other' },
        date: { type: 'string', description: 'YYYY-MM-DD (defaults to today)' },
      },
      required: ['description', 'amount'],
    },
  },
  {
    name: 'get_revenue_summary',
    description:
      'Read-only: Totals plus paid/outstanding split by calendar month and by client_id (from invoices).',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        period: { type: 'string', description: 'Optional hint: monthly | quarterly | yearly (grouping uses invoice created_at month).' },
      },
      required: [],
    },
  },
  // ── Contracts ──────────────────────────────────────────────────────
  {
    name: 'generate_contract_draft',
    description: 'Use AI to draft a professional contract (NDA, MSA, SOW, Service Agreement, etc.) and save it to the system for review.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        contract_type: { type: 'string', description: 'NDA | MSA | SOW | Service Agreement | Consulting Agreement | Freelance Contract' },
        client_name: { type: 'string', description: 'Name of the client or counterparty' },
        key_terms: { type: 'string', description: 'Describe the scope, payment terms, duration, deliverables, and any special conditions' },
      },
      required: ['contract_type', 'client_name'],
    },
  },
  {
    name: 'save_contract',
    description: 'Save a fully generated, custom contract (Markdown or HTML) directly into the platform. Used after discussing requirements with the user. Never overwrite existing contracts unless requested, and never delete contracts.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        client_id: { type: 'string', description: 'Optional UUID of the client from get_clients' },
        title: { type: 'string', description: 'Document Title' },
        content: { type: 'string', description: 'The full Markdown or HTML content of the contract' },
        type: { type: 'string', description: 'nda | msa | sow | service_agreement | freelance_contract' },
        source_attribution: {
          type: 'string',
          description: 'e.g. Manus AI, Claude, or other assistant name — shown on the saved document',
        },
      },
      required: ['title', 'content'],
    },
  },
  // ── Research & Web ─────────────────────────────────────────────────
  {
    name: 'read_url_content',
    description: 'Extract text content from any public URL. Use this to read articles, LinkedIn pages, or Facebook posts before writing content about them.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The absolute URL to read' },
      },
      required: ['url'],
    },
  },
  // ── Analytics & Momentum ───────────────────────────────────────────
  {
    name: 'get_momentum_score',
    description: 'Get the gamification XP, level, and momentum score for a user.',
    inputSchema: {
      type: 'object',
      properties: { user_id: { type: 'string' } },
      required: ['user_id'],
    },
  },
  {
    name: 'get_recent_messages',
    description: 'Read the most recent client or team messages.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        limit: { type: 'number' },
      },
      required: [],
    },
  },
  {
    name: 'get_client_email_history',
    description: 'Get outbound/inbound email history for a specific client, including Zoho-synced unified messages and outreach logs.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        client_id: { type: 'string', description: 'Client UUID from get_clients.' },
        client_email: { type: 'string', description: 'Optional email fallback when client_id is unknown.' },
        limit: { type: 'number', description: 'Max records (default 50, max 200).' },
      },
      required: [],
    },
  },
  {
    name: 'get_zoho_mail_messages',
    description: 'Read Zoho Mail messages for the connected user. Supports folder listing, folder message fetch, and search.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        user_id: { type: 'string', description: 'Optional user UUID. Defaults to MCP connection user.' },
        folder_id: { type: 'string', description: 'Zoho folderId. Omit to return folders.' },
        search_query: { type: 'string', description: 'If provided, perform Zoho mailbox search.' },
        limit: { type: 'number', description: 'Max records (default 20, max 100).' },
        start: { type: 'number', description: 'Zoho pagination start index (default 1).' },
      },
      required: [],
    },
  },
  {
    name: 'send_transactional_email',
    description: 'Send a transactional email using the caller user scoped provider configuration.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        user_id: { type: 'string' },
        to: { type: 'string' },
        subject: { type: 'string' },
        html: { type: 'string' },
        text: { type: 'string' },
        from_name: { type: 'string' },
      },
      required: ['to', 'subject'],
    },
  },
  {
    name: 'get_email_campaign_stats',
    description: 'Get outreach delivery stats by provider and status for a date range.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        user_id: { type: 'string' },
        from_date: { type: 'string', description: 'ISO date/datetime lower bound.' },
        to_date: { type: 'string', description: 'ISO date/datetime upper bound.' },
      },
      required: [],
    },
  },
  {
    name: 'get_client_history',
    description: 'Fetch a full client history: profile, related leads, outreach logs, and recent unified messages.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        client_id: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['client_id'],
    },
  },
  {
    name: 'segment_clients_by_criteria',
    description: 'Filter clients by advanced criteria for targeted automations.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        industry: { type: 'string' },
        location: { type: 'string' },
        sales_stage: { type: 'string' },
        min_value: { type: 'number' },
        max_value: { type: 'number' },
        has_email: { type: 'boolean' },
        has_phone: { type: 'boolean' },
        limit: { type: 'number' },
      },
      required: [],
    },
  },
  {
    name: 'update_client_metadata',
    description: 'Merge metadata fields into a client custom_fields object.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        client_id: { type: 'string' },
        metadata: { type: 'object' },
      },
      required: ['client_id', 'metadata'],
    },
  },
  {
    name: 'add_task_dependency',
    description: 'Declare that one task depends on completion of another task.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        task_id: { type: 'string' },
        depends_on_task_id: { type: 'string' },
      },
      required: ['task_id', 'depends_on_task_id'],
    },
  },
  {
    name: 'set_task_recurrence',
    description: 'Set recurrence schedule for a task.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        task_id: { type: 'string' },
        frequency: { type: 'string', description: 'Daily | Weekly | Monthly | Yearly' },
        interval: { type: 'number' },
        days_of_week: { type: 'array', items: { type: 'number' } },
        day_of_month: { type: 'number' },
        end_date: { type: 'string' },
      },
      required: ['task_id', 'frequency'],
    },
  },
  {
    name: 'get_project_milestones',
    description: 'Get milestones linked to a project.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        project_id: { type: 'string' },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'get_invoice_line_items',
    description: 'Get line items from an invoice for detailed billing analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        invoice_id: { type: 'string' },
      },
      required: ['invoice_id'],
    },
  },
  {
    name: 'reconcile_payment',
    description: 'Mark an invoice as paid and attach reconciliation metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        invoice_id: { type: 'string' },
        amount: { type: 'number' },
        paid_at: { type: 'string' },
        payment_ref: { type: 'string' },
      },
      required: ['invoice_id'],
    },
  },
  {
    name: 'generate_expense_report',
    description: 'Generate an expense summary report grouped by category and status.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        from_date: { type: 'string' },
        to_date: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'subscribe_events',
    description: 'Subscribe MCP automations to business events.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        event_name: { type: 'string' },
        target: { type: 'string', description: 'playbook or webhook target identifier.' },
        config: { type: 'object' },
      },
      required: ['event_name', 'target'],
    },
  },
  {
    name: 'list_event_subscriptions',
    description: 'List active MCP event subscriptions.',
    inputSchema: {
      type: 'object',
      properties: { tenant_id: { type: 'string' } },
      required: [],
    },
  },
  {
    name: 'unsubscribe_event',
    description: 'Disable an event subscription.',
    inputSchema: {
      type: 'object',
      properties: { tenant_id: { type: 'string' }, subscription_id: { type: 'string' } },
      required: ['subscription_id'],
    },
  },
  {
    name: 'update_client_status_batch',
    description: 'Batch update client sales_stage with dry_run safety.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        client_ids: { type: 'array', items: { type: 'string' } },
        sales_stage: { type: 'string' },
        dry_run: { type: 'boolean' },
      },
      required: ['client_ids', 'sales_stage'],
    },
  },
  {
    name: 'create_tasks_batch',
    description: 'Batch create tasks with per-item results and dry_run option.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        tasks: { type: 'array', items: { type: 'object' } },
        dry_run: { type: 'boolean' },
      },
      required: ['tasks'],
    },
  },
  {
    name: 'send_bulk_email_campaign',
    description: 'Batch send transactional emails to client list with dry_run support.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        client_ids: { type: 'array', items: { type: 'string' } },
        subject: { type: 'string' },
        html: { type: 'string' },
        text: { type: 'string' },
        dry_run: { type: 'boolean' },
      },
      required: ['client_ids', 'subject'],
    },
  },
  {
    name: 'get_quotes',
    description: 'Read-only: List quotes and proposals with their statuses.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        status: { type: 'string', description: 'draft | sent | accepted | declined' },
      },
      required: [],
    },
  },
  {
    name: 'create_quote',
    description: 'Create a quote/proposal for a contact or deal in this workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        name: { type: 'string', description: 'Quote title' },
        contact_id: { type: 'string', description: 'Optional contact/client UUID' },
        deal_id: { type: 'string', description: 'Optional deal UUID' },
        currency: { type: 'string', description: 'Default USD' },
        valid_for_days: { type: 'number', description: 'Default 30' },
        notes: { type: 'string' },
        terms_and_conditions: { type: 'string' },
        status: { type: 'string', description: 'draft | sent | viewed | accepted | rejected | expired | converted' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_quote',
    description: 'Update quote details and lifecycle status after creation.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        quote_id: { type: 'string', description: 'UUID from get_quotes' },
        name: { type: 'string' },
        status: { type: 'string', description: 'draft | sent | viewed | accepted | rejected | expired | converted' },
        notes: { type: 'string' },
        terms_and_conditions: { type: 'string' },
        valid_until: { type: 'string', description: 'YYYY-MM-DD' },
        currency: { type: 'string' },
      },
      required: ['quote_id'],
    },
  },
  {
    name: 'auto_create_lead_from_message',
    description: 'Create a lead from an existing inbound message in one call.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        message_id: { type: 'string', description: 'Message UUID from inbox/history' },
        business_name: { type: 'string', description: 'Optional override business/contact name' },
        source: { type: 'string', description: 'Default Inbound Message' },
      },
      required: ['message_id'],
    },
  },
  {
    name: 'score_deal',
    description: 'Score a deal from 1-10 based on stage, value, and freshness, then save score in metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        deal_id: { type: 'string', description: 'Deal UUID from get_deals' },
      },
      required: ['deal_id'],
    },
  },
  {
    name: 'voice_action_router',
    description: 'Convert a plain-language voice command into an actionable MCP instruction payload.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        command: { type: 'string', description: 'Natural language command captured from voice' },
      },
      required: ['command'],
    },
  },
  {
    name: 'write_audit_log',
    description:
      'Insert a row into audit_logs (tenant-scoped). Use to persist agent notes, integration events, or any structured record the user asked to store.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        action: { type: 'string', description: 'Short action key, e.g. mcp_note | integration_sync | user_request' },
        entity_type: { type: 'string', description: 'Category, e.g. mcp | lead | integration' },
        entity_id: { type: 'string', description: 'Optional UUID of related entity' },
        summary: { type: 'human-readable one-line summary' },
        payload: {
          type: 'object',
          description: 'Optional JSON object merged into new_values (along with summary and source)',
        },
      },
      required: ['action', 'entity_type'],
    },
  },
  {
    name: 'plan_social_calendar',
    description: 'Autonomous Strategist: Plans and schedules a 30-day social media calendar (2 articles per day) based on a monthly goal. Uses Grok for high-quality, professional, emoji-free articles and Intelligent Timing for optimal reach.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        monthly_goal: { type: 'string', description: 'The strategic objective for this month (e.g. "Lead gen for SaaS product")' },
        topics: { type: 'array', items: { type: 'string' }, description: 'Optional list of specific topics to cover. If omitted, the AI will decide based on the goal.' },
        platforms: { type: 'array', items: { type: 'string' }, description: 'facebook | linkedin (default: both)' }
      },
      required: ['monthly_goal'],
    },
  },
  {
    name: 'create_post_with_ai_image',
    description: 'Autonomous Creator: Generates a professional AI image, saves it to permanent storage, writes a professional article using Grok, and schedules it. Supports OpenAI, Grok (xAI), or externally provided images (e.g. from Manus).',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        topic: { type: 'string' },
        image_prompt: { type: 'string', description: 'Visual style for the AI image.' },
        image_provider: { type: 'string', enum: ['openai', 'xai'], description: 'Default: openai' },
        provided_image_url: { type: 'string', description: 'If an image has already been generated by another agent (like Manus), provide the URL here to bypass generation.' },
        platforms: { type: 'array', items: { type: 'string' } },
        scheduled_at: { type: 'string', description: 'Optional ISO datetime. If omitted, AI chooses the next best slot.' }
      },
      required: ['topic'],
    },
  },
  {
    name: 'sync_all_inboxes',
    description: 'Autonomous Assistant: Fetches unread/recent communications from all connected channels (Email, Facebook, LinkedIn) for processing.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        limit: { type: 'number' }
      },
      required: [],
    },
  },
  {
    name: 'autonomous_reply',
    description: 'Autonomous Assistant: Drafts or sends a professional, emoji-free reply to a lead or client message using the best-suited AI model (Claude for strategy, Grok for speed).',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        entity_id: { type: 'string', description: 'The UUID of the message or thread' },
        platform: { type: 'string', description: 'email | facebook | linkedin' },
        draft_only: { type: 'boolean', description: 'If true, saves as a draft for your review. If false, sends immediately.' }
      },
      required: ['entity_id', 'platform'],
    },
  },
  {
    name: 'book_calendar_meeting',
    description: 'Calendar booking adapter: creates a booking through the production booking pipeline.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        booking_type_id: { type: 'string' },
        start_time: { type: 'string', description: 'ISO datetime' },
        end_time: { type: 'string', description: 'ISO datetime' },
        client_name: { type: 'string' },
        client_email: { type: 'string' },
        client_phone: { type: 'string' },
        client_notes: { type: 'string' },
        time_zone: { type: 'string' },
      },
      required: ['booking_type_id', 'start_time', 'end_time', 'client_name', 'client_email'],
    },
  },
  {
    name: 'create_subscription_checkout',
    description: 'Payment/subscription adapter: creates Stripe checkout URL for subscription upgrade.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        plan_id: { type: 'string', description: 'starter | pro | enterprise' },
        price_id: { type: 'string' },
        admin_email: { type: 'string' },
        success_url: { type: 'string' },
        cancel_url: { type: 'string' },
      },
      required: ['plan_id', 'price_id', 'admin_email'],
    },
  },
  {
    name: 'create_client_portal_event',
    description: 'Client portal event adapter: records timeline, download, and feedback events.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        event_type: { type: 'string' },
        project_id: { type: 'string' },
        client_id: { type: 'string' },
        deliverable_id: { type: 'string' },
        feedback_rating: { type: 'number' },
        feedback_comment: { type: 'string' },
        metadata: { type: 'object' },
      },
      required: ['event_type'],
    },
  },
  {
    name: 'create_business_event',
    description: 'Create an internal business event trigger record for automation loops.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        start_time: { type: 'string', description: 'ISO datetime' },
        end_time: { type: 'string', description: 'ISO datetime' },
        event_type: { type: 'string', description: 'lead_created | invoice_paid | meeting | custom' },
        attendees: { type: 'array', items: { type: 'string' } },
      },
      required: ['title', 'start_time', 'end_time', 'event_type'],
    },
  },
  {
    name: 'get_business_events',
    description: 'List business events so agents can poll for new triggers.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        event_type: { type: 'string' },
        from_time: { type: 'string', description: 'ISO datetime lower bound for start_time' },
        to_time: { type: 'string', description: 'ISO datetime upper bound for start_time' },
        limit: { type: 'number', description: 'Max records (default 50, max 200)' },
      },
      required: [],
    },
  },
  {
    name: 'analyze_document_intelligence',
    description: 'Document intelligence adapter: extracts clauses/risk flags and stores a scan run.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        document_url: { type: 'string' },
        document_text: { type: 'string' },
        document_type: { type: 'string', description: 'contract | proposal | invoice | nda | other' },
      },
      required: [],
    },
  },
];
