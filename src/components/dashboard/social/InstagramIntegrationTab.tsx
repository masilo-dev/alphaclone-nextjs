'use client';

<<<<<<< HEAD
import React, { useCallback, useEffect, useState } from 'react';
import { Instagram, Link2, MessageCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { WORKSPACE } from '@/constants/design';

interface InstagramIntegrationRow {
  id: string;
  instagram_account_id: string;
  username: string | null;
  is_active: boolean;
  created_at: string;
}

export default function InstagramIntegrationTab() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<InstagramIntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('instagram_integrations')
      .select('id, instagram_account_id, username, is_active, created_at')
      .eq('tenant_id', currentTenant.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Instagram] load failed:', error);
      toast.error('Failed to load Instagram connections');
      setIntegrations([]);
    } else {
      setIntegrations((data as InstagramIntegrationRow[]) || []);
    }
    setLoading(false);
  }, [currentTenant?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleConnect = () => {
    if (!user?.id) {
      toast.error('Sign in to connect Instagram');
      return;
    }
    const tenantParam = currentTenant?.id ? `&tenant_id=${encodeURIComponent(currentTenant.id)}` : '';
    window.location.href = `/api/auth/instagram/connect${tenantParam}`;
  };

  const isConnected = integrations.some((i) => i.is_active);

  return (
    <div className="relative flex flex-col min-h-0 ac-scroll-full ac-enterprise-module max-w-4xl mx-auto p-4 ac-safe-bottom lg:pb-4">
      <div className={`${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} p-8`}>
        <div className="flex items-start gap-4 mb-6">
          <div className="w-14 h-14 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
            <Instagram className="w-7 h-7 text-pink-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Instagram Business</h1>
            <p className="text-slate-400 text-sm mt-1">
              Connect your Instagram Business account for direct messages and publishing through the Meta Graph API.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-slate-400 py-8">
            <RefreshCw className="w-5 h-5 animate-spin" />
            Loading connections...
          </div>
        ) : isConnected ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-300 text-sm font-medium">
              Connected. Instagram direct messages are handled in the Facebook Inbox.
            </div>
            <ul className="space-y-2">
              {integrations.filter((i) => i.is_active).map((ig) => (
                <li
                  key={ig.id}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3"
                >
                  <span className="text-white font-medium">
                    @{ig.username || ig.instagram_account_id}
                  </span>
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Active</span>
                </li>
              ))}
            </ul>
            <Link
              href="/dashboard/business/facebook"
              className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Open Facebook and Instagram Inbox
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">
              Link a Facebook Page with an Instagram Business account. After authorization, inbound DMs appear in the unified inbox.
            </p>
            <button
              type="button"
              onClick={handleConnect}
              className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold transition-colors"
            >
              <Link2 className="w-5 h-5" />
              Connect Instagram Business
            </button>
          </div>
        )}
