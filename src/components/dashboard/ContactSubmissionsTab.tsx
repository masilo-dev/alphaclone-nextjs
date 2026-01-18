import React, { useEffect, useState } from 'react';
import { Mail, Clock, CheckCircle, MessageSquare } from 'lucide-react';
import { contactService, ContactSubmission } from '../../services/contactService';
import { CardSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';

const ContactSubmissionsTab: React.FC = () => {
    const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'New' | 'Read' | 'Replied'>('all');

    useEffect(() => {
        loadSubmissions();
    }, []);

    const loadSubmissions = async () => {
        setLoading(true);
        const { submissions: data } = await contactService.getContactSubmissions();
        setSubmissions(data);
        setLoading(false);
    };

    const handleStatusChange = async (id: string, status: 'New' | 'Read' | 'Replied') => {
        await contactService.updateSubmissionStatus(id, status);
        loadSubmissions();
    };

    const filteredSubmissions = filter === 'all'
        ? submissions
        : submissions.filter(s => s.status === filter);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'New': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            case 'Read': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
            case 'Replied': return 'bg-green-500/10 text-green-400 border-green-500/20';
            default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
        }
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Contact Submissions</h2>
                    <p className="text-slate-400 mt-1">Messages from your contact form</p>
                </div>
                <div className="flex gap-2">
                    {['all', 'New', 'Read', 'Replied'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilter(status as any)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                filter === status
                                    ? 'bg-teal-500 text-white'
                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                        >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                            {status !== 'all' && (
                                <span className="ml-2 opacity-60">
                                    ({submissions.filter(s => s.status === status).length})
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {filteredSubmissions.length === 0 ? (
                <EmptyState
                    icon={Mail}
                    title="No contact submissions"
                    description={filter === 'all' ? 'No one has submitted the contact form yet' : `No ${filter.toLowerCase()} submissions`}
                />
            ) : (
                <div className="grid gap-4">
                    {filteredSubmissions.map((submission) => (
                        <div
                            key={submission.id}
                            className="bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-xl p-6 hover:border-teal-500/30 transition-all"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-teal-500/10 rounded-lg flex items-center justify-center">
                                        <Mail className="w-5 h-5 text-teal-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white">{submission.name}</h3>
                                        <p className="text-sm text-slate-400">{submission.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(submission.status)}`}>
                                        {submission.status}
                                    </span>
                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                        <Clock className="w-3 h-3" />
                                        {new Date(submission.date).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>

                            <div className="mb-4 p-4 bg-slate-800/50 rounded-lg">
                                <p className="text-slate-300 text-sm whitespace-pre-wrap">{submission.message}</p>
                            </div>

                            <div className="flex gap-2">
                                {submission.status !== 'Read' && (
                                    <button
                                        onClick={() => handleStatusChange(submission.id, 'Read')}
                                        className="px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        Mark as Read
                                    </button>
                                )}
                                {submission.status !== 'Replied' && (
                                    <button
                                        onClick={() => handleStatusChange(submission.id, 'Replied')}
                                        className="px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                                    >
                                        <MessageSquare className="w-4 h-4" />
                                        Mark as Replied
                                    </button>
                                )}
                                <a
                                    href={`mailto:${submission.email}`}
                                    className="px-3 py-1.5 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                                >
                                    <Mail className="w-4 h-4" />
                                    Reply via Email
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ContactSubmissionsTab;
