'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mail, Send, Inbox, RefreshCw, Settings, ChevronDown, Paperclip,
  CheckCircle, AlertCircle, Loader2, Trash2, Star, Reply, Forward,
  PenSquare, X, User, Clock, Search, Zap, MoreVertical, Archive
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';

interface ZohoIntegrationProps {
  onEmailsSent?: (count: number) => void;
}

interface ZohoFromAddress {
  address: string;
  isDefault: boolean;
  displayName: string;
}

interface ZohoAccount {
  accountId: string;
  email: string;
  displayName: string;
  fromAddresses?: ZohoFromAddress[];
}

interface EmailMessage {
  messageId: string;
  subject: string;
  fromAddress: string;
  toAddress: string;
  sentDateInGMT?: string;
  receivedTime?: string;
  summary?: string;
  content?: string;
  status?: string;
  flagged?: boolean;
}

type FolderType = 'inbox' | 'compose' | 'sent' | 'drafts' | 'trash' | 'starred';

const ZohoEmailIntegration: React.FC<ZohoIntegrationProps> = ({ onEmailsSent }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accountInfo, setAccountInfo] = useState<ZohoAccount | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [activeFolder, setActiveFolder] = useState<FolderType>('inbox');
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [composeData, setComposeData] = useState({
    from: '',
    to: '',
    cc: '',
    subject: '',
    body: '',
  });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [deletingMessage, setDeletingMessage] = useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
        checkConnection(session.user.id);
      }
    };
    fetchSession();
  }, []);

  const checkConnection = async (uid: string) => {
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/zoho/enhanced?userId=${uid}&action=get_account_info&t=${timestamp}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        setIsConnected(true);
        setAccountInfo(data.data);
        // Initialize compose from address
        if (data.data.fromAddresses?.length > 0) {
          const defaultAddr = data.data.fromAddresses.find((a: any) => a.isDefault)?.address || data.data.fromAddresses[0].address;
          setComposeData(prev => ({ ...prev, from: defaultAddr }));
        } else {
          setComposeData(prev => ({ ...prev, from: data.data.email }));
        }
        loadMessages(uid, 'inbox');
      } else if (response.status === 404) {
        // Explicitly not connected
        setIsConnected(false);
        setAccountInfo(null);
        setMessages([]);
      } else {
        // API error (500 etc.) - keep current state to avoid loop
        console.warn('Zoho API check failed with status:', response.status, data.error || '');
      }
    } catch (err) {
      console.error('Connection check failed:', err);
    }
  };

  const connectToZoho = () => {
    const appUrl = window.location.origin;
    // We add prompt=consent select_account to help force the account selection screen
    window.location.href = `/api/auth/zoho/connect?userId=${userId}&prompt=select_account`;
  };

  const disconnect = async () => {
    try {
        const { error } = await supabase
            .from('integrations')
            .delete()
            .eq('user_id', userId)
            .eq('type', 'zoho');
        
        if (error) throw error;
        
        setIsConnected(false);
        setAccountInfo(null);
        setMessages([]);
        setSelectedMessage(null);
        toast.success('Disconnected from Zoho Mail');
        // Explicitly advise user on how to switch accounts
        toast('To connect a different account, sign out of Zoho.com in this browser first.', {
          icon: 'ℹ️',
          duration: 6000
        });
    } catch (err: any) {
        toast.error('Failed to disconnect: ' + err.message);
    }
  };

  const loadMessages = async (uid: string, folder: FolderType) => {
    if (folder === 'compose') return;
    setLoading(true);
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/zoho/enhanced?userId=${uid}&action=get_messages&folder=${folder}&t=${timestamp}`);
      const data = await response.json();
      if (response.ok && data.success) {
        setMessages(data.data || []);
      } else {
        setMessages([]);
      }
    } catch (err) {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFolderChange = (folder: FolderType) => {
    setActiveFolder(folder);
    setSelectedMessage(null);
    if (folder === 'compose') {
      setIsComposing(true);
    } else {
      setIsComposing(false);
      loadMessages(userId, folder);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!userId || deletingMessage) return;
    
    setDeletingMessage(true);
    try {
      const response = await fetch('/api/zoho/enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action: 'delete_message',
          data: { messageId }
        })
      });

      if (response.ok) {
        toast.success('Message deleted');
        setMessages(prev => prev.filter(m => m.messageId !== messageId));
        if (selectedMessage?.messageId === messageId) {
          setSelectedMessage(null);
        }
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to delete message');
      }
    } catch (err) {
      toast.error('Network error deleting message');
    } finally {
      setDeletingMessage(false);
    }
  };

  const generateAiReply = async () => {
    if (!selectedMessage) return;
    setAiGenerating(true);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Reply to this email from "${selectedMessage.fromAddress}" with subject "${selectedMessage.subject}".
          Email Content: "${selectedMessage.content || selectedMessage.summary}"
          Instructions: Draft a professional and helpful response.`,
          systemPrompt: "You are an expert customer relations assistant."
        })
      });

      if (!res.ok) throw new Error('AI failed');
      const data = await res.json();
      
      setComposeData({
        from: accountInfo?.fromAddresses?.find(a => a.isDefault)?.address || accountInfo?.email || '',
        to: selectedMessage.fromAddress,
        cc: '',
        subject: `Re: ${selectedMessage.subject}`,
        body: data.text
      });
      setActiveFolder('compose');
      setIsComposing(true);
      toast.success('AI Draft ready');
    } catch (err) {
      toast.error('AI Assistant failed');
    } finally {
      setAiGenerating(false);
    }
  };

  const sendEmail = async () => {
    if (!composeData.to || !composeData.subject || !composeData.body) {
      toast.error('Please fill in To, Subject, and Body');
      return;
    }
    setSendingEmail(true);
    try {
      const resp = await fetch('/api/zoho/enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action: 'send_email',
          data: {
            to: composeData.to,
            cc: composeData.cc || undefined,
            subject: composeData.subject,
            content: composeData.body,
            fromAddress: composeData.from,
          },
        }),
      });
      const result = await resp.json();
      if (resp.ok && result.success) {
        toast.success('Email sent successfully!');
        const defaultFrom = accountInfo?.fromAddresses?.find(a => a.isDefault)?.address || accountInfo?.email || '';
        setComposeData({ from: defaultFrom, to: '', cc: '', subject: '', body: '' });
        setIsComposing(false);
        setActiveFolder('inbox');
        loadMessages(userId, 'inbox');
        if (onEmailsSent) onEmailsSent(1);
      } else {
        toast.error(result.error || 'Failed to send email');
      }
    } catch (err) {
      toast.error('Error sending email');
    } finally {
      setSendingEmail(false);
    }
  };

  const filteredMessages = messages.filter((m) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.subject?.toLowerCase().includes(q) ||
      m.fromAddress?.toLowerCase().includes(q) ||
      m.summary?.toLowerCase().includes(q)
    );
  });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = dateStr.includes('-') ? new Date(dateStr) : new Date(parseInt(dateStr));
      return date.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch { return dateStr || ''; }
  };

  // ─── Not Connected State ───
  if (!isConnected) {
    return (
      <div className="min-h-[500px] flex items-center justify-center bg-slate-900/60 rounded-2xl border border-slate-800">
        <div className="text-center max-w-sm px-6">
          <div className="w-20 h-20 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <Mail className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Zoho Mail</h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Connect your Zoho Mail account to manage your professional communications directly from your dashboard.
          </p>
          <button
            onClick={connectToZoho}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-sky-500/25"
          >
            <Zap className="w-4 h-4" />
            Connect Zoho Mail
          </button>
        </div>
      </div>
    );
  }

  // ─── Connected State ───
  return (
    <div className="flex flex-col h-full bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden" 
         style={{ minHeight: '600px', height: '100%', maxHeight: 'calc(100vh - 120px)' }}>

      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-lg flex items-center justify-center shadow">
            <Mail className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Zoho Mail</h2>
            {accountInfo && <p className="text-[10px] text-emerald-400 flex items-center gap-1"><CheckCircle className="w-2.5 h-2.5" /> Connected</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleFolderChange(activeFolder)}
            disabled={loading}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleFolderChange('compose')}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-sky-500/10"
          >
            <PenSquare className="w-3.5 h-3.5" />
            Compose
          </button>
        </div>
      </div>

      {/* ── Settings Panel ── */}
      {showSettings && (
        <div className="absolute top-16 right-4 z-50 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white text-sm">Account Settings</h3>
            <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          {accountInfo && (
            <div className="bg-slate-800/50 rounded-lg p-3 mb-4 border border-slate-700">
              <p className="text-white text-sm font-medium">{accountInfo.displayName}</p>
              <p className="text-slate-400 text-xs truncate">{accountInfo.email}</p>
            </div>
          )}
          <button
            onClick={disconnect}
            className="w-full py-2 text-sm text-red-400 border border-red-800/50 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            Disconnect Zoho
          </button>
        </div>
      )}

      {/* ── Main Layout (3-Pane) ── */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Pane 1: Folders Sidebar */}
        <div className="hidden sm:flex flex-col w-48 border-r border-slate-800 bg-slate-900/40 p-3 gap-1 shrink-0">
          {(['inbox', 'sent', 'drafts', 'trash', 'starred'] as FolderType[]).map((key) => {
            const labels: Record<FolderType, string> = { inbox: 'Inbox', compose: 'Compose', sent: 'Sent', drafts: 'Drafts', trash: 'Trash', starred: 'Starred' };
            const icons: Record<FolderType, any> = { inbox: Inbox, compose: PenSquare, sent: Send, drafts: Clock, trash: Trash2, starred: Star };
            const Icon = icons[key];
            if (key === 'compose') return null;
            return (
              <button
                key={key}
                onClick={() => handleFolderChange(key)}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${
                  activeFolder === key
                    ? 'text-sky-400 bg-sky-400/10 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${activeFolder === key ? 'text-sky-400' : 'text-slate-500'}`} />
                {labels[key]}
              </button>
            );
          })}
        </div>

        {/* Pane 2: Message List / Compose Area */}
        <div className="flex flex-1 overflow-hidden">
          {activeFolder === 'compose' ? (
            /* Compose Flow */
            <div className="flex-1 flex flex-col items-center bg-slate-900/20 p-6 overflow-y-auto">
              <div className="w-full max-w-2xl bg-slate-900/60 rounded-3xl border border-slate-800 p-8 shadow-2xl">
                <h3 className="text-white font-bold text-lg mb-8 flex items-center gap-3">
                   <PenSquare className="w-5 h-5 text-sky-400" />
                   New Communication
                </h3>
                <div className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold ml-1">From</label>
                    <div className="relative group">
                      <select
                        value={composeData.from}
                        onChange={(e) => setComposeData({ ...composeData, from: e.target.value })}
                        className="w-full bg-slate-800/50 text-white text-sm rounded-xl px-4 py-2.5 outline-none border border-slate-700 focus:border-sky-500/50 transition-all appearance-none"
                      >
                        {accountInfo?.fromAddresses?.map((addr) => (
                          <option key={addr.address} value={addr.address}>
                            {addr.displayName || addr.address} &lt;{addr.address}&gt;
                          </option>
                        )) || <option value={accountInfo?.email}>{accountInfo?.email}</option>}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none group-hover:text-sky-400 transition-colors" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold ml-1">To</label>
                    <input
                      type="text"
                      value={composeData.to}
                      onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                      placeholder="recipient@example.com"
                      className="w-full bg-slate-800/50 text-white text-sm rounded-xl px-4 py-2.5 outline-none border border-slate-700 focus:border-sky-500/50 transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold ml-1">Subject</label>
                    <input
                      type="text"
                      value={composeData.subject}
                      onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                      placeholder="Enter subject line"
                      className="w-full bg-slate-800/50 text-white text-sm rounded-xl px-4 py-2.5 outline-none border border-slate-700 focus:border-sky-500/50 transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold ml-1">Message</label>
                    <textarea
                      value={composeData.body}
                      onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                      placeholder="Compose your message..."
                      className="w-full bg-slate-800/50 text-white text-sm rounded-xl px-4 py-3 outline-none border border-slate-700 focus:border-sky-500/50 transition-all min-h-[250px] resize-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-800/50">
                   <button
                    onClick={() => { setActiveFolder('inbox'); setSelectedMessage(null); }}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    Discard
                  </button>
                  <button
                    onClick={sendEmail}
                    disabled={sendingEmail}
                    className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-sm font-bold rounded-xl transition-all shadow-xl shadow-sky-500/20 disabled:opacity-50"
                  >
                    {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {sendingEmail ? 'Sending...' : 'Schedule & Send'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Pane 2: List View */
            <div className={`flex flex-1 overflow-hidden ${selectedMessage ? 'lg:flex' : 'flex'}`}>
              <div className={`flex flex-col border-r border-slate-800 bg-slate-900/10 ${selectedMessage ? 'hidden lg:flex' : 'flex'} w-full lg:w-[350px] shrink-0`}>
                <div className="p-4 border-b border-slate-800">
                  <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-hover:text-sky-500 transition-colors" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search messages..."
                      className="w-full bg-slate-800/40 text-sm text-white rounded-xl pl-10 pr-4 py-2.5 outline-none border border-slate-800/80 focus:border-sky-500/30 transition-all"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {loading ? (
                    <div className="h-40 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-sky-400" /></div>
                  ) : filteredMessages.length === 0 ? (
                    <div className="p-12 text-center">
                      <Inbox className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                      <p className="text-slate-500 text-sm">No communications found</p>
                    </div>
                  ) : (
                    filteredMessages.map((msg) => (
                      <button
                        key={msg.messageId}
                        onClick={() => setSelectedMessage(msg)}
                        className={`w-full text-left px-5 py-4 border-b border-slate-800/40 hover:bg-slate-800/30 transition-all relative ${selectedMessage?.messageId === msg.messageId ? 'bg-slate-800/60' : ''}`}
                      >
                        {selectedMessage?.messageId === msg.messageId && <div className="absolute left-0 top-0 bottom-0 w-1 bg-sky-500" />}
                        <div className="flex justify-between items-start mb-1.5">
                          <span className="text-sm font-bold text-white truncate max-w-[180px]">{msg.fromAddress || msg.toAddress}</span>
                          <span className="text-[10px] text-slate-500 uppercase tracking-tighter shrink-0">{formatDate(msg.receivedTime || msg.sentDateInGMT)}</span>
                        </div>
                        <p className={`text-xs truncate ${selectedMessage?.messageId === msg.messageId ? 'text-sky-300' : 'text-slate-300'} font-medium`}>{msg.subject || '(No Subject)'}</p>
                        <p className="text-[11px] text-slate-500 truncate mt-1 leading-relaxed opacity-80">{msg.summary}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Pane 3: Detail View */}
              <div className={`flex flex-1 flex-col bg-slate-900/40 overflow-hidden ${selectedMessage ? 'flex' : 'hidden lg:flex'}`}>
                {selectedMessage ? (
                  <div className="flex flex-col h-full">
                    {/* Detail Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md">
                      <button onClick={() => setSelectedMessage(null)} className="lg:hidden p-2 text-slate-400"><X className="w-5 h-5" /></button>
                      <div className="flex items-center gap-2">
                        <button onClick={generateAiReply} disabled={aiGenerating} className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-bold rounded-xl border border-indigo-500/20 transition-all">
                          {aiGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />} AI Assist
                        </button>
                        <button 
                          onClick={() => {
                            setComposeData({ from: accountInfo?.fromAddresses?.find(a => a.isDefault)?.address || accountInfo?.email || '', to: selectedMessage.fromAddress, cc: '', subject: `Re: ${selectedMessage.subject}`, body: '' });
                            setActiveFolder('compose');
                          }}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Reply className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => deleteMessage(selectedMessage!.messageId)} 
                          className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Detail Body */}
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                      <div className="max-w-3xl mx-auto">
                        <h1 className="text-2xl font-bold text-white mb-6 leading-tight">{selectedMessage.subject}</h1>
                        <div className="flex items-center gap-4 mb-8">
                          <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-lg font-black shadow-xl">
                            {(selectedMessage.fromAddress || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-base font-bold text-white leading-none mb-1">{selectedMessage.fromAddress}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-1.5"><Clock className="w-3 h-3" /> {formatDate(selectedMessage.receivedTime || selectedMessage.sentDateInGMT)}</p>
                          </div>
                        </div>
                        <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap border-t border-slate-800/50 pt-8 mt-4 font-normal tracking-wide">
                          {selectedMessage.content || selectedMessage.summary || 'No message content available.'}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-40">
                    <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mb-4 border border-slate-700">
                      <Mail className="w-10 h-10 text-slate-600" />
                    </div>
                    <p className="text-slate-400 text-sm font-medium">Select a communication to view details</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ZohoEmailIntegration;