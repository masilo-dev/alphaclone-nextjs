'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  Mail,
  Phone,
  Building2,
  Calendar,
  Send,
  Trash2,
  Edit,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Activity,
  Bot,
  Sparkles,
  Layers,
  CheckCircle2,
  Clock,
  Tag,
  Filter,
  X,
  FileText,
  FolderKanban,
  Receipt,
  CalendarDays,
  CheckSquare,
} from 'lucide-react';
import Link from 'next/link';
import { contactService, type ContactWithCompany } from '@/services/contactService';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { LeadScoreBadge } from './LeadScoreBadge';
import { ContactActivityTimeline } from './ContactActivityTimeline';
import { BusinessContextPanel } from './BusinessContextPanel';
import {
  WorkspaceShell,
  WorkspacePanel,
  WorkspaceSplitter,
  WorkspaceContextPanel,
  WorkspaceToolbar,
  WorkspacePanelToggle,
  useMultiPanelWorkspace,
} from '@/components/ui/workspace';
import toast from 'react-hot-toast';

type ContactStatus = 'active' | 'inactive' | 'unsubscribed' | 'bounced';

const STATUS_CONFIG: Record<ContactStatus, { label: string; color: string; bgColor: string }> = {
  active: { label: 'Active', color: 'text-[var(--success)]', bgColor: 'bg-emerald-500/15' },
  inactive: { label: 'Inactive', color: 'text-[var(--text-secondary)]', bgColor: 'bg-slate-500/15' },
  unsubscribed: { label: 'Unsub', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
  bounced: { label: 'Bounced', color: 'text-[var(--danger)]', bgColor: 'bg-[var(--danger)]/20' },
};

export interface CrmMultiPanelWorkspaceProps {
  initialContactId?: string | null;
  onEditContact?: (contact: ContactWithCompany) => void;
  onCreateContact?: () => void;
}

export function CrmMultiPanelWorkspace({
  initialContactId,
  onEditContact,
  onCreateContact,
}: CrmMultiPanelWorkspaceProps) {
  const { currentTenant } = useTenant();
  const [contacts, setContacts] = useState<ContactWithCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContactStatus | 'all'>('all');
  const [selectedContact, setSelectedContact] = useState<ContactWithCompany | null>(null);
  const [contextTab, setContextTab] = useState<'timeline' | 'context' | 'bonnie' | 'actions'>('timeline');

  // Multi-panel layout manager
  const {
    panel1Width,
    panel3Width,
    panel1Collapsed,
    panel3Collapsed,
    activeResizingPanel,
    isMobile,
    isTablet,
    isLaptop,
    isDesktop,
    activeMobilePanel,
    setActiveMobilePanel,
    togglePanel1,
    togglePanel3,
    setPanel3Collapsed,
    getSplitterProps,
    containerRef,
  } = useMultiPanelWorkspace({
    namespace: 'crm-contacts',
    panel1Constraints: { defaultWidth: 300, minWidth: 220, maxWidth: 440 },
    panel3Constraints: { defaultWidth: 340, minWidth: 260, maxWidth: 520 },
    defaultPanel1Collapsed: false,
    defaultPanel3Collapsed: false,
  });

  // Load contacts
  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      const { contacts: data, error: err } = await contactService.getContacts({
        search: searchQuery || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        limit: 100,
        sort: 'created_at',
        direction: 'desc',
      });
      if (err) throw new Error(err);
      setContacts(data);

      // Auto-select initial contact if requested
      if (initialContactId) {
        const found = data.find((c) => c.id === initialContactId);
        if (found) {
          setSelectedContact(found);
          setActiveMobilePanel('primary');
        } else {
          // Fetch directly if not in initial 100
          contactService.getContact(initialContactId).then(({ contact }) => {
            if (contact) {
              setSelectedContact(contact);
              setActiveMobilePanel('primary');
            }
          });
        }
      } else if (data.length > 0 && !selectedContact && !isMobile) {
        setSelectedContact(data[0]);
      }
    } catch (err) {
      console.error('Failed to load contacts:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, initialContactId, isMobile, selectedContact]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Handle row click
  const handleSelectContact = (contact: ContactWithCompany) => {
    setSelectedContact(contact);
    if (isMobile) {
      setActiveMobilePanel('primary');
    }
  };

  // Back to list on mobile
  const handleMobileBack = () => {
    setActiveMobilePanel('nav');
  };

  return (
    <WorkspaceShell
      ref={containerRef}
      multiPanel
      className="ac-multi-panel-shell border-y border-[var(--border-subtle)]"
    >
      {/* ───────────────────────────────────────────────────────────── */}
      {/* PANEL 1: Navigation & Contact List                            */}
      {/* ───────────────────────────────────────────────────────────── */}
      {(!isMobile || activeMobilePanel === 'nav') && (
        <WorkspacePanel
          id="crm-nav-panel"
          panelType="nav"
          width={isMobile ? '100%' : panel1Width}
          collapsed={!isMobile && panel1Collapsed}
          collapsible={!isMobile}
          onToggleCollapse={togglePanel1}
          title="Contacts"
          subtitle={`${contacts.length} records`}
          icon={Users}
          headerActions={
            onCreateContact ? (
              <button
                type="button"
                onClick={onCreateContact}
                aria-label="Add contact"
                className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-[var(--accent)] text-[var(--text-inverse)] text-[11px] font-bold hover:brightness-110 transition-all"
              >
                <Plus className="w-3 h-3" />
                <span className="hidden sm:inline">Add</span>
              </button>
            ) : null
          }
          toolbar={
            <div className="p-2 border-b border-[var(--border-subtle)] space-y-1.5 bg-[var(--surface-1)]">
              {/* Compact search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter contacts..."
                  className="w-full h-7 pl-8 pr-6 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Status pills */}
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-0.5">
                {(['all', 'active', 'inactive', 'unsubscribed'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`h-5.5 px-2 rounded text-[10px] font-bold uppercase transition-colors shrink-0 ${
                      statusFilter === st
                        ? 'bg-[var(--accent)] text-[var(--text-inverse)]'
                        : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          }
          contentClassName="p-1 space-y-0.5"
        >
          {loading && contacts.length === 0 ? (
            <div className="p-4 text-center text-xs text-[var(--text-muted)]">
              Loading contacts…
            </div>
          ) : contacts.length === 0 ? (
            <div className="p-4 text-center text-xs text-[var(--text-muted)]">
              No contacts found
            </div>
          ) : (
            contacts.map((contact) => {
              const isSelected = selectedContact?.id === contact.id;
              const statusCfg = STATUS_CONFIG[contact.status as ContactStatus] || STATUS_CONFIG.inactive;
              const initials = (contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'C')
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();

              return (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => handleSelectContact(contact)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md flex items-center gap-2 transition-colors select-none ${
                    isSelected
                      ? 'bg-[var(--surface-2)] border-l-2 border-l-[var(--accent)] text-[var(--text-primary)] shadow-sm'
                      : 'hover:bg-[var(--surface-2)]/60 text-[var(--text-secondary)] border-l-2 border-l-transparent'
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-6 h-6 rounded-full bg-[var(--surface-3)] border border-[var(--border-subtle)] flex items-center justify-center text-[10px] font-bold text-[var(--text-primary)] shrink-0">
                    {initials}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {contact.fullName || `${contact.firstName} ${contact.lastName}`}
                      </p>
                      <span className={`text-[9px] font-bold px-1 rounded uppercase shrink-0 ${statusCfg.color} ${statusCfg.bgColor}`}>
                        {statusCfg.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] truncate">
                      {contact.company?.name || contact.email || 'No company'}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </WorkspacePanel>
      )}

      {/* Splitter between Panel 1 and Panel 2 */}
      {!isMobile && !panel1Collapsed && (
        <WorkspaceSplitter
          panelIndex={1}
          isResizing={activeResizingPanel === 1}
          {...getSplitterProps(1)}
        />
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* PANEL 2: Primary Workspace (Selected Contact & Actions)       */}
      {/* ───────────────────────────────────────────────────────────── */}
      {(!isMobile || activeMobilePanel === 'primary') && (
        <WorkspacePanel
          id="crm-primary-panel"
          panelType="primary"
          title={
            selectedContact ? (
              <div className="flex items-center gap-2">
                {isMobile && (
                  <button
                    type="button"
                    onClick={handleMobileBack}
                    className="p-1 -ml-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    aria-label="Back to contacts list"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                <span>{selectedContact.fullName || 'Contact Details'}</span>
              </div>
            ) : (
              'Primary Workspace'
            )
          }
          headerActions={
            <div className="flex items-center gap-1.5">
              {panel1Collapsed && !isMobile && (
                <WorkspacePanelToggle
                  panel="left"
                  collapsed={true}
                  onToggle={togglePanel1}
                />
              )}

              {selectedContact && onEditContact ? (
                <button
                  type="button"
                  onClick={() => onEditContact(selectedContact)}
                  className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <Edit className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              ) : null}

              {/* Toggle Panel 3 if collapsed */}
              {panel3Collapsed && !isMobile && (
                <WorkspacePanelToggle
                  panel="right"
                  collapsed={true}
                  onToggle={togglePanel3}
                />
              )}

              {isMobile && (
                <button
                  type="button"
                  onClick={() => setActiveMobilePanel('context')}
                  className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-[var(--surface-2)] text-[11px] font-semibold text-[var(--accent)]"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Context</span>
                </button>
              )}
            </div>
          }
        >
          {selectedContact ? (
            <div className="p-3 sm:p-4 space-y-4 max-w-4xl mx-auto">
              {/* Contact Profile Summary Card */}
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-[var(--surface-2)] border border-[var(--border-strong)] flex items-center justify-center text-sm font-bold text-[var(--accent)] shrink-0">
                    {(selectedContact.fullName || 'C').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-[var(--text-primary)] truncate">
                      {selectedContact.fullName}
                    </h2>
                    <p className="text-xs text-[var(--text-muted)] truncate">
                      {selectedContact.title || 'Executive'} · {selectedContact.company?.name || 'Independent contact'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <LeadScoreBadge contact={selectedContact} />
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                    {selectedContact.status}
                  </span>
                </div>
              </div>

              {/* Contact Direct Fields (Horizontal Dense Layout) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-1)] p-2.5">
                  <p className="text-[10px] font-bold uppercase text-[var(--text-muted)] flex items-center gap-1">
                    <Mail className="w-3 h-3 text-[var(--accent)]" /> Email Address
                  </p>
                  <p className="mt-1 text-xs font-medium text-[var(--text-primary)] truncate">
                    {selectedContact.email || 'No email recorded'}
                  </p>
                </div>

                <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-1)] p-2.5">
                  <p className="text-[10px] font-bold uppercase text-[var(--text-muted)] flex items-center gap-1">
                    <Phone className="w-3 h-3 text-[var(--accent)]" /> Phone
                  </p>
                  <p className="mt-1 text-xs font-medium text-[var(--text-primary)] truncate">
                    {selectedContact.phone || 'No phone recorded'}
                  </p>
                </div>

                <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-1)] p-2.5">
                  <p className="text-[10px] font-bold uppercase text-[var(--text-muted)] flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-[var(--accent)]" /> Organization
                  </p>
                  <p className="mt-1 text-xs font-medium text-[var(--text-primary)] truncate">
                    {selectedContact.company?.name || 'None specified'}
                  </p>
                </div>
              </div>

              {/* Tags & Metadata */}
              {(selectedContact.tags || []).length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Tag className="w-3 h-3 text-[var(--text-muted)]" />
                  {(selectedContact.tags || []).map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Action Toolbar for Cross-Module Continuity */}
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                  Execute From This Record
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    ['/dashboard/marketing/outreach', 'Prepare outreach', Send],
                    ['/dashboard/business/projects', 'Open projects', FolderKanban],
                    ['/dashboard/business/billing/manage', 'Manage billing', Receipt],
                    ['/dashboard/business/calendar', 'Schedule meeting', CalendarDays],
                    ['/dashboard/tasks', 'Create task', CheckSquare],
                    ['/dashboard/mail', 'Send email', Mail],
                  ].map(([href, label, Icon]) => (
                    <Link
                      key={String(label)}
                      href={`${href}?contactId=${encodeURIComponent(selectedContact.id)}`}
                      className="inline-flex items-center gap-2 p-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/40 transition-colors"
                    >
                      <Icon className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span className="truncate">{String(label)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center text-[var(--text-muted)]">
              <Users className="w-10 h-10 mb-2 text-[var(--border-strong)]" />
              <p className="text-sm font-semibold text-[var(--text-secondary)]">No contact selected</p>
              <p className="text-xs mt-1">Select a contact from the list on the left to inspect or edit details.</p>
            </div>
          )}
        </WorkspacePanel>
      )}

      {/* Splitter between Panel 2 and Panel 3 */}
      {!isMobile && !panel3Collapsed && selectedContact && (
        <WorkspaceSplitter
          panelIndex={3}
          isResizing={activeResizingPanel === 3}
          {...getSplitterProps(3)}
        />
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* PANEL 3: Context / Activity / Bonnie AI                       */}
      {/* ───────────────────────────────────────────────────────────── */}
      {(!isMobile || activeMobilePanel === 'context') && selectedContact && (
        <WorkspaceContextPanel
          id="crm-context-panel"
          width={isMobile ? '100%' : panel3Width}
          collapsed={!isMobile && panel3Collapsed}
          title="Context & Activity"
          subtitle={selectedContact.fullName}
          tabs={[
            { id: 'timeline', label: 'Timeline', icon: Activity },
            { id: 'context', label: 'Overview', icon: Layers },
            { id: 'bonnie', label: 'Bonnie AI', icon: Bot },
          ]}
          activeTab={contextTab}
          onTabChange={(tabId) => setContextTab(tabId as any)}
          onClose={isMobile ? () => setActiveMobilePanel('primary') : togglePanel3}
          headerActions={
            !isMobile && (
              <WorkspacePanelToggle
                panel="right"
                collapsed={false}
                onToggle={togglePanel3}
              />
            )
          }
        >
          {contextTab === 'timeline' && (
            <ContactActivityTimeline
              contactId={selectedContact.id}
              contactEmail={selectedContact.email || undefined}
              contactName={selectedContact.fullName}
              onClose={() => {
                if (isMobile) setActiveMobilePanel('primary');
              }}
            />
          )}

          {contextTab === 'context' && currentTenant?.id && (
            <BusinessContextPanel
              tenantId={currentTenant.id}
              entityType="contact"
              entityId={selectedContact.id}
            />
          )}

          {contextTab === 'bonnie' && (
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--accent)]">
                <Bot className="w-3.5 h-3.5" />
                <span>Bonnie Insights</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {selectedContact.status === 'active'
                  ? `Active contact with recent engagements. Next recommended action: Review deals or schedule a follow-up.`
                  : `Contact currently marked as ${selectedContact.status}. Verify communication channels or review qualification notes.`}
              </p>
              <div className="pt-2 border-t border-[var(--border-subtle)]">
                <Link
                  href={`/dashboard/bonnie?context=contact&id=${encodeURIComponent(selectedContact.id)}`}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--accent)] hover:underline"
                >
                  <Sparkles className="w-3 h-3" />
                  Chat with Bonnie about this contact
                </Link>
              </div>
            </div>
          )}
        </WorkspaceContextPanel>
      )}
    </WorkspaceShell>
  );
}

export default CrmMultiPanelWorkspace;
