'use client';

import React, { useState, useEffect } from 'react';
import {
    Filter,
    Search,
    AlertCircle,
    CheckCircle,
    Clock,
    MessageSquare,
    X,
    Save
} from 'lucide-react';
import { Button, Input, Card, Modal } from '../../ui/UIComponents';
import { Improvement } from '../../../types';
import { improvementService, ImprovementFilters } from '../../../services/improvementService';

const ImprovementsPage: React.FC = () => {
    const [improvements, setImprovements] = useState<Improvement[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedImprovement, setSelectedImprovement] = useState<Improvement | null>(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);

    // Filters
    const [filters, setFilters] = useState<ImprovementFilters>({});
    const [searchQuery, setSearchQuery] = useState('');

    // Detail modal state
    const [editStatus, setEditStatus] = useState<Improvement['status']>('new');
    const [editNotes, setEditNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Load improvements
    useEffect(() => {
        loadImprovements();
    }, [filters]);

    const loadImprovements = async () => {
        setLoading(true);
        const { improvements: data, error } = await improvementService.getImprovements(filters);

        if (!error && data) {
            setImprovements(data);
        }

        setLoading(false);
    };

    const handleSearch = () => {
        setFilters({ ...filters, search: searchQuery });
    };

    const handleFilterChange = (key: keyof ImprovementFilters, value: any) => {
        setFilters({ ...filters, [key]: value || undefined });
    };

    const openDetail = (improvement: Improvement) => {
        setSelectedImprovement(improvement);
        setEditStatus(improvement.status);
        setEditNotes(improvement.admin_notes || '');
        setDetailModalOpen(true);
    };

    const handleSaveChanges = async () => {
        if (!selectedImprovement) return;

        setIsSaving(true);

        const { error } = await improvementService.updateImprovement(
            selectedImprovement.id,
            {
                status: editStatus,
                admin_notes: editNotes.trim() || null
            }
        );

        if (!error) {
            // Update local state
            setImprovements(prev =>
                prev.map(imp =>
                    imp.id === selectedImprovement.id
                        ? { ...imp, status: editStatus, admin_notes: editNotes.trim() }
                        : imp
                )
            );

            setDetailModalOpen(false);
            setSelectedImprovement(null);
        } else {
            alert('Failed to update improvement');
        }

        setIsSaving(false);
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'high':
                return 'bg-red-500/10 text-red-400 border-red-500/20';
            case 'medium':
                return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
            case 'low':
                return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            default:
                return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'new':
                return <AlertCircle className="w-4 h-4" />;
            case 'reviewed':
                return <MessageSquare className="w-4 h-4" />;
            case 'in_progress':
                return <Clock className="w-4 h-4" />;
            case 'resolved':
                return <CheckCircle className="w-4 h-4" />;
            default:
                return null;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'new':
                return 'bg-yellow-500/10 text-yellow-400';
            case 'reviewed':
                return 'bg-blue-500/10 text-blue-400';
            case 'in_progress':
                return 'bg-purple-500/10 text-purple-400';
            case 'resolved':
                return 'bg-green-500/10 text-green-400';
            default:
                return 'bg-slate-500/10 text-slate-400';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Platform Improvements</h1>
                <p className="text-slate-400">
                    Exit-intent feedback submissions from users
                </p>
            </div>

            {/* Filters */}
            <Card className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Search */}
                    <div className="md:col-span-2">
                        <div className="flex gap-2">
                            <Input
                                placeholder="Search message or page URL..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                            />
                            <Button onClick={handleSearch} className="bg-teal-600 hover:bg-teal-500">
                                <Search className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Status filter */}
                    <div>
                        <select
                            value={filters.status || ''}
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                        >
                            <option value="">All Statuses</option>
                            <option value="new">New</option>
                            <option value="reviewed">Reviewed</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                        </select>
                    </div>

                    {/* Severity filter */}
                    <div>
                        <select
                            value={filters.severity || ''}
                            onChange={(e) => handleFilterChange('severity', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                        >
                            <option value="">All Priorities</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                        </select>
                    </div>
                </div>
            </Card>

            {/* Improvements List */}
            {loading ? (
                <div className="text-center py-12 text-slate-400">Loading improvements...</div>
            ) : improvements.length === 0 ? (
                <Card className="p-12 text-center">
                    <MessageSquare className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-400 mb-2">No improvements found</h3>
                    <p className="text-slate-500 text-sm">
                        {Object.keys(filters).length > 0
                            ? 'Try adjusting your filters'
                            : 'Exit-intent submissions will appear here'}
                    </p>
                </Card>
            ) : (
                <div className="space-y-4">
                    {improvements.map((improvement) => (
                        <Card
                            key={improvement.id}
                            className="p-6 hover:border-teal-500/30 transition-all cursor-pointer"
                            onClick={() => openDetail(improvement)}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    {/* Message preview */}
                                    <p className="text-white mb-3 line-clamp-2">
                                        {improvement.message}
                                    </p>

                                    {/* Metadata */}
                                    <div className="flex flex-wrap items-center gap-3 text-sm">
                                        {/* Severity */}
                                        <span className={`px-2 py-1 rounded-md border text-xs font-medium ${getSeverityColor(improvement.severity)}`}>
                                            {improvement.severity.toUpperCase()}
                                        </span>

                                        {/* User type */}
                                        <span className="text-slate-400">
                                            {improvement.user_type}
                                        </span>

                                        {/* Date */}
                                        <span className="text-slate-500">
                                            {improvement.created_at.toLocaleDateString()}
                                        </span>

                                        {/* Page URL */}
                                        <span className="text-slate-500 truncate max-w-xs">
                                            {new URL(improvement.page_url).pathname}
                                        </span>
                                    </div>
                                </div>

                                {/* Status badge */}
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${getStatusColor(improvement.status)}`}>
                                    {getStatusIcon(improvement.status)}
                                    <span className="text-sm font-medium capitalize">
                                        {improvement.status.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Detail Modal */}
            {selectedImprovement && (
                <Modal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)}>
                    <div className="bg-slate-900 rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-2">Improvement Details</h2>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-1 rounded-md border text-xs font-medium ${getSeverityColor(selectedImprovement.severity)}`}>
                                        {selectedImprovement.severity.toUpperCase()}
                                    </span>
                                    <span className="text-slate-400 text-sm">
                                        {selectedImprovement.created_at.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => setDetailModalOpen(false)}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Message */}
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-slate-400 mb-2">Message</h3>
                            <div className="bg-slate-800 rounded-lg p-4">
                                <p className="text-white whitespace-pre-wrap">{selectedImprovement.message}</p>
                            </div>
                        </div>

                        {/* Metadata */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-400 mb-1">User Type</h3>
                                <p className="text-white capitalize">{selectedImprovement.user_type}</p>
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-slate-400 mb-1">Source</h3>
                                <p className="text-white">{selectedImprovement.source} / {selectedImprovement.channel}</p>
                            </div>
                            <div className="col-span-2">
                                <h3 className="text-sm font-semibold text-slate-400 mb-1">Page URL</h3>
                                <a
                                    href={selectedImprovement.page_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-teal-400 hover:text-teal-300 text-sm break-all"
                                >
                                    {selectedImprovement.page_url}
                                </a>
                                {selectedImprovement.screenshot_url && (
                                    <>
                                        <h3 className="text-sm font-semibold text-slate-400 mb-1 mt-4">Screenshot</h3>
                                        <a
                                            href={selectedImprovement.screenshot_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-teal-400 hover:underline text-sm"
                                        >
                                            View Screenshot
                                        </a>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Status Update */}
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-slate-400 mb-2">Status</h3>
                            <select
                                value={editStatus}
                                onChange={(e) => setEditStatus(e.target.value as Improvement['status'])}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                            >
                                <option value="new">New</option>
                                <option value="reviewed">Reviewed</option>
                                <option value="in_progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                            </select>
                        </div>

                        {/* Admin Notes */}
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-slate-400 mb-2">Admin Notes (Internal)</h3>
                            <textarea
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                placeholder="Add internal notes about this improvement..."
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 resize-none"
                                rows={4}
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <Button
                                onClick={() => setDetailModalOpen(false)}
                                variant="outline"
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSaveChanges}
                                className="flex-1 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold"
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    'Saving...'
                                ) : (
                                    <>
                                        <Save className="w-4 h-4 mr-2" />
                                        Save Changes
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default ImprovementsPage;
