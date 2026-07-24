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
      className={`flex h-full flex-col border-r border-[color:var(--ws-border,#e2e8f0)] bg-[color:var(--ws-panel,#ffffff)] text-[color:var(--ws-text-primary,#0f172a)] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 ${
        collapsed ? 'w-[72px]' : 'w-[280px]'
      }`}
      aria-label="Bonnie conversations"
    >
      <div className="flex items-center gap-2 border-b border-[color:var(--ws-border,#e2e8f0)] px-3 py-3 dark:border-slate-800">
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-700 dark:text-teal-300">
              Alphaclone Systems
            </p>
            <h2 className="truncate text-sm font-semibold tracking-tight">Bonnie AI</h2>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500 dark:hover:bg-slate-800 md:inline-flex"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <div className="space-y-2 p-3">
        <button
          type="button"
          onClick={() => {
            onNewChat();
            onCloseMobile();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-teal-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
        >
          <MessageSquarePlus className="h-4 w-4" />
          {!collapsed && <span>New chat</span>}
        </button>

        {!collapsed && (
          <label className="relative block">
            <span className="sr-only">Search conversations</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                onSearch(e.target.value);
              }}
              placeholder="Search conversations"
              className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-xs outline-none ring-teal-500/30 placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3" aria-label="Conversation lists">
        {loading && !collapsed && (
          <p className="px-2 py-3 text-xs text-slate-500">Loading conversations…</p>
        )}

        {!collapsed && pinned.length > 0 && (
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
        )}

        {!collapsed && (
          <Section label="Recent">
            {recent.length === 0 ? (
              <p className="px-2 py-2 text-xs text-slate-500">No conversations yet.</p>
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
        )}

        {!collapsed && archived.length > 0 && (
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
        )}

        {!collapsed && (
          <Section label="Bonnie">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              <Brain className="h-4 w-4 text-teal-600" />
              Agents
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              <Workflow className="h-4 w-4 text-teal-600" />
              Saved workflows
            </button>
            {onOpenApprovals && (
              <button
                type="button"
                onClick={onOpenApprovals}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
              >
                <span className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-teal-600" />
                  Approvals
                </span>
                {pendingApprovals > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                    {pendingApprovals}
                  </span>
                )}
              </button>
            )}
          </Section>
        )}
      </nav>

      {!collapsed && (
        <div className="border-t border-[color:var(--ws-border,#e2e8f0)] p-3 dark:border-slate-800">
          <p className="truncate text-xs font-medium text-slate-500">Workspace</p>
          <p className="truncate text-sm font-semibold">{workspaceName || 'Business workspace'}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{userLabel || 'Signed in'}</p>
        </div>
      )}
    </aside>
  );

  return (
    <>
      <div className="hidden h-full md:flex">{panel}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/50"
            aria-label="Close conversations"
            onClick={onCloseMobile}
          />
          <div className="absolute inset-y-0 left-0 flex h-full w-[min(100%,300px)] shadow-xl">
            {panel}
          </div>
        </div>
      )}
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
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
    <div
      className={`group relative flex items-start gap-1 rounded-xl px-2 py-2 ${
        active
          ? 'bg-teal-50 text-teal-950 dark:bg-teal-950/40 dark:text-teal-50'
          : 'hover:bg-slate-100 dark:hover:bg-slate-900'
      }`}
    >
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium">{item.title || 'New conversation'}</p>
        <p className="truncate text-[11px] text-slate-500">
          {item.module ? `${item.module} · ` : ''}
          {relativeTime(item.updatedAt)}
        </p>
      </button>
      <button
        type="button"
        className="rounded-md p-1 text-slate-400 opacity-0 hover:bg-slate-200 group-hover:opacity-100 focus:opacity-100 dark:hover:bg-slate-800"
        aria-label="Conversation actions"
        onClick={onOpenMenu}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {menuOpen && (
        <div className="absolute right-1 top-9 z-20 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <MenuItem
            icon={<Pin className="h-3.5 w-3.5" />}
            label={item.pinned ? 'Unpin' : 'Pin'}
            onClick={() => onPin(item.id, !item.pinned)}
          />
          <MenuItem
            icon={<PinOff className="h-3.5 w-3.5" />}
            label="Rename"
            onClick={() => {
              const next = window.prompt('Rename conversation', item.title);
              if (next != null && next.trim()) onRename(item.id, next.trim());
            }}
          />
          <MenuItem
            icon={<Archive className="h-3.5 w-3.5" />}
            label={item.archived ? 'Unarchive' : 'Archive'}
            onClick={() => onArchive(item.id)}
          />
          <MenuItem
            icon={<Trash2 className="h-3.5 w-3.5" />}
            label="Delete"
            danger
            onClick={() => {
              if (window.confirm('Delete this conversation?')) onDelete(item.id);
            }}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
        danger
          ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30'
          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
