# 🎯 SYSTEMS ROADMAP TO 100% PRODUCTION READY
## AlphaClone Platform - Smart Systems Architecture

**Current State**: 65% - Siloed features working independently
**Target State**: 100% - Intelligent systems working as unified ecosystem
**Approach**: Systems thinking, not page-by-page fixes

---

## 🧠 SYSTEMS THINKING: The Real Problem

### **What's Wrong Right Now**:
```
Current Architecture (BROKEN):
┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
│   CRM   │  │ Finance │  │Messages │  │Calendar │
│ (Alone) │  │ (Alone) │  │ (Alone) │  │ (Alone) │
└─────────┘  └─────────┘  └─────────┘  └─────────┘
     ❌ No data flow        ❌ No automation
     ❌ Manual work         ❌ Duplicate entry
     ❌ No intelligence     ❌ Poor UX
```

### **What We Need**:
```
Target Architecture (SMART):
                  ┌──────────────────┐
                  │  UNIFIED DATA    │
                  │  LAYER (Truth)   │
                  └────────┬─────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐      ┌─────▼─────┐      ┌────▼────┐
   │   CRM   │◄────►│  Finance  │◄────►│Messages │
   │ System  │      │  System   │      │ System  │
   └────┬────┘      └─────┬─────┘      └────┬────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                  ┌────────▼─────────┐
                  │  AUTOMATION      │
                  │  ENGINE (Smart)  │
                  └──────────────────┘
```

**Key Principles**:
1. **Single Source of Truth** - One database, no duplication
2. **Event-Driven Architecture** - Systems react to changes
3. **Smart Automation** - AI + rules engine
4. **Real-Time Sync** - Everything updates instantly
5. **Unified UX** - Seamless cross-system workflows

---

## 🏗️ SYSTEM 1: UNIFIED DATA ARCHITECTURE

### **Problem**: Data scattered across disconnected tables

**Current State**:
- `leads` table (no link to contacts)
- `deals` table (no link to companies)
- `clients` table (portal users, not CRM)
- `messages` table (internal only)
- No unified communication log
- No activity timeline

**Target State**: Single customer record with unified timeline

### **Implementation - Week 1**:

#### 1.1 Create Core Entity Model
```sql
-- Companies (Organizations)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  domain TEXT UNIQUE,
  industry TEXT,
  employee_count INTEGER,
  annual_revenue DECIMAL,
  lifecycle_stage TEXT DEFAULT 'lead', -- lead, prospect, customer, churned
  health_score INTEGER DEFAULT 50, -- 0-100
  parent_company_id UUID REFERENCES companies(id),

  -- Smart fields
  last_activity_at TIMESTAMPTZ,
  next_followup_at TIMESTAMPTZ,
  assigned_to UUID REFERENCES users(id),

  -- Metadata
  custom_fields JSONB DEFAULT '{}',
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts (People)
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  company_id UUID REFERENCES companies(id),

  -- Identity
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  title TEXT,
  department TEXT,

  -- Social
  linkedin_url TEXT,
  twitter_handle TEXT,

  -- Engagement
  lead_score INTEGER DEFAULT 0,
  lifecycle_stage TEXT DEFAULT 'lead',
  status TEXT DEFAULT 'active',

  -- Smart tracking
  last_contacted_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  next_followup_at TIMESTAMPTZ,

  -- Metadata
  custom_fields JSONB DEFAULT '{}',
  tags TEXT[],
  preferences JSONB DEFAULT '{}', -- communication preferences
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Opportunities (Sales Pipeline)
CREATE TABLE opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  primary_contact_id UUID REFERENCES contacts(id),

  -- Deal info
  name TEXT NOT NULL,
  amount DECIMAL,
  currency TEXT DEFAULT 'USD',
  stage TEXT NOT NULL, -- lead, qualified, proposal, negotiation, closed_won, closed_lost
  probability INTEGER, -- 0-100
  close_date DATE,

  -- Assignment
  owner_id UUID REFERENCES users(id),

  -- Tracking
  lead_source TEXT,
  campaign_id UUID,
  lost_reason TEXT,

  -- Smart fields
  last_activity_at TIMESTAMPTZ,
  next_followup_at TIMESTAMPTZ,
  days_in_stage INTEGER DEFAULT 0,

  -- Metadata
  custom_fields JSONB DEFAULT '{}',
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- Unified Activity Timeline
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  -- Polymorphic relations (link to any entity)
  company_id UUID REFERENCES companies(id),
  contact_id UUID REFERENCES contacts(id),
  opportunity_id UUID REFERENCES opportunities(id),
  project_id UUID REFERENCES projects(id),

  -- Activity details
  type TEXT NOT NULL, -- email, call, meeting, note, task, contract_signed, invoice_sent, payment_received
  subject TEXT,
  description TEXT,
  outcome TEXT,

  -- Actors
  created_by UUID REFERENCES users(id),
  assigned_to UUID REFERENCES users(id),

  -- Timing
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_minutes INTEGER,

  -- Metadata
  metadata JSONB DEFAULT '{}', -- flexible data per activity type
  is_automated BOOLEAN DEFAULT false,
  source TEXT, -- manual, email, automation, integration

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unified Communications Log
CREATE TABLE unified_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  -- Relations
  company_id UUID REFERENCES companies(id),
  contact_id UUID REFERENCES contacts(id),
  opportunity_id UUID REFERENCES opportunities(id),

  -- Message details
  source TEXT NOT NULL, -- internal, gmail, zoho, sms, slack
  external_id TEXT, -- provider's message ID
  thread_id TEXT, -- group related messages

  direction TEXT NOT NULL, -- inbound, outbound
  channel TEXT NOT NULL, -- email, chat, sms, call

  -- Content
  subject TEXT,
  body TEXT,
  html_body TEXT,
  attachments JSONB DEFAULT '[]',

  -- Parties
  from_address TEXT,
  to_address TEXT,
  cc_address TEXT,
  bcc_address TEXT,

  -- Status
  read BOOLEAN DEFAULT false,
  replied BOOLEAN DEFAULT false,
  starred BOOLEAN DEFAULT false,
  folder TEXT, -- inbox, sent, archive, trash

  -- Smart fields
  sentiment TEXT, -- positive, neutral, negative (AI-analyzed)
  priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
  auto_replied BOOLEAN DEFAULT false,

  -- Timing
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  tags TEXT[],

  -- Search optimization
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(subject, '') || ' ' || coalesce(body, ''))
  ) STORED,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_companies_tenant ON companies(tenant_id);
CREATE INDEX idx_companies_domain ON companies(domain);
CREATE INDEX idx_companies_health ON companies(health_score DESC);

CREATE INDEX idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_score ON contacts(lead_score DESC);

CREATE INDEX idx_opportunities_tenant ON opportunities(tenant_id);
CREATE INDEX idx_opportunities_company ON opportunities(company_id);
CREATE INDEX idx_opportunities_stage ON opportunities(stage);
CREATE INDEX idx_opportunities_owner ON opportunities(owner_id);
CREATE INDEX idx_opportunities_close_date ON opportunities(close_date);

CREATE INDEX idx_activities_tenant ON activities(tenant_id);
CREATE INDEX idx_activities_company ON activities(company_id);
CREATE INDEX idx_activities_contact ON activities(contact_id);
CREATE INDEX idx_activities_opportunity ON activities(opportunity_id);
CREATE INDEX idx_activities_type ON activities(type);
CREATE INDEX idx_activities_created ON activities(created_at DESC);

CREATE INDEX idx_messages_tenant ON unified_messages(tenant_id);
CREATE INDEX idx_messages_company ON unified_messages(company_id);
CREATE INDEX idx_messages_contact ON unified_messages(contact_id);
CREATE INDEX idx_messages_thread ON unified_messages(thread_id);
CREATE INDEX idx_messages_search ON unified_messages USING GIN(search_vector);
CREATE INDEX idx_messages_received ON unified_messages(received_at DESC);
```

