'use client';

import React, { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Users, Plus, X, Hash, Lock, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url?: string;
}

interface GroupChatManagerProps {
  teamMembers: TeamMember[];
  onClose: () => void;
  onGroupCreated: (group: any) => void;
}

export default function GroupChatManager({ teamMembers, onClose, onGroupCreated }: GroupChatManagerProps) {
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [groupType, setGroupType] = useState<'public' | 'private'>('public');
  const [isCreating, setIsCreating] = useState(false);

  const handleMemberToggle = (memberId: string) => {
    setSelectedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedMembers.length === 0) return;
    setIsCreating(true);
    try {
      const group = {
        id: `group_${Date.now()}`,
        name: groupName.trim(),
        description: groupDescription.trim(),
        type: groupType,
        members: selectedMembers,
        createdAt: new Date().toISOString(),
      };
      onGroupCreated(group);
      setGroupName('');
      setGroupDescription('');
      setSelectedMembers([]);
      setActiveTab('manage');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-teal-400" />
            <h2 className="text-lg font-bold text-white">Group Chat</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white min-h-11 min-w-11"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-700">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={cn(
              'flex-1 px-4 py-3 text-sm font-medium transition-colors min-h-11',
              activeTab === 'create'
                ? 'border-b-2 border-teal-500 text-teal-400'
                : 'text-slate-400 hover:text-white'
            )}
          >
            Create Group
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manage')}
            className={cn(
              'flex-1 px-4 py-3 text-sm font-medium transition-colors min-h-11',
              activeTab === 'manage'
                ? 'border-b-2 border-teal-500 text-teal-400'
                : 'text-slate-400 hover:text-white'
            )}
          >
            Manage
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          {activeTab === 'create' ? (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Group Name
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="e.g. Design Team"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-teal-500 focus:outline-none min-h-11"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Description
                </label>
                <textarea
                  value={groupDescription}
                  onChange={e => setGroupDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={2}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Privacy
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setGroupType('public')}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors min-h-11',
                      groupType === 'public'
                        ? 'border-teal-500/50 bg-teal-500/10 text-teal-400'
                        : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600'
                    )}
                  >
                    <Globe className="h-4 w-4" />
                    Public
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupType('private')}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors min-h-11',
                      groupType === 'private'
                        ? 'border-teal-500/50 bg-teal-500/10 text-teal-400'
                        : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600'
                    )}
                  >
                    <Lock className="h-4 w-4" />
                    Private
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Members ({selectedMembers.length})
                </label>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/30 p-2">
                  {teamMembers.length === 0 ? (
                    <p className="py-4 text-center text-sm text-slate-500">No team members available</p>
                  ) : (
                    teamMembers.map(member => {
                      const selected = selectedMembers.includes(member.id);
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => handleMemberToggle(member.id)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors min-h-11',
                            selected
                              ? 'bg-teal-500/10 text-white'
                              : 'hover:bg-slate-700/50 text-slate-300'
                          )}
                        >
                          <Avatar src={member.avatar_url} name={member.name} email={member.email} size={32} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{member.name}</p>
                            <p className="truncate text-xs text-slate-500">{member.role || member.email}</p>
                          </div>
                          <div
                            className={cn(
                              'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                              selected
                                ? 'border-teal-500 bg-teal-500 text-white'
                                : 'border-slate-600'
                            )}
                          >
                            {selected && <Plus className="h-3 w-3 rotate-45" />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreateGroup}
                disabled={!groupName.trim() || selectedMembers.length === 0 || isCreating}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50 min-h-11"
              >
                {isCreating ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    <Hash className="h-4 w-4" />
                    Create Group
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-slate-500">
              <Users className="mx-auto mb-3 h-10 w-10 text-slate-600" />
              <p>Group management coming soon.</p>
              <p className="mt-1 text-xs">Create a group to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
