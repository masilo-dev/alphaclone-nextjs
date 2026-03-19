'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mail, Send, Inbox, RefreshCw, Settings, ChevronDown, Paperclip,
  CheckCircle, AlertCircle, Loader2, Trash2, Star, Reply, Forward,
  PenSquare, X, User, Clock, Search, Zap, MoreVertical, Archive, Users
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { businessClientService, BusinessClient } from '../../../services/businessClientService';
import toast from 'react-hot-toast';

interface ZohoIntegrationProps {
  onEmailsSent?: (count: number) => void;
  user?: any;
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

const ZohoEmailIntegration: React.FC<ZohoIntegrationProps> = ({ onEmailsSent, user }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);
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
  const [composeMode, setComposeMode] = useState<'send' | 'reply' | 'forward'>('send');
  const [composeMessageId, setComposeMessageId] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [deletingMessage, setDeletingMessage] = useState(false);

  // ── Contact Directory for compose 'To' picker ──
  const [contacts, setContacts] = useState<BusinessClient[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [showContactPicker, setShowContactPicker] = useState(false);
  const contactPickerRef = useRef<HTMLDivElement>(null);

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(contactSearch.toLowerCase())
  );

  const resetCompose = () => {
    const defaultFrom = accountInfo?.fromAddresses?.find((a: any) => a.isDefault)?.address || accountInfo?.email || '';
    setComposeData({ from: defaultFrom, to: '', cc: '', subject: '', body: '' });
    setComposeMode('send');
    setComposeMessageId(null);
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      let currentUserId = user?.id;
      if (!currentUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        currentUserId = session?.user?.id;
      }
      if (currentUserId && mounted) {
        setUserId(currentUserId);
        checkConnection(currentUserId);
      }
    };
    init();
    return () => { mounted = false; };
  }, [user?.id]);

  // Load contacts from client directory once user/tenant is available
  useEffect(() => {
    const loadContacts = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const uid = user?.id || session?.user?.id;
        if (!uid) return;
        // Fetch tenant id from profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', uid)
          .single();
        if (!profile?.tenant_id) return;
        const { clients } = await businessClientService.getClients(profile.tenant_id, 1, 100);
        setContacts(clients.filter(c => !!c.email));
      } catch (e) {
        console.warn('Could not load contacts for compose picker:', e);
      }
    };
    loadContacts();
  }, [user?.id]);

  // Close contact picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contactPickerRef.current && !contactPickerRef.current.contains(e.target as Node)) {
        setShowContactPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const [selectedRegion, setSelectedRegion] = useState('com');
  const [showRegionSelector, setShowRegionSelector] = useState(false);
  const regionDetected = useRef(false);

  useEffect(() => {
    if (!isConnected && !regionDetected.current) {
      try {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const locale = navigator.language.toLowerCase();
        
        // Dynamic region detection heuristics
        if (timeZone.startsWith('Europe/') || locale.includes('-eu') || locale.endsWith('-gb') || locale.endsWith('-fr') || locale.endsWith('-de')) {
          setSelectedRegion('eu');
        } else if (timeZone.startsWith('Asia/Calcutta') || timeZone.startsWith('Asia/Kolkata') || locale.endsWith('-in')) {
          setSelectedRegion('in');
        } else if (timeZone.startsWith('Australia/') || locale.endsWith('-au')) {
          setSelectedRegion('au');
        } else if (timeZone.startsWith('Asia/Tokyo') || locale.endsWith('-jp')) {
          setSelectedRegion('jp');
        } else if (timeZone.startsWith('America/Toronto') || locale.endsWith('-ca')) {
          setSelectedRegion('ca');
        }
        regionDetected.current = true;
      } catch (e) {
        console.warn('Region detection failed:', e);
      }
    }
  }, [isConnected]);

  const regions = [
    { id: 'com', name: 'United States (.com)', flag: '🇺🇸' },
    { id: 'eu', name: 'Europe (.eu)', flag: '🇪🇺' },
    { id: 'in', name: 'India (.in)', flag: '🇮🇳' },
    { id: 'au', name: 'Australia (.com.au)', flag: '🇦🇺' },
    { id: 'jp', name: 'Japan (.jp)', flag: '🇯🇵' },
    { id: 'ca', name: 'Canada (.ca)', flag: '🇨🇦' },
  ];

  const checkConnection = async (uid?: string) => {
    setIsCheckingConnection(true);
    try {
      const response = await fetch(`/api/zoho?action=get_account_info`);
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
        loadMessages('inbox');
      } else if (response.status === 404) {
        // Explicitly not connected
        setIsConnected(false);
        setAccountInfo(null);
        setMessages([]);
      } else {
        // API error (500 etc.) - keep current state to avoid loop
        console.warn('Zoho API check failed with status:', response.status, data.error || '');
        setIsConnected(false);
      }
    } catch (err) {
      console.error('Connection check failed:', err);
      setIsConnected(false);
    } finally {
      setIsCheckingConnection(false);
    }
  };

  const connectToZoho = () => {
    window.location.href = `/api/auth/zoho/connect?region=${encodeURIComponent(selectedRegion)}`;
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
          duration: 6000
        });
    } catch (err: any) {
        toast.error('Failed to disconnect: ' + err.message);
    }
  };

  const loadMessages = async (folder: FolderType) => {
    if (folder === 'compose') return;
    setLoading(true);
    try {
      const response = await fetch(`/api/zoho?action=get_messages&folder=${folder}`);
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
      setComposeMode('send');
      setComposeMessageId(null);
      setIsComposing(true);
    } else {
      setIsComposing(false);
      loadMessages(folder);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!userId || deletingMessage) return;
    
    setDeletingMessage(true);
    try {
      const response = await fetch(`/api/zoho`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
      setComposeMode('reply');
      setComposeMessageId(selectedMessage.messageId);
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
      const action = composeMode === 'reply' && composeMessageId
        ? 'reply_email'
        : composeMode === 'forward' && composeMessageId
          ? 'forward_email'
          : 'send_email';
      const resp = await fetch('/api/zoho', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          data: {
            ...(composeMessageId ? { messageId: composeMessageId } : {}),
            to: composeData.to,
            cc: composeData.cc || undefined,
            subject: composeData.subject,
            content: composeData.body,
            fromAddress: composeData.from,
          }
        }),
      });
      const result = await resp.json();
      if (resp.ok && result.success) {
        toast.success(composeMode === 'reply' ? 'Reply sent successfully.' : composeMode === 'forward' ? 'Forward sent successfully.' : 'Email sent successfully.');
        resetCompose();
        setIsComposing(false);
        setActiveFolder('inbox');
        loadMessages('inbox');
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

  const saveDraft = async () => {
    setSendingEmail(true);
    try {
      const resp = await fetch('/api/zoho', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_draft',
          data: {
            to: composeData.to,
            subject: composeData.subject,
            content: composeData.body,
            fromAddress: composeData.from,
          }
        }),
      });
      const result = await resp.json();
      if (resp.ok && result.success) {
        toast.success('Draft saved.');
        resetCompose();
        setIsComposing(false);
        setActiveFolder('drafts');
        loadMessages('drafts');
      } else {
        toast.error(result.error || 'Failed to save draft');
      }
    } catch (err) {
      toast.error('Error saving draft');
    } finally {
      setSendingEmail(false);
    }
  };

  const toggleStar = async (message: EmailMessage) => {
    try {
      const nextFlagged = !message.flagged;
      const resp = await fetch('/api/zoho', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_message',
          data: {
            messageId: message.messageId,
            mode: 'setFlag',
            params: {
              flagId: nextFlagged ? '2' : '0'
            }
          }
        })
      });
      const result = await resp.json();
      if (!(resp.ok && result.success)) {
        throw new Error(result.error || 'Failed to update star');
      }

      setMessages(prev => prev.map(m => m.messageId === message.messageId ? { ...m, flagged: nextFlagged } : m));
      if (selectedMessage?.messageId === message.messageId) {
        setSelectedMessage({ ...selectedMessage, flagged: nextFlagged });
      }
      if (activeFolder === 'starred' && !nextFlagged) {
        setMessages(prev => prev.filter(m => m.messageId !== message.messageId));
        if (selectedMessage?.messageId === message.messageId) {
          setSelectedMessage(null);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update star');
    }
  };

  useEffect(() => {
    if (!isConnected || activeFolder === 'compose') return;

    const term = searchQuery.trim();
    const timeoutId = window.setTimeout(async () => {
      if (!term) {
        loadMessages(activeFolder);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`/api/zoho?action=search_messages&term=${encodeURIComponent(term)}`);
        const data = await response.json();
        if (response.ok && data.success) {
          setMessages(data.data || []);
        } else {
          setMessages([]);
        }
      } catch {
        setMessages([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery, activeFolder, isConnected]);

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

  // ─── Initial Connection Check ───
  if (isCheckingConnection) {
    return (
      <div className="min-h-[400px] flex items-center justify-center bg-slate-900/60 rounded-2xl border border-slate-800">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
            <Mail className="w-6 h-6 text-white" />
          </div>
          <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
          <p className="text-xs text-slate-500">Connecting to Zoho Mail...</p>
        </div>
      </div>
    );
  }

  // ─── Not Connected State ───
  if (!isConnected) {
    return (
      <div className="min-h-[360px] flex items-center justify-center bg-slate-900/60 rounded-2xl border border-slate-800">
        <div className="text-center max-w-lg px-5 py-6">
          <div className="w-16 h-16 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-xl">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Zoho Mail</h2>
          <p className="text-sm text-slate-400 mb-5 leading-relaxed">
            Connect Zoho Mail to read, send, reply, forward, save drafts, and manage inbox activity from one workspace.
          </p>
          
          <div className="mb-6">
            <label className="block text-left text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2 ml-1">
              Select Your Zoho Data Center (Zone)
            </label>
            <div className="relative">
              <button 
                onClick={() => setShowRegionSelector(!showRegionSelector)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-slate-800/50 border border-slate-700/50 text-white text-sm rounded-xl hover:bg-slate-800 transition-all"
              >
                <span className="flex items-center gap-2">
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-slate-600 bg-slate-900 px-1.5 text-[10px] font-bold text-slate-300">
                    {selectedRegion.toUpperCase()}
                  </span>
                  {regions.find(r => r.id === selectedRegion)?.name}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${showRegionSelector ? 'rotate-180' : ''}`} />
              </button>

              {showRegionSelector && (
                <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  {regions.map((region) => (
                    <button
                      key={region.id}
                      onClick={() => {
                        setSelectedRegion(region.id);
                        setShowRegionSelector(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors ${
                        selectedRegion === region.id ? 'bg-sky-500/20 text-sky-400' : 'text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-slate-600 bg-slate-900 px-1.5 text-[10px] font-bold text-slate-300">
                        {region.id.toUpperCase()}
                      </span>
                      {region.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-2 text-[10px] text-slate-500 text-left italic">
              Most users should use .com. If you're in Europe, select .eu.
            </p>
          </div>

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
    <div className="flex flex-col bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden h-full" 
         style={{ minHeight: 'min(560px, calc(100vh - 140px))', maxHeight: 'calc(100vh - 90px)' }}>

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
              <p className="text-slate-400 text-xs truncate mb-2">{accountInfo.email}</p>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-700 w-fit">
                <span className="text-[10px] text-slate-400 uppercase tracking-tighter">Region:</span>
                <span className="text-[10px] text-sky-400 font-bold uppercase">
                  {(accountInfo as any).region || 'US (.com)'}
                </span>
              </div>
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
            /* Compose Flow — scrollable form + sticky action bar */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Scrollable form area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="w-full max-w-2xl mx-auto bg-slate-900/60 rounded-3xl border border-slate-800 p-5 sm:p-8 shadow-2xl">
                  <h3 className="text-white font-bold text-lg mb-6 flex items-center gap-3">
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

                    <div className="flex flex-col gap-1.5" ref={contactPickerRef}>
                      <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold ml-1">To</label>
                      <div className="relative">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={composeData.to}
                            onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                            placeholder="recipient@example.com or pick from contacts"
                            className="flex-1 bg-slate-800/50 text-white text-sm rounded-xl px-4 py-2.5 outline-none border border-slate-700 focus:border-sky-500/50 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => { setContactSearch(''); setShowContactPicker(v => !v); }}
                            title="Pick from client directory"
                            className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-xs font-medium rounded-xl transition-colors border border-slate-600"
                          >
                            <Users className="w-3.5 h-3.5" />
                            Contacts
                          </button>
                        </div>

                        {showContactPicker && (
                          <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                            <div className="p-2 border-b border-slate-700">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                                <input
                                  autoFocus
                                  type="text"
                                  value={contactSearch}
                                  onChange={(e) => setContactSearch(e.target.value)}
                                  placeholder="Search clients..."
                                  className="w-full bg-slate-900 text-white text-xs rounded-lg pl-8 pr-3 py-2 outline-none border border-slate-700 focus:border-sky-500/50 transition-all"
                                />
                              </div>
                            </div>
                            <div className="max-h-48 overflow-y-auto">
                              {filteredContacts.length === 0 ? (
                                <p className="text-slate-500 text-xs text-center py-4">No clients with email found</p>
                              ) : filteredContacts.map(contact => (
                                <button
                                  key={contact.id}
                                  type="button"
                                  onClick={() => {
                                    setComposeData(prev => ({ ...prev, to: contact.email || '' }));
                                    setShowContactPicker(false);
                                    setContactSearch('');
                                  }}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-700 transition-colors"
                                >
                                  <div className="w-7 h-7 rounded-full bg-sky-600/30 border border-sky-500/20 flex items-center justify-center shrink-0">
                                    <User className="w-3.5 h-3.5 text-sky-400" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-white text-xs font-medium truncate">{contact.name}</p>
                                    <p className="text-slate-400 text-[10px] truncate">{contact.email}</p>
                                  </div>
                                  <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded-md font-medium shrink-0 ${
                                    contact.salesStage === 'customer' ? 'bg-emerald-500/20 text-emerald-400' :
                                    contact.salesStage === 'lead' ? 'bg-amber-500/20 text-amber-400' :
                                    'bg-sky-500/20 text-sky-400'
                                  }`}>{contact.salesStage}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
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
                        className="w-full bg-slate-800/50 text-white text-sm rounded-xl px-4 py-3 outline-none border border-slate-700 focus:border-sky-500/50 transition-all min-h-[180px] sm:min-h-[250px] resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
              {/* Sticky action bar — always visible */}
              <div className="shrink-0 flex items-center justify-between px-5 py-4 border-t border-slate-800 bg-slate-900/80 backdrop-blur-sm">
                <button
                  onClick={() => { resetCompose(); setActiveFolder('inbox'); setSelectedMessage(null); }}
                  className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Discard
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={saveDraft}
                    disabled={sendingEmail}
                    className="px-4 py-2.5 text-sm text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                  >
                    Save Draft
                  </button>
                  <button
                    onClick={sendEmail}
                    disabled={sendingEmail}
                    className="flex items-center gap-2 px-6 sm:px-8 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-sm font-bold rounded-xl transition-all shadow-xl shadow-sky-500/20 disabled:opacity-50"
                  >
                    {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {sendingEmail ? 'Sending...' : composeMode === 'reply' ? 'Send Reply' : composeMode === 'forward' ? 'Send Forward' : 'Send Email'}
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
                        onClick={() => {
                          setSelectedMessage(msg);
                          if (!msg.flagged && activeFolder !== 'starred') {
                            fetch(`/api/zoho`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                action: 'update_message',
                                data: {
                                  messageId: msg.messageId,
                                  mode: 'markAsRead'
                                }
                              })
                            }).catch(() => null);
                          }
                        }}
                        className={`w-full text-left px-5 py-4 border-b border-slate-800/40 hover:bg-slate-800/30 transition-all relative ${selectedMessage?.messageId === msg.messageId ? 'bg-slate-800/60' : ''}`}
                      >
                        {selectedMessage?.messageId === msg.messageId && <div className="absolute left-0 top-0 bottom-0 w-1 bg-sky-500" />}
                        <div className="flex justify-between items-start mb-1.5">
                          <span className="text-sm font-bold text-white truncate max-w-[180px]">{msg.fromAddress || msg.toAddress}</span>
                          <span className="text-[10px] text-slate-500 uppercase tracking-tighter shrink-0">{formatDate(msg.receivedTime || msg.sentDateInGMT)}</span>
                        </div>
                        <p className={`text-xs truncate ${selectedMessage?.messageId === msg.messageId ? 'text-sky-300' : 'text-slate-300'} font-medium`}>{msg.subject || '(No Subject)'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {msg.flagged && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                          <p className="text-[11px] text-slate-500 truncate leading-relaxed opacity-80">{msg.summary}</p>
                        </div>
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
                            setComposeMode('reply');
                            setComposeMessageId(selectedMessage.messageId);
                            setActiveFolder('compose');
                          }}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Reply className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setComposeData({
                              from: accountInfo?.fromAddresses?.find(a => a.isDefault)?.address || accountInfo?.email || '',
                              to: '',
                              cc: '',
                              subject: `Fwd: ${selectedMessage.subject}`,
                              body: `\n\n--- Forwarded Message ---\nFrom: ${selectedMessage.fromAddress}\nSubject: ${selectedMessage.subject}\n\n${selectedMessage.content || selectedMessage.summary || ''}`
                            });
                            setComposeMode('forward');
                            setComposeMessageId(selectedMessage.messageId);
                            setActiveFolder('compose');
                          }}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Forward className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleStar(selectedMessage)}
                          className={`p-2 hover:bg-slate-800 rounded-lg transition-colors ${selectedMessage.flagged ? 'text-amber-400' : 'text-slate-400 hover:text-amber-400'}`}
                        >
                          <Star className={`w-4 h-4 ${selectedMessage.flagged ? 'fill-amber-400' : ''}`} />
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
