'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
    Plus, ChevronRight, Trash2, MoreHorizontal,
    FileText, Loader2, Search, Home, Archive,
    Edit3, Check, X, ChevronDown, Smile
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

// BlockNote is loaded client-side only to avoid SSR issues
const BlockNoteEditor = dynamic(() => import('./BlockNoteEditorWrapper'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-full text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin" />
        </div>
    ),
});

interface Page {
    id: string;
    parent_id: string | null;
    title: string;
    icon: string;
    content: any[];
    is_archived: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

const ICONS = ['📄', '📝', '📋', '📌', '🗂️', '💡', '🎯', '📊', '🚀', '⚙️', '💼', '🔖', '📈', '🧠', '✅', '🗒️'];

export default function PagesTab() {
    const { user } = useAuth();
    const { currentTenant: tenant } = useTenant();
    const [pages, setPages] = useState<Page[]>([]);
    const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [showIconPicker, setShowIconPicker] = useState<string | null>(null);
    const [savingId, setSavingId] = useState<string | null>(null);
    const renameRef = useRef<HTMLInputElement>(null);
    const saveTimerRef = useRef<Record<string, NodeJS.Timeout>>({});

    const selectedPage = pages.find(p => p.id === selectedPageId) ?? null;

    // ----- Data Loading -----
    const loadPages = useCallback(async () => {
        if (!tenant?.id) return; // eslint-disable-line
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('pages')
                .select('*')
                .eq('tenant_id', tenant.id)
                .eq('is_archived', false)
                .order('sort_order', { ascending: true })
                .order('created_at', { ascending: true });
            if (error) throw error;
            setPages(data ?? []);
            if (data?.length && !selectedPageId) {
                setSelectedPageId(data[0].id);
            }
        } catch (err: any) {
            toast.error('Failed to load pages');
        } finally {
            setLoading(false);
        }
    }, [tenant?.id]);

    useEffect(() => { loadPages(); }, [loadPages]);