#### 1.2 Add RLS Policies (Multi-Tenant Security)
```sql
-- Companies RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant users can access their companies"
  ON companies FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

-- Contacts RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant users can access their contacts"
  ON contacts FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

-- Opportunities RLS
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant users can access their opportunities"
  ON opportunities FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

-- Activities RLS
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant users can access their activities"
  ON activities FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

-- Unified Messages RLS
ALTER TABLE unified_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant users can access their messages"
  ON unified_messages FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));
```

#### 1.3 Migration Strategy
```typescript
// src/services/migration/dataUnificationService.ts

export class DataUnificationService {
  /**
   * Migrate legacy leads to new structure
   */
  async migrateLeads() {
    // 1. Convert leads to contacts + companies
    const leads = await supabase.from('leads').select('*');

    for (const lead of leads.data) {
      // Create or find company
      const company = await this.upsertCompany({
        name: lead.businessName,
        domain: this.extractDomain(lead.email),
        industry: lead.industry,
        lifecycle_stage: lead.stage
      });

      // Create contact
      const contact = await this.upsertContact({
        company_id: company.id,
        first_name: lead.businessName.split(' ')[0],
        last_name: lead.businessName.split(' ').slice(1).join(' '),
        email: lead.email,
        phone: lead.phone,
        lead_score: lead.score || 0,
        lifecycle_stage: lead.stage
      });

      // Create opportunity if qualified
      if (lead.stage !== 'lead') {
        await this.upsertOpportunity({
          company_id: company.id,
          primary_contact_id: contact.id,
          name: `${company.name} - Opportunity`,
          stage: this.mapStage(lead.stage),
          amount: lead.estimatedValue
        });
      }

      // Migrate notes to activities
      if (lead.notes) {
        await this.createActivity({
          contact_id: contact.id,
          company_id: company.id,
          type: 'note',
          description: lead.notes,
          source: 'migration'
        });
      }
    }
  }

  /**
   * Migrate existing deals to opportunities
   */
  async migrateDeals() {
    const deals = await supabase.from('deals').select('*');

    for (const deal of deals.data) {
      // Find or create company from deal
      const company = await this.findOrCreateCompany(deal);

      // Create opportunity
      await this.upsertOpportunity({
        company_id: company.id,
        name: deal.title,
        amount: deal.value,
        stage: deal.status,
        close_date: deal.close_date,
        owner_id: deal.user_id
      });
    }
  }

  /**
   * Link existing invoices to companies
   */
  async linkInvoicesToCompanies() {
    const invoices = await supabase.from('invoices').select('*');

    for (const invoice of invoices.data) {
      // Find company by client email
      const company = await this.findCompanyByEmail(invoice.client_email);

      if (company) {
        // Update invoice with company_id
        await supabase
          .from('invoices')
          .update({ company_id: company.id })
          .eq('id', invoice.id);

        // Create activity
        await this.createActivity({
          company_id: company.id,
          type: 'invoice_sent',
          subject: `Invoice ${invoice.invoice_number} sent`,
          metadata: { invoice_id: invoice.id, amount: invoice.total }
        });
      }
    }
  }
}
```

**Outcome**: Single source of truth for all customer data

---

## 🔄 SYSTEM 2: EVENT-DRIVEN AUTOMATION ENGINE

### **Problem**: Manual work, no intelligent triggers

**Current State**: Users manually move data between systems

**Target State**: Systems automatically react to events

### **Implementation - Week 2**:

