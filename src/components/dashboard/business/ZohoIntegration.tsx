'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mail, Send, Inbox, RefreshCw, Settings, ChevronDown, Paperclip,
  CheckCircle, AlertCircle, Loader2, Trash2, Star, Reply, Forward,
  PenSquare, X, User, Clock, Search, Zap
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';

interface ZohoIntegrationProps {
  // Email-only props
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

type TabType = 'inbox' | 'compose' | 'sent';

const ZohoEmailIntegration: React.FC<ZohoIntegrationProps> = ({ onEmailsSent }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accountInfo, setAccountInfo] = useState<ZohoAccount | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('inbox');
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
      const response = await fetch(`/api/zoho/enhanced?userId=${uid}&action=get_account_info`);
      const data = await response.json();
      if (response.ok && data.success) {
        setIsConnected(true);
        setAccountInfo(data.data);
        loadInbox(uid);
      }
    } catch (err) {
      console.error('Connection check failed:', err);
    }
  };

  const connectToZoho = () => {
    // Redirect to the backend-managed OAuth flow
    const appUrl = window.location.origin;
    window.location.href = `/api/auth/zoho/connect?userId=${userId}`;
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
    } catch (err: any) {
        toast.error('Failed to disconnect: ' + err.message);
    }
  };

  const loadAccountInfo = async (uid: string) => {
    try {
      const response = await fetch(`/api/zoho/enhanced?userId=${uid}&action=get_account_info`);
      const data = await response.json();
      if (response.ok && data.success) {
        setAccountInfo(data.data);
        // Set default from address if composing
        if (data.data.fromAddresses?.length > 0) {
          const defaultAddr = data.data.fromAddresses.find((a: any) => a.isDefault)?.address || data.data.fromAddresses[0].address;
          setComposeData(prev => ({ ...prev, from: defaultAddr }));
        } else {
          setComposeData(prev => ({ ...prev, from: data.data.email }));
        }
        localStorage.setItem('zoho_account_info', JSON.stringify(data.data));
      }
    } catch (err) {
      console.error('Failed to load account info:', err);
    }
  };

  const loadInbox = async (uid: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/zoho/enhanced?userId=${uid}&action=get_messages&folder=inbox`);
      const data = await response.json();
      if (response.ok && data.success) {
        setMessages(data.data || []);
      } else {
        // Graceful empty state — no toast noise
        setMessages([]);
      }
    } catch (err) {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSentMessages = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/zoho/enhanced?userId=${userId}&action=get_messages&folder=sent`);
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

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSelectedMessage(null);
    setIsComposing(false);
    if (tab === 'inbox') loadInbox(userId);
    if (tab === 'sent') loadSentMessages();
  };

  const sendEmail = async () => {
    if (!composeData.to || !composeData.subject || !composeData.body) {
      toast.error('Please fill in To, Subject, and Body');
      return;
    }
    if (!composeData.from) {
      toast.error('No sender email selected');
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
      return new Date(parseInt(dateStr)).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch { return ''; }
  };

  // ─── Not Connected ────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="min-h-[500px] flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl border border-slate-800">
        <div className="text-center max-w-sm px-6">
          <div className="w-20 h-20 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <Mail className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Zoho Mail</h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Connect your Zoho Mail account to manage your emails directly from your dashboard.
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

  // ─── Connected ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden" style={{ minHeight: '600px', maxHeight: '800px' }}>

      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-lg flex items-center justify-center shadow">
            <Mail className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Zoho Mail</h2>
            {accountInfo && (
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-emerald-400" />
                {accountInfo.email}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleTabChange(activeTab)}
            disabled={loading}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setIsComposing(true); setActiveTab('compose'); }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow"
          >
            <PenSquare className="w-4 h-4" />
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
            <div className="bg-slate-800 rounded-lg p-3 mb-4 border border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{accountInfo.displayName}</p>
                  <p className="text-slate-400 text-xs">{accountInfo.email}</p>
                </div>
              </div>
            </div>
          )}
          <button
            onClick={disconnect}
            className="w-full py-2 text-sm text-red-400 border border-red-800 rounded-lg hover:bg-red-900/20 transition-colors"
          >
            Disconnect Account
          </button>
        </div>
      )}

      {/* ── Tab Navigation ── */}
      <div className="flex items-center gap-1 px-5 pt-3 pb-0 shrink-0">
        {([
          { key: 'inbox', label: 'Inbox', icon: Inbox },
          { key: 'compose', label: 'Compose', icon: PenSquare },
          { key: 'sent', label: 'Sent', icon: Send },
        ] as { key: TabType; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => key === 'compose' ? (setIsComposing(true), setActiveTab('compose')) : handleTabChange(key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 ${
              activeTab === key
                ? 'text-sky-400 border-sky-500 bg-slate-800/50'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Main Content ── */}
      <div className="flex flex-1 overflow-hidden border-t border-slate-800">

        {/* Compose Panel */}
        {activeTab === 'compose' && (
          <div className="flex-1 p-5 overflow-y-auto">
            <div className="max-w-2xl mx-auto">
              <h3 className="text-white font-semibold mb-5 flex items-center gap-2">
                <PenSquare className="w-3.5 h-3.5 text-sky-400" />
                New Email
              </h3>
              <div className="space-y-3">
                  <div className="flex items-center gap-3 border-b border-slate-700/50 pb-4 mb-4">
                    <div className="w-10 h-10 bg-sky-500/10 rounded-xl flex items-center justify-center border border-sky-500/20 shrink-0">
                      <User className="w-5 h-5 text-sky-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Sender (From)</p>
                      {accountInfo?.fromAddresses && accountInfo.fromAddresses.length > 1 ? (
                        <div className="relative group">
                          <select
                            value={composeData.from}
                            onChange={(e) => setComposeData({ ...composeData, from: e.target.value })}
                            className="w-full bg-transparent text-white text-sm font-bold outline-none cursor-pointer appearance-none pr-8 py-0.5"
                          >
                            {accountInfo.fromAddresses.map((addr) => (
                              <option key={addr.address} value={addr.address} className="bg-slate-900 text-white">
                                {addr.address} {addr.displayName ? `(${addr.displayName})` : ''}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none group-hover:text-sky-400 transition-colors" />
                        </div>
                      ) : (
                        <p className="text-white text-sm font-bold truncate">{composeData.from || accountInfo?.email || 'Loading sender...'}</p>
                      )}
                    </div>
                  </div>

                  {([
                    { field: 'to', label: 'To', placeholder: 'recipient@example.com', required: true },
                    { field: 'cc', label: 'CC', placeholder: 'cc@example.com (optional)', required: false },
                    { field: 'subject', label: 'Subject', placeholder: 'Email subject', required: true },
                  ] as any[]).map(({ field, label, placeholder }) => (
                    <div key={field} className="flex items-center gap-3 border-b border-slate-700 pb-3">
                      <span className="text-slate-400 text-sm w-14 text-right">{label}</span>
                      <input
                        type="text"
                        value={(composeData as any)[field]}
                        onChange={(e) => setComposeData({ ...composeData, [field]: e.target.value })}
                        placeholder={placeholder}
                        className="flex-1 bg-transparent text-white text-sm placeholder:text-slate-600 outline-none"
                      />
                    </div>
                  ))}

                <textarea
                  value={composeData.body}
                  onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                  placeholder="Write your message here..."
                  rows={14}
                  className="w-full bg-transparent text-white text-sm placeholder:text-slate-600 outline-none resize-none mt-2"
                />
              </div>

              <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-700">
                <div className="flex items-center gap-2">
                  <button className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors" title="Attach file">
                    <Paperclip className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { 
                      setIsComposing(false); 
                      setActiveTab('inbox'); 
                      const defaultFrom = accountInfo?.fromAddresses?.find(a => a.isDefault)?.address || accountInfo?.email || '';
                      setComposeData({ from: defaultFrom, to: '', cc: '', subject: '', body: '' }); 
                    }}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    Discard
                  </button>
                  <button
                    onClick={sendEmail}
                    disabled={sendingEmail}
                    className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50 shadow"
                  >
                    {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {sendingEmail ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Inbox / Sent List + Detail */}
        {(activeTab === 'inbox' || activeTab === 'sent') && (
          <>
            {/* Message List */}
            <div className={`${selectedMessage ? 'hidden md:flex' : 'flex'} flex-col border-r border-slate-800 overflow-y-auto`} style={{ width: '340px', minWidth: '260px' }}>
              {/* Search */}
              <div className="p-3 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2">
                  <Search className="w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search emails..."
                    className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 outline-none"
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
                  <Inbox className="w-8 h-8 text-slate-600 mb-3" />
                  <p className="text-slate-500 text-sm">
                    {searchQuery ? 'No results found' : activeTab === 'inbox' ? 'Your inbox is empty' : 'No sent emails'}
                  </p>
                </div>
              ) : (
                filteredMessages.map((msg) => (
                  <button
                    key={msg.messageId}
                    onClick={() => setSelectedMessage(msg)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-800/50 transition-colors hover:bg-slate-800/50 ${
                      selectedMessage?.messageId === msg.messageId ? 'bg-slate-800' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-sm font-medium text-white truncate">{msg.fromAddress || msg.toAddress}</span>
                      <span className="text-xs text-slate-500 shrink-0">
                        {formatDate(msg.receivedTime || msg.sentDateInGMT)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 truncate">{msg.subject}</p>
                    {msg.summary && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">{msg.summary}</p>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Message Detail */}
            <div className={`${selectedMessage ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-hidden`}>
              {selectedMessage ? (
                <>
                  <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 shrink-0">
                    <button
                      onClick={() => setSelectedMessage(null)}
                      className="md:hidden flex items-center gap-2 text-sm text-slate-400 hover:text-white"
                    >
                      <ChevronDown className="w-4 h-4 rotate-90" /> Back
                    </button>
                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        onClick={() => {
                          setComposeData({ 
                            from: accountInfo?.fromAddresses?.find(a => a.isDefault)?.address || accountInfo?.email || '',
                            to: selectedMessage.fromAddress, 
                            cc: '', 
                            subject: `Re: ${selectedMessage.subject}`, 
                            body: '' 
                          });
                          setActiveTab('compose');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <Reply className="w-3.5 h-3.5" /> Reply
                      </button>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
                        <Forward className="w-3.5 h-3.5" /> Forward
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-5">
                    <h2 className="text-white text-lg font-semibold mb-4">{selectedMessage.subject}</h2>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-9 h-9 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {(selectedMessage.fromAddress || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{selectedMessage.fromAddress}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(selectedMessage.receivedTime || selectedMessage.sentDateInGMT)}
                        </p>
                      </div>
                    </div>
                    <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                      {selectedMessage.content || selectedMessage.summary || 'No message content available.'}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                  <Mail className="w-12 h-12 text-slate-700 mb-4" />
                  <p className="text-slate-500">Select an email to read</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ZohoEmailIntegration;