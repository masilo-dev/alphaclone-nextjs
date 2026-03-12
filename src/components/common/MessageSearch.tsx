'use client';

import React, { useState } from 'react';
import { Search, X, Filter, Calendar, User, Tag } from 'lucide-react';

interface MessageSearchProps {
  onSearch: (query: string) => void;
  onClose: () => void;
}

export default function MessageSearch({ onSearch, onClose }: MessageSearchProps) {
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    from: '',
    date: '',
    hasAttachments: false,
    isUnread: false
  });

  const handleSearch = () => {
    let searchQuery = query;
    
    if (filters.from) {
      searchQuery += ` from:${filters.from}`;
    }
    if (filters.date) {
      searchQuery += ` date:${filters.date}`;
    }
    if (filters.hasAttachments) {
      searchQuery += ' has:attachments';
    }
    if (filters.isUnread) {
      searchQuery += ' is:unread';
    }
    
    onSearch(searchQuery.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Search messages..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          <Filter className="w-4 h-4" />
        </button>
        <button
          onClick={onClose}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {showFilters && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-10">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="w-4 h-4 inline mr-1" />
                From
              </label>
              <input
                type="text"
                value={filters.from}
                onChange={(e) => setFilters(prev => ({ ...prev, from: e.target.value }))}
                placeholder="Sender name"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Date
              </label>
              <input
                type="date"
                value={filters.date}
                onChange={(e) => setFilters(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.hasAttachments}
                  onChange={(e) => setFilters(prev => ({ ...prev, hasAttachments: e.target.checked }))}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Has attachments</span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.isUnread}
                  onChange={(e) => setFilters(prev => ({ ...prev, isUnread: e.target.checked }))}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Unread only</span>
              </label>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => {
                  setFilters({
                    from: '',
                    date: '',
                    hasAttachments: false,
                    isUnread: false
                  });
                  setQuery('');
                }}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
              >
                Clear
              </button>
              <button
                onClick={handleSearch}
                className="px-4 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                Search
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}