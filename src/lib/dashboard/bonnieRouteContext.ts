import type { BonnieRecordContext } from '@/contexts/BonnieDrawerContext';
import type { ModuleId } from '@/constants/brand';
import { MODULE_IDENTITY } from '@/constants/brand';

const ROUTE_MODULE: Array<{ match: RegExp; moduleId: ModuleId; type: string }> = [
  { match: /^\/dashboard\/(business\/)?bonnie/, moduleId: 'bonnie', type: 'Assistant' },
  { match: /^\/dashboard\/crm/, moduleId: 'crm', type: 'CRM' },
  { match: /^\/dashboard\/(leads|contacts|business\/clients)/, moduleId: 'leads', type: 'Leads' },
  { match: /^\/dashboard\/deals/, moduleId: 'pipeline', type: 'Deal pipeline' },
  { match: /^\/dashboard\/(business\/)?(billing|invoices|finance)/, moduleId: 'invoicing', type: 'Invoice' },
  { match: /^\/dashboard\/business\/quotes/, moduleId: 'quotations', type: 'Quotation' },
  { match: /^\/dashboard\/(business\/)?projects/, moduleId: 'projects', type: 'Project' },
  { match: /^\/dashboard\/(business\/)?tasks|^\/dashboard\/tasks/, moduleId: 'tasks', type: 'Task' },
  { match: /^\/dashboard\/(business\/)?calendar/, moduleId: 'calendar', type: 'Calendar' },
  { match: /^\/dashboard\/(business\/)?documents/, moduleId: 'documents', type: 'Document' },
  { match: /^\/dashboard\/(business\/)?(campaigns|social|marketing)/, moduleId: 'marketing', type: 'Marketing' },
  { match: /^\/dashboard\/(business\/)?(reports|analytics|executive)/, moduleId: 'reports', type: 'Report' },
  { match: /^\/dashboard\/goals/, moduleId: 'goals', type: 'Goal' },
  { match: /^\/dashboard\/(automations|business\/workflows|marketplace)/, moduleId: 'nexus', type: 'Automation' },
  { match: /^\/dashboard\/(business\/)?settings/, moduleId: 'settings', type: 'Settings' },
  { match: /^\/dashboard\/(comms|mail|business\/unified-inbox|outreach)/, moduleId: 'email', type: 'Communication' },
];

export function resolveBonnieContextsFromPath(
  pathname: string | null | undefined,
  extras?: BonnieRecordContext[]
): BonnieRecordContext[] {
  const path = pathname || '';
  const hit = ROUTE_MODULE.find((entry) => entry.match.test(path));
  const contexts: BonnieRecordContext[] = [];
  if (hit) {
    const identity = MODULE_IDENTITY[hit.moduleId];
    contexts.push({
      type: hit.type,
      label: identity.label,
      href: path.split('?')[0] || undefined,
    });
  }
  if (extras?.length) contexts.push(...extras);
  return contexts;
}

export function modeRequiresConfirmation(mode: string, prompt: string): boolean {
  const text = `${mode} ${prompt}`.toLowerCase();
  return (
    /\b(send|email|post|publish|delete|remove|pay|transfer|invoice|permission|role|bulk|automat)/.test(
      text
    ) || mode === 'automate'
  );
}