#### 2.1 Create Event Bus
```typescript
// src/services/events/EventBus.ts

export type SystemEvent = {
  id: string;
  type: EventType;
  entity: string; // company, contact, opportunity, invoice, etc.
  entity_id: string;
  tenant_id: string;
  user_id: string;
  action: 'created' | 'updated' | 'deleted' | 'status_changed';
  old_data?: any;
  new_data: any;
  metadata?: any;
  timestamp: string;
};

export type EventType =
  // CRM Events
  | 'company.created'
  | 'company.updated'
  | 'contact.created'
  | 'contact.updated'
  | 'opportunity.created'
  | 'opportunity.stage_changed'
  | 'opportunity.won'
  | 'opportunity.lost'

  // Communication Events
  | 'email.received'
  | 'email.sent'
  | 'message.received'
  | 'call.completed'

  // Finance Events
  | 'invoice.created'
  | 'invoice.sent'
  | 'invoice.paid'
  | 'invoice.overdue'
  | 'payment.received'

  // Contract Events
  | 'contract.created'
  | 'contract.sent'
  | 'contract.signed'
  | 'contract.fully_signed'

  // Project Events
  | 'project.created'
  | 'project.completed'
  | 'task.overdue'

  // Activity Events
  | 'activity.created'
  | 'activity.completed';

export class EventBus {
  private handlers: Map<EventType, EventHandler[]> = new Map();

  /**
   * Register event handler
   */
  on(eventType: EventType, handler: EventHandler) {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
  }

  /**
   * Emit event to all handlers
   */
  async emit(event: SystemEvent) {
    // Store event in database for audit trail
    await this.storeEvent(event);

    // Get handlers for this event type
    const handlers = this.handlers.get(event.type) || [];

    // Execute all handlers in parallel
    await Promise.allSettled(
      handlers.map(handler => handler.handle(event))
    );

    // Also trigger generic handlers (listen to all events)
    const genericHandlers = this.handlers.get('*' as EventType) || [];
    await Promise.allSettled(
      genericHandlers.map(handler => handler.handle(event))
    );
  }

  /**
   * Store event for audit trail and replay
   */
  private async storeEvent(event: SystemEvent) {
    await supabase.from('system_events').insert({
      event_type: event.type,
      entity: event.entity,
      entity_id: event.entity_id,
      tenant_id: event.tenant_id,
      user_id: event.user_id,
      action: event.action,
      old_data: event.old_data,
      new_data: event.new_data,
      metadata: event.metadata
    });
  }
}

// Global event bus instance
export const eventBus = new EventBus();
```

#### 2.2 Smart Automation Rules
```typescript
// src/services/automation/AutomationEngine.ts

export class AutomationEngine {
  constructor(private eventBus: EventBus) {
    this.registerAutomations();
  }

  private registerAutomations() {
    // AUTOMATION: Opportunity Won → Create Project
    this.eventBus.on('opportunity.won', async (event) => {
      const opp = event.new_data;

      // Auto-create project
      const project = await projectService.create({
        tenant_id: event.tenant_id,
        company_id: opp.company_id,
        name: `${opp.name} - Delivery`,
        status: 'active',
        budget: opp.amount,
        owner_id: opp.owner_id
      });

      // Create onboarding tasks from template
      await this.createOnboardingTasks(project.id);

      // Send welcome email to client
      await this.sendWelcomeEmail(opp.primary_contact_id);

      // Update company lifecycle stage
      await companyService.update(opp.company_id, {
        lifecycle_stage: 'customer'
      });

      // Create activity
      await activityService.create({
        company_id: opp.company_id,
        opportunity_id: opp.id,
        type: 'opportunity_won',
        subject: `Deal won: ${opp.name}`,
        metadata: { amount: opp.amount }
      });
    });

    // AUTOMATION: Contract Signed → Send Invoice
    this.eventBus.on('contract.fully_signed', async (event) => {
      const contract = event.new_data;

      // Auto-generate invoice from contract
      const invoice = await invoiceService.createFromContract(contract.id);

      // Send invoice via email
      await emailService.sendInvoice(invoice.id);

      // Schedule payment reminder (7 days before due)
      await reminderService.schedule({
        type: 'payment_reminder',
        entity_id: invoice.id,
        send_at: this.calculateReminderDate(invoice.due_date, -7)
      });

      // Update opportunity
      if (contract.opportunity_id) {
        await opportunityService.update(contract.opportunity_id, {
          stage: 'closed_won'
        });
      }
    });

    // AUTOMATION: Invoice Paid → Thank You Email + Update Accounting
    this.eventBus.on('invoice.paid', async (event) => {
      const invoice = event.new_data;

      // Record in general ledger (double-entry)
      await accountingService.recordPayment({
        invoice_id: invoice.id,
        amount: invoice.total,
        date: new Date(),
        entries: [
          { account: 'Cash', debit: invoice.total },
          { account: 'Accounts Receivable', credit: invoice.total }
        ]
      });

      // Send thank you email
      await emailService.sendThankYou(invoice.company_id);

      // Update company health score
      await companyService.incrementHealthScore(invoice.company_id, 10);

      // Create activity
      await activityService.create({
        company_id: invoice.company_id,
        type: 'payment_received',
        subject: `Payment received for Invoice ${invoice.invoice_number}`,
        metadata: { amount: invoice.total }
      });
    });

    // AUTOMATION: Invoice Overdue → Dunning Sequence
    this.eventBus.on('invoice.overdue', async (event) => {
      const invoice = event.new_data;
      const daysOverdue = this.calculateDaysOverdue(invoice.due_date);

      // Progressive reminders
      if (daysOverdue === 1) {
        await emailService.sendPaymentReminder(invoice.id, 'gentle');
      } else if (daysOverdue === 7) {
        await emailService.sendPaymentReminder(invoice.id, 'firm');
      } else if (daysOverdue === 14) {
        await emailService.sendPaymentReminder(invoice.id, 'final');
        // Notify account manager
        await notificationService.notify({
          user_id: invoice.owner_id,
          type: 'invoice_seriously_overdue',
          data: { invoice_id: invoice.id }
        });
      } else if (daysOverdue === 30) {
        // Escalate to collections
        await activityService.create({
          company_id: invoice.company_id,
          type: 'collections_escalation',
          subject: `Invoice ${invoice.invoice_number} 30+ days overdue`,
          assigned_to: await this.getCollectionsManager()
        });
      }
    });

    // AUTOMATION: Email Received → Link to Contact + AI Sentiment Analysis
    this.eventBus.on('email.received', async (event) => {
      const email = event.new_data;

      // Find contact by email
      const contact = await contactService.findByEmail(email.from_address);

      if (contact) {
        // Link email to contact and company
        await messageService.update(email.id, {
          contact_id: contact.id,
          company_id: contact.company_id
        });

        // Analyze sentiment with AI
        const sentiment = await aiService.analyzeSentiment(email.body);
        await messageService.update(email.id, { sentiment });

        // If negative sentiment, alert account manager
        if (sentiment === 'negative') {
          await notificationService.notify({
            user_id: contact.assigned_to || await this.getAccountManager(),
            type: 'negative_email_received',
            data: { email_id: email.id, contact_id: contact.id }
          });
        }

        // Update last_activity_at
        await contactService.touch(contact.id);
        await companyService.touch(contact.company_id);

        // Create activity
        await activityService.create({
          contact_id: contact.id,
          company_id: contact.company_id,
          type: 'email',
          subject: email.subject,
          description: email.body,
          metadata: { email_id: email.id, sentiment }
        });

        // Smart reply suggestions (AI)
        if (this.needsReply(email)) {
          const suggestions = await aiService.generateReplySuggestions(email.body);
          await messageService.update(email.id, {
            metadata: { reply_suggestions: suggestions }
          });
        }
      }
    });

    // AUTOMATION: Contact Created → Enrich with AI
    this.eventBus.on('contact.created', async (event) => {
      const contact = event.new_data;

      // Enrich contact data via AI/APIs
      const enriched = await enrichmentService.enrichContact({
        email: contact.email,
        company_domain: contact.company?.domain
      });

      // Update contact with enriched data
      await contactService.update(contact.id, {
        linkedin_url: enriched.linkedin,
        title: enriched.title || contact.title,
        department: enriched.department
      });

      // Enrich company too
      if (contact.company_id) {
        const companyData = await enrichmentService.enrichCompany(
          contact.company.domain
        );
        await companyService.update(contact.company_id, companyData);
      }

      // Calculate initial lead score
      const score = await this.calculateLeadScore(contact);
      await contactService.update(contact.id, { lead_score: score });
    });

    // AUTOMATION: Task Overdue → Notify Assignee
    this.eventBus.on('task.overdue', async (event) => {
      const task = event.new_data;

      // Notify assignee
      await notificationService.notify({
        user_id: task.assigned_to,
        type: 'task_overdue',
        data: { task_id: task.id }
      });

      // Notify manager if 3+ days overdue
      if (this.getDaysOverdue(task.due_date) >= 3) {
        await notificationService.notify({
          user_id: await this.getManager(task.assigned_to),
          type: 'task_severely_overdue',
          data: { task_id: task.id, assignee_id: task.assigned_to }
        });
      }
    });

    // AUTOMATION: Company Health Score Drop → Alert
    this.eventBus.on('company.updated', async (event) => {
      const oldScore = event.old_data?.health_score || 50;
      const newScore = event.new_data.health_score || 50;

      // Alert on significant drops
      if (newScore < oldScore - 20 && newScore < 40) {
        await notificationService.notify({
          user_id: event.new_data.assigned_to,
          type: 'churn_risk',
          data: {
            company_id: event.entity_id,
            old_score: oldScore,
            new_score: newScore
          }
        });

        // Create activity for review
        await activityService.create({
          company_id: event.entity_id,
          type: 'churn_risk_detected',
          subject: `Health score dropped to ${newScore}`,
          assigned_to: event.new_data.assigned_to,
          metadata: { old_score: oldScore, new_score: newScore }
        });
      }
    });
  }
}

// Initialize automation engine
export const automationEngine = new AutomationEngine(eventBus);
```

