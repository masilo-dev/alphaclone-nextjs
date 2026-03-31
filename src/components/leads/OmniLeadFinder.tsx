'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Database, Zap, Globe, Mail, Phone, ExternalLink, Plus, RefreshCw, XCircle } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import toast from 'react-hot-toast';

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
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ step: 1, percent: 0, message: '' });
  const [results, setResults] = useState<ScrapedLead[]>([]);
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche || !location) return toast.error('Please enter a niche and location');

    setScanning(true);
    setResults([]);
    setProgress({ step: 1, percent: 10, message: 'Initiating global directory scan...' });

    try {
      // Step 1: Search directories
      setProgress({ step: 1, percent: 30, message: `Accessing local indexes for ${niche} in ${location}...` });
      
      const searchRes = await fetch('/api/scraper/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `${niche} in ${location}` })
      });
      
      const searchData = await searchRes.json();
      
      if (!searchData.success || !searchData.results.length) {
        throw new Error('No businesses found. Try a broader search area.');
      }

      const initialLeads: ScrapedLead[] = searchData.results.map((r: any) => ({
        ...r, status: 'pending'
      }));
      setResults(initialLeads);

      // Step 2: Deep Crawl
      setProgress({ step: 2, percent: 60, message: 'Extracting deep-web contact structures...' });
      
      const enhancedLeads = [...initialLeads];
      
      // We crawl in parallel batches of 3 to be safe and fast
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
              body: JSON.stringify({ url: lead.website })
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
        setProgress({ 
          step: 2, 
          percent: 60 + Math.floor((i / enhancedLeads.length) * 40), 
          message: `Analyzing metadata... (${i + batch.length}/${enhancedLeads.length} leads extracted)` 
        });
      }

      setProgress({ step: 3, percent: 100, message: 'Analysis Complete' });
      toast.success(`Extracted ${enhancedLeads.length} potential leads!`);
    } catch (error: any) {
      toast.error(error.message || 'Scraping engine encountered an anomaly.');
    } finally {
      setTimeout(() => setScanning(false), 1000);
    }
  };

  const handleSaveToCRM = async (lead: ScrapedLead) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");

      // Extract tenant_id from user context if available, or fetch it.
      // Assuming a generic default flow for leads
      const { error } = await supabase.from('leads').insert({
        owner_id: user.id,
        business_name: lead.business_name,
        website: lead.website,
        email: lead.emails?.[0] || '',
        phone: lead.phone || '',
        industry: niche,
        location: location,
        source: 'OmniScraper Deep Scan',
        social_links: lead.social_links
      });

      if (error) throw error;
      toast.success(`${lead.business_name} secured in CRM`);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-8 bg-gradient-to-r from-indigo-900/40 via-purple-900/40 to-slate-900/80 rounded-3xl border border-indigo-500/20 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -z-10" />
        
        <div className="space-y-2 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold tracking-wider uppercase mb-2">
            <Zap className="w-3 h-3 fill-current" /> Enterprise Engine
          </div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-purple-300 tracking-tight">
            OmniLead Intelligence
          </h1>
          <p className="text-slate-400 max-w-xl text-lg font-light leading-relaxed">
            Deploy the deep-web acquisition engine to harvest premium B2B contacts, extract social infrastructure, and fuel your pipeline automatically.
          </p>
        </div>

        <form onSubmit={handleSearch} className="mt-6 md:mt-0 w-full md:w-auto flex flex-col sm:flex-row gap-3 z-10">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-400 transition-colors" />
            <input 
              type="text" 
              placeholder="Niche (e.g. Lawyers)" 
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="w-full sm:w-48 pl-10 pr-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none text-white placeholder:text-slate-500 transition-all shadow-inner"
              disabled={scanning}
            />
          </div>
          <div className="relative group">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-400 transition-colors" />
            <input 
              type="text" 
              placeholder="City (e.g. Seattle)" 
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full sm:w-48 pl-10 pr-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none text-white placeholder:text-slate-500 transition-all shadow-inner"
              disabled={scanning}
            />
          </div>
          <button 
            type="submit" 
            disabled={scanning || !niche || !location}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-semibold rounded-xl transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
          >
            {scanning ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
            {scanning ? 'Extracting...' : 'Deploy Engine'}
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
            className="p-6 bg-slate-900/50 rounded-2xl border border-slate-800 backdrop-blur-sm overflow-hidden"
          >
            <div className="flex justify-between text-sm mb-3">
              <span className="text-indigo-300 font-mono flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-fuchsia-400" /> 
                {progress.message}
              </span>
              <span className="text-white font-mono font-bold">{progress.percent}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden shadow-inner flex">
              <motion.div 
                className="bg-gradient-to-r from-blue-500 via-indigo-500 to-fuchsia-500 h-full rounded-full relative"
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {results.map((lead, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="group bg-slate-900/60 border border-slate-800 rounded-2xl p-6 hover:border-indigo-500/50 hover:bg-slate-800/80 transition-all duration-300 shadow-lg hover:shadow-indigo-500/10 flex flex-col"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-start gap-4">
                  {/* Clean Domain logic for Clearbit logo */}
                  <img 
                    src={`https://logo.clearbit.com/${new URL(lead.website).hostname.replace('www.', '')}?s=64`}
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(lead.business_name)}&background=1e1b4b&color=818cf8&bold=true` }}
                    alt={lead.business_name}
                    className="w-12 h-12 rounded-xl object-contain bg-slate-800 border border-slate-700 p-1 group-hover:border-indigo-400 transition-colors"
                  />
                  <div>
                    <h3 className="text-white font-bold text-lg leading-tight line-clamp-1 group-hover:text-indigo-300 transition-colors">{lead.business_name}</h3>
                    <a href={lead.website} target="_blank" rel="noreferrer" className="text-slate-400 text-sm hover:text-white flex items-center gap-1 mt-1 transition-colors">
                      <Globe className="w-3 h-3" /> {new URL(lead.website).hostname.replace('www.', '')} <ExternalLink className="w-3 h-3 opacity-50" />
                    </a>
                  </div>
                </div>
                {/* Status Indicator */}
                {lead.status === 'crawling' && <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />}
                {lead.status === 'success' && <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />}
              </div>

              <div className="flex-grow space-y-3 mt-4 py-4 border-t border-slate-800/50 relative">
                
                {/* Simulated Crawl Overlay text if crawling */}
                {lead.status === 'crawling' && (
                  <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center rounded-lg z-10">
                     <span className="text-xs text-indigo-300 font-mono animate-pulse bg-slate-800/80 px-3 py-1 rounded-full border border-indigo-500/30">Extracting DOM node...</span>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <div className="flex-1">
                    {lead.emails && lead.emails.length > 0 ? (
                      <div className="text-sm font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded w-fit border border-emerald-400/20">{lead.emails[0]}</div>
                    ) : (
                      <span className="text-sm text-slate-600 line-through">Hidden or encrypted</span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-slate-500" />
                  <div className="flex-1 text-sm text-slate-300">
                    {lead.phone ? lead.phone : <span className="text-slate-600">Not detected in HTML header</span>}
                  </div>
                </div>
              </div>

              <button 
                onClick={() => handleSaveToCRM(lead)}
                disabled={lead.status !== 'success'}
                className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-indigo-600 text-white font-medium rounded-xl border border-slate-700 hover:border-indigo-500 transition-all group/btn disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4 group-hover/btn:scale-125 transition-transform" /> Save to CRM
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
