'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {LABELS,SERVICES,STALE_MS,overallStatus,type Status} from '@/lib/platform-monitoring/model';
type Service={id:string;name:string;group:string;status:Status;checked_at:string|null;latency_ms:number|null;message:string;scope:string;uptime:number|null;samples:number;verified_samples:number};
type Incident={id:string;service_name:string;status:string;started_at:string;resolved_at:string|null;message:string};
type Snapshot={overall:Status;services:Service[];incidents:Incident[];generated_at:string};
const color:Record<Status,string>={operational:'text-emerald-700',degraded:'text-amber-700',partial_outage:'text-red-700',major_outage:'text-red-700',maintenance:'text-blue-700',unknown:'text-slate-500'};
function utc(value:string|null) {return value?new Date(value).toISOString().replace('T',' ').slice(0,19)+' UTC':'Never checked';}
export default function StatusDashboard({history=false}:{history?:boolean}) {
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null);const [failed,setFailed]=useState(false);const [now,setNow]=useState(Date.now());
 useEffect(()=>{
 const controller=new AbortController();let active=true;
 async function load(){try{const r=await fetch('/api/platform-status',{cache:'no-store',signal:controller.signal});if(!r.ok)throw new Error();const data=await r.json();if(active){setSnapshot(data);setFailed(false);}}catch{if(active)setFailed(true);}}
 void load();const poll=setInterval(load,30000);const clock=setInterval(()=>setNow(Date.now()),1000);
 return()=>{active=false;controller.abort();clearInterval(poll);clearInterval(clock);};
 },[]);
 const services=(snapshot?.services||SERVICES.map(([id,name,group])=>({id,name,group,status:'unknown' as Status,checked_at:null,latency_ms:null,message:'No monitoring evidence available',scope:'Not verified',uptime:null,samples:0,verified_samples:0}))).map(s=>({...s,status:failed||!s.checked_at||now-Date.parse(s.checked_at)>STALE_MS?'unknown' as Status:s.status}));
 const overall=overallStatus(services.map(s=>s.status));
 const overallCopy:Record<Status,string>={operational:'All Systems Operational',unknown:'Some services are not verified',degraded:'Service degradation detected',partial_outage:'Partial service outage',major_outage:'Service outage detected',maintenance:'Scheduled maintenance'};
 return <main className="min-h-screen bg-white text-slate-900"><div className="mx-auto max-w-4xl px-5 py-12 sm:py-20">
 <Link href="/" className="text-sm text-slate-600">AlphaClone Systems</Link>
 <h1 className="mt-8 text-3xl font-semibold tracking-tight sm:text-4xl">AlphaClone Systems Status</h1>
 <p className="mt-3 text-base text-slate-600">Real-time health monitoring of the AlphaClone execution platform.</p>
 <nav className="mt-6 flex gap-6 text-sm"><Link href="/platform-status" className={!history?'font-semibold':''}>Current status</Link><Link href="/platform-status/history" className={history?'font-semibold':''}>Incident history</Link></nav>
 <section aria-live="polite" className="my-10 border-y border-slate-200 py-8">
 <h2 className={`text-xl font-medium ${color[overall]}`}>{overallCopy[overall]}</h2>
 <p className="mt-2 text-sm text-slate-500">Checks run every minute. This page refreshes every 30 seconds.</p>
 {failed&&<p className="mt-2 text-sm text-amber-700">Monitoring data cannot currently be retrieved. Previous green results are not shown as current.</p>}
 </section>
 {history?<section><h2 className="text-xl font-semibold">Incident history</h2><p className="mt-2 text-sm text-slate-500">Incidents begin at the first observed failed check. Resolution requires a verified passing check.</p>
 {!snapshot?.incidents.length&&<p className="py-8 text-slate-500">{snapshot?'No incidents recorded since monitoring began.':'Incident history unavailable.'}</p>}
 {snapshot?.incidents.map(i=><article key={i.id} className="border-b border-slate-200 py-6"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-medium">{SERVICES.find(s=>s[0]===i.service_name)?.[1]} — {i.message}</h3><span className={i.resolved_at?'text-emerald-700':'text-amber-700'}>{i.resolved_at?'Resolved':'Ongoing'}</span></div><p className="mt-2 text-sm text-slate-500">{utc(i.started_at)}{i.resolved_at?` · ${Math.ceil((Date.parse(i.resolved_at)-Date.parse(i.started_at))/60000)} minutes · Resolved ${utc(i.resolved_at)}`:''}</p></article>)}
 </section>:<>{Array.from(new Set(services.map(s=>s.group))).map(group=><section key={group} className="mb-10"><h2 className="mb-3 text-lg font-semibold">{group}</h2><div className="divide-y divide-slate-100">{services.filter(s=>s.group===group).map(s=><article key={s.id} className="py-4"><div className="flex items-start justify-between gap-3"><h3 className="font-medium">{s.name}</h3><span className={`shrink-0 text-sm font-medium ${color[s.status]}`}>{LABELS[s.status]}</span></div><p className="mt-1 text-sm text-slate-600">{s.message}</p><p className="mt-1 text-xs text-slate-500">{s.scope}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span>Last checked: {utc(s.checked_at)}</span><span>{s.latency_ms!==null?`${s.latency_ms} ms`:'Latency unavailable'}</span><span>Observed uptime: {s.uptime!==null?`${s.uptime}%`:'Unavailable'} · {s.verified_samples}/{s.samples} samples verified</span></div></article>)}</div></section>)}<p className="border-t border-slate-200 pt-5 text-sm text-slate-500">Uptime covers verified samples retained for up to 90 days. Missing checks are unverified and excluded from observed uptime; sample counts show coverage. A passing limited probe does not establish end-to-end workflow reliability.</p></>}
 </div></main>;
}