#### 2.3 Database Triggers (Real-Time Event Emission)
```sql
-- Trigger function to emit events
CREATE OR REPLACE FUNCTION emit_event()
RETURNS TRIGGER AS $$
DECLARE
  event_payload JSONB;
BEGIN
  event_payload := jsonb_build_object(
    'type', TG_TABLE_NAME || '.' || TG_OP,
    'entity', TG_TABLE_NAME,
    'entity_id', COALESCE(NEW.id, OLD.id),
    'tenant_id', COALESCE(NEW.tenant_id, OLD.tenant_id),
    'action', LOWER(TG_OP),
    'old_data', row_to_json(OLD),
    'new_data', row_to_json(NEW),
    'timestamp', NOW()
  );

  -- Emit to Supabase Realtime
  PERFORM pg_notify('system_events', event_payload::text);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to all important tables
CREATE TRIGGER opportunities_events
  AFTER INSERT OR UPDATE OR DELETE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION emit_event();

CREATE TRIGGER invoices_events
  AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION emit_event();

CREATE TRIGGER contracts_events
  AFTER INSERT OR UPDATE OR DELETE ON contracts
  FOR EACH ROW EXECUTE FUNCTION emit_event();

-- ... add to all core tables
```

**Outcome**: Systems automatically work together without manual intervention

---

## 🔗 SYSTEM 3: UNIFIED COMMUNICATION HUB

### **Problem**: Emails, chats, calls scattered across platforms

**Current State**: Gmail separate, Zoho separate, internal messages separate

**Target State**: All communication in one intelligent inbox

### **Implementation - Week 2-3**:

