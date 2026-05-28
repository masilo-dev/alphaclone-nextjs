/**
 * Static tool manifest for the AlphaClone MCP Server.
 * Consolidated for use in both the standard JSON-RPC flow and stateless discovery endpoints.
 */
export const MCP_TOOLS = [
  // ── CRM & Clients ──────────────────────────────────────────────────
  {
    name: 'get_clients',
    description: 'Access High-Value Client Roster: Retrieve comprehensive client profiles, business account data, and relationship history for strategic management.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: {
          type: 'string',
          description:
            'AlphaClone Workspace ID. Identifies the secure business environment for this operation.',
        },
        status: { type: 'string', description: 'lead | prospect | active | churned' },
        limit: { type: 'number', description: 'Max records (default 100, max 1000)' },
        offset: { type: 'number', description: 'Starting record index (default 0)' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
    description: 'Fetch a single client record by reference for update or review flows.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        client_id: { type: 'string', description: 'Reference from get_clients or search_clients' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        query: { type: 'string', description: 'Free-text search query' },
        limit: { type: 'number', description: 'Max records (default 100, max 1000)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'update_client',
    description: 'Update core client fields including stage, value, and notes. Supports Smart Lookup via search_email or search_name if client_id is unknown.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        client_id: { type: 'string', description: 'Reference from get_clients/get_client_by_id' },
        search_email: { type: 'string', description: 'Smart Lookup: Find client by email if client_id is unknown.' },
        search_name: { type: 'string', description: 'Smart Lookup: Find client by name if client_id is unknown.' },
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
      required: [],
    },
  },
  {
    name: 'get_contacts',
    description: 'Fetch individual people/contacts for a tenant. Use to look up specific people within organizations.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        query: { type: 'string', description: 'Free-text search query' },
        limit: { type: 'number', description: 'Max records (default 100, max 1000)' },
      },
      required: ['query'],
    },
  },
  // ── Direct Gmail Operations (App Password) ───────────────────────
  {
    name: 'gmail_list_threads',
    description: 'List recent Gmail conversations via IMAP. Returns a list of threads with subjects, senders, and dates.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        limit: { type: 'number', description: 'Max threads to fetch (default 20)' },
      },
      required: [],
    },
  },
  {
    name: 'gmail_get_thread',
    description: 'Fetch all messages in a specific Gmail thread by threadId.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        thread_id: { type: 'string', description: 'The thread identifier from gmail_list_threads' },
      },
      required: ['thread_id'],
    },
  },
  {
    name: 'gmail_send_email',
    description: 'Send a new email or reply to an existing thread via Gmail SMTP.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'HTML or text body of the email' },
        thread_id: { type: 'string', description: 'Optional: threadId to reply to' },
        cc: { type: 'string' },
        bcc: { type: 'string' },
      },
      required: ['to', 'subject', 'body'],
    },
  },

  // ── Leads Pipeline ─────────────────────────────────────────────────
  {
    name: 'get_leads',
    description: 'Retrieve High-Intent Pipeline Intelligence: Access the latest prospective business opportunities and lead scoring signals from the growth engine.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
    description: 'Run a business automation sequence. Low-risk steps auto-run; high-risk steps require approval unless auto_high_risk=true.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        run_id: { type: 'string', description: 'Execution reference' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        business_name: { type: 'string' },
        contact_name: { type: 'string', description: 'Full name of the contact' },
        email: { type: 'string' },
        phone: { type: 'string' },
        industry: { type: 'string' },
        location: { type: 'string', description: 'Physical address or location' },
        source: { type: 'string', description: 'Where this lead came from (e.g. AI Agent, Referral, LinkedIn)' },
        notes: { type: 'string', description: 'Qualifying notes about this lead' },
        linkedin_url: { type: 'string', description: 'LinkedIn profile URL of the decision maker or company' },
        decision_maker_name: { type: 'string', description: 'Name of the key decision maker at this company' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        lead_id: { type: 'string', description: 'Reference of the lead to update' },
        status: { type: 'string', description: 'new | contacted | qualified | converted | disqualified' },
        stage: { type: 'string', description: 'lead | prospect | opportunity | negotiation | closed_won | closed_lost' },
        notes: { type: 'string', description: 'Reason for the status change or qualifying notes' },
      },
      required: ['lead_id'],
    },
  },
  {
    name: 'update_lead',
    description: 'Update lead details. Supports Smart Lookup via search_email or search_business_name if lead_id is unknown.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        lead_id: { type: 'string', description: 'Reference of the lead to update' },
        search_email: { type: 'string', description: 'Smart Lookup: Find lead by email if lead_id is unknown.' },
        search_business_name: { type: 'string', description: 'Smart Lookup: Find lead by business name if lead_id is unknown.' },
        business_name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        industry: { type: 'string' },
        location: { type: 'string' },
        source: { type: 'string' },
        notes: { type: 'string' },
        status: { type: 'string', description: 'new | contacted | qualified | converted | disqualified' },
        stage: { type: 'string', description: 'lead | prospect | opportunity | negotiation | closed_won | closed_lost' },
        linkedin_url: { type: 'string', description: 'LinkedIn profile URL of the decision maker or company' },
        decision_maker_name: { type: 'string', description: 'Name of the key decision maker at this company' },
      },
      required: [],
    },
  },
  // ── Deals ──────────────────────────────────────────────────────────
  {
    name: 'get_deals',
    description: 'Fetch deals/opportunities from the CRM pipeline.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        deal_id: { type: 'string', description: 'Reference from get_deals' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        client_id: { type: 'string', description: 'Reference from get_clients' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        status: { type: 'string', description: 'draft | sent | paid | overdue | cancelled | void' },
        client_id: { type: 'string', description: 'Optional client reference' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        invoice_id: { type: 'string', description: 'Reference from create_invoice or get_invoices' },
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
    description: 'Generate a PDF invoice and send it to the client via the tenant-configured email provider (Resend, SendGrid, Brevo, Zoho, or Gmail SMTP). Returns sent_to, pdf_url, provider_used, and email_id. Works as a single stateless POST from Claude chat.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        invoice_id: { type: 'string', description: 'Reference from create_invoice or invoice list' },
        recipient_email: { type: 'string', description: 'Optional override email. Defaults to the email on the client record.' },
        provider: { type: 'string', enum: ['resend', 'sendgrid', 'brevo', 'zoho', 'gmail'], description: 'Optional: force a specific email provider. Defaults to the tenant-configured provider.' },
      },
      required: ['invoice_id'],
    },
  },
  {
    name: 'get_finance_snapshot',
    description: 'Generate Executive Fiscal Health Briefing: A comprehensive reconciliation of cash position, revenue momentum, and pending fiscal obligations.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'get_pnl_statement',
    description: 'Generate a detailed Profit & Loss (P&L) statement including revenue momentum, expense distribution, and net margin analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        period: { type: 'string', enum: ['monthly', 'quarterly', 'yearly'], description: 'Default: monthly' },
        from_date: { type: 'string', description: 'Optional start date (YYYY-MM-DD)' },
        to_date: { type: 'string', description: 'Optional end date (YYYY-MM-DD)' },
      },
      required: [],
    },
  },
  {
    name: 'get_business_snapshot',
    description: 'Autonomous Chief of Staff Briefing: Synthesize the current operational state across pipeline, fiscal health, and strategic execution into a single executive dashboard.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'generate_business_report',
    description: 'Executive Performance Reporting: Generate a comprehensive business performance report including revenue trends, conversion rates, automation throughput, and strategic insights.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        start_date: { type: 'string', description: 'Optional start date (YYYY-MM-DD)' },
        end_date: { type: 'string', description: 'Optional end date (YYYY-MM-DD)' },
        format: { type: 'string', enum: ['summary', 'detailed', 'executive'], description: 'Report depth and detail level.' },
      },
      required: [],
    },
  },
  {
    name: 'get_strategic_plan',
    description: 'Autonomous Strategic Orchestrator: Analyze the organizational snapshot to derive a mission-critical theme, session objectives, and a prioritized growth roadmap.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'get_accounts_receivable_aging',
    description: 'Return accounts receivable aging buckets for open invoices.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'get_accounts_payable_aging',
    description: 'Return accounts payable aging buckets for vendor bills.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'get_bank_accounts',
    description: 'List bank accounts connected to this workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'create_bank_account',
    description: 'Create a bank account record for treasury and reconciliation workflows.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        name: { type: 'string' },
        account_number_last4: { type: 'string' },
        bank_name: { type: 'string' },
        account_type: { type: 'string', description: 'checking | savings | credit_card | loan | investment | other' },
        currency: { type: 'string' },
        opening_balance: { type: 'number' },
        current_balance: { type: 'number' },
        coa_account_id: { type: 'string', description: 'Optional chart-of-accounts reference' },
        is_active: { type: 'boolean' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_reconciliation_sessions',
    description: 'List bank reconciliation sessions for this workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        limit: { type: 'number', description: 'Max records (default 25)' },
      },
      required: [],
    },
  },
  {
    name: 'create_reconciliation_session',
    description: 'Create a reconciliation session for a bank statement period.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        bank_account_id: { type: 'string', description: 'Reference from get_bank_accounts' },
        statement_start_date: { type: 'string', description: 'YYYY-MM-DD' },
        statement_end_date: { type: 'string', description: 'YYYY-MM-DD' },
        statement_ending_balance: { type: 'number' },
        cleared_balance: { type: 'number' },
        status: { type: 'string', description: 'draft | in_progress | completed | archived' },
        notes: { type: 'string' },
        metadata: { type: 'object' },
      },
      required: ['bank_account_id', 'statement_start_date', 'statement_end_date', 'statement_ending_balance'],
    },
  },
  {
    name: 'get_vendor_bills',
    description: 'List vendor bills for accounts payable operations.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        status: { type: 'string', description: 'draft | open | partial | paid | void | overdue' },
        limit: { type: 'number', description: 'Max records (default 100)' },
      },
      required: [],
    },
  },
  {
    name: 'create_vendor_bill',
    description: 'Create a vendor bill for accounts payable tracking.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        vendor_id: { type: 'string' },
        company_id: { type: 'string' },
        reference: { type: 'string' },
        issue_date: { type: 'string', description: 'YYYY-MM-DD' },
        due_date: { type: 'string', description: 'YYYY-MM-DD' },
        status: { type: 'string', description: 'draft | open | partial | paid | void | overdue' },
        currency: { type: 'string' },
        amount_paid: { type: 'number' },
        notes: { type: 'string' },
        terms: { type: 'string' },
        line_items: { type: 'array', items: { type: 'object' } },
        metadata: { type: 'object' },
      },
      required: ['issue_date', 'line_items'],
    },
  },
  {
    name: 'get_contract_templates',
    description: 'List active contract templates available to this workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'create_contract_template',
    description: 'Create a reusable contract template for sales and delivery workflows.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        name: { type: 'string' },
        category: { type: 'string' },
        description: { type: 'string' },
        content: { type: 'string' },
        output_format: { type: 'string', description: 'html | markdown | text' },
        approval_required: { type: 'boolean' },
        is_active: { type: 'boolean' },
        is_default: { type: 'boolean' },
        version_number: { type: 'number' },
        metadata: { type: 'object' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_contract_versions',
    description: 'List stored versions for a contract.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        contract_id: { type: 'string', description: 'Contract reference' },
      },
      required: ['contract_id'],
    },
  },
  {
    name: 'create_contract_version',
    description: 'Create a new version of an existing contract.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        contract_id: { type: 'string', description: 'Contract reference' },
        content: { type: 'string' },
        change_summary: { type: 'string' },
        status: { type: 'string', description: 'draft | approval_pending | approved | rejected | superseded' },
        metadata: { type: 'object' },
      },
      required: ['contract_id', 'content'],
    },
  },
  {
    name: 'get_contract_approvals',
    description: 'List contract approval requests, optionally filtered to one contract.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        contract_id: { type: 'string', description: 'Optional contract reference' },
      },
      required: [],
    },
  },
  {
    name: 'request_contract_approval',
    description: 'Request approval for a contract or a specific contract version.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        contract_id: { type: 'string', description: 'Contract reference' },
        contract_version_id: { type: 'string', description: 'Optional contract version reference' },
        approver_id: { type: 'string', description: 'Optional approver profile reference' },
        request_note: { type: 'string' },
        due_at: { type: 'string', description: 'ISO datetime' },
        metadata: { type: 'object' },
      },
      required: ['contract_id'],
    },
  },
  {
    name: 'review_contract_approval',
    description: 'Approve, reject, or cancel a contract approval request.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        approval_id: { type: 'string', description: 'Approval reference from get_contract_approvals' },
        status: { type: 'string', description: 'approved | rejected | cancelled' },
        decision_note: { type: 'string' },
      },
      required: ['approval_id', 'status'],
    },
  },
  {
    name: 'send_receipt',
    description: 'Send a formal payment receipt for a paid invoice using the specified email provider (Brevo, Resend, Zoho, or SendGrid).',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        invoice_id: { type: 'string', description: 'Reference of the PAID invoice' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        language_mode: {
          type: 'string',
          enum: ['auto', 'ask', 'en', 'es', 'pl', 'fr', 'de', 'it', 'pt', 'nl'],
          description: 'Email language. Use "auto" to infer from country/company, "ask" to ask the user before sending, or an explicit language code.',
        },
        language: {
          type: 'string',
          enum: ['en', 'es', 'pl', 'fr', 'de', 'it', 'pt', 'nl'],
          description: 'Explicit email language code. Overrides auto inference when provided.',
        },
      },
      required: ['name', 'subject', 'body_html', 'target_audience', 'from_email', 'from_name'],
    },
  },
  {
    name: 'send_batch_outreach',
    description: 'Autonomous Strategic Outreach: Orchestrate personalized high-fidelity communications to a cohort of leads or clients using AI-driven relationship intelligence.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        lead_ids: { type: 'array', items: { type: 'string' }, description: 'References of leads from get_leads' },
        client_ids: { type: 'array', items: { type: 'string' }, description: 'References of clients from get_clients' },
        tone: { type: 'string', description: 'professional | friendly | direct | creative' },
        custom_context: { type: 'string', description: 'Specific strategic instructions for relationship personalization.' },
        delivery_provider: { type: 'string', enum: ['sendgrid', 'resend', 'brevo', 'zoho', 'gmail'], description: 'Default: sendgrid' },
        language_mode: {
          type: 'string',
          enum: ['auto', 'ask', 'en', 'es', 'pl', 'fr', 'de', 'it', 'pt', 'nl'],
          description: 'Email language. Use "ask" when the user must choose before any send, "auto" to infer from available country/company context, or an explicit language code.',
        },
        language: {
          type: 'string',
          enum: ['en', 'es', 'pl', 'fr', 'de', 'it', 'pt', 'nl'],
          description: 'Explicit email language code.',
        },
      },
      required: [],
    },
  },
  {
    name: 'queue_email_campaign_send',
    description: 'Queue an existing AlphaClone email campaign for immediate sending through connected providers such as Zoho, Brevo, Resend, SendGrid, or Gmail. Keeps delivery inside AlphaClone.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        campaign_id: { type: 'string', description: 'Email campaign UUID from create_bulk_email_campaign or dashboard.' },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'get_email_campaign_delivery_status',
    description: 'Get campaign delivery progress, provider routing summary, sent/failed/open/click style recipient statuses, and sample failures.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        campaign_id: { type: 'string', description: 'Email campaign UUID.' },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'send_message',
    description: 'Send a workspace message to a teammate or group thread.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        recipient_id: { type: 'string', description: 'Optional user reference recipient' },
        group_id: { type: 'string', description: 'Optional group/thread reference' },
        text: { type: 'string' },
        priority: { type: 'string', description: 'low | normal | high | urgent' },
        reply_to: { type: 'string', description: 'Optional parent message reference' },
      },
      required: ['text'],
    },
  },
  {
    name: 'upload_media_asset',
    description: 'Upload an image or video file into workspace media storage and return the stored media reference and URL.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        file_name: { type: 'string', description: 'Original file name with extension' },
        mime_type: { type: 'string', description: 'MIME type such as image/png or video/mp4' },
        file_base64: { type: 'string', description: 'File data encoded as string (data:*;base64,...)' },
        alt_text: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['file_name', 'mime_type', 'file_base64'],
    },
  },
  {
    name: 'upload_document',
    description: 'Upload a document or file (PDF, Docx, Text) into the native AlphaClone Document Hub. Includes automated cyber-security scanning. Does not return a public/external link unless create_public_link is explicitly true.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        filename: { type: 'string', description: 'Original file name with extension' },
        mime_type: { type: 'string', description: 'MIME type such as application/pdf' },
        file_base64: { type: 'string', description: 'File data encoded as string (data:*;base64,...)' },
        category: { type: 'string', description: 'Optional category (e.g. "Invoice", "Contract")' },
        tags: { type: 'array', items: { type: 'string' } },
        entity_type: { type: 'string', description: 'Optional native link target: client, project, lead, deal, contract, invoice, task' },
        entity_id: { type: 'string', description: 'Optional AlphaClone record id for the link target' },
        create_public_link: { type: 'boolean', description: 'Only true when the user explicitly asks for an external/public share link.' },
        public_link_expires_hours: { type: 'number', description: 'Optional expiry for explicit public links. Defaults to 48 hours.' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'get_facebook_page_capabilities',
    description: 'Report the exact Facebook Page capabilities AlphaClone can use for the connected page: publish, media upload, delete, insights, comments, Messenger, and leads.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        page_id: { type: 'string', description: 'Optional page id. If omitted, the first publishable page is used.' },
      },
      required: [],
    },
  },
  {
    name: 'get_facebook_post_insights',
    description: 'Fetch reach and engagement metrics for a Facebook Page post through AlphaClone.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        page_id: { type: 'string', description: 'Optional page id. If omitted, the first publishable page is used.' },
        post_id: { type: 'string', description: 'Facebook post id.' },
      },
      required: ['post_id'],
    },
  },
  {
    name: 'delete_facebook_post',
    description: 'Delete a Facebook Page post using the connected AlphaClone Facebook Page token.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        page_id: { type: 'string', description: 'Optional page id. If omitted, the first publishable page is used.' },
        post_id: { type: 'string', description: 'Facebook post id to delete.' },
      },
      required: ['post_id'],
    },
  },
  {
    name: 'create_social_post',
    description: 'Autonomous Brand Distribution: Deploy professional content across the global social matrix (Facebook, LinkedIn, Instagram, X, TikTok).',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        platforms: { type: 'array', items: { type: 'string' }, description: 'facebook | linkedin | instagram | x | tiktok (default: facebook)' },
        page_id: { type: 'string', description: 'Optional connected Facebook Page ID. If omitted, MCP auto-selects a publishable page.' },
        caption: { type: 'string' },
        link_url: { type: 'string' },
        media_urls: { type: 'array', items: { type: 'string' }, description: 'Optional image URLs' },
        media_asset_ids: { type: 'array', items: { type: 'string' }, description: 'Optional media asset references uploaded to the workspace library' },
        hashtags: { type: 'array', items: { type: 'string' } },
        publish_now: { type: 'boolean' },
        scheduled_at: { type: 'string', description: 'Required ISO datetime when publish_now is false' },
        task_id: { type: 'string', description: 'Optional task reference to update with execution notes' },
        task_title: { type: 'string', description: 'Optional task title to create when task_id is not provided' },
        task_note: { type: 'string', description: 'Optional note describing what was posted/scheduled' },
        mark_task_done: { type: 'boolean', description: 'If true, mark task as completed after action.' },
        executing_agent: { type: 'string', description: 'The AI agent executing the tool: claude | grok | manus (default: auto)' },
        media_base64_data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              file_name: { type: 'string' },
              file_type: { type: 'string', description: 'e.g. image/png or video/mp4' },
              base64: { type: 'string', description: 'Base64 encoded file content. MCP automatically uploads this to sovereign Supabase storage.' }
            },
            required: ['file_name', 'file_type', 'base64']
          },
          description: 'Direct base64 media payload to solve uploading issues for Claude/Grok/Manus.'
        },
        auto_refine_with_context: { type: 'boolean', description: 'Automatically read workspace files (e.g. DESIGN.md) and enrich post with corporate safety, OSM maps, and solopreneur trial pricing alignment.' }
      },
      required: ['caption'],
    },
  },
  {
    name: 'create_post',
    description: 'DEPRECATED: Use create_social_post instead. Alias of create_social_post for legacy agent compatibility.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        platforms: { type: 'array', items: { type: 'string' }, description: 'facebook | linkedin | instagram | x | tiktok (default: facebook)' },
        page_id: { type: 'string', description: 'Optional connected Facebook Page ID. If omitted, MCP auto-selects a publishable page.' },
        caption: { type: 'string' },
        link_url: { type: 'string' },
        media_urls: { type: 'array', items: { type: 'string' } },
        media_asset_ids: { type: 'array', items: { type: 'string' } },
        hashtags: { type: 'array', items: { type: 'string' } },
        publish_now: { type: 'boolean' },
        scheduled_at: { type: 'string', description: 'Required ISO datetime when publish_now is false' },
        executing_agent: { type: 'string', description: 'The AI agent executing the tool: claude | grok | manus (default: auto)' },
        media_base64_data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              file_name: { type: 'string' },
              file_type: { type: 'string' },
              base64: { type: 'string' }
            },
            required: ['file_name', 'file_type', 'base64']
          }
        },
        auto_refine_with_context: { type: 'boolean' }
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        text: { type: 'string', description: 'Post text content' },
        post_as: { type: 'string', description: 'personal | company | all_pages (default: personal)' },
        media_urls: { type: 'array', items: { type: 'string' }, description: 'Optional image URLs for scheduled publishing' },
        media_asset_ids: { type: 'array', items: { type: 'string' }, description: 'Optional media asset references uploaded to the workspace library' },
        publish_now: { type: 'boolean' },
        scheduled_at: { type: 'string', description: 'Required ISO datetime when publish_now is false' },
        linkedin_organization_id: { type: 'string', description: 'Optional LinkedIn organization ID to post as company page' },
        task_id: { type: 'string', description: 'Optional task reference to update with execution notes' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        post_urn: { type: 'string', description: 'LinkedIn activity or ugcPost URN' },
        reaction_type: { type: 'string', description: 'LIKE | PRAISE | MAYBE | EMPATHY | INTEREST | APPRECIATION' },
      },
      required: ['post_urn'],
    },
  },
  {
    name: 'create_linkedin_event',
    description: 'Create a LinkedIn organization event. Use for webinars, networking, or brand announcements.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        name: { type: 'string', description: 'Event title' },
        description: { type: 'string' },
        start_time: { type: 'string', description: 'ISO datetime' },
        end_time: { type: 'string', description: 'ISO datetime' },
        timezone: { type: 'string', description: 'e.g. UTC, America/New_York' },
        event_type: { type: 'string', enum: ['ONLINE', 'IN_PERSON'], default: 'ONLINE' },
        online_url: { type: 'string', description: 'Meeting link if ONLINE' },
        linkedin_organization_id: { type: 'string', description: 'Required organization ID to host the event' },
      },
      required: ['name', 'start_time', 'end_time', 'linkedin_organization_id'],
    },
  },
  {
    name: 'get_linkedin_ad_accounts',
    description: 'List LinkedIn Advertising accounts connected to the workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'get_linkedin_ad_campaigns',
    description: 'Fetch ad campaigns for a specific LinkedIn ad account.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        ad_account_id: { type: 'string', description: 'The LinkedIn ad account URN or ID' },
        status: { type: 'string', description: 'ACTIVE | PAUSED | ARCHIVED | CANCELED' },
      },
      required: ['ad_account_id'],
    },
  },
  {
    name: 'get_linkedin_member_profile',
    description: 'Retrieve the basic profile and identity data for the authenticated LinkedIn member.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  // ── Projects ───────────────────────────────────────────────────────
  {
    name: 'get_projects',
    description: 'Access Strategic Project Portfolio: Retrieve the status, progress, and financial standing of all active business initiatives.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        status: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'get_project_summary',
    description: 'Get a rich AlphaClone project summary with project fields, task counts, estimated/actual hours, and linked Document Hub files.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        project_id: { type: 'string', description: 'Project UUID from get_projects.' },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'create_project',
    description:
      'Create a new native AlphaClone project in the workspace. Use like an Asana/Azure Boards-style workstream, but keep execution inside AlphaClone with CRM, documents, tasks, and email context linked together.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        name: { type: 'string', description: 'Project name/title' },
        description: { type: 'string', description: 'Optional project brief' },
        status: { type: 'string', description: 'planning | active | on_hold | completed | cancelled' },
        due_date: { type: 'string', description: 'Optional ISO date or datetime' },
        client_id: { type: 'string', description: 'Optional CRM client id to link this project to.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_project_status',
    description:
      'Update a project status. project_id must be the unique reference from get_projects, not the project name.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        project_id: { type: 'string', description: 'Reference from get_projects' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        project_id: {
          type: 'string',
          description: 'Optional. Reference of the linked business project (same as tasks.related_to_project).',
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
    description: 'Create a native AlphaClone task or schedule a follow-up. Use like Asana/Azure task assignment inside AlphaClone. Can link to projects and optionally notify the assignee by email.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        title: { type: 'string' },
        description: { type: 'string' },
        project_id: {
          type: 'string',
          description: 'Optional. Reference of business project to link (stored as related_to_project).',
        },
        assigned_to: { type: 'string' },
        notify_assignee: { type: 'boolean', description: 'If true and assigned_to has an email, send the task assignment by AlphaClone email.' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        task_id: { type: 'string', description: 'Task reference from get_tasks' },
        title: { type: 'string' },
        description: { type: 'string' },
        assigned_to: { type: 'string', description: 'Optional assignee user reference' },
        due_date: { type: 'string', description: 'ISO 8601 datetime or date string' },
        priority: { type: 'string', description: 'low | medium | high | urgent' },
        status: { type: 'string', description: 'ideas | todo | in_progress | review | completed | cancelled' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'send_task_email',
    description: 'Send a task by email with title, description, status, priority, assignee, project, and due date details.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        task_id: { type: 'string', description: 'Task reference from get_tasks' },
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Optional subject override' },
        message: { type: 'string', description: 'Optional intro message to include before the task details' },
        provider: { type: 'string', description: 'Optional provider override: zoho | brevo | sendgrid | resend' },
      },
      required: ['task_id', 'to'],
    },
  },
  {
    name: 'write_task_note',
    description:
      'Append a timestamped note to a task. Use for progress logs, blockers, handoff notes, and AI-generated summaries.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        task_id: { type: 'string', description: 'Task reference from get_tasks' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        status: { type: 'string', description: 'pending | approved | rejected' },
        from_date: { type: 'string', description: 'YYYY-MM-DD' },
        to_date: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: [],
    },
  },
  {
    name: 'create_expense',
    description: 'Log a new business expense manually. Use when the user specifies all details.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        description: { type: 'string', description: 'What was purchased / vendor name' },
        amount: { type: 'number', description: 'Amount in USD' },
        category: { type: 'string', description: 'Office Supplies | Travel | Software | Marketing | Meals | Utilities | Other' },
        date: { type: 'string', description: 'YYYY-MM-DD (defaults to today)' },
      },
      required: ['description', 'amount'],
    },
  },
  {
    name: 'automate_expense_entry',
    description: 'Autonomous Accounting: Use AI to parse a receipt image description or raw text and automatically record an expense.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        raw_data: { type: 'string', description: 'Raw text from a receipt, email, or user description of a purchase.' },
      },
      required: ['raw_data'],
    },
  },
  {
    name: 'get_revenue_summary',
    description:
      'Returns monthly revenue totals, paid vs outstanding split, and per-client breakdown (from business_invoices). Works as a single stateless POST from Claude chat — no artifact wrapper needed.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        client_id: { type: 'string', description: 'Optional reference of the client from get_clients' },
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
  {
    name: 'send_contract',
    description: 'Send a contract for review and digital signature. Generates a PDF of the contract and emails a secure signature link to the recipient using the tenant-configured email provider.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        contract_id: { type: 'string', description: 'Contract ID reference' },
        recipient_email: { type: 'string', description: 'Override recipient email. If omitted, uses email from the linked client.' },
        subject: { type: 'string', description: 'Optional custom email subject' },
        message: { type: 'string', description: 'Optional custom email body message' },
      },
      required: ['tenant_id', 'contract_id'],
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        client_id: { type: 'string', description: 'Client reference from get_clients.' },
        client_email: { type: 'string', description: 'Optional email fallback when client_id is unknown.' },
        limit: { type: 'number', description: 'Max records (default 50, max 200).' },
      },
      required: [],
    },
  },
  {
    name: 'get_zoho_mail_messages',
    description: 'Read full Zoho Mail messages for the connected user including body, recipients, read status, thread IDs, and attachments.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        user_id: { type: 'string', description: 'Optional user reference. Defaults to connection user.' },
        folder_id: { type: 'string', description: 'Zoho folderId. Omit to return folders.' },
        search_query: { type: 'string', description: 'If provided, perform Zoho mailbox search.' },
        limit: { type: 'number', description: 'Max records (default 20, max 100).' },
        start: { type: 'number', description: 'Zoho pagination start index (default 1).' },
      },
      required: [],
    },
  },
  {
    name: 'get_zoho_mail_thread',
    description: 'Read a full Zoho Mail conversation thread ordered chronologically with complete message bodies and attachment metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        user_id: { type: 'string', description: 'Optional user reference. Defaults to connection user.' },
        thread_id: { type: 'string', description: 'Zoho thread/conversation ID from get_zoho_mail_messages' },
      },
      required: ['thread_id'],
    },
  },
  {
    name: 'reply_to_zoho_mail',
    description: 'Reply to a Zoho Mail message preserving the thread chain, optionally with base64 attachments, and log the reply to matching CRM contact history.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        user_id: { type: 'string', description: 'Optional user reference. Defaults to connection user.' },
        message_id: { type: 'string', description: 'Zoho message ID to reply to' },
        body_html: { type: 'string', description: 'HTML reply body' },
        body_text: { type: 'string', description: 'Optional plain text reply body' },
        attachments: {
          type: 'array',
          description: 'Optional base64 attachments.',
          items: {
            type: 'object',
            properties: {
              filename: { type: 'string' },
              content: { type: 'string', description: 'Base64-encoded content' },
              content_type: { type: 'string' },
            },
            required: ['filename', 'content'],
          },
        },
      },
      required: ['message_id', 'body_html'],
    },
  },
  {
    name: 'send_transactional_email',
    description: 'Send a transactional email using the caller user scoped provider configuration. Supports base64 file attachments for sending PDFs and documents. For Claude, Manus, Grok, and other MCP clients: send documents as attachments/native email by default; do not create or include external document links unless the user explicitly asks. If no stored sender signature exists, ask the user for email_signature before sending.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        user_id: { type: 'string' },
        to: { type: 'string' },
        subject: { type: 'string' },
        html: { type: 'string' },
        text: { type: 'string' },
        from_name: { type: 'string' },
        provider: { type: 'string', description: 'Optional provider override: zoho | brevo | sendgrid | resend' },
        email_signature: { type: 'string', description: 'Sender-specific signature. Required when the user has not saved a signature in AlphaClone.' },
        document_file_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional AlphaClone Document Hub file_uploads IDs. By default these are attached directly to the email.',
        },
        include_public_document_links: {
          type: 'boolean',
          description: 'Only true when the user explicitly asks for share links. Links are AlphaClone-hosted and expire after 48 hours by default.',
        },
        public_link_expires_hours: {
          type: 'number',
          description: 'Optional expiry for explicit AlphaClone document share links. Defaults to 48 hours.',
        },
        attachments: {
          type: 'array',
          description: 'Optional file attachments to include in the email.',
          items: {
            type: 'object',
            properties: {
              filename: { type: 'string', description: 'The filename as it will appear to the recipient (e.g. Invoice_001.pdf)' },
              content: { type: 'string', description: 'Base64-encoded file content' },
              content_type: { type: 'string', description: 'MIME type of the file (e.g. application/pdf, image/png)' },
            },
            required: ['filename', 'content'],
          },
        },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        name: { type: 'string', description: 'Quote title' },
        contact_id: { type: 'string', description: 'Optional contact/client reference' },
        deal_id: { type: 'string', description: 'Optional deal reference' },
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
    name: 'send_quote',
    description: 'Send a quote/proposal by email with quote details and an attached quote document generated from AlphaClone data.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        quote_id: { type: 'string', description: 'Reference from get_quotes or create_quote' },
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Optional subject override' },
        message: { type: 'string', description: 'Optional intro message to include before quote details' },
        provider: { type: 'string', description: 'Optional provider override: zoho | brevo | sendgrid | resend' },
      },
      required: ['quote_id', 'to'],
    },
  },
  {
    name: 'update_quote',
    description: 'Update quote details and lifecycle status after creation.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        quote_id: { type: 'string', description: 'Reference from get_quotes' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        message_id: { type: 'string', description: 'Message reference from inbox/history' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        deal_id: { type: 'string', description: 'Deal reference from get_deals' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        action: { type: 'string', description: 'Short action key, e.g. mcp_note | integration_sync | user_request' },
        entity_type: { type: 'string', description: 'Category, e.g. mcp | lead | integration' },
        entity_id: { type: 'string', description: 'Optional reference of related entity' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        monthly_goal: { type: 'string', description: 'The strategic objective for this month (e.g. "Lead gen for SaaS product")' },
        topics: { type: 'array', items: { type: 'string' }, description: 'Optional list of specific topics to cover. If omitted, the AI will decide based on the goal.' },
        platforms: { type: 'array', items: { type: 'string' }, description: 'facebook | linkedin (default: both)' }
      },
      required: ['monthly_goal'],
    },
  },
  {
    name: 'create_post_with_ai_image',
    description: 'Autonomous Creator: Generates a professional AI image, saves it to permanent storage, writes a professional article and schedules it.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        limit: { type: 'number' }
      },
      required: [],
    },
  },
  {
    name: 'autonomous_reply',
    description: 'Autonomous Assistant: Drafts or sends a professional, emoji-free reply to a lead or client message using the best-suited AI model.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        entity_id: { type: 'string', description: 'The reference of the message or thread' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
    name: 'get_calendly_status',
    description: 'Check Calendly connection status and return configured booking URL plus local booking fallback.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'sync_calendly_events',
    description: 'Sync active Calendly scheduled events into the native AlphaClone calendar so reminders and CRM context work inside AlphaClone.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        user_id: { type: 'string', description: 'Optional calendar owner. Defaults to MCP user.' },
      },
      required: [],
    },
  },
  {
    name: 'create_subscription_checkout',
    description: 'Payment/subscription adapter: creates Stripe checkout URL for subscription upgrade.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
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
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        document_url: { type: 'string' },
        document_text: { type: 'string' },
        document_type: { type: 'string', description: 'contract | proposal | invoice | nda | other' },
      },
      required: [],
    },
  },
  {
    name: 'start_invoice_lifecycle',
    description: 'Autonomous Workflows: Trigger the full durable invoice lifecycle (PDF -> Send -> Reminders -> Overdue).',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        invoice_id: { type: 'string' }
      },
      required: ['invoice_id'],
    },
  },
  {
    name: 'start_contract_lifecycle',
    description: 'Autonomous Workflows: Trigger the durable contract lifecycle (Signature -> Project -> Task Creation -> Invoicing).',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        contract_id: { type: 'string' }
      },
      required: ['contract_id'],
    },
  },
  {
    name: 'start_lead_campaign',
    description: 'Autonomous Workflows: Trigger lead finding automation (Scrape -> Enrich -> Score -> Inject).',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        query: { type: 'string' },
        location: { type: 'string' }
      },
      required: ['query', 'location'],
    },
  },
  {
    name: 'start_lead_nurture',
    description: 'Autonomous Workflows: Trigger durable lead nurturing outreach sequence.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        lead_id: { type: 'string' }
      },
      required: ['lead_id'],
    },
  },
  {
    name: 'trigger_deal_automation',
    description: 'Vercel Workflows: Trigger deal stage automation based on stage changes.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        deal_id: { type: 'string' },
        stage: { type: 'string' }
      },
      required: ['deal_id', 'stage'],
    },
  },
  {
    name: 'schedule_social_automation',
    description: 'Vercel Workflows: Trigger social post publication and engagement tracking.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        post_id: { type: 'string' }
      },
      required: ['post_id'],
    },
  },
  {
    name: 'start_email_campaign',
    description: 'Vercel Workflows: Trigger bulk email campaign and performance tracking.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        campaign_id: { type: 'string' }
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'kickoff_project_automation',
    description: 'Vercel Workflows: Trigger project environment setup and milestone monitoring.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        project_id: { type: 'string' }
      },
      required: ['project_id'],
    },
  },
  {
    name: 'orchestrate_meeting_workflow',
    description: 'Vercel Workflows: Trigger post-meeting cleanup and CRM sync.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        meeting_id: { type: 'string' }
      },
      required: ['meeting_id'],
    },
  },
  {
    name: 'onboard_user_automation',
    description: 'Vercel Workflows: Trigger durable user onboarding sequence.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        user_id: { type: 'string' }
      },
      required: ['user_id'],
    },
  },
  {
    name: 'run_mcp_agent_workflow',
    description: 'Vercel Workflows: Run a durable AI agent workflow for complex tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        prompt: { type: 'string' }
      },
      required: ['prompt'],
    },
  },
  {
    name: 'generate_viral_video_script',
    description: 'Generate a high-engagement, viral business video script with hooks and visual cues.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Core theme of the video' },
        intensity: { type: 'string', enum: ['normal', 'high', 'extreme'], default: 'high' }
      },
      required: ['topic'],
    },
  },
  {
    name: 'generate_grok_video',
    description: 'Generate a short Grok/xAI video inside AlphaClone using grok-imagine-video. Supports text-to-video and image-to-video via image_url. Returns the xAI video URL when ready.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        prompt: { type: 'string', description: 'Video generation prompt' },
        image_url: { type: 'string', description: 'Optional source image URL for image-to-video' },
        duration: { type: 'number', description: 'Duration in seconds, clamped to provider-supported short clips' },
        poll: { type: 'boolean', description: 'If true, wait for completion. Defaults true.' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'send_batch_outreach',
    description: 'Trigger personalized outreach to multiple leads simultaneously.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_ids: { type: 'array', items: { type: 'string' }, description: 'List of lead UUIDs' },
        tone: { type: 'string', description: 'Tone of the message (professional, punchy, etc.)' },
        custom_context: { type: 'string', description: 'Additional context for personalization' },
        delivery_provider: { type: 'string', enum: ['sendgrid', 'resend', 'zoho'], default: 'sendgrid' }
      },
      required: ['lead_ids'],
    },
  },
  {
    name: 'get_x_profile',
    description: 'Fetch an X (Twitter) user profile by username or ID.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        username: { type: 'string', description: 'X username (without @)' },
      },
      required: [],
    },
  },
  {
    name: 'search_x_tweets',
    description: 'Search for recent tweets on X. Highly effective for lead hunting and market research.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        query: { type: 'string', description: 'Search query (supports operators like from:, has:media, etc.)' },
        limit: { type: 'number', description: 'Max results (default 10, max 100)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'post_x_tweet',
    description: 'Post a new tweet to the connected X account with optional image. Strictly for business/professional content. To include an image, provide image_url (a public URL to an image) or image_base64 (base64-encoded image data).',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        text: { type: 'string', description: 'Tweet content (max 280 chars)' },
        image_url: { type: 'string', description: 'Optional: public URL of an image to attach to the tweet' },
        image_base64: { type: 'string', description: 'Optional: base64-encoded image data to attach (alternative to image_url)' },
        image_mime_type: { type: 'string', description: 'MIME type of the image (e.g. image/png, image/jpeg) — required when using image_base64' },
      },
      required: ['text'],
    },
  },
  {
    name: 'reply_to_x_tweet',
    description: 'Reply to a specific tweet on X. Used for engagement and lead nurturing.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        tweet_id: { type: 'string', description: 'The ID of the tweet to reply to' },
        text: { type: 'string', description: 'Reply content' },
      },
      required: ['tweet_id', 'text'],
    },
  },
  {
    name: 'send_x_dm',
    description: 'Send a direct message to an X user.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        recipient_id: { type: 'string', description: 'X user ID of the recipient' },
        text: { type: 'string', description: 'Message content' },
      },
      required: ['recipient_id', 'text'],
    },
  },
  {
    name: 'get_x_timeline',
    description: 'Autonomous Social Intelligence: Access the latest signals and sentiment from the connected X account timeline.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'search_x_users',
    description: 'High-Value Signal Discovery: Search for X users by biography, reputation, or interests to identify strategic engagement opportunities.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        query: { type: 'string', description: 'Strategic search query' },
        limit: { type: 'number', description: 'Max results (default 10, max 50)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'nexus_payroll_sync',
    description: 'AlphaClone Nexus: Autonomous Payroll Orchestration and disbursement reconciliation.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'nexus_invoice_chasing',
    description: 'AlphaClone Nexus: Autonomous Revenue Collection and systematic payment follow-up.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'nexus_month_end_close',
    description: 'AlphaClone Nexus: Fiscal Period Finalization and Month-End Reconciliation.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'nexus_lead_enrichment',
    description: 'AlphaClone Nexus: Strategic Lead Intelligence and CRM Data Augmentation.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'nexus_sales_campaign',
    description: 'AlphaClone Nexus: Autonomous Growth Engineering and Sales Pipeline Activation. Can automatically send outreach emails to leads when auto_send_outreach=true.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        auto_send_outreach: { type: 'boolean', description: 'Set to true to automatically send outreach emails to the top campaign targets. Requires an email provider configured in Settings.' },
        outreach_context: { type: 'string', description: 'Optional context or message to personalise the outreach email (e.g. "We can help you with payroll automation").' },
        user_id: { type: 'string', description: 'Optional: user profile ID to use for email provider resolution' },
      },
      required: [],
    },
  },
  {
    name: 'nexus_contract_drafter',
    description: 'AlphaClone Nexus: Autonomous Legal Instrument Drafting. When contract_type and client_name are provided, uses AI to draft and save a full professional contract. Without those params, returns an overview of existing contracts and prompts for drafting details.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        contract_type: { type: 'string', description: 'Type of contract to draft, e.g. "Service Agreement", "NDA", "MSA", "SOW"' },
        client_name: { type: 'string', description: 'Full name of the client the contract is for' },
        key_terms: { type: 'string', description: 'Optional key terms, scope, or special clauses to include in the contract' },
      },
      required: [],
    },
  },
  {
    name: 'nexus_content_synthesis',
    description: 'AlphaClone Nexus: Brand Continuity Engine and Autonomous Content Orchestration.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'nexus_market_pulse',
    description: 'AlphaClone Nexus: Real-Time Market Intelligence and Competitor Signal Analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'nexus_design_audit',
    description: 'AlphaClone Nexus: Autonomous Aesthetic Audit and Brand Identity Verification.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'nexus_project_architect',
    description: 'AlphaClone Nexus: Strategic Project Architecting and Operational Dependency Mapping.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'nexus_calendar_nexus',
    description: 'AlphaClone Nexus: Temporal Optimization and Executive Schedule Orchestration.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'nexus_email_triage',
    description: 'AlphaClone Nexus: Intelligent Communication Triage and Priority Inbox Management.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'nexus_support_triage',
    description: 'AlphaClone Nexus: Triage customer support tickets and escalate critical issues.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'nexus_onboarding_flow',
    description: 'AlphaClone Nexus: Optimize customer and user onboarding sequences.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'nexus_meeting_intelligence',
    description: 'AlphaClone Nexus: Extract and synthesize intelligence from meeting transcripts.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  // ── Advanced DMS ───────────────────────────────────────────────────
  {
    name: 'get_documents',
    description: 'Access Permanent Business Records: Retrieve workspace documents, legal filings, and fiscal records with strategic filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        category: { type: 'string', description: 'e.g. Invoice, Contract, ID, Receipt' },
        entity_type: { type: 'string' },
        entity_id: { type: 'string' },
        limit: { type: 'number' },
      },
      required: [],
    },
  },
  {
    name: 'search_documents',
    description: 'Search documents by filename, tags, or content metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        query: { type: 'string', description: 'Search term' },
      },
      required: ['query'],
    },
  },
  // ── Advanced Accounting ─────────────────────────────────────────────
  {
    name: 'get_balance_sheet',
    description: 'Generate Strategic Balance Sheet: A point-in-time analysis of Assets, Liabilities, and Equity to assess organizational solvency.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        as_of_date: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: [],
    },
  },
  {
    name: 'get_cash_flow_statement',
    description: 'Analyze cash inflows and outflows for a specific period.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        from_date: { type: 'string' },
        to_date: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'create_journal_entry',
    description: 'Manually record a double-entry journal entry in the general ledger.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        date: { type: 'string' },
        description: { type: 'string' },
        lines: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              account_id: { type: 'string' },
              debit: { type: 'number' },
              credit: { type: 'number' },
            },
            required: ['account_id'],
          },
        },
      },
      required: ['description', 'lines'],
    },
  },
  // ── Advanced Project Architecture ──────────────────────────────────
  {
    name: 'get_project_details',
    description: 'Comprehensive project status including tasks, milestones, and financial progress.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        project_id: { type: 'string' },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'get_project_timeline',
    description: 'Flat timeline of all project events, status changes, and upcoming deadlines.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        project_id: { type: 'string' },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'send_project_email',
    description: 'Send a project summary by email with project status, due date, task list, milestones, and optional message.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        project_id: { type: 'string', description: 'Project reference from get_projects' },
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Optional subject override' },
        message: { type: 'string', description: 'Optional intro message before the project details' },
        provider: { type: 'string', description: 'Optional provider override: zoho | brevo | sendgrid | resend' },
      },
      required: ['project_id', 'to'],
    },
  },
  {
    name: 'task_create',
    description: 'Autonomous Scheduler: Create a recurring or one-time AI prompt task. e.g. "Check Bitcoin price every morning"',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        name: { type: 'string', description: 'Name for the task' },
        prompt: { type: 'string', description: 'What the AI should do each time the task runs' },
        schedule: { type: 'string', description: 'Cron expression or natural language (e.g. "every day at 8am")' },
        timezone: { type: 'string', description: 'Default: UTC' },
        notification_preference: { type: 'object', description: 'e.g. {"email": true}' }
      },
      required: ['name', 'prompt', 'schedule'],
    },
  },
  {
    name: 'task_list',
    description: 'Autonomous Assistant: List all scheduled AI tasks and their current status.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'task_get_results',
    description: 'Autonomous Assistant: Retrieve the latest outputs from a specific AI task.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        task_id: { type: 'string', description: 'Task reference from task_list' },
        limit: { type: 'number', description: 'Max results to pull (default 5)' }
      },
      required: ['task_id'],
    },
  },
  {
    name: 'task_pause',
    description: 'Autonomous Assistant: Temporarily stop a scheduled task.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        task_id: { type: 'string', description: 'Task reference' }
      },
      required: ['task_id'],
    },
  },
  {
    name: 'task_resume',
    description: 'Autonomous Assistant: Resume a paused scheduled task.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        task_id: { type: 'string', description: 'Task reference' }
      },
      required: ['task_id'],
    },
  },
  {
    name: 'task_delete',
    description: 'Autonomous Assistant: Permanently remove a scheduled task.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        task_id: { type: 'string', description: 'Task reference' }
      },
      required: ['task_id'],
    },
  },
  {
    name: 'nexus_strategic_orchestrator',
    description: 'AlphaClone Nexus: High-Level Strategic Orchestrator. Triggers multiple autonomous systems to achieve a complex business objective.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        objective: { type: 'string', description: 'The high-level business goal (e.g. "Maximize Q3 collection", "Aggressive growth scan")' },
      },
      required: ['objective'],
    },
  },
  {
    name: 'generate_market_authority_report',
    description: 'AlphaClone Nexus: Generate a Market Authority Report. Synthesizes real-time market signals with autonomous content strategy to solidify brand dominance.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  // ── Identity & Session ─────────────────────────────────────────────
  {
    name: 'get_current_user',
    description: 'Get the authenticated user\'s internal AlphaClone profile ID, email, display name, and workspace (tenant) ID from the current MCP session. Use this before calling tools that require a user_id (e.g. get_momentum_score) when the internal ID is not already known.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID (optional — resolved from session if omitted)' },
      },
      required: [],
    },
  },
  // ── WhatsApp Chatbot & Outreach ─────────────────────────────────────
  {
    name: 'enable_whatsapp_chatbot',
    description: 'Turn on auto-reply for tenant\'s WhatsApp integration.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'disable_whatsapp_chatbot',
    description: 'Turn off auto-reply for tenant\'s WhatsApp integration (tenant handles manually).',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'train_chatbot',
    description: 'Manually trigger training refresh from latest conversations and CRM data.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'get_chatbot_persona',
    description: 'View the current persona prompt for review/edit.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'update_chatbot_persona',
    description: 'Override or update specific persona instructions for the WhatsApp Chatbot.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        persona_prompt: { type: 'string' },
      },
      required: ['persona_prompt'],
    },
  },
  {
    name: 'get_chatbot_conversations',
    description: 'View all chatbot-handled conversations.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        limit: { type: 'number' },
      },
      required: [],
    },
  },
  {
    name: 'send_whatsapp_message',
    description: 'Send a WhatsApp message through the tenant connected WhatsApp integration and return the real provider delivery result.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        phone: { type: 'string', description: 'Recipient phone number in international format' },
        message: { type: 'string', description: 'Message text to send' },
        contact_id: { type: 'string', description: 'Optional CRM contact/client reference' },
        integration_id: { type: 'string', description: 'Optional WhatsApp integration override' },
      },
      required: ['phone', 'message'],
    },
  },
  {
    name: 'get_whatsapp_status',
    description: 'Diagnose tenant WhatsApp setup, recent sends, inbox sync, chatbot settings, and missing configuration.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'set_chatbot_handoff_rules',
    description: 'Define triggers for when the chatbot escalates to a human.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        handoff_rules: { type: 'object' },
      },
      required: ['handoff_rules'],
    },
  },
  {
    name: 'enable_lead_auto_outreach',
    description: 'Automatically message new leads on WhatsApp when added to CRM.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        enabled: { type: 'boolean' },
      },
      required: ['enabled'],
    },
  },
  {
    name: 'set_outreach_limits',
    description: 'Set max messages per day and delay between sends for WhatsApp outreach.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        outreach_limit_per_day: { type: 'number' },
        outreach_delay_seconds: { type: 'number' },
      },
      required: ['outreach_limit_per_day', 'outreach_delay_seconds'],
    },
  },
  {
    name: 'get_chatbot_performance',
    description: 'Stats: messages handled, replies sent, leads qualified, handoffs triggered.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      },
      required: [],
    },
  },
  {
    name: 'execute_strategic_intelligence',
    description: 'Unified router for executing AlphaClone 3-Year Leap strategic intelligence modules (e.g. pricing_elasticity, churn_propensity, proposal_generator, ivr_agent, network_graph, data_enrichment, revenue_recognition, invoice_factoring, objection_handling, narrative_reports, anomaly_alert, sql_query, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        module_name: { type: 'string', description: 'The name of the intelligence module to execute' },
        parameters: { type: 'object', description: 'Parameters required by the chosen intelligence module (e.g., deal_id, client_id, query, etc.)' }
      },
      required: ['module_name']
    }
  },
  // ── Bonnie Dreaming (Self-Improving Agent) ─────────────────────────────────
  {
    name: 'trigger_bonnie_dream',
    description: 'Triggers a Bonnie Dreaming session: reviews the last 50 MCP session logs, calls the Claude Managed Agents dreaming endpoint to extract patterns, and stores results. Optionally auto-applies memory updates.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        auto_apply: { type: 'boolean', description: 'Auto-apply extracted patterns immediately (default false)', default: false },
      },
      required: ['tenant_id'],
    },
  },
  {
    name: 'get_dream_sessions',
    description: 'Returns the history of Bonnie dreaming sessions for the tenant, including extracted patterns and memory updates.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        limit: { type: 'number', description: 'Max sessions to return (default 10)', default: 10 },
      },
      required: ['tenant_id'],
    },
  },
  {
    name: 'approve_dream_update',
    description: 'Approves a pending Bonnie dreaming session and marks its memory updates as applied.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        session_id: { type: 'string', description: 'Dream session UUID to approve' },
      },
      required: ['tenant_id', 'session_id'],
    },
  },
  // ── Bonnie Multiagent Orchestration ────────────────────────────────────────
  {
    name: 'orchestrate_task',
    description: 'Orchestrates a complex task by delegating sub-tasks to specialized Bonnie subagents using the Claude Managed Agents multiagent session type.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        task: { type: 'string', description: 'High-level task description' },
        subagents: {
          type: 'array',
          description: 'List of subagents (max 5). Each has: name, role, instructions.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              role: { type: 'string' },
              instructions: { type: 'string' },
            },
            required: ['name', 'role', 'instructions'],
          },
        },
      },
      required: ['tenant_id', 'task', 'subagents'],
    },
  },
  {
    name: 'get_orchestration_history',
    description: 'Returns the history of orchestrated tasks from MCP session logs for the tenant.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        limit: { type: 'number', description: 'Max history entries (default 20)', default: 20 },
      },
      required: ['tenant_id'],
    },
  },
  // ── Bonnie Outcomes ────────────────────────────────────────────────────────
  {
    name: 'define_outcome',
    description: 'Defines and records the success/failure outcome of a Bonnie agent session, including evaluation criteria and performance scores.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        session_id: { type: 'string', description: 'Optional MCP session ID this outcome is linked to' },
        criteria: {
          type: 'array',
          description: 'Evaluation criteria with met/not-met flags',
          items: {
            type: 'object',
            properties: {
              metric: { type: 'string' },
              target: { type: ['string', 'number'] },
              actual: { type: ['string', 'number'] },
              met: { type: 'boolean' },
            },
            required: ['metric', 'target', 'met'],
          },
        },
        status: { type: 'string', enum: ['success', 'partial', 'failure'], description: 'Overall outcome status' },
        notes: { type: 'string', description: 'Optional notes about the outcome' },
      },
      required: ['tenant_id', 'criteria', 'status'],
    },
  },
  // ── External Integrations (MCP Hooks) ─────────────────────────────────────
  {
    name: 'export_to_google_workspace',
    description: 'Exports AlphaClone data (contacts, invoices, deals, documents) to Google Workspace (Sheets, Docs, Drive). Requires a connected Google OAuth token.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        export_type: { type: 'string', enum: ['contacts', 'invoices', 'deals', 'documents'], description: 'Type of data to export' },
        destination: { type: 'string', enum: ['sheets', 'docs', 'drive'], description: 'Google Workspace destination' },
        title: { type: 'string', description: 'Optional title for the exported file' },
        filters: { type: 'object', description: 'Optional filters to narrow the export' },
      },
      required: ['tenant_id', 'export_type', 'destination'],
    },
  },
  // ── API Health & Rate Limit Diagnostics ────────────────────────────────────
  {
    name: 'get_api_health',
    description: 'Returns API health metrics including tool execution success rates, error rates, average latency, and rate-limit diagnostics for the tenant.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        hours: { type: 'number', description: 'Lookback window in hours (default 24, max 168)', default: 24 },
      },
      required: ['tenant_id'],
    },
  },
  // ── Document → Claude (Files API) ─────────────────────────────────────────
  {
    name: 'send_document_to_claude',
    description: 'Sends a contract, invoice, quote, or workspace file directly to Claude for unlimited analysis, Q&A, or summarization using the Anthropic Files API. No token or size limits.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        document_type: { type: 'string', enum: ['contract', 'invoice', 'quote', 'file'], description: 'Type of document to retrieve and send to Claude' },
        document_id: { type: 'string', description: 'UUID of the contract, invoice, quote, or file' },
        question: { type: 'string', description: 'What you want Claude to analyze, answer, or do with the document' },
        system_prompt: { type: 'string', description: 'Optional custom system prompt for Claude' },
        model: { type: 'string', description: 'Optional Claude model override' },
      },
      required: ['tenant_id', 'document_type', 'document_id', 'question'],
    },
  },
  {
    name: 'analyze_workspace_document_url',
    description: 'Fetches any document by URL (PDF, TXT, contract, invoice) and sends it directly to Claude for full analysis — no size limits.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        document_url: { type: 'string', description: 'Public URL of the document to analyze' },
        document_name: { type: 'string', description: 'Optional display name for the document' },
        mime_type: { type: 'string', description: 'MIME type (default: application/pdf)', default: 'application/pdf' },
        question: { type: 'string', description: 'What you want Claude to do with the document' },
        system_prompt: { type: 'string', description: 'Optional system prompt for Claude' },
        model: { type: 'string', description: 'Optional Claude model override' },
      },
      required: ['tenant_id', 'document_url', 'question'],
    },
  },
  // ── Facebook Reels & Multi-Photo ───────────────────────────────────────────
  {
    name: 'publish_facebook_reel',
    description: 'Publishes a Facebook Reel (short video) to a connected Facebook Page. Accepts a public video URL or base64-encoded video. Supports immediate publish or scheduled publishing.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        page_id: { type: 'string', description: 'Facebook Page ID (uses first connected page if omitted)' },
        video_url: { type: 'string', description: 'Public URL of the video to publish as a Reel' },
        video_base64: { type: 'string', description: 'Base64-encoded video content (alternative to video_url)' },
        video_filename: { type: 'string', description: 'Filename for base64 video', default: 'reel.mp4' },
        description: { type: 'string', description: 'Reel caption/description' },
        title: { type: 'string', description: 'Optional Reel title' },
        publish_now: { type: 'boolean', description: 'Publish immediately (default: true)', default: true },
        scheduled_publish_time: { type: 'number', description: 'Unix timestamp for scheduled publishing' },
      },
      required: ['tenant_id'],
    },
  },
  {
    name: 'publish_facebook_multi_photo',
    description: 'Publishes a Facebook post with multiple photos (1–10 images) in a single post. Accepts public image URLs or base64-encoded images. Creates a proper multi-photo Facebook carousel post.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        page_id: { type: 'string', description: 'Facebook Page ID (uses first connected page if omitted)' },
        caption: { type: 'string', description: 'Post caption/text' },
        photos: {
          type: 'array',
          description: 'List of 1–10 photos. Each needs url or base64.',
          items: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'Public image URL' },
              base64: { type: 'string', description: 'Base64-encoded image' },
              filename: { type: 'string', description: 'Filename for base64 uploads', default: 'photo.jpg' },
            },
          },
        },
        link_url: { type: 'string', description: 'Optional link URL to attach to the post' },
        publish_now: { type: 'boolean', description: 'Publish immediately (default: true)', default: true },
      },
      required: ['tenant_id', 'caption', 'photos'],
    },
  },
  {
    name: 'run_chief_of_staff_routine',
    description: 'Execute the autonomous Chief of Staff routine: 1) Pipeline Health (draft invoices, new deals for stale leads, update due tasks), 2) Revenue Recovery (nexus invoice chasing, resend), 3) Deal Pipeline (get leads without deals, create deals, score them), 4) Daily Social Engine (post 3 rotated content updates on LinkedIn and Facebook scheduled at 9am, 1pm, 5pm Warsaw time). Runs once per calendar day for social updates.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
        user_id: { type: 'string', description: 'Optional user UUID' },
      },
      required: ['tenant_id'],
    },
  },
];
