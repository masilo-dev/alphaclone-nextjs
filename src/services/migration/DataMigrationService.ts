import { supabase } from '@/lib/supabase';
import { companyService } from '../unified/CompanyService';
import { unifiedContactService } from '../unified/ContactService';

export class DataMigrationService {
  /**
   * Run full migration
   */
  async runFullMigration() {
    console.log('🚀 Starting data migration to unified architecture...');

    try {
      // Step 1: Migrate leads to companies + contacts
      console.log('📊 Step 1: Migrating leads...');
      const leadsResult = await this.migrateLeads();
      console.log(`✅ Migrated ${leadsResult.companies} companies and ${leadsResult.contacts} contacts from leads`);

      // Step 2: Migrate deals to opportunities
      console.log('📊 Step 2: Migrating deals...');
      const dealsResult = await this.migrateDeals();
      console.log(`✅ Migrated ${dealsResult.opportunities} opportunities from deals`);

      // Step 3: Link invoices to companies
      console.log('📊 Step 3: Linking invoices to companies...');
      const invoicesResult = await this.linkInvoicesToCompanies();
      console.log(`✅ Linked ${invoicesResult.linked} invoices to companies`);

      // Step 4: Link contracts to companies
      console.log('📊 Step 4: Linking contracts to companies...');
      const contractsResult = await this.linkContractsToCompanies();
      console.log(`✅ Linked ${contractsResult.linked} contracts to companies`);

      // Step 5: Migrate internal messages
      console.log('📊 Step 5: Migrating internal messages...');
      const messagesResult = await this.migrateInternalMessages();
      console.log(`✅ Migrated ${messagesResult.messages} internal messages`);

      console.log('🎉 Migration completed successfully!');

      return {
        leads: leadsResult,
        deals: dealsResult,
        invoices: invoicesResult,
        contracts: contractsResult,
        messages: messagesResult
      };
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Migrate leads to companies + contacts
   */
  async migrateLeads() {
    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;

    let companiesCreated = 0;
    let contactsCreated = 0;

    for (const lead of leads || []) {
      try {
        // Extract domain from email
        const domain = this.extractDomain(lead.email);

        // Find or create company
        let company = domain ? await companyService.findByDomain(domain) : null;

        if (!company && lead.businessName) {
          company = await companyService.create({
            name: lead.businessName,
            domain: domain || undefined,
            industry: lead.industry,
            lifecycle_stage: this.mapLeadStageToLifecycle(lead.stage),
            tags: ['migrated-from-leads'],
            custom_fields: {
              original_lead_id: lead.id,
              estimated_value: lead.estimatedValue,
              source: lead.source
            }
          });
          companiesCreated++;
        }

        // Create contact
        if (company) {
          const [firstName, ...lastNameParts] = (lead.businessName || lead.email || 'Unknown').split(' ');
          const lastName = lastNameParts.join(' ') || 'Contact';

          const contact = await unifiedContactService.create({
            company_id: company.id,
            first_name: firstName,
            last_name: lastName,
            email: lead.email,
            phone: lead.phone,
            lifecycle_stage: this.mapLeadStageToContactLifecycle(lead.stage),
            tags: ['migrated-from-leads'],
            custom_fields: {
              original_lead_id: lead.id,
              lead_score: lead.score || 0
            }
          });
          contactsCreated++;

          // Migrate notes to activities
          if (lead.notes) {
            await supabase.from('activities').insert({
              tenant_id: company.tenant_id,
              company_id: company.id,
              contact_id: contact.id,
              type: 'note',
              subject: 'Migrated notes',
              description: lead.notes,
              source: 'migration',
              is_automated: true,
              created_at: lead.created_at
            });
          }

          // Create opportunity if qualified
          if (lead.stage !== 'lead' && lead.estimatedValue) {
            await supabase.from('opportunities').insert({
              tenant_id: company.tenant_id,
              company_id: company.id,
              primary_contact_id: contact.id,
              name: `${company.name} - Opportunity`,
              amount: lead.estimatedValue,
              stage: this.mapLeadStageToOppStage(lead.stage),
              lead_source: lead.source,
              tags: ['migrated-from-leads'],
              created_at: lead.created_at
            });
          }
        }
      } catch (error) {
        console.error(`Failed to migrate lead ${lead.id}:`, error);
      }
    }

    return {
      companies: companiesCreated,
      contacts: contactsCreated
    };
  }

  /**
   * Migrate deals to opportunities
   */
  async migrateDeals() {
    const { data: deals, error } = await supabase
      .from('deals')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;

    let opportunitiesCreated = 0;

    for (const deal of deals || []) {
      try {
        // Try to find company by deal name or create new one
        let company = await this.findOrCreateCompanyFromDeal(deal);

        if (company) {
          await supabase.from('opportunities').insert({
            tenant_id: company.tenant_id,
            company_id: company.id,
            name: deal.title,
            description: deal.description,
            amount: deal.value,
            stage: this.mapDealStatusToStage(deal.status),
            expected_close_date: deal.close_date,
            owner_id: deal.user_id,
            tags: ['migrated-from-deals'],
            custom_fields: {
              original_deal_id: deal.id
            },
            created_at: deal.created_at
          });
          opportunitiesCreated++;
        }
      } catch (error) {
        console.error(`Failed to migrate deal ${deal.id}:`, error);
      }
    }

    return {
      opportunities: opportunitiesCreated
    };
  }

  /**
   * Link invoices to companies
   */
  async linkInvoicesToCompanies() {
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('*')
      .is('company_id', null); // Only unlinked invoices

    if (error) throw error;

    let linkedCount = 0;

    for (const invoice of invoices || []) {
      try {
        // Find company by client email or name
        const company = await this.findCompanyByEmailOrName(
          invoice.client_email,
          invoice.client_name
        );

        if (company) {
          // Update invoice with company_id
          await supabase
            .from('invoices')
            .update({ company_id: company.id })
            .eq('id', invoice.id);

          // Create activity
          await supabase.from('activities').insert({
            tenant_id: company.tenant_id,
            company_id: company.id,
            invoice_id: invoice.id,
            type: 'invoice_sent',
            subject: `Invoice ${invoice.invoice_number} sent`,
            description: `Invoice for ${invoice.total} ${invoice.currency}`,
            metadata: {
              invoice_id: invoice.id,
              amount: invoice.total,
              status: invoice.status
            },
            source: 'migration',
            is_automated: true,
            created_at: invoice.created_at
          });

          linkedCount++;
        }
      } catch (error) {
        console.error(`Failed to link invoice ${invoice.id}:`, error);
      }
    }

    return {
      linked: linkedCount
    };
  }

  /**
   * Link contracts to companies
   */
  async linkContractsToCompanies() {
    const { data: contracts, error } = await supabase
      .from('contracts')
      .select('*')
      .is('company_id', null); // Only unlinked contracts

    if (error) throw error;

    let linkedCount = 0;

    for (const contract of contracts || []) {
      try {
        // Find company by client email
        const company = await this.findCompanyByEmailOrName(
          contract.client_party?.email,
          contract.client_party?.name
        );

        if (company) {
          // Update contract with company_id
          await supabase
            .from('contracts')
            .update({ company_id: company.id })
            .eq('id', contract.id);

          // Create activity
          if (contract.status === 'fully_signed') {
            await supabase.from('activities').insert({
              tenant_id: company.tenant_id,
              company_id: company.id,
              contract_id: contract.id,
              type: 'contract_signed',
              subject: `Contract ${contract.title} signed`,
              metadata: {
                contract_id: contract.id,
                value: contract.payment_terms?.total_amount
              },
              source: 'migration',
              is_automated: true,
              created_at: contract.updated_at
            });
          }

          linkedCount++;
        }
      } catch (error) {
        console.error(`Failed to link contract ${contract.id}:`, error);
      }
    }

    return {
      linked: linkedCount
    };
  }

  /**
   * Migrate internal messages to unified_messages
   */
  async migrateInternalMessages() {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;

    let migratedCount = 0;

    for (const message of messages || []) {
      try {
        // Find related contact by recipient email (if applicable)
        const recipientUser = await supabase
          .from('users')
          .select('email')
          .eq('id', message.recipient_id)
          .single();

        let contactId = null;
        let companyId = null;

        if (recipientUser.data?.email) {
          const contact = await unifiedContactService.findByEmail(recipientUser.data.email);
          if (contact) {
            contactId = contact.id;
            companyId = contact.company_id;
          }
        }

        // Insert into unified_messages
        await supabase.from('unified_messages').insert({
          tenant_id: message.tenant_id || (await supabase.auth.getUser()).data.user?.user_metadata?.tenant_id,
          company_id: companyId,
          contact_id: contactId,
          source: 'internal',
          external_id: message.id,
          direction: 'outbound',
          channel: 'chat',
          body: message.text,
          read: !!message.read_at,
          priority: message.priority || 'normal',
          sent_at: message.created_at,
          received_at: message.created_at,
          read_at: message.read_at,
          metadata: {
            sender_id: message.sender_id,
            recipient_id: message.recipient_id,
            group_id: message.group_id,
            is_thinking: message.is_thinking,
            attachments: message.attachments
          },
          tags: ['migrated-from-messages']
        });

        migratedCount++;
      } catch (error) {
        console.error(`Failed to migrate message ${message.id}:`, error);
      }
    }

    return {
      messages: migratedCount
    };
  }

  // ========== Helper Methods ==========

  private extractDomain(email?: string): string | null {
    if (!email) return null;
    const match = email.match(/@(.+)$/);
    return match ? match[1].toLowerCase() : null;
  }

  private mapLeadStageToLifecycle(stage: string): 'lead' | 'prospect' | 'customer' {
    const mapping: Record<string, any> = {
      lead: 'lead',
      qualified: 'prospect',
      contacted: 'prospect',
      proposal: 'prospect',
      negotiation: 'prospect',
      closed: 'customer'
    };
    return mapping[stage] || 'lead';
  }

  private mapLeadStageToContactLifecycle(stage: string): any {
    const mapping: Record<string, any> = {
      lead: 'lead',
      qualified: 'mql',
      contacted: 'sql',
      proposal: 'opportunity',
      negotiation: 'opportunity',
      closed: 'customer'
    };
    return mapping[stage] || 'lead';
  }

  private mapLeadStageToOppStage(stage: string): any {
    const mapping: Record<string, any> = {
      qualified: 'qualified',
      contacted: 'qualified',
      proposal: 'proposal',
      negotiation: 'negotiation',
      closed: 'closed_won'
    };
    return mapping[stage] || 'lead';
  }

  private mapDealStatusToStage(status: string): any {
    const mapping: Record<string, any> = {
      lead: 'lead',
      qualified: 'qualified',
      proposal: 'proposal',
      negotiation: 'negotiation',
      closed_won: 'closed_won',
      closed_lost: 'closed_lost'
    };
    return mapping[status] || 'lead';
  }

  private async findOrCreateCompanyFromDeal(deal: any) {
    // Try to extract company name from deal title or description
    const companyName = deal.title?.split('-')[0]?.trim() || deal.title;

    if (!companyName) return null;

    // Search for existing company
    const existing = await companyService.search(companyName, 1);
    if (existing.length > 0) {
      return existing[0];
    }

    // Create new company
    try {
      return await companyService.create({
        name: companyName,
        lifecycle_stage: 'prospect',
        tags: ['migrated-from-deals']
      });
    } catch (error) {
      console.error('Failed to create company:', error);
      return null;
    }
  }

  private async findCompanyByEmailOrName(email?: string, name?: string) {
    if (email) {
      const domain = this.extractDomain(email);
      if (domain) {
        const company = await companyService.findByDomain(domain);
        if (company) return company;
      }

      // Try to find contact with this email
      const contact = await unifiedContactService.findByEmail(email);
      if (contact?.company_id) {
        return await companyService.get(contact.company_id);
      }
    }

    if (name) {
      const companies = await companyService.search(name, 1);
      if (companies.length > 0) return companies[0];
    }

    return null;
  }
}

export const dataMigrationService = new DataMigrationService();
