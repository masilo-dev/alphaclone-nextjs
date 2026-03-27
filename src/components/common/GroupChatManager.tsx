'use client';

import React, { useState } from 'react';
import Image from 'next/image';
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
      const newGroup = {
        name: groupName.trim(),
        description: groupDescription.trim(),
        members: selectedMembers,
        type: groupType,
        avatar_url: null
      };
      
      // In a real app, this would call your API
      console.log('Creating group:', newGroup);
      onGroupCreated(newGroup);
      
      // Reset form
      setGroupName('');
      setGroupDescription('');
      setSelectedMembers([]);
      setGroupType('public');
      
      onClose();
    } catch (error) {
      console.error('Error creating group:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <Users className="w-6 h-6 text-blue-600 mr-3" />
            <h2 className="text-xl font-semibold text-gray-900">Group Chat Manager</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('create')}
            className={cn(
              "flex-1 px-6 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === 'create'
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            Create Group
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={cn(
              "flex-1 px-6 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === 'manage'
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            Manage Groups
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'create' ? (
            <div className="space-y-6">
              {/* Group Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Group Name *
                  </label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g., Marketing Team, Project Alpha"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    placeholder="What's this group about?"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Group Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Group Type
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setGroupType('public')}
                      className={cn(
                        "flex items-center p-3 border rounded-lg transition-colors",
                        groupType === 'public'
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-300 hover:border-gray-400"
                      )}
                    >
                      <Globe className="w-5 h-5 mr-2" />
                      <div className="text-left">
                        <div className="font-medium">Public</div>
                        <div className="text-sm text-gray-500">Anyone can join</div>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => setGroupType('private')}
                      className={cn(
                        "flex items-center p-3 border rounded-lg transition-colors",
                        groupType === 'private'
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-300 hover:border-gray-400"
                      )}
                    >
                      <Lock className="w-5 h-5 mr-2" />
                      <div className="text-left">
                        <div className="font-medium">Private</div>
                        <div className="text-sm text-gray-500">Invite only</div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Members Selection */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Add Members ({selectedMembers.length} selected)
                  </label>
                  <button
                    onClick={() => setSelectedMembers(teamMembers.map(m => m.id))}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Select All
                  </button>
                </div>
                
                <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                  {teamMembers.map(member => (
                    <label
                      key={member.id}
                      className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(member.id)}
                        onChange={() => handleMemberToggle(member.id)}
                        className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <div className="flex items-center flex-1">
                        {member.avatar_url ? (
                          <div className="w-8 h-8 rounded-full mr-3 relative overflow-hidden">
                            <Image
                              src={member.avatar_url}
                              alt={member.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-3">
                            <span className="text-white text-sm font-medium">
                              {member.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-gray-900">{member.name}</div>
                          <div className="text-sm text-gray-500">{member.email}</div>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {member.role}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Groups Yet</h3>
              <p className="text-gray-500">Create your first group chat to get started</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'create' && (
          <div className="flex items-center justify-between p-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateGroup}
              disabled={!groupName.trim() || selectedMembers.length === 0 || isCreating}
              className={cn(
                "px-6 py-2 rounded-lg font-medium transition-colors",
                !groupName.trim() || selectedMembers.length === 0 || isCreating
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              )}
            >
              {isCreating ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}