    // ----- Page CRUD -----
    const createPage = async (parentId: string | null = null) => {
        if (!tenant?.id || !user?.id) return;
        const response = await fetch(`/api/tenant/${encodeURIComponent(tenant.id)}/pages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parentId, sortOrder: pages.filter(p => p.parent_id === parentId).length }) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.page) { toast.error(result.error || 'Failed to create page'); return; }
        const data = result.page as Page;
        setPages(prev => [...prev, data]);
        setSelectedPageId(data.id);
        if (parentId) setExpanded(prev => new Set([...prev, parentId]));
        // Auto-start rename
        setRenamingId(data.id);
        setRenameValue('');
        setTimeout(() => renameRef.current?.focus(), 50);
    };

    const deletePage = async (id: string) => {
        if (!confirm('Delete this page and all sub-pages?')) return;
        // Cascade deletes sub-pages via DB foreign key
        if (!tenant?.id) return;
        const response = await fetch(`/api/tenant/${encodeURIComponent(tenant.id)}/pages?pageId=${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!response.ok) { toast.error('Failed to delete page'); return; }
        setPages(prev => prev.filter(p => p.id !== id && p.parent_id !== id));
        if (selectedPageId === id) setSelectedPageId(pages.find(p => p.id !== id)?.id ?? null);
        toast.success('Page deleted');
    };

    const archivePage = async (id: string) => {
        if (!tenant?.id) return;
        const response = await fetch(`/api/tenant/${encodeURIComponent(tenant.id)}/pages`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pageId: id, isArchived: true }) });
        if (!response.ok) { toast.error('Failed to archive page'); return; }
        setPages(prev => prev.filter(p => p.id !== id));
        if (selectedPageId === id) setSelectedPageId(pages.find(p => p.id !== id)?.id ?? null);
        toast.success('Page archived');
    };

    const renameSubmit = async (id: string) => {
        const title = renameValue.trim() || 'Untitled';
        setPages(prev => prev.map(p => p.id === id ? { ...p, title } : p));
        setRenamingId(null);
        if (tenant?.id) await fetch(`/api/tenant/${encodeURIComponent(tenant.id)}/pages`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pageId: id, title }) });
    };

    const updateIcon = async (id: string, icon: string) => {
        setPages(prev => prev.map(p => p.id === id ? { ...p, icon } : p));
        setShowIconPicker(null);
        if (tenant?.id) await fetch(`/api/tenant/${encodeURIComponent(tenant.id)}/pages`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pageId: id, icon }) });
    };

    // Auto-save content with debounce
    const handleContentChange = useCallback((pageId: string, content: any[]) => {
        setPages(prev => prev.map(p => p.id === pageId ? { ...p, content } : p));
        if (saveTimerRef.current[pageId]) clearTimeout(saveTimerRef.current[pageId]);
        setSavingId(pageId);
        saveTimerRef.current[pageId] = setTimeout(async () => {
            if (tenant?.id) await fetch(`/api/tenant/${encodeURIComponent(tenant.id)}/pages`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pageId, content }) });
            setSavingId(null);
        }, 1200);
    }, [tenant?.id]);

    // ----- Tree helpers -----
    const rootPages = pages.filter(p => !p.parent_id);
    const getChildren = (id: string) => pages.filter(p => p.parent_id === id);
    const filteredPages = searchTerm
        ? pages.filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase()))
        : null;

    const toggleExpand = (id: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    // ----- Render tree node -----
    const PageNode = ({ page, depth = 0 }: { page: Page; depth?: number }) => {
        const children = getChildren(page.id);
        const hasChildren = children.length > 0;
        const isExpanded = expanded.has(page.id);
        const isSelected = selectedPageId === page.id;
        const [showMenu, setShowMenu] = useState(false);

        return (
            <div>
                <div
                    className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 cursor-pointer transition-all text-sm
                        ${isSelected ? 'bg-teal-500/15 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                    style={{ paddingLeft: `${0.5 + depth * 1.25}rem` }}
                    onClick={() => setSelectedPageId(page.id)}
                >
                    {/* Expand toggle */}
                    <button
                        className={`shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''} ${hasChildren ? 'text-slate-400 hover:text-white' : 'opacity-0 pointer-events-none'}`}
                        onClick={e => { e.stopPropagation(); toggleExpand(page.id); }}
                    >
                        <ChevronRight className="w-3 h-3" />
                    </button>

                    {/* Icon */}
                    <button
                        className="text-base leading-none shrink-0 hover:scale-125 transition-transform"
                        onClick={e => { e.stopPropagation(); setShowIconPicker(showIconPicker === page.id ? null : page.id); }}
                    >
                        {page.icon}
                    </button>

                    {/* Title / rename input */}
                    {renamingId === page.id ? (
                        <input
                            ref={renameRef}
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onBlur={() => renameSubmit(page.id)}
                            onKeyDown={e => { if (e.key === 'Enter') renameSubmit(page.id); if (e.key === 'Escape') setRenamingId(null); }}
                            onClick={e => e.stopPropagation()}
                            className="flex-1 bg-slate-900 text-white text-sm px-1 py-0 rounded border border-teal-500 outline-none min-w-0"
                            placeholder="Page title"
                            autoFocus
                        />
                    ) : (
                        <span className="flex-1 truncate text-sm">{page.title}</span>
                    )}

                    {/* Action buttons - visible on hover */}
                    <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            className="p-0.5 rounded hover:bg-slate-700 text-slate-500 hover:text-white"
                            onClick={e => { e.stopPropagation(); createPage(page.id); }}
                            title="Add sub-page"
                        >
                            <Plus className="w-3 h-3" />
                        </button>
                        <div className="relative">
                            <button
                                className="p-0.5 rounded hover:bg-slate-700 text-slate-500 hover:text-white"
                                onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}
                            >
                                <MoreHorizontal className="w-3 h-3" />
                            </button>
                            {showMenu && (
                                <div className="absolute right-0 top-full mt-1 w-40 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 py-1">
                                    <button onClick={e => { e.stopPropagation(); setRenamingId(page.id); setRenameValue(page.title); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white">
                                        <Edit3 className="w-3 h-3" /> Rename
                                    </button>
                                    <button onClick={e => { e.stopPropagation(); createPage(page.id); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white">
                                        <Plus className="w-3 h-3" /> Add sub-page
                                    </button>
                                    <button onClick={e => { e.stopPropagation(); archivePage(page.id); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white">
                                        <Archive className="w-3 h-3" /> Archive
                                    </button>
                                    <div className="my-1 border-t border-slate-800" />
                                    <button onClick={e => { e.stopPropagation(); deletePage(page.id); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10">
                                        <Trash2 className="w-3 h-3" /> Delete
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Icon picker */}
                {showIconPicker === page.id && (
                    <div className="mx-2 mb-1 p-2 bg-slate-900 border border-slate-700 rounded-xl grid grid-cols-8 gap-1 z-50">
                        {ICONS.map(ic => (
                            <button key={ic} onClick={() => updateIcon(page.id, ic)} className="text-base hover:scale-125 transition-transform p-0.5 rounded hover:bg-slate-700">
                                {ic}
                            </button>
                        ))}
                    </div>
                )}

                {/* Children */}
                {isExpanded && hasChildren && (
                    <div>
                        {children.map(child => (
                            <PageNode key={child.id} page={child} depth={depth + 1} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Loading pages...
            </div>
        );
    }

    return (
        <div className="flex h-full overflow-hidden bg-slate-950">
            {/* ---- SIDEBAR ---- */}
            <aside className="w-60 shrink-0 flex flex-col border-r border-slate-800/60 bg-slate-950 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-3 border-b border-slate-800/60">
                    <div className="flex items-center gap-2 text-slate-300 text-sm font-semibold">
                        <FileText className="w-4 h-4 text-teal-400" />
                        Pages
                    </div>
                    <button
                        onClick={() => createPage(null)}
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-teal-400 transition-colors"
                        title="New root page"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>

                {/* Search */}
                <div className="px-3 py-2 border-b border-slate-800/40">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search pages..."
                            className="w-full bg-slate-900 text-slate-300 text-xs pl-8 pr-3 py-2 rounded-lg border border-slate-800 outline-none focus:border-teal-500/50 placeholder:text-slate-600"
                        />
                    </div>
                </div>

                {/* Page tree */}
                <nav className="flex-1 overflow-y-auto py-2 px-1 space-y-0.5">
                    {pages.length === 0 ? (
                        <div className="text-center py-8 px-4">
                            <FileText className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                            <p className="text-xs text-slate-500 mb-3">No pages yet. Create your first client-facing page.</p>
                            <button
                                onClick={() => createPage(null)}
                                className="text-xs text-teal-400 hover:text-teal-300 font-medium"
                            >
                                + Create your first page
                            </button>
                        </div>
                    ) : filteredPages ? (
                        filteredPages.map(page => (
                            <div
                                key={page.id}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer text-sm transition-colors ${selectedPageId === page.id ? 'bg-teal-500/15 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                                onClick={() => { setSelectedPageId(page.id); setSearchTerm(''); }}
                            >
                                <span>{page.icon}</span>
                                <span className="truncate">{page.title}</span>
                            </div>
                        ))
                    ) : (
                        rootPages.map(page => (
                            <PageNode key={page.id} page={page} depth={0} />
                        ))
                    )}
                </nav>
            </aside>

            {/* ---- EDITOR ---- */}
            <main className="flex-1 flex flex-col overflow-hidden min-w-0">
                {selectedPage ? (
                    <>
                        {/* Page header */}
                        <div className="shrink-0 px-10 pt-10 pb-4 border-b border-slate-800/40 flex items-start gap-4">
                            <button
                                className="text-4xl leading-none hover:scale-110 transition-transform mt-1"
                                onClick={() => setShowIconPicker(showIconPicker === selectedPage.id ? null : selectedPage.id)}
                                title="Change icon"
                            >
                                {selectedPage.icon}
                            </button>
                            {showIconPicker === selectedPage.id && (
                                <div className="absolute mt-12 ml-0 p-2 bg-slate-900 border border-slate-700 rounded-xl grid grid-cols-8 gap-1 z-50 shadow-2xl">
                                    {ICONS.map(ic => (
                                        <button key={ic} onClick={() => updateIcon(selectedPage.id, ic)} className="text-xl hover:scale-125 transition-transform p-1 rounded hover:bg-slate-700">
                                            {ic}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                {renamingId === selectedPage.id ? (
                                    <input
                                        ref={renameRef}
                                        value={renameValue}
                                        onChange={e => setRenameValue(e.target.value)}
                                        onBlur={() => renameSubmit(selectedPage.id)}
                                        onKeyDown={e => { if (e.key === 'Enter') renameSubmit(selectedPage.id); if (e.key === 'Escape') setRenamingId(null); }}
                                        className="w-full bg-transparent text-3xl font-bold text-white outline-none border-b-2 border-teal-500"
                                        placeholder="Untitled"
                                        autoFocus
                                    />
                                ) : (
                                    <h1
                                        className="text-3xl font-bold text-white cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={() => { setRenamingId(selectedPage.id); setRenameValue(selectedPage.title); }}
                                        title="Click to rename"
                                    >
                                        {selectedPage.title || 'Untitled'}
                                    </h1>
                                )}
                                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                    <span>
                                        {savingId === selectedPage.id ? (
                                            <span className="flex items-center gap-1 text-teal-500">
                                                <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-slate-600">
                                                <Check className="w-3 h-3" /> Saved
                                            </span>
                                        )}
                                    </span>
                                    <span>·</span>
                                    <span>Updated {new Date(selectedPage.updated_at).toLocaleDateString()}</span>
                                    <span>·</span>
                                    <button
                                        onClick={() => createPage(selectedPage.id)}
                                        className="text-teal-400 hover:text-teal-300"
                                    >
                                        + Add sub-page
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* BlockNote editor */}
                        <div className="flex-1 overflow-y-auto">
                            <BlockNoteEditor
                                key={selectedPage.id}
                                pageId={selectedPage.id}
                                initialContent={selectedPage.content}
                                onChange={(content) => handleContentChange(selectedPage.id, content)}
                            />
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                        <div className="text-6xl mb-6">📝</div>
                        <h2 className="text-2xl font-bold text-white mb-2">Your workspace</h2>
                        <p className="text-slate-400 mb-6 max-w-sm">Create pages for meeting notes, SOPs, project briefs, client research — anything your team needs.</p>
                        <button
                            onClick={() => createPage(null)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl transition-colors"
                        >
                            <Plus className="w-4 h-4" /> New Page
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