#### 3.1 Universal Inbox Service
```typescript
// src/services/communication/UnifiedInboxService.ts

export class UnifiedInboxService {
  /**
   * Get all messages across all channels
   */
  async getInbox(filters: InboxFilters) {
    const messages = await supabase
      .from('unified_messages')
      .select(`
        *,
        company:companies(*),
        contact:contacts(*),
        opportunity:opportunities(*)
      `)
      .eq('tenant_id', await tenantService.getCurrentTenantId())
      .eq('folder', filters.folder || 'inbox')
      .order('received_at', { ascending: false })
      .range(filters.offset || 0, filters.limit || 50);

    return messages.data;
  }

  /**
   * Search across all messages (full-text)
   */
  async search(query: string) {
    const messages = await supabase
      .from('unified_messages')
      .select('*, company:companies(*), contact:contacts(*)')
      .textSearch('search_vector', query)
      .eq('tenant_id', await tenantService.getCurrentTenantId())
      .limit(100);

    return messages.data;
  }

  /**
   * Get conversation thread
   */
  async getThread(threadId: string) {
    const messages = await supabase
      .from('unified_messages')
      .select('*, company:companies(*), contact:contacts(*)')
      .eq('thread_id', threadId)
      .order('received_at', { ascending: true });

    return messages.data;
  }

  /**
   * Send message (smart routing to correct channel)
   */
  async send(params: SendMessageParams) {
    const { to, subject, body, channel, company_id, contact_id } = params;

    // Determine channel (email, sms, chat)
    const actualChannel = channel || this.detectChannel(to);

    let result;
    switch (actualChannel) {
      case 'email':
        // Route to user's preferred email provider
        const provider = await this.getPreferredEmailProvider();
        if (provider === 'gmail') {
          result = await gmailService.send({ to, subject, body });
        } else if (provider === 'zoho') {
          result = await zohoMailService.sendEmail({
            toAddress: to,
            subject,
            content: body
          });
        } else {
          result = await emailService.send({ to, subject, html: body });
        }
        break;

      case 'sms':
        result = await smsService.send({ to, body });
        break;

      case 'chat':
        result = await messageService.send({
          recipient_id: await this.getUserIdByEmail(to),
          text: body
        });
        break;
    }

    // Store in unified inbox
    const message = await supabase.from('unified_messages').insert({
      tenant_id: await tenantService.getCurrentTenantId(),
      company_id,
      contact_id,
      source: provider || 'internal',
      external_id: result.id,
      direction: 'outbound',
      channel: actualChannel,
      to_address: to,
      subject,
      body,
      sent_at: new Date().toISOString()
    }).select().single();

    // Emit event
    await eventBus.emit({
      type: 'email.sent',
      entity: 'message',
      entity_id: message.data.id,
      tenant_id: message.data.tenant_id,
      user_id: await this.getCurrentUserId(),
      new_data: message.data
    });

    return message.data;
  }
}
```

#### 3.2 Background Sync Service
```typescript
// src/services/communication/SyncService.ts

export class CommunicationSyncService {
  private syncInterval = 5 * 60 * 1000; // 5 minutes

  /**
   * Start background sync for all providers
   */
  async start() {
    setInterval(() => this.syncAll(), this.syncInterval);
  }

  private async syncAll() {
    const tenants = await this.getTenantsWithIntegrations();

    for (const tenant of tenants) {
      await this.syncGmail(tenant.id);
      await this.syncZoho(tenant.id);
      await this.syncInternalMessages(tenant.id);
    }
  }

  /**
   * Sync Gmail emails to unified inbox
   */
  private async syncGmail(tenantId: string) {
    const users = await this.getUsersWithGmail(tenantId);

    for (const user of users) {
      try {
        // Get messages since last sync
        const lastSync = await this.getLastSyncTime(tenantId, user.id, 'gmail');
        const messages = await gmailService.getMessagesSince(user.id, lastSync);

        for (const msg of messages) {
          // Check if already synced
          const exists = await this.messageExists(msg.id, 'gmail');
          if (exists) continue;

          // Link to contact if possible
          const contact = await contactService.findByEmail(msg.from);

          // Store in unified inbox
          await supabase.from('unified_messages').insert({
            tenant_id: tenantId,
            contact_id: contact?.id,
            company_id: contact?.company_id,
            source: 'gmail',
            external_id: msg.id,
            thread_id: msg.threadId,
            direction: 'inbound',
            channel: 'email',
            from_address: msg.from,
            to_address: msg.to,
            subject: msg.subject,
            body: msg.snippet,
            html_body: msg.body,
            received_at: msg.date,
            read: msg.read
          });
        }

        // Update last sync time
        await this.updateLastSyncTime(tenantId, user.id, 'gmail');
      } catch (error) {
        console.error(`Gmail sync failed for user ${user.id}:`, error);
      }
    }
  }

  /**
   * Sync Zoho emails to unified inbox
   */
  private async syncZoho(tenantId: string) {
    // Similar to Gmail sync
    // ... implementation
  }
}

// Start sync service
export const syncService = new CommunicationSyncService();
syncService.start();
```

**Outcome**: All communication unified in single intelligent inbox

---

## 🤖 SYSTEM 4: SMART INTELLIGENCE LAYER

### **Problem**: No AI working across systems

**Current State**: AI features isolated to individual pages

**Target State**: AI powering the entire platform

### **Implementation - Week 3-4**:

