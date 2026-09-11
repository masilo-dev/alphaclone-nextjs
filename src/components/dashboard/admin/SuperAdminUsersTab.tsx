'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Search,
  UserMinus,
  UserCheck,
  Trash2,
  Shield,
  ShieldAlert,
  Info,
  Building2,
  History,
  Lock,
  ArrowRightLeft,
  X,
} from 'lucide-react';
import { userService } from '@/services/userService';
import { User } from '@/types';
import { Input } from '../../ui/UIComponents';
import { EnterpriseDataTable, type EnterpriseColumn } from '../../ui/EnterpriseDataTable';
import { StatusBadge, userStatusVariant } from '../../ui/StatusBadge';
import { rowActionsClass } from '../../ui/ResponsiveTable';
import { Avatar } from '@/components/ui/Avatar';
import { toast } from 'react-hot-toast';

export const SuperAdminUsersTab: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'suspended' | 'deleted' | 'admin' | 'super_admin' | 'tenant_admin' | 'client'>('all');

  // Modals state
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [pendingRole, setPendingRole] = useState<string>('super_admin');
  const [roleReason, setRoleReason] = useState<string>('');
  
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTenantId, setTransferTenantId] = useState<string>('');
  const [newOwnerId, setNewOwnerId] = useState<string>('');

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
    if (!confirm('Are you sure you want to suspend this user account?')) return;
    const { error } = await userService.suspendUser(userId);
    if (error) {
      toast.error(error);
    } else {
      toast.success('User account suspended');
      loadUsers();
    }
  };

  const handleRestore = async (userId: string) => {
    const { error } = await userService.restoreUser(userId);
    if (error) {
      toast.error(error);
    } else {
      toast.success('User account restored');
      loadUsers();
    }
  };

  const handleSoftDelete = async (userId: string, name: string) => {
    if (!confirm(`Are you sure you want to soft delete account "${name}"? The account will be scheduled for removal.`)) return;
    const { error } = await userService.deleteUserAccount(userId, false);
    if (error) {
      toast.error(error);
    } else {
      toast.success('User account soft deleted');
      loadUsers();
    }
  };

  const handlePermanentDelete = async (u: any) => {
    if (!confirm(`DANGER: Are you sure you want to PERMANENTLY delete user "${u.name}"? This action cannot be undone.`)) return;
    
    const { error, requiresOwnershipTransfer, tenantId } = await userService.deleteUserAccount(u.id, true);
    if (error) {
      if (requiresOwnershipTransfer && tenantId) {
        setSelectedUser(u);
        setTransferTenantId(tenantId);
        setShowTransferModal(true);
        toast.error('Workspace ownership must be transferred before permanent deletion.');
      } else {
        toast.error(error);
      }
    } else {
      toast.success('User permanently deleted');
      loadUsers();
    }
  };

  const handleRoleChangeSubmit = async (confirmationGiven: boolean = false) => {
    if (!selectedUser) return;
    const { error, requiresConfirmation } = await userService.changeUserRole(
      selectedUser.id,
      pendingRole,
      confirmationGiven,
      roleReason
    );

    if (error) {
      if (requiresConfirmation) {
        setShowRoleModal(true);
      } else {
        toast.error(error);
      }
    } else {
      toast.success(`Role updated to ${pendingRole}`);
      setShowRoleModal(false);
      setSelectedUser(null);
      loadUsers();
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newOwnerId || !transferTenantId) return;

    const { error } = await userService.transferWorkspaceOwnership(
      transferTenantId,
      selectedUser.id,
      newOwnerId
    );

    if (error) {
      toast.error(error);
    } else {
      toast.success('Workspace ownership transferred successfully! You can now proceed with account deletion.');
      setShowTransferModal(false);
      loadUsers();
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      filter === 'all' ||
      (filter === 'active' && u.account_status === 'active') ||
      (filter === 'suspended' && u.account_status === 'suspended') ||
      (filter === 'deleted' && u.account_status === 'deleted') ||
      filter === u.role;
    return matchesSearch && matchesFilter;
  });

  const userColumns = useMemo<EnterpriseColumn<any>[]>(
    () => [
      {
        id: 'identity',
        header: 'User Identity',
        mobilePrimary: true,
        sortable: true,
        sortValue: (u) => u.name,
        accessor: (u) => (
          <div className="flex items-center gap-3 min-w-0 cursor-pointer" onClick={() => { setSelectedUser(u); setShowDetailModal(true); }}>
            <Avatar
              src={u.avatar}
              name={u.name}
              email={u.email}
              size={40}
              className="shrink-0 rounded-xl"
              shape="rounded"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-white text-sm truncate">{u.name}</p>
                {u.password_change_required && (
                  <span className="p-0.5 bg-amber-500/20 text-amber-400 rounded" title="Forced Password Reset Pending">
                    <Lock className="w-3 h-3" />
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-mono truncate">{u.email}</p>
            </div>
          </div>
        ),
      },
      {
        id: 'role',
        header: 'Role',
        accessor: (u) => (
          <select
            value={u.role}
            onChange={(e) => {
              setSelectedUser(u);
              setPendingRole(e.target.value);
              if (e.target.value === 'super_admin' || e.target.value === 'admin') {
                setShowRoleModal(true);
              } else {
                userService.changeUserRole(u.id, e.target.value).then((res) => {
                  if (res.error) toast.error(res.error);
                  else {
                    toast.success('Role updated');
                    loadUsers();
                  }
                });
              }
            }}
            className={`px-2 py-1 rounded text-xs font-black uppercase tracking-tighter cursor-pointer bg-slate-900 border ${
              u.role === 'super_admin' || u.role === 'admin'
                ? 'text-purple-400 border-purple-500/40'
                : u.role === 'tenant_admin'
                ? 'text-blue-400 border-blue-500/40'
                : 'text-slate-400 border-white/10'
            }`}
          >
            <option value="user">User</option>
            <option value="tenant_admin">Tenant Admin</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
            <option value="client">Client</option>
          </select>
        ),
      },
      {
        id: 'status',
        header: 'Account Status',
        accessor: (u) => (
          <StatusBadge variant={userStatusVariant(String(u.account_status || 'active'))}>
            {u.account_status || 'active'}
          </StatusBadge>
        ),
      },
      {
        id: 'onboarding',
        header: 'Onboarding & Verify',
        accessor: (u) => (
          <div className="text-xs space-y-0.5">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              u.onboarding_status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
            }`}>
              {u.onboarding_status || 'pending'}
            </span>
            <span className="block text-slate-500 text-[10px]">
              {u.email_verified ? 'Verified' : 'Unverified'}
            </span>
          </div>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        accessor: (u) => (
          <div className={`${rowActionsClass} justify-end`}>
            <button
              onClick={() => { setSelectedUser(u); setShowDetailModal(true); }}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-white/5"
              title="View User Details"
            >
              <Info className="w-4 h-4" />
            </button>

            {u.account_status === 'suspended' ? (
              <button
                onClick={() => handleRestore(u.id)}
                className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/20"
                title="Reactivate Account"
              >
                <UserCheck className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => handleSuspend(u.id)}
                className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/20"
                title="Suspend Account"
              >
                <UserMinus className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => handleSoftDelete(u.id, u.name)}
              className="p-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-lg border border-orange-500/20"
              title="Soft Delete Account"
            >
              <UserMinus className="w-4 h-4 text-orange-400" />
            </button>

            <button
              onClick={() => handlePermanentDelete(u)}
              className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20"
              title="Permanent Delete Account"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ],
    [loadUsers]
  );

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
    <div className="space-y-6 animate-fade-in min-w-0 ac-scroll-full ac-enterprise-module">
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
              className="pl-10 w-full sm:w-64 h-10 bg-slate-900/50 border-slate-800"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'active', 'suspended', 'deleted', 'admin', 'super_admin', 'tenant_admin', 'client'] as const).map(
          (f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${
                filter === f
                  ? 'bg-teal-500 text-white border-teal-500 shadow-lg shadow-teal-500/20'
                  : 'bg-slate-900/50 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              {f}
            </button>
          )
        )}
      </div>

      <EnterpriseDataTable
        columns={userColumns}
        data={filteredUsers}
        getRowId={(u) => u.id}
        emptyMessage="No users match your current criteria."
        className="bg-slate-900/40 border border-slate-800 rounded-2xl p-2"
      />

      {/* Role Promotion Confirmation Modal */}
      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-400" />
                Confirm Role Elevation
              </h3>
              <button onClick={() => setShowRoleModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 text-xs text-purple-300 space-y-2">
              <p className="font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                Security Requirement #40 Warning
              </p>
              <p>
                You are about to promote user <strong>{selectedUser.name}</strong> ({selectedUser.email}) to role <strong>{pendingRole}</strong>.
              </p>
              <p className="text-slate-300">
                This user will receive platform-wide administrative privileges across all workspaces. Continue?
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Reason for Promotion (Optional)</label>
              <input
                type="text"
                value={roleReason}
                onChange={(e) => setRoleReason(e.target.value)}
                placeholder="e.g. Assigned as Platform Operations Admin"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowRoleModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRoleChangeSubmit(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-purple-500/20"
              >
                Confirm Role Elevation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {showDetailModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <Avatar src={selectedUser.avatar} name={selectedUser.name} email={selectedUser.email} size={44} shape="rounded" />
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedUser.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">{selectedUser.email}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <span className="text-slate-500 block uppercase font-bold text-[10px]">User Role</span>
                <span className="font-black text-purple-400 uppercase">{selectedUser.role}</span>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <span className="text-slate-500 block uppercase font-bold text-[10px]">Account Status</span>
                <span className="font-bold text-white uppercase">{selectedUser.account_status}</span>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <span className="text-slate-500 block uppercase font-bold text-[10px]">Onboarding</span>
                <span className="text-slate-300 font-semibold">{selectedUser.onboarding_status}</span>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <span className="text-slate-500 block uppercase font-bold text-[10px]">Email Verification</span>
                <span className="text-slate-300 font-semibold">{selectedUser.email_verified ? 'Verified' : 'Unverified'}</span>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <span className="text-slate-500 block uppercase font-bold text-[10px]">Business Type</span>
                <span className="text-slate-300">{selectedUser.business_type || 'Not specified'}</span>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <span className="text-slate-500 block uppercase font-bold text-[10px]">Company Name</span>
                <span className="text-slate-300">{selectedUser.company_name || 'Not specified'}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1 text-xs">
              <span className="text-slate-500 block uppercase font-bold text-[10px]">Timestamps & Identifiers</span>
              <p className="text-slate-400">User ID: <span className="font-mono text-white">{selectedUser.id}</span></p>
              <p className="text-slate-400">Registered: <span className="text-slate-300">{selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleString() : 'N/A'}</span></p>
              <p className="text-slate-400">Last Login: <span className="text-slate-300">{selectedUser.last_login_at ? new Date(selectedUser.last_login_at).toLocaleString() : 'Never'}</span></p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Ownership Modal */}
      {showTransferModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-amber-400" />
                Transfer Workspace Ownership
              </h3>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300">
              User <strong>{selectedUser.name}</strong> is the sole owner of active workspace <span className="font-mono">{transferTenantId}</span>. Transfer ownership before deleting this user account.
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select New Owner</label>
                <select
                  required
                  value={newOwnerId}
                  onChange={(e) => setNewOwnerId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                >
                  <option value="">-- Choose active platform user --</option>
                  {users
                    .filter((u) => u.id !== selectedUser.id && u.account_status === 'active')
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg"
                >
                  Transfer Ownership
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminUsersTab;
