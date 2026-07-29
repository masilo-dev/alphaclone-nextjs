'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useCurrentTenantSafe } from '@/hooks/useTenantSafe';
import {
  ArrowRight, Check, Clock3, Database, Download, FileUp, History, ListPlus,
  Mail, MapPin, MoreHorizontal, Pause, Play, Search, Settings2, SlidersHorizontal,
  Sparkles, X,
} from 'lucide-react';
import toast from 'react-hot-toast';

type SearchRecord = {
  id: string; name: string; query?: string; location?: string; industry?: string;
  status: string; progress: number; discovered_count: number; accepted_count: number;
  rejected_count: number; duplicate_count: number; error_count: number; created_at: string;
};
type Candidate = {
  id: string; business_name: string; contact_name?: string; industry?: string; city?: string;
  country?: string; website?: string; public_email?: string; public_phone?: string;
  source_type: string; quality_score: number; fit_score: number; verification_status: string;
  review_status: string; created_at: string;
};

const nav = ['Discover', 'Results', 'Lists', 'Outreach', 'Activity', 'Settings'] as const;
const presets = [
  ['Restaurants in Harare', 'restaurants', 'Harare'],
  ['Construction companies in Bulawayo', 'construction companies', 'Bulawayo'],
  ['Marketing agencies in Warsaw', 'marketing agencies', 'Warsaw'],
  ['Small retailers in Johannesburg', 'small retailers', 'Johannesburg'],
  ['Local service businesses', 'local services', ''],
  ['Companies without websites', 'businesses', ''],
  ['Businesses with public email addresses', 'businesses', ''],
] as const;

const fieldClass = 'min-h-11 w-full rounded-xl border border-[var(--ws-border)] bg-[var(--ws-surface)] px-3 text-sm text-[var(--ws-text-primary)] outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20';
const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 disabled:cursor-not-allowed disabled:opacity-50';