=======
import React, { useState } from 'react';
import {
  Instagram, Sparkles, Send, Bell, CheckCircle2, MessageSquare, ShieldAlert,
  ArrowRight, Heart, BrainCircuit, Zap, BarChart3, HelpCircle, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function InstagramIntegrationTab() {
  const [subscribed, setSubscribed] = useState(false);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [simQuery, setSimQuery] = useState('');
  const [simResponse, setSimResponse] = useState('');
  const [simulating, setSimulating] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubscribed(true);
      toast.success('Awesome! We will notify you as soon as Instagram Suite goes live.', {
        icon: '🚀',
        duration: 4000
      });
    }, 1000);
  };

  const handleSimulate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simQuery.trim()) return;
    setSimulating(true);
    setSimResponse('');
    
    // Simulate AI thinking and typing
    setTimeout(() => {
      const query = simQuery.toLowerCase();
      let reply = "Hi there! Thanks for reaching out. Our team is online and will get back to you shortly. You can also view our website at alphaclone.com for more info!";
      
      if (query.includes('pricing') || query.includes('cost') || query.includes('plan') || query.includes('much')) {
        reply = "Hey! Our business dashboard plan is only $15/month. It includes all of our AI agents, workflows, and integrations! You can start a free trial at alphaclone.com.";
      } else if (query.includes('hello') || query.includes('hi') || query.includes('hey')) {
        reply = "Hello! 👋 Welcome to AlphaClone. How can our AI assistant help you grow your business today?";
      } else if (query.includes('meet') || query.includes('call') || query.includes('schedule') || query.includes('demo')) {
        reply = "Sure! You can book a quick 1-on-1 demo call with our lead strategist at alphaclone.com/meet. We'd love to chat!";
      } else if (query.includes('work') || query.includes('feature') || query.includes('what is')) {
        reply = "AlphaClone is an AI-powered Business OS that consolidates CRM, Deals, Campaigns, Accounting, and Social outreach in one simple unified workspace.";
      }

      setSimulating(false);
      setSimResponse(reply);
      toast.success('Instagram AI responder executed.', {
        icon: '🤖',
      });
    }, 1200);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      
      {/* Visual Glass Header */}
      <div className="relative overflow-hidden bg-gradient-to-tr from-purple-900/40 via-pink-900/25 to-yellow-900/10 border border-pink-500/20 rounded-3xl p-8 md:p-12 shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-10 blur-[1px]">
          <Instagram className="w-48 h-48 text-pink-500 animate-pulse duration-[8s]" />
        </div>
        
        <div className="relative z-10 space-y-6 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/30 text-xs font-black text-pink-400 uppercase tracking-widest animate-bounce">
            <Sparkles className="w-3 h-3" /> Coming Soon
          </div>
          
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
            Instagram <span className="bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-400 bg-clip-text text-transparent">AI Suite</span>
          </h1>
          
          <p className="text-slate-300 text-base md:text-lg leading-relaxed">
            Automate your Instagram presence with autonomous AI agents. Generate stunning visual content, schedule posts, and deploy an auto-responder that converts direct messages into leads instantly.
          </p>

          {!subscribed ? (
            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3 pt-2">
              <input
                type="email"
                placeholder="Enter your email to request beta access"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="px-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-all flex-1"
              />
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                Notify Me
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <div className="text-sm font-bold">You are on the VIP early-access list! We will update you soon.</div>
            </div>
          )}
        </div>
      </div>

      {/* Core Upcoming Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            icon: <BrainCircuit className="w-6 h-6 text-pink-400" />,
            title: 'AI Auto-Responder',
            desc: 'Engage with customers, answer product queries, and capture CRM leads 24/7 inside your DMs automatically.',
          },
          {
            icon: <Zap className="w-6 h-6 text-yellow-400" />,
            title: 'Reels Content Copilot',
            desc: 'Generate viral video hooks, draft scripts, and plan your visual grid layout tailored to your target niche.',
          },
          {
            icon: <BarChart3 className="w-6 h-6 text-purple-400" />,
            title: 'Growth Analytics',
            desc: 'Track reach, engagement momentum, and DM conversion funnels with advanced charts and actionable advice.',
          }
        ].map((feature, i) => (
          <div key={i} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all space-y-3">
            <div className="w-12 h-12 bg-slate-950 rounded-xl flex items-center justify-center border border-slate-800">
              {feature.icon}
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">{feature.title}</h3>
            <p className="text-slate-400 text-xs leading-relaxed">{feature.desc}</p>
          </div>
        ))}
      </div>

      {/* Live AI Simulation Sandbox */}
      <div className="bg-slate-900/30 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-pink-500/10 border border-pink-500/20 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-pink-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Try the Instagram DM Agent (Interactive Draft)</h3>
            <p className="text-slate-500 text-xs">Simulate how the AI auto-responder will converse with prospective buyers on your behalf.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Chat Simulator Input */}
          <form onSubmit={handleSimulate} className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Customer DM Input</span>
            
            <div className="space-y-3">
              <input
                type="text"
                value={simQuery}
                onChange={(e) => setSimQuery(e.target.value)}
                placeholder="Ask e.g. 'What is the pricing?', 'How do I start?'"
                className="w-full h-11 bg-slate-900 border border-slate-800 rounded-xl px-4 text-xs text-white placeholder-slate-600 outline-none focus:border-pink-500/40"
              />
              
              {/* Quick suggestion tags */}
              <div className="flex flex-wrap gap-2">
                {['What is the pricing?', 'Schedule a demo call', 'How does it work?'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSimQuery(tag)}
                    className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-[10px] text-slate-400 hover:text-white transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={simulating || !simQuery.trim()}
              className="w-full py-2.5 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {simulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Send Simulated Message
            </button>
          </form>

          {/* Interactive Screen Preview */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[260px]">
            {/* Mock Instagram DM Bar */}
            <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[1.5px]">
                <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
                  <Instagram className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
              <div>
                <span className="text-[11px] font-bold text-white block">AlphaClone AI Assistant</span>
                <span className="text-[9px] text-green-400 font-bold uppercase tracking-wider">Active Responder</span>
              </div>
            </div>

            {/* DM Screen Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 flex flex-col justify-end">
              {simQuery && (
                <div className="self-end bg-pink-600 text-white px-3.5 py-2 rounded-2xl rounded-tr-sm text-xs max-w-[80%] animate-in slide-in-from-right-2 duration-300">
                  {simQuery}
                </div>
              )}
              
              {simulating && (
                <div className="self-start bg-slate-900 text-slate-300 px-3.5 py-2 rounded-2xl rounded-tl-sm text-xs flex items-center gap-2 border border-slate-800">
                  <Loader2 className="w-3 h-3 animate-spin text-pink-400" />
                  <span>AI Agent is typing...</span>
                </div>
              )}

              {simResponse && !simulating && (
                <div className="self-start bg-slate-900 text-slate-200 px-3.5 py-2 rounded-2xl rounded-tl-sm text-xs max-w-[80%] border border-slate-800 animate-in slide-in-from-left-2 duration-300">
                  {simResponse}
                </div>
              )}

              {!simQuery && !simResponse && !simulating && (
                <div className="text-center text-slate-600 text-[11px] italic py-8">
                  Type a customer message on the left to test the auto-reply capability.
                </div>
              )}
            </div>
          </div>
        </div>
>>>>>>> origin/main
      </div>
    </div>
  );
}
