import React, { useState, useEffect } from 'react';
import { X, Command, Search } from 'lucide-react';

interface Shortcut {
    key: string;
    description: string;
    category: string;
}

const shortcuts: Shortcut[] = [
    // Navigation
    { key: '⌘K / Ctrl+K', description: 'Open global search', category: 'Navigation' },
    { key: 'Esc', description: 'Close modals/dialogs', category: 'Navigation' },
    { key: '/', description: 'Focus search', category: 'Navigation' },

    // Actions
    { key: '⌘N / Ctrl+N', description: 'New project', category: 'Actions' },
    { key: '⌘S / Ctrl+S', description: 'Save changes', category: 'Actions' },
    { key: '⌘Enter', description: 'Submit form', category: 'Actions' },

    // Dashboard
    { key: 'G then D', description: 'Go to Dashboard', category: 'Dashboard' },
    { key: 'G then P', description: 'Go to Projects', category: 'Dashboard' },
    { key: 'G then M', description: 'Go to Messages', category: 'Dashboard' },
    { key: 'G then C', description: 'Go to Calendar', category: 'Dashboard' },
    { key: 'G then S', description: 'Go to Settings', category: 'Dashboard' },

    // Lists
    { key: '↑ / ↓', description: 'Navigate items', category: 'Lists' },
    { key: 'Enter', description: 'Select item', category: 'Lists' },
    { key: 'Space', description: 'Toggle selection', category: 'Lists' },
];

interface KeyboardShortcutsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === '?' && (e.shiftKey)) {
                e.preventDefault();
                onClose();
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const categories = Array.from(new Set(shortcuts.map(s => s.category)));

    const filteredShortcuts = shortcuts.filter(
        s =>
            s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.key.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const groupedShortcuts = categories.reduce((acc, category) => {
        acc[category] = filteredShortcuts.filter(s => s.category === category);
        return acc;
    }, {} as Record<string, Shortcut[]>);

    return (
        <>
            <div
                className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="p-6 border-b border-slate-800">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Command className="w-5 h-5 text-teal-400" />
                                Keyboard Shortcuts
                            </h2>
                            <button
                                onClick={onClose}
                                className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search shortcuts..."
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-teal-500"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Shortcuts List */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                        {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => {
                            if (categoryShortcuts.length === 0) return null;

                            return (
                                <div key={category}>
                                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                                        {category}
                                    </h3>
                                    <div className="space-y-2">
                                        {categoryShortcuts.map((shortcut, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors"
                                            >
                                                <span className="text-sm text-slate-300">{shortcut.description}</span>
                                                <kbd className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-xs font-mono text-slate-300">
                                                    {shortcut.key}
                                                </kbd>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}

                        {filteredShortcuts.length === 0 && (
                            <div className="text-center py-8 text-slate-400">
                                <p>No shortcuts found</p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                        <p className="text-xs text-slate-400 text-center">
                            Press <kbd className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">?</kbd> to toggle this modal
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
};

// Hook to manage keyboard shortcuts modal
export const useKeyboardShortcuts = () => {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // ? key to open shortcuts
            if (e.key === '?' && e.shiftKey && !isOpen) {
                e.preventDefault();
                setIsOpen(true);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    return {
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
    };
};

export default KeyboardShortcutsModal;
