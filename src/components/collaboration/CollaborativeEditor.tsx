import React, { useEffect, useRef, useState } from 'react';
import { Card, Button } from '../ui/UIComponents';
import { Users, Save, History, MessageSquare, X } from 'lucide-react';
import { collaborationService, CollaborationDocument, CursorPosition } from '../../services/collaborationService';
import { User } from '../../types';

interface CollaborativeEditorProps {
    documentId: string;
    user: User;
    onClose?: () => void;
}

const CollaborativeEditor: React.FC<CollaborativeEditorProps> = ({ documentId, user, onClose }) => {
    const [document, setDocument] = useState<CollaborationDocument | null>(null);
    const [content, setContent] = useState('');
    const [cursors, setCursors] = useState<CursorPosition[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [participants, setParticipants] = useState<string[]>([]);
    const editorRef = useRef<HTMLTextAreaElement>(null);
    const subscriptionRef = useRef<{ unsubscribe: () => void; sendCursor: (cursor: CursorPosition) => void } | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        loadDocument();
        subscribeToDocument();

        return () => {
            if (subscriptionRef.current) {
                subscriptionRef.current.unsubscribe();
            }
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [documentId]);

    const loadDocument = async () => {
        const { document: doc, error } = await collaborationService.getDocument(documentId);
        if (doc && !error) {
            setDocument(doc);
            setContent(doc.content);
            setParticipants(doc.participants);
        }
    };

    const subscribeToDocument = () => {
        const subscription = collaborationService.subscribeToDocument(
            documentId,
            (updatedDoc) => {
                setDocument(updatedDoc);
                setContent(updatedDoc.content);
                setParticipants(updatedDoc.participants);
            },
            (updatedCursors) => {
                setCursors(updatedCursors);
            }
        );

        subscriptionRef.current = subscription;
    };

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value;
        setContent(newContent);

        // Send cursor position
        if (subscriptionRef.current) {
            const position = e.target.selectionStart;
            subscriptionRef.current.sendCursor({
                userId: user.id,
                userName: user.name,
                position,
                color: '#2dd4bf',
            });
        }

        // Auto-save with debounce
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
            saveDocument(newContent);
        }, 1000);
    };

    const saveDocument = async (docContent?: string) => {
        setIsSaving(true);
        const contentToSave = docContent || content;
        const { success, error } = await collaborationService.updateDocument(documentId, contentToSave, user.id);
        if (!success) {
            console.error('Failed to save:', error);
        }
        setIsSaving(false);
    };

    const getParticipantColors = (userId: string): string => {
        const colors = ['#2dd4bf', '#8b5cf6', '#3b82f6', '#f59e0b', '#ef4444'];
        const index = participants.indexOf(userId) % colors.length;
        return colors[index] ?? colors[0] ?? '#2dd4bf';
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <Card className="w-full max-w-5xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-white">{document?.title || 'Collaborative Document'}</h2>
                        {isSaving && (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                <Save className="w-3 h-3 animate-spin" />
                                Saving...
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Participants */}
                        <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-slate-400" />
                            <div className="flex -space-x-2">
                                {participants.slice(0, 3).map((participantId) => (
                                    <div
                                        key={participantId}
                                        className="w-8 h-8 rounded-full border-2 border-slate-800"
                                        style={{ backgroundColor: getParticipantColors(participantId) }}
                                        title={participantId === user.id ? user.name : 'Participant'}
                                    />
                                ))}
                                {participants.length > 3 && (
                                    <div className="w-8 h-8 rounded-full bg-slate-700 border-2 border-slate-800 flex items-center justify-center text-xs text-white">
                                        +{participants.length - 3}
                                    </div>
                                )}
                            </div>
                        </div>

                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-2 text-slate-400 hover:text-white transition-colors"
                                aria-label="Close editor"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Editor */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    <textarea
                        ref={editorRef}
                        value={content}
                        onChange={handleContentChange}
                        className="flex-1 w-full p-6 bg-slate-950 text-white placeholder-slate-600 resize-none outline-none font-mono text-sm"
                        placeholder="Start typing... Changes are saved automatically and synced in real-time."
                    />

                    {/* Cursor indicators */}
                    {cursors.length > 0 && (
                        <div className="absolute pointer-events-none">
                            {cursors.map((cursor) => (
                                <div
                                    key={cursor.userId}
                                    className="absolute w-0.5 h-5"
                                    style={{
                                        backgroundColor: cursor.color,
                                        left: `${cursor.position * 8}px`, // Approximate
                                    }}
                                >
                                    <div
                                        className="absolute -top-6 left-0 px-2 py-1 rounded text-xs text-white whitespace-nowrap"
                                        style={{ backgroundColor: cursor.color }}
                                    >
                                        {cursor.userName}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 flex items-center justify-between text-sm text-slate-400">
                    <div className="flex items-center gap-4">
                        <span>{participants.length} participant{participants.length !== 1 ? 's' : ''}</span>
                        <span>Version {document?.version || 1}</span>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                // Open version history
                            }}
                        >
                            <History className="w-4 h-4 mr-2" />
                            History
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                // Open comments
                            }}
                        >
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Comments
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default CollaborativeEditor;