#### 4.1 Unified AI Service
```typescript
// src/services/ai/UnifiedAIService.ts

export class UnifiedAIService {
  private claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  /**
   * Analyze customer health (AI-powered)
   */
  async analyzeCustomerHealth(companyId: string) {
    // Get all company data
    const company = await companyService.getWithRelations(companyId);
    const activities = await activityService.getForCompany(companyId, { limit: 50 });
    const opportunities = await opportunityService.getForCompany(companyId);
    const invoices = await invoiceService.getForCompany(companyId);
    const messages = await messageService.getForCompany(companyId, { limit: 20 });

    // AI analysis
    const analysis = await this.claude.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Analyze this customer's health based on all available data:

        Company: ${JSON.stringify(company, null, 2)}
        Recent Activities: ${JSON.stringify(activities, null, 2)}
        Opportunities: ${JSON.stringify(opportunities, null, 2)}
        Invoices: ${JSON.stringify(invoices, null, 2)}
        Recent Messages: ${JSON.stringify(messages, null, 2)}

        Provide:
        1. Health Score (0-100)
        2. Risk Level (low, medium, high, critical)
        3. Key Issues (array of concerns)
        4. Recommended Actions (array of next steps)
        5. Sentiment Trend (improving, stable, declining)
        6. Churn Probability (0-100%)
        7. Upsell Potential (low, medium, high)

        Return as JSON.`
      }]
    });

    const result = JSON.parse(analysis.content[0].text);

    // Update company health score
    await companyService.update(companyId, {
      health_score: result.health_score,
      metadata: {
        ...company.metadata,
        ai_analysis: result,
        last_analyzed_at: new Date().toISOString()
      }
    });

    // Create activities for recommended actions
    for (const action of result.recommended_actions) {
      await activityService.create({
        company_id: companyId,
        type: 'task',
        subject: action,
        assigned_to: company.assigned_to,
        is_automated: true,
        source: 'ai'
      });
    }

    return result;
  }

  /**
   * Smart email categorization
   */
  async categorizeEmail(messageId: string) {
    const message = await messageService.get(messageId);

    const categories = await this.claude.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Categorize this email:

        From: ${message.from_address}
        Subject: ${message.subject}
        Body: ${message.body}

        Return JSON with:
        - category: support, sales, billing, general
        - priority: low, normal, high, urgent
        - sentiment: positive, neutral, negative
        - intent: question, complaint, request, update, other
        - needs_response: boolean
        - suggested_department: sales, support, finance, general`
      }]
    });

    const result = JSON.parse(categories.content[0].text);

    // Update message
    await messageService.update(messageId, {
      priority: result.priority,
      sentiment: result.sentiment,
      metadata: {
        ...message.metadata,
        category: result.category,
        intent: result.intent,
        suggested_department: result.suggested_department
      }
    });

    // Auto-assign to appropriate team member
    if (result.needs_response) {
      const assignee = await this.getTeamMember(result.suggested_department);
      await activityService.create({
        type: 'email_response_needed',
        subject: `Reply needed: ${message.subject}`,
        assigned_to: assignee,
        metadata: { message_id: messageId }
      });
    }

    return result;
  }

  /**
   * Predictive lead scoring
   */
  async scoreContact(contactId: string) {
    const contact = await contactService.getWithRelations(contactId);
    const activities = await activityService.getForContact(contactId);
    const messages = await messageService.getForContact(contactId);

    const scoring = await this.claude.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Score this lead's conversion potential:

        Contact: ${JSON.stringify(contact, null, 2)}
        Activities: ${JSON.stringify(activities, null, 2)}
        Messages: ${JSON.stringify(messages, null, 2)}

        Consider:
        - Engagement level
        - Company fit (industry, size, revenue)
        - Intent signals from messages
        - Responsiveness
        - Budget indicators

        Return JSON with:
        - lead_score: 0-100
        - conversion_probability: 0-100
        - best_next_action: string
        - estimated_deal_size: number
        - timeline: hot (0-30 days), warm (30-90 days), cold (90+ days)`
      }]
    });

    const result = JSON.parse(scoring.content[0].text);

    // Update contact
    await contactService.update(contactId, {
      lead_score: result.lead_score,
      metadata: {
        ...contact.metadata,
        conversion_probability: result.conversion_probability,
        ai_recommendations: result
      }
    });

    return result;
  }

  /**
   * Smart reply suggestions
   */
  async generateReplySuggestions(messageId: string, context?: string) {
    const message = await messageService.get(messageId);
    const thread = await messageService.getThread(message.thread_id);
    const contact = await contactService.get(message.contact_id);
    const company = await companyService.get(message.company_id);

    const suggestions = await this.claude.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Generate 3 reply options for this email:

        Thread: ${JSON.stringify(thread, null, 2)}
        Contact: ${contact.first_name} ${contact.last_name} - ${contact.title} at ${company.name}
        Company: ${JSON.stringify(company, null, 2)}
        ${context ? `Additional Context: ${context}` : ''}

        Generate:
        1. Professional/formal reply
        2. Friendly/casual reply
        3. Brief/concise reply

        Each should be helpful, on-brand, and appropriate for context.
        Return as JSON array.`
      }]
    });

    return JSON.parse(suggestions.content[0].text);
  }

  /**
   * Daily AI briefing for each user
   */
  async generateDailyBriefing(userId: string) {
    const user = await userService.get(userId);
    const today = new Date();

    // Get today's data
    const tasks = await taskService.getForUser(userId, { dueDate: today });
    const meetings = await meetingService.getForUser(userId, { date: today });
    const opportunities = await opportunityService.getForUser(userId, { active: true });
    const activities = await activityService.getForUser(userId, { assignedTo: userId, completed: false });
    const churnRisks = await companyService.getChurnRisks(userId);

    const briefing = await this.claude.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Generate a daily briefing for ${user.full_name}:

        Tasks Due Today: ${JSON.stringify(tasks, null, 2)}
        Meetings Today: ${JSON.stringify(meetings, null, 2)}
        Active Opportunities: ${JSON.stringify(opportunities, null, 2)}
        Pending Activities: ${JSON.stringify(activities, null, 2)}
        Churn Risks: ${JSON.stringify(churnRisks, null, 2)}

        Create a concise, actionable briefing with:
        1. Priority items for today
        2. Opportunities that need attention
        3. Customers at risk
        4. Recommended focus areas
        5. Time allocation suggestion

        Keep it motivating and actionable. Max 250 words.`
      }]
    });

    return briefing.content[0].text;
  }
}

export const aiService = new UnifiedAIService();
```

#### 4.2 Smart Automation Rules with AI
```typescript
// Add AI-powered automation
automationEngine.registerSmartAutomation({
  name: 'intelligent_lead_routing',
  trigger: 'contact.created',
  handler: async (event) => {
    const contact = event.new_data;

    // AI determines best salesperson for this lead
    const assignment = await aiService.suggestAssignment(contact);

    await contactService.update(contact.id, {
      assigned_to: assignment.user_id
    });

    await notificationService.notify({
      user_id: assignment.user_id,
      type: 'new_lead_assigned',
      data: {
        contact_id: contact.id,
        reason: assignment.reason,
        fit_score: assignment.fit_score
      }
    });
  }
});
```

**Outcome**: AI working intelligently across all systems

---

## 📊 SYSTEM 5: REAL-TIME SYNC & PERFORMANCE

### **Problem**: Slow loading, no real-time updates

**Current State**: Manual refresh needed, slow queries

**Target State**: Sub-second response, real-time everywhere

### **Implementation - Week 4**:

#### 5.1 Real-Time Subscriptions
```typescript
// src/services/realtime/RealtimeService.ts

