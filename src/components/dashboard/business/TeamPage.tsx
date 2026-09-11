import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '../../../types';
import { useTenant } from '../../../contexts/TenantContext';
import { supabase } from '../../../lib/supabase';
import {
    Users as UsersIcon,
    Plus,
    Mail,
    Shield,
    Trash2,
    X,
    UserPlus,
    Layout,
    MessageSquare,
    BarChart3,
    Network,
    Inbox,
    CheckSquare,
    ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import ResourceAllocationView from '../ResourceAllocationView';
import { TeamChat } from './TeamChat';
import { motion, AnimatePresence } from 'framer-motion';

interface TeamPageProps {
    user: User;
}

const TeamPage: React.FC<TeamPageProps> = ({ user }) => {
    const router = useRouter();
    const { currentTenant } = useTenant();
    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'directory' | 'org' | 'resources' | 'chat'>('directory');

    useEffect(() => {
        if (currentTenant) {
            loadTeamMembers();
        }
    }, [currentTenant]);

    const loadTeamMembers = async () => {
        if (!currentTenant) return;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('tenant_users')
                .select(`
                    *,
                    user:user_id (
                        id,
                        email,
                        name,
                        avatar
                    )
                `)
                .eq('tenant_id', currentTenant.id);

            if (!error && data) {
                setTeamMembers(data);
            }
        } catch (error) {
            console.error('Error loading team members:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleInviteMember = async (email: string, role: string) => {
        if (!currentTenant) return;

        try {
            const { error } = await supabase
                .from('tenant_invitations')
                .insert({
                    tenant_id: currentTenant.id,
                    email,
                    role,
                    invited_by: user.id
                });

            if (error) throw error;

            toast.success(`Invitation sent to ${email}`);
            setShowInviteModal(false);
        } catch (error: any) {
            console.error('Invite failed:', error);
            toast.error(error.message || 'Failed to send invitation');
        }
    };

    const handleRemoveMember = async (userId: string) => {
        if (!confirm('Are you sure you want to remove this team member?')) return;

        if (!currentTenant) return;

        const { error } = await supabase
            .from('tenant_users')
            .delete()
            .eq('tenant_id', currentTenant.id)
            .eq('user_id', userId);

        if (!error) {
            setTeamMembers(teamMembers.filter(m => m.user_id !== userId));
        }
    };

    if (loading) {
        return (
            <div className="space-y-6 h-full flex flex-col">
                <div className="flex-1 min-h-[320px] flex items-center justify-center">
                    <div className="text-slate-400">Loading team...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* Header & Tabs */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <UsersIcon className="w-6 h-6 text-teal-400" />
                        Human Resources & Team
                    </h2>
                    <p className="text-slate-400 mt-1">Manage your organization, talent, and culture</p>
                </div>
                
                <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                    {[
                        { id: 'directory', label: 'Directory', icon: UsersIcon },
                        { id: 'org', label: 'Org Chart', icon: Network },
                        { id: 'resources', label: 'Allocation', icon: BarChart3 },
                        { id: 'chat', label: 'Team Chat', icon: MessageSquare },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                activeTab === tab.id
                                    ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                <AnimatePresence mode="wait">
                    {activeTab === 'directory' && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            <div className="flex justify-end">
                                <button
                                    onClick={() => setShowInviteModal(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 rounded-lg transition-colors text-white font-bold shadow-lg shadow-teal-500/20"
                                >
                                    <UserPlus className="w-4 h-4" />
                                    Invite Member
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {teamMembers.map(member => (
                                    <TeamMemberCard
                                        key={member.user_id}
                                        member={member}
                                        onRemove={handleRemoveMember}
                                        isCurrentUser={member.user_id === user.id}
                                    />
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'org' && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="h-full bg-slate-900/50 border border-slate-800 rounded-2xl p-8 flex items-center justify-center"
                        >
                            <div className="text-center max-w-lg">
                                <Network className="w-16 h-16 text-slate-700 mx-auto mb-6" />
                                <h3 className="text-xl font-bold text-white mb-2">Organization Structure</h3>
                                <p className="text-slate-400 mb-8">
                                    Visualize your team's hierarchy and reporting lines.
                                    (Currently showing flat structure)
                                </p>
                                <div className="flex flex-col items-center gap-4 relative">
                                    {/* Simple Tree Visualization */}
                                    <div className="p-4 bg-teal-500/20 border border-teal-500/50 rounded-xl min-w-[200px]">
                                        <div className="font-bold text-teal-400">Admin / Owner</div>
                                    </div>
                                    <div className="h-8 w-px bg-slate-700"></div>
                                    <div className="flex gap-4 overflow-x-auto p-4 w-full justify-center">
                                        {teamMembers.filter(m => m.role !== 'admin').map(member => (
                                            <div key={member.user_id} className="flex flex-col items-center relative group">
                                                <div className="absolute -top-4 left-1/2 w-px h-4 bg-slate-700"></div>
                                                <div className="p-3 bg-slate-800 border border-slate-700 rounded-xl min-w-[140px] text-center hover:border-teal-500/50 transition-all">
                                                    <div className="font-bold text-white text-sm">{member.user?.name || 'Unknown'}</div>
                                                    <div className="text-xs text-slate-500 uppercase">{member.role}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'resources' && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <ResourceAllocationView user={user} />
                        </motion.div>
                    )}

                    {activeTab === 'chat' && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="h-full"
                        >
                            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4 h-full min-h-0">
                                <div className="min-h-0">
                                    <TeamChat user={user} teamMembers={teamMembers} tenantId={currentTenant?.id} />
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/20">
                                                <Inbox className="w-4 h-4 text-teal-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-semibold text-white">Connected work</h3>
                                                <p className="text-xs text-slate-500">Keep chat, email, and tasks linked.</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 mb-3">
                                            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-2.5">
                                                <div className="text-[11px] uppercase tracking-widest text-slate-500">Members</div>
                                                <div className="text-lg font-black text-white">{teamMembers.length}</div>
                                            </div>
                                            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-2.5">
                                                <div className="text-[11px] uppercase tracking-widest text-slate-500">Chat</div>
                                                <div className="text-lg font-black text-white">Live</div>
                                            </div>
                                            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-2.5">
                                                <div className="text-[11px] uppercase tracking-widest text-slate-500">Email</div>
                                                <div className="text-lg font-black text-white">On</div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <button
                                                onClick={() => router.push('/dashboard/business/messages')}
                                                className="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 hover:bg-slate-900 px-3 py-2.5 text-left transition-colors"
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Mail className="w-4 h-4 text-sky-400 shrink-0" />
                                                    <span className="text-sm font-medium text-white truncate">Open inbox</span>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
                                            </button>
                                            <button
                                                onClick={() => router.push('/dashboard/zoho/mail')}
                                                className="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 hover:bg-slate-900 px-3 py-2.5 text-left transition-colors"
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Inbox className="w-4 h-4 text-emerald-400 shrink-0" />
                                                    <span className="text-sm font-medium text-white truncate">Open Zoho Mail</span>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
                                            </button>
                                            <button
                                                onClick={() => router.push('/dashboard/tasks')}
                                                className="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 hover:bg-slate-900 px-3 py-2.5 text-left transition-colors"
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <CheckSquare className="w-4 h-4 text-orange-400 shrink-0" />
                                                    <span className="text-sm font-medium text-white truncate">Open tasks</span>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
                                            </button>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {teamMembers.slice(0, 4).map((member) => (
                                                <div key={member.user_id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-slate-950/60 border border-slate-800">
                                                    <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-black text-white">
                                                        {member.user?.name?.charAt(0) || '?'}
                                                    </div>
                                                    <span className="text-xs text-slate-300 max-w-[120px] truncate">{member.user?.name || member.user?.email}</span>
                                                </div>
                                            ))}
                                            {teamMembers.length > 4 && (
                                                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-slate-950/60 border border-slate-800">
                                                    <span className="text-xs text-slate-400">+{teamMembers.length - 4} more</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <InviteMemberModal
                    onClose={() => setShowInviteModal(false)}
                    onInvite={handleInviteMember}
                />
            )}
        </div>
    );
};

const TeamMemberCard = ({ member, onRemove, isCurrentUser }: any) => {
    const roleColors = {
        admin: 'bg-red-500/10 text-red-400 border-red-500/20',
        manager: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
        member: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    };

    return (
        <div className="bg-slate-900/50 border border-slate-800 hover:border-teal-500/30 rounded-2xl p-6 transition-all group">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-500 to-violet-600 flex items-center justify-center font-bold text-lg text-white shadow-lg">
                        {member.user?.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                        <h3 className="font-bold text-white">{member.user?.name || 'Unknown'}</h3>
                        <p className="text-xs text-slate-400 font-mono">{member.user?.email}</p>
                    </div>
                </div>
                {!isCurrentUser && (
                    <button
                        onClick={() => onRemove(member.user_id)}
                        className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/10 rounded-lg transition-all"
                        title="Remove Member"
                    >
                        <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                )}
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800/50">
                <span className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded-lg border ${roleColors[member.role as keyof typeof roleColors] || roleColors.member}`}>
                    {member.role?.charAt(0).toUpperCase() + member.role?.slice(1) || 'Member'}
                </span>
                {isCurrentUser && (
                    <span className="text-xs font-bold text-teal-400 flex items-center gap-1">
                        <Shield className="w-3 h-3" /> You
                    </span>
                )}
            </div>
        </div>
    );
};

const InviteMemberModal = ({ onClose, onInvite }: any) => {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('member');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onInvite(email, role);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">Invite Team Member</h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-300 mb-2">Email Address *</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="colleague@example.com"
                            className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl focus:outline-none focus:border-teal-500 text-white placeholder-slate-600 transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-300 mb-2">Role</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['member', 'manager', 'admin'].map((r) => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => setRole(r)}
                                    className={`px-2 py-2 rounded-xl text-xs font-bold uppercase tracking-wide border transition-all ${
                                        role === r 
                                            ? 'bg-teal-500 text-white border-teal-500' 
                                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'
                                    }`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-slate-500 mt-3 bg-slate-800/50 p-3 rounded-lg border border-slate-800">
                            {role === 'member' && "Can view projects and tasks assigned to them."}
                            {role === 'manager' && "Can create projects, manage tasks, and view reports."}
                            {role === 'admin' && "Full access to all settings, billing, and team management."}
                        </p>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors text-slate-300 font-bold"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-3 bg-teal-600 hover:bg-teal-500 rounded-xl transition-colors text-white font-bold shadow-lg shadow-teal-500/20"
                        >
                            Send Invitation
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TeamPage;
