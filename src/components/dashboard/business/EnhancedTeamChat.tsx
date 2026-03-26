'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, CheckCircle, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { messageService } from '@/services/messageService';
import { teamService } from '@/services/teamService';
import { ChatMessage } from '@/types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface TeamMember {
  id: string;
  name: string;
  role: string;
}

export default function EnhancedTeamChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTeamMembers();
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadTeamMembers = async () => {
    try {
      const { team } = await teamService.getTeamMembers();
      setTeamMembers(team as TeamMember[]);
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  const loadMessages = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { messages: fetched } = await messageService.getMessages(user.id);
      setMessages(fetched || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user) return;
    const text = newMessage.trim();
    setNewMessage('');
    try {
      const { message: sent } = await messageService.sendMessage(
        user.id,
        user.name || 'User',
        'user',
        text,
        undefined,
        [],
        'normal'
      );
      if (sent) {
        setMessages(prev => [...prev, sent]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
      <div className="flex flex-col h-[600px] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <MessageCircle className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-bold text-white">Team Chat</h3>
              <p className="text-xs text-slate-400">Real-time team collaboration</p>
            </div>
          </div>
          <div className="flex -space-x-2">
            {teamMembers.slice(0, 5).map(m => (
              <div
                key={m.id}
                title={m.name}
                className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-700 flex items-center justify-center text-xs font-bold text-white"
              >
                {m.name?.charAt(0)}
              </div>
            ))}
            {teamMembers.length > 5 && (
              <div className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-xs text-slate-400 font-bold">
                +{teamMembers.length - 5}
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Users className="w-12 h-12 text-slate-600 mb-3" />
              <p className="text-slate-400 text-sm">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map(msg => {
              const isMe = msg.senderId === user?.id;
              const isSystem = msg.role === 'system';

              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-full px-4 py-1 text-xs text-slate-400 flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-400" />
                      {msg.text}
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center font-bold text-xs text-white">
                    {(msg.senderName || 'U').charAt(0)}
                  </div>
                  <div className={`max-w-[70%] space-y-1 ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="font-bold text-slate-300">{isMe ? 'You' : msg.senderName}</span>
                      <span>{format(new Date(msg.timestamp), 'h:mm a')}</span>
                    </div>
                    <div className={`p-3 rounded-2xl text-sm ${isMe
                      ? 'bg-indigo-600 text-white rounded-tr-sm'
                      : 'bg-slate-800 text-slate-200 rounded-tl-sm'
                      }`}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-slate-900 border-t border-slate-800">
          <div className="relative">
            <textarea
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-4 pr-12 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none h-12"
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim()}
              className="absolute right-2 top-2 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
  );
}