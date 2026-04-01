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
  const [filterQuery, setFilterQuery] = useState('');
  const [progress, setProgress] = useState({ step: 1, percent: 0, message: '' });

  // Filtered results
  const filteredResults = results.filter(lead => 
    lead.business_name.toLowerCase().includes(filterQuery.toLowerCase()) ||
    lead.website.toLowerCase().includes(filterQuery.toLowerCase()) ||
    (lead.emails?.[0] || '').toLowerCase().includes(filterQuery.toLowerCase())
  );

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
        body: JSON.stringify({ query, usePlaywright })
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
    <div className="w-full space-y-4">
      <div className="flex flex-col justify-between items-start lg:flex-row lg:items-center p-4 bg-gradient-to-r from-teal-900/40 via-slate-900/40 to-slate-900/80 rounded-xl border border-teal-500/20 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        <div className="space-y-1 z-10 lg:pr-6">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-300 text-[10px] font-semibold tracking-wider uppercase mb-0.5">
            <Zap className="w-2.5 h-2.5 fill-current" /> Enterprise Engine
          </div>
          <h1 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-teal-200 to-emerald-300 tracking-tight">
            AlphaClone Business Lead
          </h1>
          <p className="text-slate-400 max-w-md text-xs font-light leading-relaxed">
            Universal acquisition engine. {usePlaywright ? 'Power Mode active: Browser clusters deployed.' : 'Standard Mode: Optimized for speed.'}
          </p>
        </div>

        <form onSubmit={handleSearch} className="mt-4 lg:mt-0 w-full lg:w-auto z-10 flex flex-col gap-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input 
              type="text" 
              placeholder="Industry (e.g. HVAC)" 
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-900/80 border border-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 outline-none text-white transition-all shadow-inner w-full md:w-48"
              disabled={scanning}
            />
            <input 
              type="text" 
              placeholder="City (e.g. Miami)" 
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-900/80 border border-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 outline-none text-white transition-all shadow-inner w-full md:w-48"
              disabled={scanning}
            />
          </div>

          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 cursor-pointer group" onClick={() => !scanning && setUsePlaywright(!usePlaywright)}>
              <div className={`w-7 h-3.5 rounded-full transition-colors relative ${usePlaywright ? 'bg-teal-500' : 'bg-slate-700'}`}>
                <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-transform ${usePlaywright ? 'left-4' : 'left-0.5'}`} />
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-widest ${usePlaywright ? 'text-teal-400' : 'text-slate-500'}`}>
                Power Mode
              </span>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={scanning || !niche}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 mt-0.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-medium text-xs rounded-lg transition-all shadow-lg disabled:opacity-50"
          >
            {scanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
            {scanning ? 'Scaling...' : 'Deploy Universal Engine'}
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
            className="p-3 bg-slate-900/50 rounded-lg border border-slate-800 backdrop-blur-sm overflow-hidden"
          >
            <div className="flex justify-between text-[10px] mb-1.5">
              <span className="text-teal-300 font-mono flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" /> 
                {progress.message}
              </span>
              <span className="text-white font-mono font-bold">{progress.percent}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden shadow-inner flex">
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

      {/* Filtering and Status Row */}
      {results.length > 0 && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 bg-slate-900/40 rounded-lg border border-slate-800">
           <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input 
                type="text"
                placeholder="Filter results..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950/50 border border-slate-800 rounded-lg text-xs text-slate-200 focus:ring-2 focus:ring-teal-500/30 outline-none transition-all"
              />
           </div>
           <div className="flex items-center gap-3 text-[10px] font-medium text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                Found: {results.length}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Filtered: {filteredResults.length}
              </div>
           </div>
        </div>
      )}

      {/* Results Grid */}
      {filteredResults.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredResults.map((lead, idx) => {
            const domain = getHostname(lead.website);
            return (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="group bg-slate-900/60 border border-slate-800 rounded-lg p-3.5 hover:border-teal-500/50 hover:bg-slate-800/80 transition-all duration-300 shadow-md hover:shadow-teal-500/10 flex flex-col"
              >
                <div className="flex justify-between items-start mb-2.5">
                  <div className="flex items-start gap-2.5">
                    <div className="border border-slate-700 group-hover:border-teal-400 transition-colors rounded-lg p-0.5 bg-slate-800 flex-shrink-0">
                      <Avatar 
                        name={lead.business_name}
                        size={32}
                        shape="rounded"
                        className="rounded-md"
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-white font-semibold text-sm leading-tight truncate group-hover:text-teal-300 transition-colors">{lead.business_name}</h3>
                      {domain && (
                        <a href={lead.website} target="_blank" rel="noreferrer" className="text-slate-400 text-[10px] hover:text-white flex items-center gap-1 mt-0.5 transition-colors">
                          <Globe className="w-2.5 h-2.5" /> {domain}
                        </a>
                      )}
                    </div>
                  </div>
                  {/* Status Indicator */}
                  {lead.status === 'crawling' && <RefreshCw className="w-3.5 h-3.5 text-teal-400 animate-spin" />}
                  {lead.status === 'success' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] mt-1" />}
                </div>

                <div className="flex-grow space-y-2 mt-1 py-2 border-t border-slate-800/50 relative">
                  
                  {/* Simulated Crawl Overlay text if crawling */}
                  {lead.status === 'crawling' && (
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[1px] flex items-center justify-center rounded-md z-10">
                       <span className="text-[9px] text-teal-300 font-mono animate-pulse bg-slate-800/80 px-2 py-0.5 rounded-full border border-teal-500/30">Extracting...</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-slate-500" />
                    <div className="flex-1 overflow-hidden">
                      {lead.emails && lead.emails.length > 0 ? (
                        <div className="text-[10px] font-medium text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded w-fit border border-emerald-400/20 truncate">{lead.emails[0]}</div>
                      ) : (
                        <span className="text-[10px] text-slate-600 line-through">Encrypted</span>
                      )}
                    </div>
                  </div>
                
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-slate-500" />
                    <div className="flex-1 text-[10px] text-slate-300 truncate">
                      {lead.phone ? lead.phone : <span className="text-slate-600">Not detected</span>}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => handleSaveToCRM(lead)}
                  disabled={lead.status !== 'success'}
                  className="w-full mt-2.5 flex items-center justify-center gap-1.5 py-1.5 hover:bg-teal-600/30 text-teal-400 hover:text-teal-300 font-medium text-[11px] rounded-lg border border-teal-500/20 hover:border-teal-500/50 transition-all group/btn disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5 group-hover/btn:scale-125 transition-transform" /> Sync CRM
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
