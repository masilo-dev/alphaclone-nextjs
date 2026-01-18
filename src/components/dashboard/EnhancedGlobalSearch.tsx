import React, { useState, useEffect, useRef } from 'react';
import { Search, X, FileText, MessageSquare, DollarSign, User, Filter } from 'lucide-react';
import { searchService, SearchResult, SearchFilters } from '../../services/searchService';
import { User as UserType } from '../../types';
import { Card } from '../ui/UIComponents';

interface EnhancedGlobalSearchProps {
    user: UserType;
    onNavigate: (path: string) => void;
}

const EnhancedGlobalSearch: React.FC<EnhancedGlobalSearchProps> = ({ user, onNavigate }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [history, setHistory] = useState<string[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<SearchFilters>({});
    const [isSearching, setIsSearching] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

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
        loadSearchHistory();

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        if (query.length >= 2) {
            const debounceTimer = setTimeout(() => {
                performSearch();
                loadSuggestions();
            }, 300);

            return () => clearTimeout(debounceTimer);
        } else {
            setResults([]);
            setSuggestions([]);
            return undefined;
        }
    }, [query, filters]);

    const loadSearchHistory = async () => {
        const historyData = await searchService.getSearchHistory(user.id, 5);
        setHistory(historyData);
    };

    const loadSuggestions = async () => {
        const role = user.role === 'admin' ? 'admin' : 'client';
        const suggs = await searchService.getSuggestions(query, user.id, role);
        setSuggestions(suggs);
    };

    const performSearch = async () => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        setIsSearching(true);
        const role = user.role === 'admin' ? 'admin' : 'client';
        const { results: searchResults, error } = await searchService.search(
            query,
            user.id,
            role,
            filters
        );

        if (!error && searchResults) {
            setResults(searchResults);
            await searchService.saveSearchHistory(user.id, query, searchResults.length);
        }
        setIsSearching(false);
    };

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
        setResults([]);
    };

    const handleHistoryClick = (historyQuery: string) => {
        setQuery(historyQuery);
        inputRef.current?.focus();
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'project':
                return <FileText className="w-4 h-4" />;
            case 'message':
                return <MessageSquare className="w-4 h-4" />;
            case 'invoice':
                return <DollarSign className="w-4 h-4" />;
            case 'user':
                return <User className="w-4 h-4" />;
            default:
                return <Search className="w-4 h-4" />;
        }
    };

    const getColor = (type: string) => {
        switch (type) {
            case 'project':
                return 'text-blue-400 bg-blue-500/10';
            case 'message':
                return 'text-purple-400 bg-purple-500/10';
            case 'invoice':
                return 'text-green-400 bg-green-500/10';
            case 'user':
                return 'text-teal-400 bg-teal-500/10';
            default:
                return 'text-slate-400 bg-slate-500/10';
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 transition-colors group"
            >
                <img src="/logo.png" alt="AlphaClone" className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                <span className="text-sm">Search...</span>
                <kbd className="hidden sm:inline-block px-2 py-0.5 text-xs bg-slate-900 border border-slate-700 rounded">
                    ⌘K
                </kbd>
            </button>
        );
    }

    return (
        <>
            <div
                className="fixed inset-0 bg-black/50 z-50"
                onClick={() => setIsOpen(false)}
            />
            <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
                <Card className="w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
                    {/* Search Input */}
                    <div className="flex items-center gap-3 p-4 border-b border-slate-800">
                        <Search className="w-5 h-5 text-slate-400" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Search projects, messages, invoices, users..."
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
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`p-2 rounded-lg transition-colors ${showFilters ? 'bg-teal-500/20 text-teal-400' : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            <Filter className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Filters Panel */}
                    {showFilters && (
                        <div className="p-4 border-b border-slate-800 bg-slate-900/50">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-slate-400 mb-2 block">Type</label>
                                    <select
                                        multiple
                                        value={filters.type || []}
                                        onChange={(e) => {
                                            const values = Array.from(e.target.selectedOptions, opt => opt.value);
                                            setFilters({ ...filters, type: values as any });
                                        }}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                                    >
                                        <option value="project">Projects</option>
                                        <option value="message">Messages</option>
                                        <option value="invoice">Invoices</option>
                                        {user.role === 'admin' && <option value="user">Users</option>}
                                        <option value="all">All</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 mb-2 block">Status</label>
                                    <input
                                        type="text"
                                        placeholder="Filter by status..."
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                                        onChange={(e) => {
                                            const newFilters = { ...filters };
                                            if (e.target.value) {
                                                newFilters.status = [e.target.value];
                                            } else {
                                                delete newFilters.status;
                                            }
                                            setFilters(newFilters);
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Suggestions */}
                    {suggestions.length > 0 && !query && (
                        <div className="p-4 border-b border-slate-800">
                            <p className="text-xs text-slate-400 mb-2">Suggestions</p>
                            <div className="flex flex-wrap gap-2">
                                {suggestions.map((suggestion, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleHistoryClick(suggestion)}
                                        className="px-3 py-1 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700 transition-colors"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* History */}
                    {history.length > 0 && !query && results.length === 0 && (
                        <div className="p-4 border-b border-slate-800">
                            <p className="text-xs text-slate-400 mb-2">Recent Searches</p>
                            <div className="space-y-1">
                                {history.map((historyItem, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleHistoryClick(historyItem)}
                                        className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                                    >
                                        {historyItem}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Results */}
                    <div className="flex-1 overflow-y-auto">
                        {isSearching && (
                            <div className="p-8 text-center text-slate-400">
                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400 mb-3"></div>
                                <p>Searching...</p>
                            </div>
                        )}

                        {!isSearching && results.length === 0 && query && (
                            <div className="p-8 text-center text-slate-400">
                                <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p>No results found</p>
                                <p className="text-xs mt-2">Try different keywords or adjust filters</p>
                            </div>
                        )}

                        {!isSearching && results.length === 0 && !query && (
                            <div className="p-8 text-center text-slate-400">
                                <p className="text-sm">Start typing to search...</p>
                                <div className="mt-4 text-xs space-y-1">
                                    <p>• Search across projects, messages, invoices</p>
                                    <p>• Use filters to narrow results</p>
                                    <p>• Press ⌘K anytime to search</p>
                                </div>
                            </div>
                        )}

                        {results.map((result, index) => (
                            <button
                                key={`${result.type}-${result.id}`}
                                onClick={() => handleSelect(result)}
                                className={`w-full flex items-start gap-3 p-4 text-left transition-colors ${index === selectedIndex
                                        ? 'bg-slate-800'
                                        : 'hover:bg-slate-800/50'
                                    }`}
                            >
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${getColor(result.type)}`}>
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
                                    {result.description && (
                                        <p className="text-slate-500 text-xs mt-1 line-clamp-2">
                                            {result.description}
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className="text-xs text-slate-500 uppercase">
                                        {result.type}
                                    </span>
                                    {result.metadata && (
                                        <span className="text-xs text-slate-600">
                                            {result.relevance}% match
                                        </span>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-900/50">
                        <div className="flex gap-4">
                            <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded">↑↓</kbd> Navigate</span>
                            <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Enter</kbd> Select</span>
                            <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Esc</kbd> Close</span>
                        </div>
                        <span>{results.length} result{results.length !== 1 ? 's' : ''}</span>
                    </div>
                </Card>
            </div>
        </>
    );
};

export default EnhancedGlobalSearch;

