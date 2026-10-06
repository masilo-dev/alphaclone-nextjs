'use client';

import { Textarea as AlphaCloneTextarea } from '@/components/ui/textarea';


import React, { useState, useEffect, useRef } from 'react';
import { collaborationService, CollaborationDocument, CursorPosition } from '@/services/collaborationService';
import { Loader2, Users, Save, X, Maximize2, Minimize2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { WORKSPACE } from '@/constants/design';

interface CollaborativeTaskNotesProps {
    taskId: string;
    userId: string;
    userName: string;
    onClose: () => void;
}

const CollaborativeTaskNotes: React.FC<CollaborativeTaskNotesProps> = ({
    taskId,
    userId,
    userName,
    onClose
}) => {
    const [document, setDocument] = useState<CollaborationDocument | null>(null);
    const [loading, setLoading] = useState(true);
    const [cursors, setCursors] = useState<CursorPosition[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const editorRef = useRef<HTMLTextAreaElement>(null);
    const subscriptionRef = useRef<{ unsubscribe: () => void; sendCursor: (c: CursorPosition) => void } | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Ref for document ID to access inside closure if needed
    const document_id_ref = useRef<string | null>(null);
    useEffect(() => { document_id_ref.current = document?.id || null; }, [document]);

    useEffect(() => {
        loadDocument();
        return () => {
            if (subscriptionRef.current) subscriptionRef.current.unsubscribe();
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    }, [taskId]);

    const loadDocument = async () => {
        setLoading(true);
        try {
            const { document: doc, error } = await collaborationService.getDocumentByTaskId(taskId);

            if (doc) {
                setDocument(doc);
                if (doc.content && editorRef.current) {
                    editorRef.current.value = doc.content;
                }
            } else {
                // Create a new document if it doesn't exist
                const { document: newDoc, error: createError } = await collaborationService.createDocument(
                    'Task Notes',
                    'note',
                    undefined,
                    userId,
                    taskId
                );

                if (createError) {
                    toast.error('Failed to create notes document');
                    return;
                }

                if (newDoc) {
                    setDocument(newDoc);
                }
            }
        } catch (error) {
            console.error('Error loading document:', error);
            toast.error('Failed to load notes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!document) return;

        const sub = collaborationService.subscribeToDocument(
            document.id,
            (updatedDoc) => {
                // Simple sync visualization (could be enhanced)
            },
            (updatedCursors) => {
                setCursors(updatedCursors.filter(c => c.userId !== userId));
            }
        );

        subscriptionRef.current = {
            unsubscribe: sub.unsubscribe,
            sendCursor: sub.sendCursor
        };

        return () => {
            sub.unsubscribe();
        };
    }, [document?.id, userId]);

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value;
        if (document) {
            setDocument({ ...document, content: newContent });

            // Send cursor position
            if (subscriptionRef.current) {
                subscriptionRef.current.sendCursor({
                    userId,
                    userName,
                    position: e.target.selectionStart,
                    color: 'var(--success-500)' // Teal
                });
            }

            // Auto-save logic (debounced)
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            setIsSaving(true);
            saveTimeoutRef.current = setTimeout(async () => {
                await saveDocument(newContent);
            }, 1000);
        }
    };

    const saveDocument = async (content: string) => {
        if (!document) return;
        try {
            const { error } = await collaborationService.updateDocument(document.id, content, userId);
            if (error) throw new Error(error);
        } catch (err) {
            console.error('Auto-save failed:', err);
            toast.error('Failed to save notes');
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
                <p className="text-[var(--ws-text-muted)] type-card-description font-medium animate-pulse">Syncing with Grid Node...</p>
            </div>
        );
    }

    return (
        <div className={`flex h-full flex-col overflow-hidden transition-all duration-500 ${WORKSPACE.panel.base} rounded-lg ${isFullscreen ? 'fixed inset-4 z-50' : 'relative'}`}>
            {/* Toolbar */}
            <div className="flex items-center justify-between border-b border-[var(--ws-border)] bg-[var(--ws-panel)]/40 px-6 py-4 backdrop-blur-xl">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-teal-500/10 rounded-xl">
                        <Users className="w-5 h-5 text-teal-400" />
                    </div>
                    <div>
                        <h3 className="type-ui font-semibold text-[var(--ws-text-primary)]">Shared Notes</h3>
                        <div className="flex items-center gap-2">
                            <span className="flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                            <span className="type-caption text-[var(--ws-text-muted)]">
                                {cursors.length > 0 ? `${cursors.length + 1} people viewing` : 'Only you'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg transition-all ${isSaving ? 'bg-orange-500/10 text-orange-400' : 'text-slate-600'}`}>
                        <Save className={`w-4 h-4 ${isSaving ? 'animate-bounce' : ''}`} />
                    </div>
                    <button
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="p-2 hover:bg-[var(--ws-hover)] rounded-xl text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)] transition-all"
                    >
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-[var(--error-500)]/10 rounded-xl text-[var(--ws-text-muted)] hover:text-red-400 transition-all"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 relative bg-[var(--ws-canvas)] group">
                <AlphaCloneTextarea
                    ref={editorRef}
                    defaultValue={document?.content}
                    onChange={handleContentChange}
                    className="w-full h-full p-8 font-mono leading-relaxed resize-none"
                    placeholder="Start typing your notes..."
                />

                {/* Users Online List */}
                <div className="absolute bottom-6 right-6 flex -space-x-2">
                    {cursors.map((cursor, i) => (
                        <div
                            key={i}
                            className="w-8 h-8 rounded-full border-2 border-slate-950 bg-[var(--ws-surface-secondary)] flex items-center justify-center type-caption font-black text-[var(--ws-text-primary)] shadow-xl"
                            title={cursor.userName}
                            style={{ borderColor: cursor.color }}
                        >
                            {cursor.userName.charAt(0)}
                        </div>
                    ))}
                    <div className="w-8 h-8 rounded-full border-2 border-slate-950 bg-teal-500 flex items-center justify-center type-caption font-black text-[var(--text-inverse)] shadow-xl z-10" title="You">
                        {userName.charAt(0)}
                    </div>
                </div>

                {/* Grid Overlay for aesthetic */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
            </div>

            {/* Status Footer */}
            <div className="flex items-center gap-1.5 border-t border-[var(--ws-border)] bg-[var(--ws-panel)]/20 px-6 py-2 type-caption text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                <span>Auto-saving</span>
            </div>
        </div>
    );
};
export { CollaborativeTaskNotes };

