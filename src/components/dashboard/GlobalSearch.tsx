import React, { useState, useEffect, useRef } from 'react';
import { Search, X, FileText, MessageSquare, DollarSign } from 'lucide-react';
import { Project, ChatMessage, Invoice } from '../../types';

interface GlobalSearchProps {
    projects: Project[];
    messages: ChatMessage[];
    invoices: Invoice[];
    onNavigate: (path: string) => void;
}

type SearchResult = {
    type: 'project' | 'message' | 'invoice' | 'other';
    id: string;
    title: string;
    subtitle?: string;
    link: string;
};

const GlobalSearch: React.FC<GlobalSearchProps> = ({ projects, messages, invoices, onNavigate }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Keyboard shortcut (Cmd/Ctrl + K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(true);
                setTimeout(() => inputRef.current?.focus(), 100);
            }
            if (e.key === 'Escape') {
                setIsOpen(false);
                setQuery('');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Search logic
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        const searchQuery = query.toLowerCase();
        const searchResults: SearchResult[] = [];

        // Search projects
        projects.forEach(project => {
            if (
                project.name.toLowerCase().includes(searchQuery) ||
                project.description?.toLowerCase().includes(searchQuery) ||
                project.category.toLowerCase().includes(searchQuery)
            ) {
                searchResults.push({
                    type: 'project',
                    id: project.id,
                    title: project.name,
                    subtitle: project.description || project.category,
                    link: '/dashboard/projects',
                });
            }
        });

        // Search messages
        messages.forEach(message => {
            if (message.text.toLowerCase().includes(searchQuery)) {
                searchResults.push({
                    type: 'message',
                    id: message.id,
                    title: message.text.substring(0, 60) + '...',
                    subtitle: message.senderName ? `From ${message.senderName}` : 'Message',
                    link: '/dashboard/messages',
                });
            }
        });

        // Search invoices
        invoices.forEach(invoice => {
            if (
                invoice.id.toLowerCase().includes(searchQuery) ||
                invoice.description?.toLowerCase().includes(searchQuery) ||
                invoice.projectName.toLowerCase().includes(searchQuery)
            ) {
                searchResults.push({
                    type: 'invoice',
                    id: invoice.id,
                    title: `Invoice #${invoice.id.substring(0, 8).toUpperCase()}`,
                    subtitle: `$${invoice.amount.toLocaleString()} - ${invoice.status}`,
                    link: '/dashboard/finance',
                });
            }
        });

        setResults(searchResults.slice(0, 10)); // Limit to 10 results
        setSelectedIndex(0);
    }, [query, projects, messages, invoices]);

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
        }
    };

    const handleSelect = (result: SearchResult) => {
        onNavigate(result.link);
        setIsOpen(false);
        setQuery('');
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'project':
                return <FileText className="w-4 h-4" />;
            case 'message':
                return <MessageSquare className="w-4 h-4" />;
            case 'invoice':
                return <DollarSign className="w-4 h-4" />;
            default:
                return <Search className="w-4 h-4" />;
        }
    };

    const getColor = (type: string) => {
        switch (type) {
            case 'project':
                return 'text-blue-400';
            case 'message':
                return 'text-purple-400';
            case 'invoice':
                return 'text-green-400';
            default:
                return 'text-slate-400';
        }
    };

    return (
        <>
            {/* Search Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 transition-colors"
            >
                <Search className="w-4 h-4" />
                <span className="text-sm">Search...</span>
                <kbd className="hidden sm:inline-block px-2 py-0.5 text-xs bg-slate-900 border border-slate-700 rounded">
                    ⌘K
                </kbd>
            </button>

            {/* Search Modal */}
            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-black/50 z-50"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
                        <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
                            {/* Search Input */}
                            <div className="flex items-center gap-3 p-4 border-b border-slate-800">
                                <Search className="w-5 h-5 text-slate-400" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Search projects, messages, invoices..."
                                    className="flex-1 bg-transparent text-white placeholder-slate-400 outline-none"
                                    autoFocus
                                />
                                {query && (
                                    <button
                                        onClick={() => setQuery('')}
                                        className="text-slate-400 hover:text-white transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                )}
                            </div>

                            {/* Results */}
                            <div className="max-h-96 overflow-y-auto">
                                {results.length === 0 && query && (
                                    <div className="p-8 text-center text-slate-400">
                                        <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p>No results found</p>
                                    </div>
                                )}
                                {results.length === 0 && !query && (
                                    <div className="p-8 text-center text-slate-400">
                                        <p className="text-sm">Start typing to search...</p>
                                        <div className="mt-4 text-xs space-y-1">
                                            <p>• Search projects by name or description</p>
                                            <p>• Find messages by content</p>
                                            <p>• Locate invoices by ID or amount</p>
                                        </div>
                                    </div>
                                )}
                                {results.map((result, index) => (
                                    <button
                                        key={result.id}
                                        onClick={() => handleSelect(result)}
                                        className={`w-full flex items-start gap-3 p-4 text-left transition-colors ${index === selectedIndex
                                            ? 'bg-slate-800'
                                            : 'hover:bg-slate-800/50'
                                            }`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 ${getColor(result.type)}`}>
                                            {getIcon(result.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-medium text-sm truncate">
                                                {result.title}
                                            </p>
                                            {result.subtitle && (
                                                <p className="text-slate-400 text-xs mt-1 truncate">
                                                    {result.subtitle}
                                                </p>
                                            )}
                                        </div>
                                        <span className="text-xs text-slate-500 uppercase">
                                            {result.type}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {/* Footer */}
                            <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                                <div className="flex gap-4">
                                    <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded">↑↓</kbd> Navigate</span>
                                    <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Enter</kbd> Select</span>
                                    <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Esc</kbd> Close</span>
                                </div>
                                <span>{results.length} results</span>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </>
    );
};

export default GlobalSearch;