export class RealtimeService {
  private supabase = createClient(/* ... */);
  private subscriptions: Map<string, RealtimeChannel> = new Map();

  /**
   * Subscribe to entity updates
   */
  subscribeToEntity(
    entity: string,
    entityId: string,
    callback: (payload: any) => void
  ) {
    const channel = this.supabase
      .channel(`${entity}:${entityId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: entity,
          filter: `id=eq.${entityId}`
        },
        (payload) => callback(payload)
      )
      .subscribe();

    this.subscriptions.set(`${entity}:${entityId}`, channel);

    return () => this.unsubscribe(`${entity}:${entityId}`);
  }

  /**
   * Subscribe to all activities for a company
   */
  subscribeToCompanyActivities(
    companyId: string,
    callback: (activity: Activity) => void
  ) {
    const channel = this.supabase
      .channel(`company_activities:${companyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activities',
          filter: `company_id=eq.${companyId}`
        },
        (payload) => callback(payload.new as Activity)
      )
      .subscribe();

    this.subscriptions.set(`company_activities:${companyId}`, channel);
  }

  /**
   * Subscribe to system events
   */
  subscribeToSystemEvents(callback: (event: SystemEvent) => void) {
    const channel = this.supabase
      .channel('system_events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_events' },
        (payload) => callback(payload.new as SystemEvent)
      )
      .subscribe();

    this.subscriptions.set('system_events', channel);
  }

  /**
   * Unsubscribe from channel
   */
  unsubscribe(key: string) {
    const channel = this.subscriptions.get(key);
    if (channel) {
      channel.unsubscribe();
      this.subscriptions.delete(key);
    }
  }

  /**
   * Unsubscribe all
   */
  unsubscribeAll() {
    this.subscriptions.forEach(channel => channel.unsubscribe());
    this.subscriptions.clear();
  }
}

export const realtimeService = new RealtimeService();
```

#### 5.2 Performance Optimizations
```typescript
// src/services/performance/CacheService.ts

export class CacheService {
  private redis = new Redis(process.env.UPSTASH_REDIS_REST_URL);
  private ttl = 5 * 60; // 5 minutes

  /**
   * Get or fetch with caching
   */
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = this.ttl
  ): Promise<T> {
    // Try cache first
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch and cache
    const data = await fetchFn();
    await this.redis.setex(key, ttl, JSON.stringify(data));

    return data;
  }

  /**
   * Invalidate cache
   */
  async invalidate(pattern: string) {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  /**
   * Cache dashboard stats
   */
  async getDashboardStats(tenantId: string, userId: string) {
    return this.getOrFetch(
      `dashboard:stats:${tenantId}:${userId}`,
      async () => {
        // Expensive calculation
        const [revenue, deals, tasks, activities] = await Promise.all([
          this.calculateRevenue(tenantId),
          this.countDeals(tenantId),
          this.countTasks(userId),
          this.getRecentActivities(tenantId, 10)
        ]);

        return { revenue, deals, tasks, activities };
      },
      60 // 1 minute cache
    );
  }
}

export const cacheService = new CacheService();
```

#### 5.3 Database Query Optimization
```sql
-- Materialized views for expensive queries
CREATE MATERIALIZED VIEW company_summary AS
SELECT
  c.id,
  c.name,
  c.health_score,
  COUNT(DISTINCT co.id) AS contact_count,
  COUNT(DISTINCT o.id) AS opportunity_count,
  SUM(CASE WHEN o.stage = 'closed_won' THEN o.amount ELSE 0 END) AS total_revenue,
  COUNT(DISTINCT CASE WHEN i.status = 'paid' THEN i.id END) AS paid_invoices,
  SUM(CASE WHEN i.status = 'overdue' THEN i.total ELSE 0 END) AS overdue_amount,
  MAX(a.created_at) AS last_activity_at
FROM companies c
LEFT JOIN contacts co ON co.company_id = c.id
LEFT JOIN opportunities o ON o.company_id = c.id
LEFT JOIN invoices i ON i.company_id = c.id
LEFT JOIN activities a ON a.company_id = c.id
GROUP BY c.id, c.name, c.health_score;

-- Refresh every hour
CREATE INDEX idx_company_summary_health ON company_summary(health_score DESC);
CREATE INDEX idx_company_summary_revenue ON company_summary(total_revenue DESC);

-- Auto-refresh with pg_cron
SELECT cron.schedule('refresh-company-summary', '0 * * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY company_summary');
```

**Outcome**: Sub-second performance, real-time everywhere

---

## 🔐 SYSTEM 6: ENTERPRISE SECURITY & COMPLIANCE

### **Problem**: Security features scattered, no compliance framework

**Current State**: Basic security, no audit trail

**Target State**: Enterprise-grade security with compliance

### **Implementation - Week 4**:

#### 6.1 Comprehensive Audit Trail
```sql
-- Audit log for all changes
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),

  -- What changed
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[], -- array of field names that changed

  -- Context
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  api_endpoint TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Search
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(table_name, '') || ' ' || coalesce(action, ''))
  ) STORED
);

CREATE INDEX idx_audit_log_tenant ON audit_log(tenant_id);
CREATE INDEX idx_audit_log_table ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_search ON audit_log USING GIN(search_vector);

-- Trigger function for audit logging
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  changed_fields TEXT[];
  old_json JSONB;
  new_json JSONB;
BEGIN
  old_json := to_jsonb(OLD);
  new_json := to_jsonb(NEW);

  -- Get changed fields
  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(key)
    INTO changed_fields
    FROM jsonb_each(new_json)
    WHERE new_json->key IS DISTINCT FROM old_json->key;
  END IF;

  -- Insert audit log
  INSERT INTO audit_log (
    tenant_id,
    user_id,
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    changed_fields
  ) VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    auth.uid(),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    old_json,
    new_json,
    changed_fields
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply to all sensitive tables
CREATE TRIGGER audit_companies
  AFTER INSERT OR UPDATE OR DELETE ON companies
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_opportunities
  AFTER INSERT OR UPDATE OR DELETE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ... apply to all critical tables
