'use client';

import React, { useState } from 'react';
import { MessageCircle, Reply, Edit, Trash2, MoreVertical, Download, Heart, ThumbsUp, Smile, Star, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import MessageReactions from './MessageReactions';
import UserPresence from './UserPresence';

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

interface MessageThreadProps {
  message: Message;
  currentUserId: string;
  onReaction: (messageId: string, emoji: string) => void;
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDelete: (messageId: string) => void;
  teamMembers: any[];
  className?: string;
}

export default function MessageThread({
  message,
  currentUserId,
  onReaction,
  onReply,
  onEdit,
  onDelete,
  teamMembers,
  className
}: MessageThreadProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const isOwnMessage = message.sender_id === currentUserId;
  const sender = teamMembers.find(member => member.id === message.sender_id);

  const handleEdit = () => {
    setIsEditing(true);
    setShowMenu(false);
  };

  const handleSaveEdit = () => {
    if (editText.trim() && editText !== message.text) {
      onEdit({ ...message, text: editText.trim() });
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(message.text);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this message?')) {
      onDelete(message.id);
    }
    setShowMenu(false);
  };

  const handleReaction = (emoji: string) => {
    onReaction(message.id, emoji);
    setShowEmojiPicker(false);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const isSystemMessage = message.type === 'system';
  const isTaskMessage = message.type === 'task_created' || message.type === 'goal_created';

  return (
    <div className={cn("group", className)}>
      {/* System Message */}
      {isSystemMessage && (
        <div className="flex justify-center my-4">
          <div className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm">
            {message.text}
          </div>
        </div>
      )}

      {/* Regular Message */}
      {!isSystemMessage && (
        <div className={cn(
          "flex items-start space-x-3",
          isOwnMessage && "flex-row-reverse space-x-reverse"
        )}>
          {/* Avatar */}
          <UserPresence
            user={sender || { id: message.sender_id, name: message.sender_name, email: '', role: 'user' }}
            size="sm"
            className="flex-shrink-0 mt-1"
          />

          {/* Message Content */}
          <div className={cn(
            "flex-1 max-w-md lg:max-w-lg",
            isOwnMessage && "flex flex-col items-end"
          )}>
            {/* Message Header */}
            <div className={cn(
              "flex items-center space-x-2 mb-1",
              isOwnMessage && "flex-row-reverse space-x-reverse"
            )}>
              <span className="text-sm font-medium text-gray-900">
                {message.sender_name}
              </span>
              <span className="text-xs text-gray-500">
                {formatTime(message.created_at)}
              </span>
              {message.edited_at && (
                <span className="text-xs text-gray-400">(edited)</span>
              )}
            </div>

            {/* Message Bubble */}
            <div className={cn(
              "relative px-4 py-2 rounded-lg",
              isOwnMessage
                ? "bg-blue-600 text-white"
                : isTaskMessage
                ? "bg-green-50 border border-green-200"
                : "bg-gray-100 text-gray-900"
            )}>
              {/* Reply Preview */}
              {message.reply_to && (
                <div className={cn(
                  "mb-2 pb-2 border-l-2 pl-3 text-sm",
                  isOwnMessage
                    ? "border-blue-400 text-blue-100"
                    : "border-gray-300 text-gray-600"
                )}>
                  <div className="font-medium">Replying to message</div>
                  <div className="truncate">Original message text...</div>
                </div>
              )}

              {/* Message Text */}
              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 resize-none"
                    rows={2}
                    autoFocus
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={handleSaveEdit}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="whitespace-pre-wrap break-words">
                  {message.text}
                </div>
              )}

              {/* Attachments */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="mt-2 space-y-2">
                  {message.attachments.map((attachment, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex items-center space-x-2 p-2 rounded cursor-pointer hover:bg-opacity-10",
                        isOwnMessage ? "bg-white bg-opacity-10" : "bg-gray-200 bg-opacity-50"
                      )}
                      onClick={() => window.open(attachment.url, '_blank')}
                    >
                      <Download className="w-4 h-4" />
                      <span className="text-sm truncate">{attachment.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Task/Gl Goal Indicator */}
              {isTaskMessage && (
                <div className={cn(
                  "mt-2 flex items-center space-x-1 text-xs",
                  isOwnMessage ? "text-blue-100" : "text-green-600"
                )}>
                  <MessageCircle className="w-3 h-3" />
                  <span>{message.type === 'task_created' ? 'Task created' : 'Goal created'}</span>
                </div>
              )}
            </div>

            {/* Reactions */}
            {message.reactions && Object.keys(message.reactions).length > 0 && (
              <MessageReactions
                reactions={message.reactions}
                messageId={message.id}
                currentUserId={currentUserId}
                onReaction={onReaction}
                className="mt-1"
              />
            )}
          </div>

          {/* Message Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className={cn(
                "p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity",
                showMenu && "opacity-100",
                "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              )}
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-32">
                <button
                  onClick={() => onReply(message)}
                  className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Reply className="w-4 h-4 mr-2" />
                  Reply
                </button>
                
                {isOwnMessage && (
                  <button
                    onClick={handleEdit}
                    className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </button>
                )}
                
                <div className="border-t border-gray-100 my-1"></div>
                
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Smile className="w-4 h-4 mr-2" />
                  React
                </button>
                
                {isOwnMessage && (
                  <button
                    onClick={handleDelete}
                    className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </button>
                )}
              </div>
            )}

            {/* Quick Emoji Picker */}
            {showEmojiPicker && (
              <div className="absolute right-0 top-16 bg-white rounded-lg shadow-lg border border-gray-200 p-2 z-20">
                <div className="flex space-x-1">
                  {['👍', '❤️', '😄', '⭐', '🔥'].map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => handleReaction(emoji)}
                      className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-lg"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}