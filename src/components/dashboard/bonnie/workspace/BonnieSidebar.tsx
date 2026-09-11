'use client';

import React, { useMemo, useState } from 'react';
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  MessageSquarePlus,
  MoreHorizontal,
  Pin,
  PinOff,
  Search,
  Settings,
  Brain,
  Trash2,
  Workflow,
} from 'lucide-react';
import type { BonnieConversationSummary } from '@/hooks/useBonnieConversations';

function relativeTime(iso?: string) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

type Props = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  conversations: BonnieConversationSummary[];
  activeId: string | null;
  loading?: boolean;
  workspaceName?: string;
  userLabel?: string;
  pendingApprovals?: number;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onSearch: (q: string) => void;
  onOpenApprovals?: () => void;
};

const navButton = 'flex min-h-11 w-full items-center gap-2 rounded-[var(--ws-radius-control,8px)] px-2 text-left text-sm text-[var(--ws-text-secondary)] transition-colors hover:bg-[var(--ws-hover)] hover:text-[var(--ws-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]';

export default function BonnieSidebar({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
  conversations,
  activeId,
  loading,
  workspaceName,
  userLabel,
  pendingApprovals = 0,
  onNewChat,
  onSelect,
  onRename,
  onPin,
  onArchive,
  onDelete,
  onSearch,
  onOpenApprovals,
}: Props) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const { pinned, recent, archived } = useMemo(() => {
    const pinnedList = conversations.filter((c) => c.pinned && !c.archived);
    const recentList = conversations.filter((c) => !c.pinned && !c.archived);
    const archivedList = conversations.filter((c) => c.archived);
    return { pinned: pinnedList, recent: recentList, archived: archivedList };
  }, [conversations]);

  const panel = (
    <aside
      className={`flex h-full flex-col border-r border-[var(--ws-border)] bg-[var(--ws-panel)] text-[var(--ws-text-primary)] ${collapsed ? 'w-[72px]' : 'w-[280px]'}`}
      aria-label="Bonnie conversations"
    >
      <div className="flex items-center gap-2 border-b border-[var(--ws-border)] px-3 py-3">
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--brand-teal)]">AlphaClone Systems</p>
            <h2 className="truncate text-sm font-semibold tracking-tight text-[var(--ws-text-primary)]">Bonnie AI</h2>
          </div>
        ) : null}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="hidden min-h-11 min-w-11 items-center justify-center rounded-[var(--ws-radius-control,8px)] text-[var(--ws-text-secondary)] hover:bg-[var(--ws-hover)] hover:text-[var(--ws-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] md:inline-flex"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronLeft className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      <div className="space-y-2 p-3">
        <button
          type="button"
          onClick={() => {
            onNewChat();
            onCloseMobile();
          }}
          className="ac-workspace-action-btn ac-workspace-action-btn--bonnie flex w-full items-center justify-center gap-2"
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
          {!collapsed ? <span>New chat</span> : null}
        </button>

        {!collapsed ? (
          <label className="relative block">
            <span className="sr-only">Search conversations</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ws-text-tertiary)]" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                onSearch(e.target.value);
              }}
              placeholder="Search conversations"
              className="min-h-11 w-full rounded-[var(--ws-radius-control,8px)] border border-[var(--ws-border)] bg-[var(--ws-surface-primary)] py-2 pl-9 pr-3 text-xs text-[var(--ws-text-primary)] outline-none placeholder:text-[var(--ws-text-tertiary)] focus:border-[var(--ac-bonnie)] focus:ring-2 focus:ring-[var(--focus-ring)]"
            />
          </label>
        ) : null}
      </div>

      <nav className="ios-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3" aria-label="Conversation lists">
        {loading && !collapsed ? <p className="px-2 py-3 text-xs text-[var(--ws-text-tertiary)]">Loading conversations…</p> : null}

        {!collapsed && pinned.length > 0 ? (
          <Section label="Pinned">
            {pinned.map((c) => (
              <ConversationRow
                key={c.id}
                item={c}
                active={c.id === activeId}
                menuOpen={menuId === c.id}
                onOpenMenu={() => setMenuId(menuId === c.id ? null : c.id)}
                onSelect={() => {
                  onSelect(c.id);
                  onCloseMobile();
                  setMenuId(null);
                }}
                onRename={onRename}
                onPin={onPin}
                onArchive={onArchive}
                onDelete={onDelete}
              />
            ))}
          </Section>
        ) : null}

        {!collapsed ? (
          <Section label="Recent">
            {recent.length === 0 ? (
              <p className="px-2 py-2 text-xs text-[var(--ws-text-tertiary)]">No conversations yet.</p>
            ) : (
              recent.map((c) => (
                <ConversationRow
                  key={c.id}
                  item={c}
                  active={c.id === activeId}
                  menuOpen={menuId === c.id}
                  onOpenMenu={() => setMenuId(menuId === c.id ? null : c.id)}
                  onSelect={() => {
                    onSelect(c.id);
                    onCloseMobile();
                    setMenuId(null);
                  }}
                  onRename={onRename}
                  onPin={onPin}
                  onArchive={onArchive}
                  onDelete={onDelete}
                />
              ))
            )}
          </Section>
        ) : null}

        {!collapsed && archived.length > 0 ? (
          <Section label="Archived">
            {archived.map((c) => (
              <ConversationRow
                key={c.id}
                item={c}
                active={c.id === activeId}
                menuOpen={menuId === c.id}
                onOpenMenu={() => setMenuId(menuId === c.id ? null : c.id)}
                onSelect={() => {
                  onSelect(c.id);
                  onCloseMobile();
                  setMenuId(null);
                }}
                onRename={onRename}
                onPin={onPin}
                onArchive={onArchive}
                onDelete={onDelete}
              />
            ))}
          </Section>
        ) : null}

        {!collapsed ? (
          <Section label="Bonnie">
            <button type="button" className={navButton}>
              <Brain className="h-4 w-4 text-[var(--ac-bonnie)]" aria-hidden="true" />
              Agents
            </button>
            <button type="button" className={navButton}>
              <Workflow className="h-4 w-4 text-[var(--ac-bonnie)]" aria-hidden="true" />
              Saved workflows
            </button>
            {onOpenApprovals ? (
              <button type="button" onClick={onOpenApprovals} className={`${navButton} justify-between`}>
                <span className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-[var(--ac-bonnie)]" aria-hidden="true" />
                  Approvals
                </span>
                {pendingApprovals > 0 ? (
                  <span className="rounded-full bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-[var(--warning)]">{pendingApprovals}</span>
                ) : null}
              </button>
            ) : null}
          </Section>
        ) : null}
      </nav>

      {!collapsed ? (
        <div className="border-t border-[var(--ws-border)] p-3">
          <p className="truncate text-xs font-medium text-[var(--ws-text-tertiary)]">Workspace</p>
          <p className="truncate text-sm font-semibold text-[var(--ws-text-primary)]">{workspaceName || 'Business workspace'}</p>
          <p className="mt-1 truncate text-xs text-[var(--ws-text-tertiary)]">{userLabel || 'Signed in'}</p>
        </div>
      ) : null}
    </aside>
  );

  return (
    <>
      <div className="hidden h-full md:flex">{panel}</div>
      {mobileOpen ? (
        <div className="fixed inset-0 z-[1110] md:hidden" role="dialog" aria-modal="true" aria-label="Bonnie conversations">
          <button type="button" className="absolute inset-0 bg-[var(--overlay,rgba(0,0,0,0.5))]" aria-label="Close conversations" onClick={onCloseMobile} />
          <div data-sheet data-side="left" data-state="open" className="absolute inset-y-0 left-0 flex h-full w-[min(100%,300px)] shadow-2xl">
            {panel}
          </div>
        </div>
      ) : null}
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ws-text-tertiary)]">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function ConversationRow({
  item,
  active,
  menuOpen,
  onOpenMenu,
  onSelect,
  onRename,
  onPin,
  onArchive,
  onDelete,
}: {
  item: BonnieConversationSummary;
  active: boolean;
  menuOpen: boolean;
  onOpenMenu: () => void;
  onSelect: () => void;
  onRename: (id: string, title: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={`group relative flex items-start gap-1 rounded-[var(--ws-radius-control,8px)] px-2 py-2 transition-colors ${active ? 'bg-[color-mix(in_srgb,var(--ac-bonnie)_12%,var(--ws-panel))] text-[var(--ws-text-primary)]' : 'hover:bg-[var(--ws-hover)]'}`}>
      <button type="button" onClick={onSelect} className="min-h-11 min-w-0 flex-1 text-left focus-visible:outline-none">
        <p className="truncate text-sm font-medium">{item.title || 'New conversation'}</p>
        <p className="truncate text-[11px] text-[var(--ws-text-tertiary)]">
          {item.module ? `${item.module} · ` : ''}
          {relativeTime(item.updatedAt)}
        </p>
      </button>
      <button
        type="button"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--ws-radius-control,8px)] text-[var(--ws-text-tertiary)] opacity-0 transition-opacity hover:bg-[var(--ws-hover)] group-hover:opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        aria-label="Conversation actions"
        onClick={onOpenMenu}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>
      {menuOpen ? (
        <div data-popover-content data-state="open" className="absolute right-1 top-11 z-20 w-44 rounded-[var(--ws-radius-lg,14px)] border border-[var(--ws-border)] bg-[color-mix(in_srgb,var(--ws-panel)_96%,transparent)] p-1 shadow-xl">
          <MenuItem icon={<Pin className="h-3.5 w-3.5" />} label={item.pinned ? 'Unpin' : 'Pin'} onClick={() => onPin(item.id, !item.pinned)} />
          <MenuItem
            icon={<PinOff className="h-3.5 w-3.5" />}
            label="Rename"
            onClick={() => {
              const next = window.prompt('Rename conversation', item.title);
              if (next != null && next.trim()) onRename(item.id, next.trim());
            }}
          />
          <MenuItem icon={<Archive className="h-3.5 w-3.5" />} label={item.archived ? 'Unarchive' : 'Archive'} onClick={() => onArchive(item.id)} />
          <MenuItem
            icon={<Trash2 className="h-3.5 w-3.5" />}
            label="Delete"
            danger
            onClick={() => {
              if (window.confirm('Delete this conversation?')) onDelete(item.id);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-11 w-full items-center gap-2 rounded-[var(--ws-radius-control,8px)] px-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${danger ? 'text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_8%,transparent)]' : 'text-[var(--ws-text-secondary)] hover:bg-[var(--ws-hover)] hover:text-[var(--ws-text-primary)]'}`}
    >
      {icon}
      {label}
    </button>
  );
}