export default function ScraperCampaignsPage() {
  const tenant = useCurrentTenantSafe();
  const [active, setActive] = useState<(typeof nav)[number]>('Discover');
  const [advanced, setAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [available, setAvailable] = useState(true);
  const [availabilityNotice, setAvailabilityNotice] = useState<string | null>(null);
  const [searches, setSearches] = useState<SearchRecord[]>([]);
  const [selectedSearch, setSelectedSearch] = useState<SearchRecord | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [form, setForm] = useState({
    keywords: '', location: '', country: '', city: '', region: '', industry: '',
    searchType: 'businesses_by_location', resultLimit: 50, website: false, email: false,
    phone: false, social: false, sources: ['openstreetmap', 'website'],
    excludedKeywords: '', excludedDomains: '', excludedLocations: '',
  });

  const loadSearches = useCallback(async () => {
    if (!tenant?.id) return;
    const res = await fetch(`/api/leads/searches?workspaceId=${encodeURIComponent(tenant.id)}`);
    const body = await res.json();
    if (res.ok) {
      setAvailable(Boolean(body.available ?? true));
      setAvailabilityNotice(body.notice || null);
      setSearches(body.searches || []);
      setSelectedSearch(current => current ? body.searches.find((s: SearchRecord) => s.id === current.id) || current : body.searches[0] || null);
    } else {
      toast.error(body?.error || 'Lead Finder could not be loaded');
    }
  }, [tenant?.id]);

  const loadResults = useCallback(async () => {
    if (!tenant?.id || !selectedSearch?.id) return;
    const res = await fetch(`/api/leads/searches/${selectedSearch.id}/results?workspaceId=${encodeURIComponent(tenant.id)}&limit=50`);
    const body = await res.json();
    if (res.ok) {
      setCandidates(body.candidates || []);
    }
  }, [tenant?.id, selectedSearch?.id]);

  useEffect(() => { void loadSearches(); }, [loadSearches]);
  useEffect(() => { void loadResults(); }, [loadResults]);
  useEffect(() => {
    if (!searches.some(s => ['queued', 'running'].includes(s.status))) return;
    const timer = window.setInterval(() => void loadSearches(), 4000);
    return () => window.clearInterval(timer);
  }, [searches, loadSearches]);

  const createSearch = async (event: FormEvent) => {
    event.preventDefault();
    if (!available) {
      toast.error(availabilityNotice || 'Lead Finder is not ready for this workspace yet.');
      return;
    }
    if (!tenant?.id || (!form.keywords.trim() && !form.location.trim())) {
      toast.error('Add business keywords or a location.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/leads/searches', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: tenant.id,
          name: [form.keywords, form.location].filter(Boolean).join(' in ').slice(0, 120),
          searchType: form.searchType, query: form.keywords,
          businessKeywords: form.keywords.split(',').map(x => x.trim()).filter(Boolean),
          location: form.location, country: form.country, city: form.city, region: form.region,
          industry: form.industry, sources: form.sources, resultLimit: Number(form.resultLimit),
          requirements: { website: form.website, email: form.email, phone: form.phone, social: form.social },
          exclusions: {
            keywords: form.excludedKeywords.split(',').map(x => x.trim()).filter(Boolean),
            domains: form.excludedDomains.split(',').map(x => x.trim()).filter(Boolean),
            locations: form.excludedLocations.split(',').map(x => x.trim()).filter(Boolean),
          }, runNow: true,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (res.status === 503 && body?.available === false) {
          setAvailable(false);
          setAvailabilityNotice(body.notice || body.error || 'Lead Finder is not ready yet.');
        }
        throw new Error(body.error || 'Search could not be started');
      }
      toast.success('Search queued. You can leave this page while workers continue.');
      setSelectedSearch(body.search); setActive('Results'); await loadSearches();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Search could not be started'); }
    finally { setSubmitting(false); }
  };

  const metrics = useMemo(() => ({
    discovered: selectedSearch?.discovered_count || candidates.length,
    accepted: selectedSearch?.accepted_count || candidates.filter(x => x.review_status === 'accepted').length,
    duplicates: selectedSearch?.duplicate_count || 0,
    verified: candidates.filter(x => !['unverified', 'invalid'].includes(x.verification_status)).length,
  }), [selectedSearch, candidates]);

  return (
    <section className="min-h-full bg-[var(--ws-bg)] text-[var(--ws-text-primary)]" aria-labelledby="lead-finder-title">
      <div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-5 lg:px-7">
        <header className="flex flex-col gap-4 border-b border-[var(--ws-border)] pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 id="lead-finder-title" className="text-2xl font-bold tracking-tight">Lead Finder</h1>
            <p className="mt-1 text-sm text-[var(--ws-text-secondary)]">Find, verify and organize businesses that match your ideal customer.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={`${buttonClass} border border-[var(--ws-border)] bg-[var(--ws-surface)]`} onClick={() => toast('Import workspace is ready for CSV, XLSX, JSON and pasted rows.') }><FileUp size={16}/>Import</button>
            <button className={`${buttonClass} border border-[var(--ws-border)] bg-[var(--ws-surface)]`} onClick={() => setActive('Activity')}><History size={16}/>Search history</button>
            <button className={`${buttonClass} bg-teal-500 text-slate-950 hover:bg-teal-400`} onClick={() => setActive('Discover')}><Search size={16}/>New search</button>
          </div>
        </header>

        {!available ? (
          <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-sm font-semibold text-amber-200">Lead Finder is still being prepared for this workspace.</p>
            <p className="mt-1 text-sm text-amber-100/80">
              {availabilityNotice || 'Database tables for lead search are not available yet. Apply migrations and refresh.'}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className={`${buttonClass} border border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15`}
                onClick={() => void loadSearches()}
              >
                Retry
              </button>
              <button
                type="button"
                className={`${buttonClass} border border-[var(--ws-border)] bg-[var(--ws-surface)]`}
                onClick={() => setActive('Activity')}
              >
                View history
              </button>
            </div>
          </div>
        ) : null}

        <nav className="my-4 flex gap-1 overflow-x-auto border-b border-[var(--ws-border)]" aria-label="Lead Finder sections">
          {nav.map(item => <button key={item} onClick={() => setActive(item)} aria-current={active === item ? 'page' : undefined}
            className={`min-h-11 shrink-0 border-b-2 px-3 text-sm font-medium ${active === item ? 'border-teal-400 text-teal-400' : 'border-transparent text-[var(--ws-text-secondary)] hover:text-[var(--ws-text-primary)]'}`}>{item}</button>)}
        </nav>

        {active === 'Discover' && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <form onSubmit={createSearch} className="rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-surface)] p-4 sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div><h2 className="text-lg font-semibold">What businesses should we find?</h2><p className="text-sm text-[var(--ws-text-secondary)]">Only permitted public sources are searched. Free sources have responsible quotas.</p></div>
                <Sparkles className="text-teal-400" aria-hidden="true"/>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium">Business type or keywords
                  <input className={`${fieldClass} mt-1.5`} value={form.keywords} onChange={e => setForm({...form, keywords:e.target.value})} placeholder="e.g. accounting firms" />
                </label>
                <label className="text-sm font-medium">Location
                  <div className="relative mt-1.5"><MapPin className="absolute left-3 top-3 text-[var(--ws-text-secondary)]" size={17}/><input className={`${fieldClass} pl-10`} value={form.location} onChange={e => setForm({...form, location:e.target.value})} placeholder="City, region or country" /></div>
                </label>
                <label className="text-sm font-medium">Search mode
                  <select className={`${fieldClass} mt-1.5`} value={form.searchType} onChange={e => setForm({...form,searchType:e.target.value})}>
                    <option value="businesses_by_location">Businesses by location</option><option value="businesses_by_keyword">Businesses by keyword</option>
                    <option value="domain_discovery">Domain discovery</option><option value="website_contact_discovery">Website contact discovery</option>
                    <option value="public_directory_discovery">Public directory discovery</option><option value="public_social_discovery">Public social profile discovery</option>
                    <option value="csv_import">CSV import</option><option value="manual">Manual lead entry</option>
                  </select>
                </label>
                <label className="text-sm font-medium">Industry
                  <input className={`${fieldClass} mt-1.5`} value={form.industry} onChange={e => setForm({...form,industry:e.target.value})} placeholder="Optional industry" />
                </label>
              </div>
              <fieldset className="mt-5"><legend className="text-sm font-semibold">Required public information</legend>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{(['website','email','phone','social'] as const).map(key =>
                  <label key={key} className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--ws-border)] px-3 text-sm capitalize"><input type="checkbox" checked={form[key]} onChange={e=>setForm({...form,[key]:e.target.checked})} className="accent-teal-500"/>{key}</label>)}</div>
              </fieldset>
              <button type="button" onClick={() => setAdvanced(!advanced)} className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-teal-400"><SlidersHorizontal size={16}/>{advanced ? 'Hide' : 'Show'} advanced filters</button>
              {advanced && <div className="grid gap-4 border-t border-[var(--ws-border)] pt-4 md:grid-cols-2">
                <label className="text-sm">Country<input className={`${fieldClass} mt-1`} value={form.country} onChange={e=>setForm({...form,country:e.target.value})}/></label>
                <label className="text-sm">City or region<input className={`${fieldClass} mt-1`} value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/></label>
                <label className="text-sm">Excluded keywords<input className={`${fieldClass} mt-1`} value={form.excludedKeywords} onChange={e=>setForm({...form,excludedKeywords:e.target.value})} placeholder="comma separated"/></label>
                <label className="text-sm">Excluded domains<input className={`${fieldClass} mt-1`} value={form.excludedDomains} onChange={e=>setForm({...form,excludedDomains:e.target.value})} placeholder="comma separated"/></label>
                <label className="text-sm">Result limit<input type="number" min={1} max={500} className={`${fieldClass} mt-1`} value={form.resultLimit} onChange={e=>setForm({...form,resultLimit:Number(e.target.value)})}/></label>
              </div>}
              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[var(--ws-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[var(--ws-text-secondary)]">OpenStreetMap: 2 requests/min · max 500 records/day. Searches persist if you leave.</p>
                <button disabled={submitting || !available} className={`${buttonClass} bg-teal-500 text-slate-950 hover:bg-teal-400`}>{submitting ? 'Queuing…' : 'Find businesses'}<ArrowRight size={16}/></button>
              </div>
            </form>
            <aside className="space-y-4">
              <div className="rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-surface)] p-4">
                <h2 className="font-semibold">Search presets</h2><p className="mb-3 text-xs text-[var(--ws-text-secondary)]">Suggestions only—results always come from live public sources.</p>
                <div className="space-y-1">{presets.map(([label,keywords,location]) => <button key={label} onClick={()=>setForm({...form,keywords,location})} className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm hover:bg-white/5"><span>{label}</span><ArrowRight size={14}/></button>)}</div>
              </div>
              <div className="rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-surface)] p-4">
                <div className="flex items-center gap-2"><Database size={17} className="text-teal-400"/><h2 className="font-semibold">Public-source policy</h2></div>
                <p className="mt-2 text-sm text-[var(--ws-text-secondary)]">No login bypass, private-profile collection, CAPTCHA evasion or paid lead database is required. Robots rules and source limits are enforced by workers.</p>
              </div>
            </aside>
          </div>
        )}

        {active === 'Results' && <ResultsPanel searches={searches} selected={selectedSearch} setSelected={setSelectedSearch} candidates={candidates} metrics={metrics} />}
        {active === 'Activity' && <HistoryPanel searches={searches} onOpen={s=>{setSelectedSearch(s);setActive('Results')}} />}
        {(['Lists','Outreach','Settings'] as const).includes(active as never) && <ModuleEmpty section={active}/>}
      </div>
    </section>
  );
}

function ResultsPanel({ searches, selected, setSelected, candidates, metrics }: { searches: SearchRecord[]; selected: SearchRecord|null; setSelected:(s:SearchRecord)=>void; candidates:Candidate[]; metrics:Record<string,number> }) {
  return <div className="space-y-4">
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="font-semibold">{selected?.name || 'No search selected'}</h2><p className="text-sm text-[var(--ws-text-secondary)]">{selected ? `${selected.status.replace('_',' ')} · ${selected.progress}% complete` : 'Create a search to discover public business leads.'}</p></div>
      {searches.length>0 && <select aria-label="Selected search" className={`${fieldClass} sm:max-w-xs`} value={selected?.id||''} onChange={e=>{const s=searches.find(x=>x.id===e.target.value);if(s)setSelected(s)}}>{searches.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>}
    </div>
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{Object.entries(metrics).map(([label,value])=><div key={label} className="rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-surface)] p-4"><p className="text-xs uppercase tracking-wide text-[var(--ws-text-secondary)]">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{value}</p></div>)}</div>
    {selected && ['queued','running'].includes(selected.status) && <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-3" role="status"><div className="mb-2 flex justify-between text-xs"><span>Discovery continues in the background</span><span>{selected.progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-black/20"><div className="h-full bg-teal-400 transition-all" style={{width:`${selected.progress}%`}}/></div></div>}
    {candidates.length ? <div className="overflow-hidden rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-surface)]">
      <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="border-b border-[var(--ws-border)] text-xs uppercase text-[var(--ws-text-secondary)]"><tr>{['Company','Location','Contact','Source','Quality','Fit','Status',''].map(x=><th key={x} className="px-4 py-3">{x}</th>)}</tr></thead><tbody>{candidates.map(c=><tr key={c.id} className="border-b border-[var(--ws-border)] last:border-0"><td className="px-4 py-3 font-semibold">{c.business_name}<div className="text-xs font-normal text-[var(--ws-text-secondary)]">{c.industry||'Uncategorized'}</div></td><td className="px-4 py-3">{[c.city,c.country].filter(Boolean).join(', ')||'—'}</td><td className="px-4 py-3">{c.public_email||c.public_phone||'No public contact'}</td><td className="px-4 py-3">{c.source_type}</td><td className="px-4 py-3">{c.quality_score}</td><td className="px-4 py-3">{c.fit_score}</td><td className="px-4 py-3 capitalize">{c.review_status}</td><td className="px-4 py-3"><button aria-label={`Actions for ${c.business_name}`} className="min-h-11 min-w-11"><MoreHorizontal/></button></td></tr>)}</tbody></table></div>
      <div className="divide-y divide-[var(--ws-border)] md:hidden">{candidates.map(c=><article key={c.id} className="p-4"><div className="flex justify-between gap-3"><div><h3 className="font-semibold">{c.business_name}</h3><p className="text-sm text-[var(--ws-text-secondary)]">{[c.industry,c.city].filter(Boolean).join(' · ')}</p></div><span className="text-sm font-semibold text-teal-400">{c.fit_score} fit</span></div><p className="mt-3 text-sm">{c.public_email||c.public_phone||'No public contact found'}</p></article>)}</div>
    </div> : <ModuleEmpty section="Results"/>}
  </div>;
}

function HistoryPanel({ searches, onOpen }: { searches:SearchRecord[]; onOpen:(s:SearchRecord)=>void }) {
  return searches.length ? <div className="space-y-2">{searches.map(s=><button key={s.id} onClick={()=>onOpen(s)} className="flex min-h-16 w-full items-center justify-between rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-surface)] p-4 text-left"><div><p className="font-semibold">{s.name}</p><p className="text-xs text-[var(--ws-text-secondary)]">{new Date(s.created_at).toLocaleString()} · {s.discovered_count} found · {s.error_count} errors</p></div><span className="capitalize">{s.status.replace('_',' ')}</span></button>)}</div> : <ModuleEmpty section="Search history"/>;
}

function ModuleEmpty({ section }: { section:string }) {
  const copy:Record<string,[string,string]> = {
    Results:['No results yet','Run a public-source search, then review candidates here.'],
    Lists:['No lead lists','Create a list from accepted candidates to organize outreach.'],
    Outreach:['No outreach campaigns','Connect an existing sender, approve recipients and start with a safe daily limit.'],
    Settings:['Lead Finder settings','Source controls, quotas, scoring, verification and retention are workspace-scoped.'],
    'Search history':['No search history','Your completed, running and cancelled searches will appear here.'],
  }; const [title,body]=copy[section]||[`No ${section.toLowerCase()}`,`Your ${section.toLowerCase()} will appear here.`];
  return <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--ws-border)] bg-[var(--ws-surface)] p-8 text-center"><Search className="mb-3 text-[var(--ws-text-secondary)]"/><h2 className="font-semibold">{title}</h2><p className="mt-1 max-w-md text-sm text-[var(--ws-text-secondary)]">{body}</p></div>;
}
