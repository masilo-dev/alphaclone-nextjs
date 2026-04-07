'use client';

import React, { useState, useCallback } from 'react';
import { 
  Search, Globe, Github, FileText, Server, Shield, 
  CheckCircle, XCircle, Loader2, Mail, AlertCircle,
  RefreshCw, ExternalLink, Info, Download, Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

interface EmailResult {
  email: string;
  source: string;
  confidence: number;
  pattern?: string;
  verified: boolean;
  name?: string;
  title?: string;
}

interface SourceStatus {
  name: string;
  status: 'pending' | 'loading' | 'success' | 'error' | 'skipped';
  count: number;
  error?: string;
  description: string;
}

const SOURCE_INFO: Record<string, { icon: React.ReactNode; description: string; color: string }> = {
  dns_txt_records: {
    icon: <Server className="w-4 h-4" />,
    description: 'DNS TXT records (SPF, DMARC) often contain email addresses',
    color: 'text-blue-400'
  },
  whois_registration: {
    icon: <Shield className="w-4 h-4" />,
    description: 'Domain registration records (public RDAP data)',
    color: 'text-purple-400'
  },
  github_commits: {
    icon: <Github className="w-4 h-4" />,
    description: 'GitHub commit authors who work at this company',
    color: 'text-gray-400'
  },
  website_mailto: {
    icon: <Mail className="w-4 h-4" />,
    description: 'mailto: links found on company website',
    color: 'text-green-400'
  },
  website_content: {
    icon: <FileText className="w-4 h-4" />,
    description: 'Email addresses in website text content',
    color: 'text-yellow-400'
  },
  pattern_guess_from_name: {
    icon: <Search className="w-4 h-4" />,
    description: 'Generated from employee names found on website',
    color: 'text-orange-400'
  }
};

export default function EmailDiscoveryTool() {
  const [domain, setDomain] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<EmailResult[]>([]);
  const [sources, setSources] = useState<SourceStatus[]>([
    { name: 'DNS Records', status: 'pending', count: 0, description: 'Check domain mail server records' },
    { name: 'WHOIS Data', status: 'pending', count: 0, description: 'Domain registration contact info' },
    { name: 'GitHub Commits', status: 'pending', count: 0, description: 'Public developer profiles' },
    { name: 'Website Scraping', status: 'pending', count: 0, description: 'Contact pages and team directories' }
  ]);
  const [showTransparency, setShowTransparency] = useState(false);

  const discoverEmails = useCallback(async () => {
    if (!domain) {
      toast.error('Please enter a domain');
      return;
    }

    setLoading(true);
    setResults([]);
    setSources(prev => prev.map(s => ({ ...s, status: 'loading', count: 0 })));

    try {
      const res = await fetch('/api/scraper/email-discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: domain.replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
          company_name: companyName || undefined,
          verify: true
        })
      });

      const data = await res.json();

      if (data.success) {
        setResults(data.emails);
        
        // Update source statuses
        setSources([
          { 
            name: 'DNS Records', 
            status: data.sources.dns?.status === 'success' ? 'success' : 'error',
            count: data.sources.dns?.count || 0,
            description: 'Domain mail server records',
            error: data.sources.dns?.error
          },
          { 
            name: 'WHOIS Data', 
            status: data.sources.whois?.status === 'success' ? 'success' : 'error',
            count: data.sources.whois?.count || 0,
            description: 'Domain registration contact info',
            error: data.sources.whois?.error
          },
          { 
            name: 'GitHub Commits', 
            status: data.sources.github?.status === 'success' ? 'success' : 'error',
            count: data.sources.github?.count || 0,
            description: 'Public developer profiles',
            error: data.sources.github?.error
          },
          { 
            name: 'Website Scraping', 
            status: data.sources.website?.status === 'success' ? 'success' : 'error',
            count: data.sources.website?.count || 0,
            description: 'Contact pages and team directories',
            error: data.sources.website?.error
          }
        ]);

        toast.success(`Found ${data.emails_found} emails using ${data.methods_used.length} methods`);
      } else {
        toast.error(data.error || 'Discovery failed');
        setSources(prev => prev.map(s => ({ ...s, status: 'error' })));
      }
    } catch (err) {
      toast.error('Failed to run email discovery');
      setSources(prev => prev.map(s => ({ ...s, status: 'error' })));
    } finally {
      setLoading(false);
    }
  }, [domain, companyName]);

  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    toast.success('Email copied');
  };

  const exportEmails = () => {
    const csv = [
      'Email,Source,Confidence,Verified,Name,Title',
      ...results.map(r => 
        `"${r.email}","${r.source}",${r.confidence},${r.verified},"${r.name || ''}","${r.title || ''}"`
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${domain}_emails.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-white flex items-center justify-center gap-3">
          <Search className="w-8 h-8 text-blue-400" />
          Free Email Discovery
        </h1>
        <p className="text-slate-400">
          Find business emails using only public data sources - no APIs needed, completely free
        </p>
        <div className="flex items-center justify-center gap-2 text-sm">
          <span className="text-green-400 font-medium">100% Free</span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400">Open Source Methods</span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400">Transparent</span>
        </div>
      </div>

      {/* Input Form */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Domain * <span className="text-slate-500">(e.g., example.com)</span>
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="company.com"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Company Name <span className="text-slate-500">(optional, helps GitHub search)</span>
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Corp"
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <button
          onClick={discoverEmails}
          disabled={loading || !domain}
          className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-400 hover:to-purple-400 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Discovering Emails...
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              Start Discovery
            </>
          )}
        </button>
      </div>

      {/* Data Sources Status */}
      {loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {sources.map((source, idx) => (
            <motion.div
              key={source.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`p-4 rounded-lg border ${
                source.status === 'loading' ? 'bg-blue-500/10 border-blue-500/30' :
                source.status === 'success' ? 'bg-green-500/10 border-green-500/30' :
                source.status === 'error' ? 'bg-red-500/10 border-red-500/30' :
                'bg-slate-800 border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {source.status === 'loading' && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
                {source.status === 'success' && <CheckCircle className="w-4 h-4 text-green-400" />}
                {source.status === 'error' && <XCircle className="w-4 h-4 text-red-400" />}
                <span className={`text-sm font-medium ${
                  source.status === 'loading' ? 'text-blue-400' :
                  source.status === 'success' ? 'text-green-400' :
                  source.status === 'error' ? 'text-red-400' :
                  'text-slate-400'
                }`}>
                  {source.name}
                </span>
              </div>
              <p className="text-xs text-slate-500">{source.description}</p>
              {source.count > 0 && (
                <p className="text-sm text-green-400 mt-1">{source.count} found</p>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">
              Found {results.length} Emails
            </h2>
            <button
              onClick={exportEmails}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-700"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          <div className="space-y-2">
            {results.map((email, idx) => {
              const sourceInfo = SOURCE_INFO[email.source] || {
                icon: <Search className="w-4 h-4" />,
                description: 'Unknown source',
                color: 'text-slate-400'
              };

              return (
                <motion.div
                  key={`${email.email}-${idx}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`${sourceInfo.color}`}>
                          {sourceInfo.icon}
                        </span>
                        <span className="text-lg font-mono text-white truncate">
                          {email.email}
                        </span>
                        <button
                          onClick={() => copyEmail(email.email)}
                          className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="text-slate-400">
                          Source: <span className="text-slate-300 capitalize">{email.source.replace(/_/g, ' ')}</span>
                        </span>
                        
                        {email.name && (
                          <span className="text-slate-400">
                            Name: <span className="text-slate-300">{email.name}</span>
                          </span>
                        )}
                        
                        {email.title && (
                          <span className="text-slate-400">
                            Title: <span className="text-slate-300">{email.title}</span>
                          </span>
                        )}

                        {email.pattern && (
                          <span className="text-orange-400 text-xs bg-orange-500/10 px-2 py-0.5 rounded">
                            Pattern: {email.pattern}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 mt-2">
                        {sourceInfo.description}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2 ml-4">
                      {/* Confidence Score */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Confidence</span>
                        <div className="w-16 bg-slate-700 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${getConfidenceColor(email.confidence)}`}
                            style={{ width: `${email.confidence}%` }}
                          />
                        </div>
                        <span className={`text-sm font-medium ${
                          email.confidence >= 80 ? 'text-green-400' :
                          email.confidence >= 60 ? 'text-blue-400' :
                          email.confidence >= 40 ? 'text-yellow-400' :
                          'text-orange-400'
                        }`}>
                          {email.confidence}%
                        </span>
                      </div>

                      {/* Verified Badge */}
                      {email.verified ? (
                        <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded">
                          <CheckCircle className="w-3 h-3" />
                          Verified
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <AlertCircle className="w-3 h-3" />
                          Unverified
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Transparency Section */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <button
          onClick={() => setShowTransparency(!showTransparency)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-400" />
            <span className="font-semibold text-white">How This Works (Transparency)</span>
          </div>
          <span className="text-slate-400">{showTransparency ? '−' : '+'}</span>
        </button>

        <AnimatePresence>
          {showTransparency && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 space-y-4 text-sm text-slate-400"
            >
              <p>
                This tool uses only <strong className="text-slate-300">public data sources</strong> and 
                <strong className="text-slate-300"> open APIs</strong> that don't require authentication. 
                Here's exactly what we check:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-800 p-3 rounded-lg">
                  <h4 className="font-medium text-white flex items-center gap-2 mb-2">
                    <Server className="w-4 h-4 text-blue-400" />
                    DNS Records
                  </h4>
                  <p className="text-xs">
                    Checks TXT records (SPF, DMARC) which often list email addresses 
                    for domain verification. Uses public DNS over HTTPS.
                  </p>
                </div>

                <div className="bg-slate-800 p-3 rounded-lg">
                  <h4 className="font-medium text-white flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-purple-400" />
                    WHOIS/RDAP
                  </h4>
                  <p className="text-xs">
                    Domain registration records often contain contact emails. 
                    Uses RDAP.org which is the official registry access protocol.
                  </p>
                </div>

                <div className="bg-slate-800 p-3 rounded-lg">
                  <h4 className="font-medium text-white flex items-center gap-2 mb-2">
                    <Github className="w-4 h-4 text-gray-400" />
                    GitHub Public API
                  </h4>
                  <p className="text-xs">
                    Searches public repositories and extracts commit author emails 
                    that match the company domain. Rate limited, no key needed.
                  </p>
                </div>

                <div className="bg-slate-800 p-3 rounded-lg">
                  <h4 className="font-medium text-white flex items-center gap-2 mb-2">
                    <Globe className="w-4 h-4 text-green-400" />
                    Website Scraping
                  </h4>
                  <p className="text-xs">
                    Scrapes public pages (/contact, /about, /team) for mailto links 
                    and visible email addresses. Uses Playwright for JS-rendered sites.
                  </p>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                <p className="text-yellow-400 text-xs">
                  <strong>Note:</strong> Pattern-based emails (first.last@domain) are 
                  <strong>guesses</strong> based on names found on the website. These have lower 
                  confidence scores and should be verified before use.
                </p>
              </div>

              <p className="text-xs">
                <strong className="text-slate-300">No APIs used:</strong> Hunter.io, Apollo, 
                ZoomInfo, or any paid services. Everything is free, public data.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-slate-500">
        By using this tool, you agree to only use discovered emails in compliance with 
        applicable laws (CAN-SPAM, GDPR, etc.) and the target website's Terms of Service.
      </p>
    </div>
  );
}
