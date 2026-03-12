'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Paperclip, Smile, Users, Hash, AtSign, Search, Filter, MoreVertical, Reply, Edit, Trash2, Download, Volume2, VolumeX, Phone, Video } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { messageService } from '@/services/messageService';
import { taskService } from '@/services/taskService';
import { teamService } from '@/services/teamService';
import toast from 'react-hot-toast';
import { MessageReactions } from '@/components/common/MessageReactions';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: 'user' | 'model' | 'system';
  recipient_id?: string;
  group_id?: string;
  text: string;
  type: 'text' | 'task_created' | 'goal_created' | 'system' | 'reaction' | 'reply';
  attachments?: any[];
  reactions?: { [emoji: string]: string[] };
  reply_to?: string;
  edited_at?: string;
  read_at?: string;
  delivered_at?: string;
  created_at: string;
  tenant_id: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url?: string;
  status?: 'online' | 'away' | 'offline';
  last_seen?: string;
}

interface GroupChat {
  id: string;
  name: string;
  description?: string;
  members: string[];
  avatar_url?: string;
  type: 'group' | 'channel';
  created_at: string;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
}

export default function EnhancedTeamChat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [groupChats, setGroupChats] = useState<GroupChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<{ type: 'user' | 'group'; id: string }>({ type: 'user', id: '' });
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>({});
  const [notificationSettings, setNotificationSettings] = useState({
    sound: true,
    desktop: true,
    mentions: true
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Load team members and group chats
  useEffect(() => {
    loadTeamMembers();
    loadGroupChats();
    loadMessages();
    setupRealtimeSubscription();
  }, [selectedChat]);

  const loadTeamMembers = async () => {
    try {
      const members = await teamService.getTeamMembers();
      setTeamMembers(members.map(member => ({
        ...member,
        status: 'online', // Will be updated by presence system
        last_seen: new Date().toISOString()
      })));
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  const loadGroupChats = async () => {
    try {
      const groups = await messageService.getGroupChats();
      setGroupChats(groups);
    } catch (error) {
      console.error('Error loading group chats:', error);
    }
  };

  const loadMessages = async () => {
    if (!selectedChat.id) return;
    
    setIsLoading(true);
    try {
      let fetchedMessages;
      if (selectedChat.type === 'user') {
        fetchedMessages = await messageService.getMessages(selectedChat.id);
      } else {
        fetchedMessages = await messageService.getGroupMessages(selectedChat.id);
      }
      setMessages(fetchedMessages);
      scrollToBottom();
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!selectedChat.id) return;

    const channel = messageService.subscribeToMessages(
      selectedChat.type === 'user' ? selectedChat.id : undefined,
      selectedChat.type === 'group' ? selectedChat.id : undefined
    );

    channel.on('postgres_changes', (payload: any) => {
      if (payload.eventType === 'INSERT') {
        const newMsg = payload.new as Message;
        setMessages(prev => [...prev, newMsg]);
        
        // Play notification sound if enabled and not from current user
        if (notificationSettings.sound && newMsg.sender_id !== user?.id) {
          playNotificationSound();
        }
        
        // Show desktop notification
        if (notificationSettings.desktop && newMsg.sender_id !== user?.id) {
          showDesktopNotification(newMsg);
        }
        
        scrollToBottom();
      } else if (payload.eventType === 'UPDATE') {
        const updatedMsg = payload.new as Message;
        setMessages(prev => prev.map(msg => 
          msg.id === updatedMsg.id ? updatedMsg : msg
        ));
      }
    });

    return () => {
      messageService.unsubscribeFromMessages(channel);
    };
  };

  const sendMessage = async () => {
    if (!newMessage.trim() && selectedFiles.length === 0) return;
    
    const messageText = newMessage.trim();
    setNewMessage('');
    setSelectedFiles([]);

    try {
      // Handle task creation commands
      if (messageText.startsWith('@') && messageText.includes('assign task')) {
        const taskMatch = messageText.match(/@(\w+) assign task (.+)/);
        if (taskMatch) {
          const [, assigneeName, taskDescription] = taskMatch;
          const assignee = teamMembers.find(member => 
            member.name.toLowerCase().includes(assigneeName.toLowerCase())
          );
          
          if (assignee) {
            await taskService.createTask({
              title: taskDescription.trim(),
              description: `Created from chat by ${user?.name}`,
              assignee_id: assignee.id,
              priority: 'medium'
            });
            
            toast({
              title: "Task Created",
              description: `Task assigned to ${assignee.name}`
            });
            return;
          }
        }
      }

      // Send message with attachments
      const attachments = selectedFiles.length > 0 ? await uploadFiles(selectedFiles) : [];
      
      const { error } = await messageService.sendMessage(
        user?.id || '',
        user?.name || '',
        'user',
        messageText,
        selectedChat.type === 'user' ? selectedChat.id : undefined,
        attachments,
        'normal',
        replyingTo?.id,
        selectedChat.type === 'group' ? selectedChat.id : undefined
      );

      if (error) {
        throw new Error(error);
      }
      
      setReplyingTo(null);
      
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    }
  };

  const uploadFiles = async (files: File[]): Promise<any[]> => {
    const uploadedAttachments = [];
    for (const file of files) {
      try {
        const uploaded = await messageService.uploadAttachment(file);
        uploadedAttachments.push(uploaded);
      } catch (error) {
        console.error('Error uploading file:', error);
        toast({
          title: "Upload Failed",
          description: `Failed to upload ${file.name}`,
          variant: "destructive"
        });
      }
    }
    return uploadedAttachments;
  };

  const addReaction = async (messageId: string, emoji: string) => {
    try {
      await messageService.addReaction(messageId, emoji, user?.id || '');
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const editMessage = async (messageId: string, newText: string) => {
    try {
      await messageService.editMessage(messageId, newText);
      setEditingMessage(null);
    } catch (error) {
      console.error('Error editing message:', error);
      toast({
        title: "Error",
        description: "Failed to edit message",
        variant: "destructive"
      });
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      await messageService.deleteMessage(messageId);
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive"
      });
    }
  };

  const playNotificationSound = () => {
    const audio = new Audio('/notification.mp3');
    audio.play().catch(console.error);
  };

  const showDesktopNotification = (message: Message) => {
    if (Notification.permission === 'granted') {
      new Notification(`${message.sender_name}`, {
        body: message.text,
        icon: '/favicon.ico'
      });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const isToday = (date: string) => {
    const messageDate = new Date(date);
    const today = new Date();
    return messageDate.toDateString() === today.toDateString();
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Team Chat</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <Search className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowGroupManager(true)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <Users className="w-4 h-4" />
              </button>
              <button
                onClick={() => setNotificationSettings(prev => ({ ...prev, sound: !prev.sound }))}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                {notificationSettings.sound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            </div>
          </div>
          
          {showSearch && (
            <MessageSearch
              onSearch={setSearchQuery}
              onClose={() => setShowSearch(false)}
            />
          )}
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {/* Group Chats */}
          {groupChats.length > 0 && (
            <div className="p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Groups</h3>
              {groupChats.map(group => (
                <button
                  key={group.id}
                  onClick={() => setSelectedChat({ type: 'group', id: group.id })}
                  className={cn(
                    "w-full flex items-center p-3 rounded-lg mb-2 transition-colors",
                    selectedChat.type === 'group' && selectedChat.id === group.id
                      ? "bg-blue-50 text-blue-700"
                      : "hover:bg-gray-50 text-gray-900"
                  )}
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-3">
                    <Hash className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium">{group.name}</div>
                    {group.last_message && (
                      <div className="text-sm text-gray-500 truncate">
                        {group.last_message}
                      </div>
                    )}
                  </div>
                  {group.unread_count && group.unread_count > 0 && (
                    <div className="bg-blue-600 text-white text-xs rounded-full px-2 py-1">
                      {group.unread_count}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Direct Messages */}
          <div className="p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Direct Messages</h3>
            {teamMembers.map(member => (
              <button
                key={member.id}
                onClick={() => setSelectedChat({ type: 'user', id: member.id })}
                className={cn(
                  "w-full flex items-center p-3 rounded-lg mb-2 transition-colors",
                  selectedChat.type === 'user' && selectedChat.id === member.id
                    ? "bg-blue-50 text-blue-700"
                    : "hover:bg-gray-50 text-gray-900"
                )}
              >
                <UserPresence
                  user={member}
                  showStatus={true}
                  className="mr-3"
                />
                <div className="flex-1 text-left">
                  <div className="font-medium">{member.name}</div>
                  <div className="text-sm text-gray-500">{member.role}</div>
                </div>
                {unreadCounts[member.id] && unreadCounts[member.id] > 0 && (
                  <div className="bg-blue-600 text-white text-xs rounded-full px-2 py-1">
                    {unreadCounts[member.id]}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedChat.id ? (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center">
                {selectedChat.type === 'group' ? (
                  <>
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-3">
                      <Hash className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {groupChats.find(g => g.id === selectedChat.id)?.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {groupChats.find(g => g.id === selectedChat.id)?.members.length} members
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <UserPresence
                      user={teamMembers.find(m => m.id === selectedChat.id)}
                      showStatus={true}
                      className="mr-3"
                    />
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {teamMembers.find(m => m.id === selectedChat.id)?.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {teamMembers.find(m => m.id === selectedChat.id)?.role}
                      </p>
                    </div>
                  </>
                )}
              </div>
              <div className="flex space-x-2">
                <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                  <Phone className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                  <Video className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoading ? (
                <div className="flex justify-center items-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                messages.map((message) => (
                  <MessageThread
                    key={message.id}
                    message={message}
                    currentUserId={user?.id}
                    onReaction={addReaction}
                    onReply={setReplyingTo}
                    onEdit={setEditingMessage}
                    onDelete={deleteMessage}
                    teamMembers={teamMembers}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply Preview */}
            {replyingTo && (
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <div className="flex items-center">
                  <Reply className="w-4 h-4 text-gray-500 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{replyingTo.sender_name}</p>
                    <p className="text-sm text-gray-500 truncate max-w-md">{replyingTo.text}</p>
                  </div>
                </div>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>
            )}

            {/* Message Input */}
            <div className="p-4 bg-white border-t border-gray-200">
              <div className="flex items-center space-x-2 mb-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  <Smile className="w-5 h-5" />
                </button>
                <div className="flex-1"></div>
                {selectedFiles.length > 0 && (
                  <MessageAttachments
                    files={selectedFiles}
                    onRemove={(index) => setSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                  />
                )}
              </div>
              
              <div className="relative">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a message... Use @name assign task to create tasks"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={2}
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() && selectedFiles.length === 0}
                  className="absolute right-2 bottom-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {showEmojiPicker && (
                <div className="absolute bottom-full mb-2">
                  <EmojiPicker
                    onEmojiSelect={(emoji) => {
                      setNewMessage(prev => prev + emoji);
                      setShowEmojiPicker(false);
                    }}
                    onClose={() => setShowEmojiPicker(false)}
                  />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a conversation</h3>
              <p className="text-gray-500">Choose a team member or group to start chatting</p>
            </div>
          </div>
        )}
      </div>

      {/* Group Chat Manager Modal */}
      {showGroupManager && (
        <GroupChatManager
          teamMembers={teamMembers}
          onClose={() => setShowGroupManager(false)}
          onGroupCreated={loadGroupChats}
        />
      )}

      {/* File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
        className="hidden"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
      />
    </div>
  );
}