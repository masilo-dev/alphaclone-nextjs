'use client';

<<<<<<< HEAD
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Twitter, Link2, RefreshCw, Send, Loader2 } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { WORKSPACE } from '@/constants/design';

interface XIntegrationRow {
  id: string;
  x_username: string;
  x_user_id: string;
  created_at: string;
}

export default function XIntegrationTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentTenant } = useTenant();
  const [integration, setIntegration] = useState<XIntegrationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [postText, setPostText] = useState('');
  const [posting, setPosting] = useState(false);
  const [tweets, setTweets] = useState<Array<{ id: string; text: string }>>([]);
  const [loadingTweets, setLoadingTweets] = useState(false);
  const [creditsDepleted, setCreditsDepleted] = useState(false);
  const connectedAt = integration?.created_at ? new Date(integration.created_at) : null;
  const remainingChars = 280 - postText.length;

  const loadIntegration = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('x_integrations')
      .select('id, x_username, x_user_id, created_at')
      .eq('tenant_id', currentTenant.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('[X] load failed:', error);
      toast.error('Failed to load X connection');
    }
    setIntegration((data as XIntegrationRow) || null);
    setLoading(false);
  }, [currentTenant?.id]);

  const loadTweets = useCallback(async () => {
    if (!currentTenant?.id || !integration) return;
    setLoadingTweets(true);
    try {
      const res = await fetch(`/api/x/tweets?tenantId=${encodeURIComponent(currentTenant.id)}`);
      const payload = await res.json();
      if (payload.creditsDepleted) {
        setCreditsDepleted(true);
        setTweets([]);
        return;
      }
      setCreditsDepleted(false);
      if (!res.ok || !payload.success) {
        setTweets([]);
        toast.error(payload.error || 'Failed to load posts');
        return;
      }
      const items = payload.data?.data || [];
      setTweets(
        items.map((t: { id: string; text: string }) => ({
          id: t.id,
          text: t.text || '',
        }))
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load timeline';
      toast.error(message);
    } finally {
      setLoadingTweets(false);
    }
  }, [currentTenant?.id, integration]);

  useEffect(() => {
    loadIntegration();
  }, [loadIntegration]);

  useEffect(() => {
    if (integration) loadTweets();
  }, [integration, loadTweets]);

  useEffect(() => {
    const connected = searchParams?.get('x_connected');
    const err = searchParams?.get('x_error');
    if (connected === '1') {
      toast.success('X account connected');
      loadIntegration();
    } else if (err) {
      toast.error(`X connection failed: ${err.replace(/_/g, ' ')}`);
    }
  }, [searchParams, loadIntegration]);

  const handleConnect = () => {
    const tenantId = currentTenant?.id ? `?tenantId=${encodeURIComponent(currentTenant.id)}` : '';
    router.push(`/api/auth/x${tenantId}`);
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenant?.id || !postText.trim()) return;
    setPosting(true);
    try {
      const res = await fetch('/api/x/tweets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: currentTenant.id, text: postText.trim() }),
      });
      const payload = await res.json();
      if (payload.creditsDepleted) {
        setCreditsDepleted(true);
        toast.error(payload.error || 'X API credits depleted');
        return;
      }
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || 'Post failed');
      }
      toast.success('Posted to X');
      setPostText('');
      await loadTweets();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to post';
      toast.error(message);
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return (
      <div className="relative flex flex-col min-h-0 ac-scroll-full ac-enterprise-module max-w-5xl mx-auto p-4 ac-safe-bottom lg:pb-4 space-y-6">
        <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 min-h-[320px] flex items-center justify-center">
          <div className="flex items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Loading X workspace...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!integration) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className={`${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} p-10 text-center`}>
          <Twitter className="w-12 h-12 text-sky-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Connect X (Twitter)</h1>
          <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
            Authorize your X account to publish posts and read public profile data from your workspace.
          </p>
          <div className="inline-flex flex-wrap items-center justify-center gap-2 mb-6">
            <span className="px-3 py-1 rounded-full border border-slate-700 bg-slate-950 text-xs text-slate-300">Posting access</span>
            <span className="px-3 py-1 rounded-full border border-slate-700 bg-slate-950 text-xs text-slate-300">Public profile data</span>
            <span className="px-3 py-1 rounded-full border border-slate-700 bg-slate-950 text-xs text-slate-300">No DMs</span>
          </div>
          <button
            type="button"
            onClick={handleConnect}
            className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold"
          >
            <Link2 className="w-5 h-5" />
            Connect X Account
          </button>
          <p className="text-slate-500 text-xs mt-4 max-w-md mx-auto">
            The connection requests the minimum permissions needed for posting, reading public account data, and keeping your session active.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col min-h-0 ac-scroll-full ac-enterprise-module max-w-5xl mx-auto p-4 ac-safe-bottom lg:pb-4 space-y-6">
      <div className={`${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} p-6`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
              <Twitter className="w-6 h-6 text-sky-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold text-white truncate">@{integration.x_username}</h1>
              <p className="text-slate-400 text-sm">
                Connected {connectedAt ? `since ${connectedAt.toLocaleDateString()}` : 'to post and read your timeline'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadTweets}
              disabled={loadingTweets}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-900 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingTweets ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleConnect}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold"
            >
              <Link2 className="w-4 h-4" />
              Reconnect
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className={`${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} p-4 shadow-none`}>
            <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Workspace</div>
            <div className="mt-1 text-sm text-slate-200 truncate">{currentTenant?.name || 'Current workspace'}</div>
          </div>
          <div className={`${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} p-4 shadow-none`}>
            <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Posts Loaded</div>
            <div className="mt-1 text-sm text-slate-200">{tweets.length}</div>
          </div>
          <div className={`${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} p-4 shadow-none`}>
            <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Account ID</div>
            <div className="mt-1 text-sm text-slate-200 truncate">{integration.x_user_id}</div>
          </div>
        </div>
      </div>

      {creditsDepleted && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Your X developer account has no API credits left. Timeline and posting are paused until you add credits at{' '}
          <a href="https://developer.x.com" target="_blank" rel="noopener noreferrer" className="underline font-semibold">
            developer.x.com
          </a>
          .
        </div>
      )}

      <form onSubmit={handlePost} className={`${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} p-5 space-y-4`}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-white">Compose</div>
          <div className={`text-xs font-semibold ${remainingChars < 20 ? 'text-amber-300' : 'text-slate-400'}`}>
            {remainingChars} left
          </div>
        </div>

        <textarea
          value={postText}
          onChange={(e) => setPostText(e.target.value)}
          placeholder="Write a post..."
          maxLength={280}
          rows={4}
          className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-white text-sm resize-none focus:outline-none focus:border-sky-500"
        />
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-sky-500"
              style={{ width: `${Math.min(100, (postText.length / 280) * 100)}%` }}
            />
          </div>
          <button
            type="submit"
            disabled={posting || !postText.trim()}
            className="inline-flex items-center gap-2 h-10 px-6 rounded-2xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-extrabold text-sm shrink-0"
          >
            {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Post
          </button>
        </div>
      </form>

      <div className={`${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} overflow-hidden`}>
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Recent posts
          </div>
          <div className="text-xs text-slate-500">
            {loadingTweets ? 'Loading…' : `${tweets.length} items`}
          </div>
        </div>
        {loadingTweets ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading...</div>
        ) : tweets.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No posts yet.</div>
        ) : (
          tweets.map((t) => (
            <div key={t.id} className="px-5 py-4 border-b border-slate-800 last:border-b-0">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                  <Twitter className="w-4 h-4 text-sky-400" />
                </div>
                <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{t.text}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
=======
import React, { useState } from 'react';
import { 
    Twitter, Sparkles, Send, Bell, CheckCircle2, MessageSquare, 
    Zap, Search, Activity, HelpCircle, Loader2, ArrowRight, Flame
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function XIntegrationTab() {
    const [subscribed, setSubscribed] = useState(false);
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    
    // Interactive Hook Generator state
    const [topic, setTopic] = useState('');
    const [hookOutput, setHookOutput] = useState('');
    const [generating, setGenerating] = useState(false);

    const handleSubscribe = (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;
        setSubmitting(true);
        setTimeout(() => {
            setSubmitting(false);
            setSubscribed(true);
            toast.success('Joined the X manager early access list!', {
                icon: '🐦',
                duration: 4000
            });
        }, 1000);
    };

    const handleGenerateHook = (e: React.FormEvent) => {
        e.preventDefault();
        if (!topic.trim()) return;
        setGenerating(true);
        setHookOutput('');

        setTimeout(() => {
            const term = topic.toLowerCase();
            let result = "We analyzed 10,000 viral threads. Here is the exact framework you need to scale your outreach: 🧵";

            if (term.includes('productivity') || term.includes('ai') || term.includes('tool')) {
                result = "Most founders use ChatGPT wrong. Here are 5 AI productivity tools that will save you 25+ hours a week (none of them are LLMs): 🧵";
            } else if (term.includes('saas') || term.includes('startup') || term.includes('build') || term.includes('indie')) {
                result = "I built a micro-SaaS in 7 days that generates $5,000/month. No venture capital, no huge team. Here is my step-by-step playbook: 🧵";
            } else if (term.includes('sales') || term.includes('marketing') || term.includes('deal') || term.includes('cold')) {
                result = "99% of cold outreach emails get deleted instantly. Here is the 3-step message template that closed $150k in deals last month: 🧵";
            } else if (term.includes('finance') || term.includes('money') || term.includes('crypto')) {
                result = "Trading time for money is a trap. Here are 4 digital assets you can build once and sell forever (even while you sleep): 🧵";
            }

            setGenerating(false);
            setHookOutput(result);
            toast.success('Viral tweet hook generated by AI', {
                icon: '🔥'
            });
        }, 1200);
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500 pb-20">
            {/* Header Card */}
            <div className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl p-8 md:p-12 shadow-2xl">
                <div className="absolute top-0 right-0 p-8 opacity-5 blur-[1px]">
                    <Twitter className="w-48 h-48 text-white animate-pulse duration-[8s]" />
                </div>
                
                <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
                    <div className="space-y-4 max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-xs font-black text-sky-400 uppercase tracking-widest animate-bounce">
                            <Sparkles className="w-3.5 h-3.5" /> Coming Soon
                        </div>
                        <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">X (Twitter) Autopilot</h2>
                        <p className="text-slate-400 text-sm md:text-base leading-relaxed">
                            Supercharge your social presence and lead hunting. Leverage state-of-the-art AI outreach to scan X conversations, write highly-engaging threads, and auto-reply to viral prompts.
                        </p>

                        {!subscribed ? (
                            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3 pt-2">
                                <input
                                    type="email"
                                    placeholder="Enter your email for beta invitation"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="px-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all flex-1"
                                />
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-3 bg-white text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4 text-slate-950" />}
                                    Notify Me
                                </button>
                            </form>
                        ) : (
                            <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
                                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                                <div className="text-sm font-bold">You are on the X beta access list!</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Core Capabilities */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Core Capabilities</h3>
                        <div className="space-y-4">
                            {[
                                { icon: <Search className="w-4 h-4" />, label: 'Lead Hunting', status: 'Ready' },
                                { icon: <MessageSquare className="w-4 h-4" />, label: 'Auto-DMs', status: 'Soon' },
                                { icon: <Zap className="w-4 h-4" />, label: 'Viral Thread Creator', status: 'Soon' },
                            ].map((cap, i) => (
                                <div key={i} className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <div className="text-sky-400">{cap.icon}</div>
                                        <span className="text-xs text-white font-medium">{cap.label}</span>
                                    </div>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase ${
                                        cap.status === 'Ready' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700/50'
                                    }`}>{cap.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Platform Sync</h3>
                            <Twitter className="w-3.5 h-3.5 text-slate-600" />
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                            <p className="text-xs text-slate-400">Syncing queue ready to configure</p>
                        </div>
                        <p className="text-[10px] text-slate-600 mt-2 uppercase font-bold">API STATUS: READY</p>
                    </div>
                </div>

                {/* Interactive Hook Creator */}
                <div className="lg:col-span-2">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 h-full flex flex-col justify-between">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Flame className="w-5 h-5 text-amber-500" />
                                <h3 className="text-sm font-black text-white uppercase tracking-widest">AI Viral Tweet Hook Generator</h3>
                            </div>
                            <p className="text-slate-400 text-xs">
                                Try a snippet of the AI Thread builder. Enter your topic below to generate a high-engagement hook for X.
                            </p>
                        </div>

                        <form onSubmit={handleGenerateHook} className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Topic or Niche</label>
                                <input
                                    type="text"
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    placeholder="e.g. 'productivity tools', 'saas growth', 'sales tips'"
                                    className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl px-4 text-xs text-white placeholder-slate-600 outline-none focus:border-sky-500/40"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={generating || !topic.trim()}
                                className="w-full py-3 bg-sky-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-sky-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                                Generate Hook
                            </button>
                        </form>

                        {/* Output visual console */}
                        <div className="mt-6 flex-1 min-h-[120px] bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-center">
                            {generating ? (
                                <div className="text-center text-slate-500 text-xs space-y-2">
                                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-sky-400" />
                                    <span>AI Agent is engineering hooks...</span>
                                </div>
                            ) : hookOutput ? (
                                <div className="space-y-3 animate-in fade-in duration-300">
                                    <span className="text-[9px] font-bold text-sky-400 uppercase tracking-widest block">AI-Generated Tweet Hook</span>
                                    <p className="text-xs text-white leading-relaxed font-mono bg-slate-900/60 p-3 rounded-lg border border-slate-800">{hookOutput}</p>
                                </div>
                            ) : (
                                <div className="text-center text-slate-600 text-[11px] italic">
                                    Generated tweet hook output will appear here.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
>>>>>>> origin/main
}