```

#### 6.2 GDPR Compliance
```typescript
// src/services/compliance/GDPRService.ts

export class GDPRService {
  /**
   * Export all user data (GDPR Article 20)
   */
  async exportUserData(userId: string): Promise<Blob> {
    const user = await userService.get(userId);

    // Collect all data
    const data = {
      user: await userService.get(userId),
      contacts: await contactService.getForUser(userId),
      companies: await companyService.getForUser(userId),
      opportunities: await opportunityService.getForUser(userId),
      activities: await activityService.getForUser(userId),
      messages: await messageService.getForUser(userId),
      invoices: await invoiceService.getForUser(userId),
      contracts: await contractService.getForUser(userId),
      projects: await projectService.getForUser(userId),
      tasks: await taskService.getForUser(userId),
      audit_log: await auditService.getForUser(userId)
    };

    // Create ZIP with all data
    const zip = new JSZip();

    zip.file('user_data.json', JSON.stringify(data, null, 2));
    zip.file('README.txt', `
      Your Personal Data Export
      Generated: ${new Date().toISOString()}

      This archive contains all personal data we have stored about you.
      You have the right to:
      - Access this data (Article 15)
      - Correct inaccurate data (Article 16)
      - Delete your data (Article 17)
      - Restrict processing (Article 18)
      - Data portability (Article 20)

      For more information, visit our privacy policy.
    `);

    const blob = await zip.generateAsync({ type: 'blob' });

    // Log export for compliance
    await auditService.log({
      user_id: userId,
      action: 'gdpr_data_export',
      metadata: { file_size: blob.size }
    });

    return blob;
  }

  /**
   * Delete all user data (GDPR Article 17 - Right to be Forgotten)
   */
  async deleteUserData(userId: string, reason: string) {
    // Anonymize instead of hard delete (preserve referential integrity)
    await supabase.rpc('anonymize_user', {
      p_user_id: userId,
      p_reason: reason
    });

    // Log deletion
    await auditService.log({
      user_id: userId,
      action: 'gdpr_data_deletion',
      metadata: { reason }
    });
  }
}
```

**Outcome**: Enterprise-ready security and compliance

---

## 📅 MASTER IMPLEMENTATION TIMELINE

### **Week 1: Foundation (Systems 1-2)**
**Days 1-2: Unified Data Architecture**
- Create companies, contacts, opportunities, activities tables
- Add RLS policies
- Run data migration
- **Outcome**: Single source of truth established

**Days 3-5: Event-Driven Architecture**
- Implement EventBus
- Create AutomationEngine
- Add database triggers
- Register core automations
- **Outcome**: Systems react automatically

**Day 6: Testing & Validation**
- Test data flow between systems
- Verify automations working
- Load testing

**Day 7: Deploy to Production**

---

### **Week 2: Communication (System 3)**
**Days 1-3: Unified Inbox**
- Implement UnifiedInboxService
- Build UI component
- Add email sync service
- **Outcome**: All messages in one place

**Days 4-5: Background Sync**
- Gmail sync service
- Zoho sync service
- SMS integration
- **Outcome**: Real-time message aggregation

**Days 6-7: Smart Features**
- AI email categorization
- Smart reply suggestions
- Thread detection
- **Outcome**: Intelligent inbox

---

### **Week 3: Intelligence (System 4)**
**Days 1-3: AI Services**
- Customer health analysis
- Lead scoring
- Email categorization
- **Outcome**: AI across platform

**Days 4-5: Smart Automation**
- AI-powered routing
- Predictive alerts
- Daily briefings
- **Outcome**: Proactive intelligence

**Days 6-7: Testing & Tuning**
- AI accuracy testing
- Prompt optimization
- Performance tuning

---

### **Week 4: Performance & Security (Systems 5-6)**
**Days 1-2: Real-Time Sync**
- Supabase Realtime subscriptions
- WebSocket connections
- Live updates
- **Outcome**: Instant sync everywhere

**Days 3-4: Performance**
- Redis caching
- Materialized views
- Query optimization
- **Outcome**: Sub-second response

**Days 5-7: Enterprise Security**
- Audit trail
- GDPR compliance
- Security hardening
- **Outcome**: Enterprise-ready

---

## 🎯 SUCCESS METRICS

### **System Health Dashboard**
```
┌─────────────────────────────────────────┐
│  PLATFORM HEALTH: 100%  ✅              │
├─────────────────────────────────────────┤
│  📊 Data Architecture:        100%      │
│  🔄 Event Automation:         100%      │
│  💬 Unified Communication:    100%      │
│  🤖 AI Intelligence:          100%      │
│  ⚡ Performance:              100%      │
│  🔐 Security & Compliance:    100%      │
├─────────────────────────────────────────┤
│  🎯 PRODUCTION READY: YES ✅            │
└─────────────────────────────────────────┘
```

### **KPIs to Track**
1. **Data Quality**: 0 duplicate records, 100% linkage
2. **Automation**: 90%+ tasks automated
3. **Response Time**: <500ms API, <2s page load
4. **Uptime**: 99.99% availability
5. **Security**: 0 vulnerabilities, 100% audit coverage
6. **AI Accuracy**: >85% correct predictions
7. **User Satisfaction**: >4.5/5 rating

---

## 🚀 READY TO START?

I can begin implementing this systems architecture immediately. Which system should we tackle first?

**Recommended Order**:
1. ✅ **System 1** (Week 1) - Foundation first
2. ✅ **System 2** (Week 1) - Automation engine
3. ✅ **System 3** (Week 2) - Unified communication
4. ✅ **System 4** (Week 3) - AI intelligence
5. ✅ **System 5** (Week 4) - Performance
6. ✅ **System 6** (Week 4) - Security

**OR** we can prioritize based on your immediate business needs:
- Need to close deals faster? → Start with CRM (System 1 + AI)
- Need better customer success? → Start with Communication (System 3)
- Need enterprise customers? → Start with Security (System 6)

**What's your priority?** I'll create the implementation plan and start building.
