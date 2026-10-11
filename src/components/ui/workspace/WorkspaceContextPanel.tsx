'use client';

import React, { useState } from 'react';
import {
  Activity,
  Bot,
  FileText,
  Layers,
  Sparkles,
  X,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkspacePanel } from './WorkspacePanel';
import { BusinessContextPanel } from '@/components/dashboard/crm/BusinessContextPanel';

export interface ContextTabOption {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  count?: number;
}

export interface WorkspaceContextPanelProps {
  id?: string;
  title?: string;
  subtitle?: string;
  width?: number | string;
  minWidth?: number;
  maxWidth?: number;
  collapsed?: boolean;
  onClose?: () => void;
  // Tabs
  tabs?: ContextTabOption[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  // Pre-integrated Business Context support
  tenantId?: string;
  entityType?: 'lead' | 'client' | 'contact' | 'contract' | 'invoice' | 'project';
  entityId?: string;
  // Tab render map or default children
  renderTabContent?: (activeTabId: string) => React.ReactNode;
  children?: React.ReactNode;
  headerActions?: React.ReactNode;
  className?: string;
}

const DEFAULT_TABS: ContextTabOption[] = [
  { id: 'context', label: 'Context', icon: Layers },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'bonnie', label: 'Bonnie AI', icon: Bot },
  { id: 'notes', label: 'Notes', icon: FileText },
];

/**
 * Universal Workspace Context Panel (Panel 3).
 * Houses activity history, record details, Bonnie AI execution context, notes, and related items.
 */
export function WorkspaceContextPanel({
  id = 'workspace-context-panel',
  title = 'Context & Intelligence',
  subtitle,
  width = 340,
  minWidth = 260,
  maxWidth = 540,
  collapsed = false,
  onClose,
  tabs = DEFAULT_TABS,
  activeTab: controlledActiveTab,
  onTabChange,
  tenantId,
  entityType,
  entityId,
  renderTabContent,
  children,
  headerActions,
  className,
}: WorkspaceContextPanelProps) {
  const [internalTab, setInternalTab] = useState(tabs[0]?.id || 'context');
  const activeTabId = controlledActiveTab !== undefined ? controlledActiveTab : internalTab;

  const handleTabClick = (tabId: string) => {
    if (onTabChange) {
      onTabChange(tabId);
    } else {
      setInternalTab(tabId);
    }
  };

  if (collapsed) return null;

  return (
    <WorkspacePanel
      id={id}
      panelType="context"
      title={title}
      subtitle={subtitle}
      icon={Sparkles}
      width={width}
      minWidth={minWidth}
      maxWidth={maxWidth}
      headerActions={
        <div className="flex items-center gap-1">
          {headerActions}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close context panel"
              className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      }
      toolbar={
        tabs.length > 1 ? (
          <div className="flex items-center gap-0.5 border-b border-[var(--border-subtle)] bg-[var(--surface-1)] px-2 py-1 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTabId === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabClick(tab.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-semibold transition-colors shrink-0',
                    isActive
                      ? 'bg-[var(--surface-2)] text-[var(--accent)] font-bold border border-[var(--border-strong)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]'
                  )}
                >
                  {Icon ? <Icon className="w-3 h-3 shrink-0" /> : null}
                  <span>{tab.label}</span>
                  {tab.count !== undefined ? (
                    <span className="rounded-full bg-[var(--surface-3)] px-1 py-0.2 text-[9px] font-bold text-[var(--text-muted)]">
                      {tab.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null
      }
      className={cn('bg-[var(--surface-1)]', className)}
    >
      <div className="p-3 space-y-3">
        {/* Render Tab Content if custom handler provided */}
        {renderTabContent ? (
          renderTabContent(activeTabId)
        ) : (
          <>
            {/* Built-in Context rendering */}
            {activeTabId === 'context' && tenantId && entityType && entityId ? (
              <BusinessContextPanel
                tenantId={tenantId}
                entityType={entityType}
                entityId={entityId}
              />
            ) : null}

            {children}
          </>
        )}
      </div>
    </WorkspacePanel>
  );
}

export default WorkspaceContextPanel;
