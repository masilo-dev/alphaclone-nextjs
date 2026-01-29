import React, { useState, useEffect } from 'react';
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
    UserPlus
} from 'lucide-react';
import toast from 'react-hot-toast';

interface TeamPageProps {
    user: User;
}

const TeamPage: React.FC<TeamPageProps> = ({ user }) => {
    const { currentTenant, userTenants } = useTenant();
    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [loading, setLoading] = useState(true);

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
        return <div className="flex items-center justify-center h-full"><div className="text-slate-400">Loading team...</div></div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Team Management</h2>
                    <p className="text-slate-400 mt-1">{teamMembers.length} team members</p>
                </div>
                <button
                    onClick={() => setShowInviteModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 rounded-lg transition-colors"
                >
                    <UserPlus className="w-4 h-4" />
                    Invite Member
                </button>
            </div>

            {/* Team Members Grid */}
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
        <div className="bg-slate-900/50 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition-all group">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-500 to-violet-600 flex items-center justify-center font-bold text-lg">
                        {member.user?.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                        <h3 className="font-semibold">{member.user?.name || 'Unknown'}</h3>
                        <p className="text-sm text-slate-400">{member.user?.email}</p>
                    </div>
                </div>
                {!isCurrentUser && (
                    <button
                        onClick={() => onRemove(member.user_id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 rounded transition-all"
                    >
                        <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                )}
            </div>

            <div className="flex items-center justify-between">
                <span className={`text-xs px-2 py-1 rounded-full border ${roleColors[member.role as keyof typeof roleColors] || roleColors.member}`}>
                    {member.role?.charAt(0).toUpperCase() + member.role?.slice(1) || 'Member'}
                </span>
                {isCurrentUser && (
                    <span className="text-xs text-teal-400">You</span>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold">Invite Team Member</h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Email Address *</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="colleague@example.com"
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Role</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        >
                            <option value="member">Member</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Admin</option>
                        </select>
                        <p className="text-xs text-slate-500 mt-2">
                            Members can view and edit. Managers can manage projects. Admins have full access.
                        </p>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-teal-500 hover:bg-teal-600 rounded-lg transition-colors"
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
