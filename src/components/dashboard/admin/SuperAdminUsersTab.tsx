'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
    Users,
    Search,
    UserMinus,
    UserCheck,
    Trash2,
    ShieldAlert,
    Mail,
    Filter,
    MoreHorizontal
} from 'lucide-react';
import { userService } from '../../../services/userService';
import { User } from '../../../types';
import { Button, Input } from '../../ui/UIComponents';
import { toast } from 'react-hot-toast';

const SuperAdminUsersTab: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'all' | 'active' | 'suspended' | 'admin' | 'client'>('all');

    const loadUsers = useCallback(async () => {
        setLoading(true);
        const { users: fetchedUsers, error } = await userService.getAllPlatformUsers();
        if (error) {
            toast.error(`Error loading users: ${error}`);
        } else {
            setUsers(fetchedUsers);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    const handleSuspend = async (userId: string) => {
        if (!confirm('Are you sure you want to suspend this user?')) return;
        const { error } = await userService.suspendUser(userId);
        if (error) {
            toast.error(error);
        } else {
            toast.success('User suspended');
            loadUsers();
        }
    };

    const handleRestore = async (userId: string) => {
        const { error } = await userService.restoreUser(userId);
        if (error) {
            toast.error(error);
        } else {
            toast.success('User restored');
            loadUsers();
        }
    };

    const handleDelete = async (userId: string, name: string) => {
        if (!confirm(`Are you sure you want to PERMANENTLY delete user "${name}"? This will remove their profile and tenant links.`)) return;
        const { error } = await userService.deleteUser(userId);
        if (error) {
            toast.error(error);
        } else {
            toast.success('User deleted');
            loadUsers();
        }
    };

    const filteredUsers = users.filter(u => {
        const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filter === 'all' ||
            (filter === 'active' && (u as any).status !== 'suspended') ||
            (filter === 'suspended' && (u as any).status === 'suspended') ||
            (filter === u.role);
        return matchesSearch && matchesFilter;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400 font-medium">Synchronizing Platform Users...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in min-w-0">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Users className="w-6 h-6 text-teal-400" />
                        Platform User Management
                    </h2>
                    <p className="text-slate-400">Total Users: {users.length}</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input
                            placeholder="Search email or name..."
                            className="pl-10 w-full max-w-full sm:w-64 sm:max-w-xs h-10 bg-slate-900/50 border-slate-800"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                {(['all', 'active', 'suspended', 'admin', 'client'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${filter === f
                                ? 'bg-teal-500 text-white border-teal-500 shadow-lg shadow-teal-500/20'
                                : 'bg-slate-900/50 text-slate-400 border-slate-800 hover:border-slate-700'
                            }`}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-x-auto backdrop-blur-md min-w-0">
                <table className="w-full min-w-[720px] text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-500 text-xs uppercase tracking-widest font-black">
                            <th className="p-4">User Identity</th>
                            <th className="p-4">Platform Role</th>
                            <th className="p-4">Account Status</th>
                            <th className="p-4 text-right">Administrative Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {filteredUsers.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-12 text-center text-slate-500 italic">
                                    No users match your current criteria.
                                </td>
                            </tr>
                        ) : (
                            filteredUsers.map(user => (
                                <tr key={user.id} className="group hover:bg-slate-800/30 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/5 ring-2 ring-transparent group-hover:ring-teal-500/30 transition-all relative">
                                                <Image
                                                    src={user.avatar || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.email}`}
                                                    alt={user.name}
                                                    fill
                                                    className="object-cover"
                                                    sizes="40px"
                                                />
                                            </div>
                                            <div>
                                                <div className="font-bold text-white text-sm">{user.name}</div>
                                                <div className="text-xs text-slate-500 font-mono">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-black uppercase tracking-tighter ${user.role === 'admin' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                                                user.role === 'tenant_admin' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                                    'bg-slate-800 text-slate-400 border border-white/5'
                                            }`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${(user as any).status === 'suspended' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]'}`} />
                                            <span className={`text-xs font-bold uppercase tracking-wider ${(user as any).status === 'suspended' ? 'text-red-400' : 'text-green-400'}`}>
                                                {(user as any).status || 'active'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {(user as any).status === 'suspended' ? (
                                                <button
                                                    onClick={() => handleRestore(user.id)}
                                                    className="p-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg border border-green-500/20"
                                                    title="Restore User"
                                                >
                                                    <UserCheck className="w-4 h-4" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleSuspend(user.id)}
                                                    className="p-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-lg border border-orange-500/20"
                                                    title="Suspend User"
                                                >
                                                    <UserMinus className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(user.id, user.name)}
                                                className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20"
                                                title="Permanent Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SuperAdminUsersTab;

