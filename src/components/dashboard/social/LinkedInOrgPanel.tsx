'use client';

import { AlertTriangle, Building2, Linkedin, RefreshCw, User } from 'lucide-react';
import { WORKSPACE } from '@/constants/design';
import { cn } from '@/lib/utils';

export interface LinkedInCompanyPage {
  id: string;
  name: string | null;
  vanityName: string | null;
  logoUrl: string | null;
}

interface LinkedInOrgPanelProps {
  isConnected: boolean;
  companyPages: LinkedInCompanyPage[];
  selectedOrgId: string;
  onSelectOrg: (id: string) => void;
  hasOrganizationWriteScope: boolean;
  onConnect: () => void;
  onReconnect?: () => void;
  className?: string;
}

export function LinkedInOrgPanel({
  isConnected,
  companyPages,
  selectedOrgId,
  onSelectOrg,
  hasOrganizationWriteScope,
  onConnect,
  onReconnect,
  className,
}: LinkedInOrgPanelProps) {
  const reconnect = onReconnect ?? onConnect;

  if (!isConnected) {
    return (
      <div className={cn(WORKSPACE.panel.base, WORKSPACE.panel.padding, className)}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0A66C2]/15 flex items-center justify-center shrink-0">
            <Linkedin className="w-5 h-5 text-[#0A66C2]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={WORKSPACE.typography.panelTitle}>Connect LinkedIn</h3>
            <p className={cn(WORKSPACE.typography.panelSubtitle, 'mt-1')}>
              Connect your profile to post and manage company pages you administer.
            </p>
            <button
              type="button"
              onClick={onConnect}
              className="ac-workspace-action-btn ac-workspace-action-btn--primary mt-3"
            >
              Connect LinkedIn account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(WORKSPACE.panel.base, WORKSPACE.panel.padding, 'space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className={WORKSPACE.typography.panelTitle}>Post as</h3>
          <p className={WORKSPACE.typography.panelSubtitle}>Personal profile or company page</p>
        </div>
        <button
          type="button"
          onClick={reconnect}
          className="ac-workspace-action-btn text-[11px] shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reconnect
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onSelectOrg('')}
          className={cn(
            'flex items-center gap-2.5 p-3 rounded-lg border text-left transition-colors',
            !selectedOrgId
              ? 'border-[var(--ac-accent)] bg-[var(--ac-accent-muted)]'
              : 'border-[var(--ws-border)] hover:border-[var(--ws-border-strong)]',
          )}
        >
          <User className="w-4 h-4 text-[var(--ws-text-secondary)] shrink-0" />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-white truncate">Personal profile</p>
            <p className="text-[11px] text-[var(--ws-text-tertiary)]">Your member account</p>
          </div>
        </button>

        {companyPages.map((page) => (
          <button
            key={page.id}
            type="button"
            onClick={() => onSelectOrg(page.id)}
            className={cn(
              'flex items-center gap-2.5 p-3 rounded-lg border text-left transition-colors',
              selectedOrgId === page.id
                ? 'border-[var(--ac-accent)] bg-[var(--ac-accent-muted)]'
                : 'border-[var(--ws-border)] hover:border-[var(--ws-border-strong)]',
            )}
          >
            {page.logoUrl ? (
              <img src={page.logoUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
            ) : (
              <Building2 className="w-4 h-4 text-[#0A66C2] shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-white truncate">
                {page.name || page.vanityName || 'Company page'}
              </p>
              <p className="text-[11px] text-[var(--ws-text-tertiary)]">Organization</p>
            </div>
          </button>
        ))}
      </div>

      {companyPages.length === 0 ? (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-200 text-[12px]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">No company pages found</p>
            <p className="mt-1 text-amber-200/80">
              You must be a LinkedIn Page administrator. Reconnect and approve organization permissions.
            </p>
          </div>
        </div>
      ) : null}

      {selectedOrgId && !hasOrganizationWriteScope ? (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-200 text-[12px]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Missing organization posting permission</p>
            <p className="mt-1 text-rose-200/80">
              Reconnect LinkedIn and approve company page posting scopes.
            </p>
            <button type="button" onClick={reconnect} className="mt-2 underline font-semibold">
              Reconnect with org permissions
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function normalizeLinkedInScopes(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .flatMap((value) => String(value).split(/[,\s]+/))
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[,\s]+/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}
