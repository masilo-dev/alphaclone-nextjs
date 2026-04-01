'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Database, Zap, Globe, Mail, Phone, ExternalLink, Plus, RefreshCw, Briefcase, Tag } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import toast from 'react-hot-toast';
import { Avatar } from '../ui/Avatar';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { businessClientService } from '../../services/businessClientService';

interface ScrapedLead {
  business_name: string;
  website: string;
  snippet?: string;
  emails?: string[];
  phone?: string;
  social_links?: any;
  status: 'pending' | 'crawling' | 'success' | 'failed';
}

export default function OmniLeadFinder() {
  const [niche, setNiche] = useState('');
  const [location, setLocation] = useState('');
  const [size, setSize] = useState('');
  const [keywords, setKeywords] = useState('');
  const [usePlaywright, setUsePlaywright] = useState(false);
  const [scanning, setScanning] = useState(false);
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [results, setResults] = useState<ScrapedLead[]>([]);
  const [progress, setProgress] = useState({ step: 1, percent: 0, message: '' });

  const getHostname = (url: string) => {
    try {
      const hostname = new URL(url).hostname;
      return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
    } catch (e) {
      return url;
    }
  };

  const handleSaveToCRM = async (lead: ScrapedLead) => {
    if (!currentTenant) return toast.error('No active business context found');
    
    const toastId = toast.loading(`Syncing ${lead.business_name} to CRM...`);
    
    try {
      const { error } = await businessClientService.createClient(currentTenant.id, {
        name: lead.business_name,
        email: lead.emails?.[0] || '',
        phone: lead.phone || '',
        website: lead.website,
        salesStage: 'lead',
        industry: niche,
        description: lead.snippet || 'Lead captured via Omni Search'
      });

      if (error) throw new Error(error);
      
      toast.success('Lead synchronized successfully!', { id: toastId });
    } catch (error: any) {
      toast.error(error.message || 'Failed to save lead', { id: toastId });
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche) return toast.error('Please enter an industry or niche');

    setScanning(true);
    setResults([]);
    setProgress({ step: 1, percent: 10, message: 'Initiating global acquisition engine...' });

    try {
      // Step 1: Search directories & index
      const query = `${niche}${location ? ` in ${location}` : ''}${size ? ` ${size}` : ''}${keywords ? ` ${keywords}` : ''}`.trim();

      setProgress({ step: 1, percent: 30, message: `Deploying scanners for ${niche}...` });
      
      const searchRes = await fetch('/api/scraper/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      
      const searchData = await searchRes.json();
      
      if (!searchData.success || !searchData.results?.length) {
        throw new Error(searchData.error || 'Search engine returned zero matches.');
      }

      const initialLeads: ScrapedLead[] = searchData.results.map((r: any) => ({
        ...r, status: 'pending'
      }));
      setResults(initialLeads);

      // Step 2: Deep Crawl
      setProgress({ step: 2, percent: 60, message: 'Extracting deep-web contact structures...' });
      
      const enhancedLeads = [...initialLeads];
      
      for (let i = 0; i < enhancedLeads.length; i += 3) {
        const batch = enhancedLeads.slice(i, i + 3);
        
        await Promise.all(batch.map(async (lead, batchIndex) => {
          const actualIndex = i + batchIndex;
          enhancedLeads[actualIndex].status = 'crawling';
          setResults([...enhancedLeads]);
          
          try {
            const crawlRes = await fetch('/api/scraper/deep-crawl', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: lead.website, usePlaywright })
            });
            const crawlData = await crawlRes.json();
            
            enhancedLeads[actualIndex].emails = crawlData.emails || [];
            enhancedLeads[actualIndex].phone = crawlData.phone || '';
            enhancedLeads[actualIndex].social_links = crawlData.social_links || {};
            enhancedLeads[actualIndex].status = 'success';
          } catch (e) {
            enhancedLeads[actualIndex].status = 'failed';
          }
        }));
        setResults([...enhancedLeads]);
      }

      setProgress({ step: 3, percent: 100, message: 'Analysis Complete' });
      toast.success(`Extracted ${enhancedLeads.length} leads!`);
    } catch (error: any) {
      toast.error(error.message || 'Scraping anomaly detected.');
    } finally {
      setTimeout(() => setScanning(false), 1000);
    }
  };


  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col justify-between items-start lg:flex-row lg:items-center p-6 bg-gradient-to-r from-teal-900/40 via-slate-900/40 to-slate-900/80 rounded-2xl border border-teal-500/20 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        <div className="space-y-2 z-10 lg:pr-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-300 text-xs font-semibold tracking-wider uppercase mb-1">
            <Zap className="w-3 h-3 fill-current" /> Enterprise Engine
          </div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-teal-200 to-emerald-300 tracking-tight">
            AlphaClone Business Lead
          </h1>
          <p className="text-slate-400 max-w-lg text-sm font-light leading-relaxed">
            Universal business acquisition engine. {usePlaywright ? 'Power Mode active: Deploying full browser clusters.' : 'Standard Mode active: Optimized for speed.'}
          </p>
        </div>

        <form onSubmit={handleSearch} className="mt-6 lg:mt-0 w-full lg:w-auto z-10 flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input 
              type="text" 
              placeholder="Industry (e.g. HVAC)" 
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-900/80 border border-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 outline-none text-white transition-all shadow-inner"
              disabled={scanning}
            />
            <input 
              type="text" 
              placeholder="City (e.g. Miami)" 
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-900/80 border border-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 outline-none text-white transition-all shadow-inner"
              disabled={scanning}
            />
          </div>

          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 cursor-pointer group" onClick={() => !scanning && setUsePlaywright(!usePlaywright)}>
              <div className={`w-8 h-4 rounded-full transition-colors relative ${usePlaywright ? 'bg-teal-500' : 'bg-slate-700'}`}>
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${usePlaywright ? 'left-4.5' : 'left-0.5'}`} />
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${usePlaywright ? 'text-teal-400' : 'text-slate-500'}`}>
                Power Mode (Playwright)
              </span>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={scanning || !niche}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 mt-1 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-medium text-sm rounded-lg transition-all shadow-[0_0_15px_rgba(20,184,166,0.3)] disabled:opacity-50"
          >
            {scanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            {scanning ? 'Scaling Acquisition...' : 'Deploy Universal Business Engine'}
          </button>
        </form>
      </div>

      {/* Progress Monitor */}
      <AnimatePresence>
        {scanning && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-5 bg-slate-900/50 rounded-xl border border-slate-800 backdrop-blur-sm overflow-hidden"
          >
            <div className="flex justify-between text-sm mb-2">
              <span className="text-teal-300 font-mono flex items-center gap-2 text-xs">
                <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" /> 
                {progress.message}
              </span>
              <span className="text-white font-mono font-bold text-xs">{progress.percent}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden shadow-inner flex">
              <motion.div 
                className="bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 h-full rounded-full relative"
                initial={{ width: 0 }}
                animate={{ width: `${progress.percent}%` }}
                transition={{ duration: 0.5 }}
              >
                <div className="absolute top-0 right-0 bottom-0 left-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[stripes_1s_linear_infinite]" />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Grid */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((lead, idx) => {
            const domain = getHostname(lead.website);
            return (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="group bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-teal-500/50 hover:bg-slate-800/80 transition-all duration-300 shadow-md hover:shadow-teal-500/10 flex flex-col"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-start gap-3">
                    <div className="border border-slate-700 group-hover:border-teal-400 transition-colors rounded-lg p-0.5 bg-slate-800">
                      <Avatar 
                        name={lead.business_name}
                        size={36}
                        shape="rounded"
                        className="rounded-md"
                      />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold text-base leading-tight line-clamp-1 group-hover:text-teal-300 transition-colors">{lead.business_name}</h3>
                      {domain && (
                        <a href={lead.website} target="_blank" rel="noreferrer" className="text-slate-400 text-xs hover:text-white flex items-center gap-1 mt-1 transition-colors">
                          <Globe className="w-3 h-3" /> {domain} <ExternalLink className="w-3 h-3 opacity-50" />
                        </a>
                      )}
                    </div>
                  </div>
                  {/* Status Indicator */}
                  {lead.status === 'crawling' && <RefreshCw className="w-4 h-4 text-teal-400 animate-spin" />}
                  {lead.status === 'success' && <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />}
                </div>

                <div className="flex-grow space-y-2.5 mt-2 py-3 border-t border-slate-800/50 relative">
                  
                  {/* Simulated Crawl Overlay text if crawling */}
                  {lead.status === 'crawling' && (
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center rounded-md z-10">
                       <span className="text-xs text-teal-300 font-mono animate-pulse bg-slate-800/80 px-2 py-1 rounded-full border border-teal-500/30">Extracting DOM node...</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <div className="flex-1">
                    {lead.emails && lead.emails.length > 0 ? (
                      <div className="text-sm font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded w-fit border border-emerald-400/20">{lead.emails[0]}</div>
                    ) : (
                      <span className="text-sm text-slate-600 line-through">Hidden or encrypted</span>
                    )}
                  </div>
                </div>
                
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <div className="flex-1 text-xs text-slate-300">
                      {lead.phone ? lead.phone : <span className="text-slate-600">Not detected in HTML header</span>}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => handleSaveToCRM(lead)}
                  disabled={lead.status !== 'success'}
                  className="w-full mt-3 flex items-center justify-center gap-1.5 py-2 hover:bg-teal-600/30 text-teal-400 hover:text-teal-300 font-medium text-sm rounded-lg border border-teal-500/20 hover:border-teal-500/50 transition-all group/btn disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4 group-hover/btn:scale-125 transition-transform" /> Save to Pipeline
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
