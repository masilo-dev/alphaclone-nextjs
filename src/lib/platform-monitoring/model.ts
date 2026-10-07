export const SERVICES = [
 ['website','Website','Core Platform'],['dashboard','Dashboard','Core Platform'],['api','API','Core Platform'],
 ['authentication','Authentication','Core Platform'],['database','Database','Core Platform'],
 ['mcp','MCP Server','AI Execution'],['agent_runtime','Agent Runtime','AI Execution'],['automation','Automation Engine','AI Execution'],
 ['crm','CRM','Business Modules'],['projects','Projects','Business Modules'],['contracts','Contracts','Business Modules'],
 ['billing','Billing','Business Modules'],['client_portal','Client Portal','Business Modules'],['notifications','Notifications','Business Modules'],
 ['stripe','Stripe','Integrations'],['zoho','Zoho','Integrations'],['brevo','Brevo','Integrations'],['outlook','Outlook','Integrations'],
 ['linkedin','LinkedIn','Integrations'],['facebook','Facebook','Integrations'],['instagram','Instagram','Integrations'],
] as const;
export type Status = 'operational'|'degraded'|'partial_outage'|'major_outage'|'maintenance'|'unknown';
export type Evidence = { service_name:string; status:Exclude<Status,'unknown'>; latency_ms:number|null; message:string; checked_at:string; metadata_json:{verified:boolean; scope:string} };
export const STALE_MS = 180_000;
export function effectiveStatus(row: Evidence|undefined, now=Date.now()):Status {
 const time = Date.parse(row?.checked_at || '');
 if (!row || !Number.isFinite(time) || time>now+60_000 || now-time>STALE_MS || !row.metadata_json?.verified) return 'unknown';
 return row.status;
}
export function overallStatus(statuses:Status[]):Status {
 for(const s of ['major_outage','partial_outage','degraded','unknown','maintenance'] as Status[]) if(statuses.includes(s)) return s;
 return statuses.length ? 'operational':'unknown';
}
export const LABELS:Record<Status,string> = {operational:'Operational',degraded:'Degraded',partial_outage:'Partial outage',major_outage:'Major outage',maintenance:'Maintenance',unknown:'Not verified'};
