'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Clock, CheckCircle, MessageSquare, Inbox, Reply } from 'lucide-react';
import { inboxService, type InboxSubmission, type InboxStatus } from '../../services/inboxService';
import { CardSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { ModuleStatCards, type ModuleStat } from './common/ModuleStatCards';
import { EnterpriseDataTable, type EnterpriseColumn } from '../ui/EnterpriseDataTable';
import { DetailDrawer } from '../ui/DetailDrawer';
import { StatusBadge, inboxStatusVariant } from '../ui/StatusBadge';
import { buildMailComposeUrl } from '@/lib/email/composeNavigation';

const ContactSubmissionsTab: React.FC = () => {
    const router = useRouter();
    const [submissions, setSubmissions] = useState<InboxSubmission[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | InboxStatus>('all');
    const [selected, setSelected] = useState<InboxSubmission | null>(null);

    const loadSubmissions = React.useCallback(async () => {
        setLoading(true);
        const { submissions: data } = await inboxService.getInbox();
        setSubmissions(data);
        setLoading(false);
    }, []);

    const handleStatusChange = React.useCallback(async (id: string, source: 'contact' | 'form', status: InboxStatus) => {
        await inboxService.updateStatus(id, source, status);
        loadSubmissions();
    }, [loadSubmissions]);

    React.useEffect(() => {
        loadSubmissions();
    }, [loadSubmissions]);

    const filteredSubmissions = filter === 'all'
        ? submissions
        : submissions.filter(s => s.status === filter);

    const submissionStats = useMemo<ModuleStat[]>(() => {
        const newCount = submissions.filter(s => s.status === 'new').length;
        const readCount = submissions.filter(s => s.status === 'read').length;
        const repliedCount = submissions.filter(s => s.status === 'replied').length;
        const responseRate = submissions.length > 0
            ? Math.round((repliedCount / submissions.length) * 100)
            : 0;
        return [
            { label: 'Total', value: submissions.length, sub: 'All submissions', Icon: Inbox, accent: 'teal' },
            { label: 'New', value: newCount, sub: 'Unread inquiries', Icon: Mail, accent: newCount > 0 ? 'amber' : 'emerald' },
            { label: 'Awaiting Reply', value: readCount, sub: 'Read but open', Icon: Clock, accent: 'blue' },
            { label: 'Response Rate', value: `${responseRate}%`, sub: `${repliedCount} replied`, Icon: Reply, accent: 'purple' },
        ];
    }, [submissions]);

    const columns = useMemo<EnterpriseColumn<InboxSubmission>[]>(() => [
        {
            id: 'name',
            header: 'Name',
            mobilePrimary: true,
            sortable: true,
            sortValue: (r) => r.name,
            accessor: (r) => <span className="font-medium text-white">{r.name}</span>,
        },
        {
            id: 'email',
            header: 'Email',
            mobilePrimary: true,
            accessor: (r) => r.email,
        },
        {
            id: 'status',
            header: 'Status',
            mobilePrimary: true,
            accessor: (r) => <StatusBadge variant={inboxStatusVariant(r.status)}>{r.status}</StatusBadge>,
        },
        {
            id: 'date',
            header: 'Date',
            sortable: true,
            sortValue: (r) => new Date(r.date).getTime(),
            accessor: (r) => new Date(r.date).toLocaleDateString(),
        },
    ], []);

    if (loading) {
        return (
            <div className="space-y-4 ac-enterprise-module">
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
            </div>
        );
    }

    return (
        <div className="space-y-6 ac-scroll-full ac-enterprise-module animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white">Contact Submissions</h2>
                    <p className="text-slate-400 text-xs sm:text-sm mt-1">Messages from your contact form</p>
                </div>
                <div className="flex gap-2 overflow-x-auto ios-scroll pb-1">
                    {['all', 'new', 'read', 'replied'].map((status) => (
                        <button
                            key={status}
                            type="button"
                            onClick={() => setFilter(status as typeof filter)}
                            className={`min-h-11 px-4 py-2 rounded-lg text-sm font-medium capitalize whitespace-nowrap ${
                                filter === status ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {submissions.length > 0 && <ModuleStatCards stats={submissionStats} />}

            {filteredSubmissions.length === 0 ? (
                <EmptyState
                    icon={Mail}
                    title="No contact submissions"
                    description={filter === 'all' ? 'No one has submitted a form yet' : `No ${filter.toLowerCase()} submissions`}
                />
            ) : (
                <EnterpriseDataTable
                    columns={columns}
                    data={filteredSubmissions}
                    getRowId={(r) => `${r.source}-${r.id}`}
                    onRowClick={setSelected}
                    renderExpanded={(submission) => (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-300 whitespace-pre-wrap">{submission.message}</p>
                            <div className="flex flex-wrap gap-2">
                                {submission.status !== 'read' && (
                                    <button
                                        type="button"
                                        onClick={() => handleStatusChange(submission.id, submission.source, 'read')}
                                        className="min-h-11 px-3 py-2 bg-yellow-500/10 text-yellow-400 rounded-lg text-sm font-medium"
                                    >
                                        Mark as Read
                                    </button>
                                )}
                                {submission.status !== 'replied' && (
                                    <button
                                        type="button"
                                        onClick={() => handleStatusChange(submission.id, submission.source, 'replied')}
                                        className="min-h-11 px-3 py-2 bg-green-500/10 text-green-400 rounded-lg text-sm font-medium"
                                    >
                                        Mark as Replied
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => router.push(buildMailComposeUrl(submission.email, `Re: ${submission.formTitle || 'your message'}`))}
                                    className="min-h-11 px-3 py-2 bg-teal-500/10 text-teal-400 rounded-lg text-sm font-medium"
                                >
                                    Reply in Mail
                                </button>
                            </div>
                        </div>
                    )}
                />
            )}

            <DetailDrawer
                open={!!selected}
                onOpenChange={(open) => !open && setSelected(null)}
                title={selected?.name || 'Submission'}
                description={selected?.email}
            >
                {selected ? (
                    <div className="space-y-4 pb-6">
                        <StatusBadge variant={inboxStatusVariant(selected.status)}>{selected.status}</StatusBadge>
                        <p className="text-sm text-slate-300 whitespace-pre-wrap">{selected.message}</p>
                        <div className="flex flex-wrap gap-2">
                            {selected.status !== 'read' && (
                                <button type="button" onClick={() => { handleStatusChange(selected.id, selected.source, 'read'); setSelected(null); }} className="min-h-11 px-3 rounded-lg bg-yellow-500/10 text-yellow-400 text-sm">Mark read</button>
                            )}
                            {selected.status !== 'replied' && (
                                <button type="button" onClick={() => { handleStatusChange(selected.id, selected.source, 'replied'); setSelected(null); }} className="min-h-11 px-3 rounded-lg bg-green-500/10 text-green-400 text-sm">Mark replied</button>
                            )}
                            <button type="button" onClick={() => router.push(buildMailComposeUrl(selected.email, `Re: ${selected.formTitle || 'your message'}`))} className="min-h-11 px-3 rounded-lg bg-teal-500/10 text-teal-400 text-sm">Reply in Mail</button>
                        </div>
                    </div>
                ) : null}
            </DetailDrawer>
        </div>
    );
};

export default ContactSubmissionsTab;
