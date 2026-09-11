import fs from 'fs';
import path from 'path';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type SkillMeta = {
  name: string;
  description: string;
  allowedTools?: string[];
  source: 'builtin' | 'tenant';
};

export type SkillDefinition = SkillMeta & {
  body: string;
};

const SKILLS_ROOT = path.join(process.cwd(), 'src', 'skills');

function parseSkillMd(raw: string): { meta: Omit<SkillMeta, 'source'>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { meta: { name: 'unknown', description: raw.slice(0, 200) }, body: raw };
  }

  const frontmatter = match[1];
  const body = match[2].trim();
  const meta: Record<string, string> = {};
  for (const line of frontmatter.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    meta[key] = value;
  }

  const allowedTools = meta['allowed-tools']
    ? meta['allowed-tools'].split(/\s+/).filter(Boolean)
    : undefined;

  return {
    meta: {
      name: meta.name || 'unknown',
      description: meta.description || '',
      allowedTools,
    },
    body,
  };
}

function loadBuiltinSkills(): SkillDefinition[] {
  if (!fs.existsSync(SKILLS_ROOT)) return [];

  const skills: SkillDefinition[] = [];
  for (const dir of fs.readdirSync(SKILLS_ROOT, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const skillPath = path.join(SKILLS_ROOT, dir.name, 'SKILL.md');
    if (!fs.existsSync(skillPath)) continue;
    const raw = fs.readFileSync(skillPath, 'utf8');
    const { meta, body } = parseSkillMd(raw);
    skills.push({ ...meta, source: 'builtin', body });
  }
  return skills;
}

async function loadTenantSkills(tenantId: string): Promise<SkillDefinition[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('custom_playbooks')
    .select('id, name, description, metadata')
    .eq('tenant_id', tenantId);

  const skills: SkillDefinition[] = [];
  for (const row of data || []) {
    const metadata = (row.metadata || {}) as Record<string, unknown>;
    const skillMd = String(metadata.skill_md || '');
    if (!skillMd) continue;
    const { meta, body } = parseSkillMd(skillMd);
    skills.push({
      name: meta.name || String(row.name || row.id),
      description: meta.description || String(row.description || ''),
      allowedTools: meta.allowedTools,
      source: 'tenant',
      body,
    });
  }
  return skills;
}

export async function listSkills(tenantId: string): Promise<SkillMeta[]> {
  const builtin = loadBuiltinSkills().map(({ body: _body, ...meta }) => meta);
  const tenant = (await loadTenantSkills(tenantId)).map(({ body: _body, ...meta }) => meta);
  const seen = new Set<string>();
  const merged: SkillMeta[] = [];
  for (const skill of [...tenant, ...builtin]) {
    if (seen.has(skill.name)) continue;
    seen.add(skill.name);
    merged.push(skill);
  }
  return merged;
}

export async function loadSkill(tenantId: string, name: string): Promise<SkillDefinition | null> {
  const tenantSkills = await loadTenantSkills(tenantId);
  const tenantMatch = tenantSkills.find((s) => s.name === name);
  if (tenantMatch) return tenantMatch;

  const builtinMatch = loadBuiltinSkills().find((s) => s.name === name);
  return builtinMatch || null;
}

export function resolveSkillForModule(moduleId: string): string | null {
  const map: Record<string, string> = {
    crm: 'crm-follow-up',
    leads: 'lead-qualification',
    deals: 'stale-deal-follow-up',
    campaigns: 'campaign-diagnose',
    accounting: 'invoice-recovery',
    tickets: 'support-triage',
    tasks: 'meeting-prep',
    general: 'workspace-ops',
  };
  return map[moduleId] || null;
}

export async function getActiveSkillContext(
  tenantId: string,
  moduleId?: string
): Promise<{ name: string; description: string; body: string; allowedTools?: string[] } | null> {
  const skillName = moduleId ? resolveSkillForModule(moduleId) : null;
  if (!skillName) return null;
  const skill = await loadSkill(tenantId, skillName);
  if (!skill) return null;
  return {
    name: skill.name,
    description: skill.description,
    body: skill.body,
    allowedTools: skill.allowedTools,
  };
}

export async function getDreamMemoryPatterns(tenantId: string, limit = 5): Promise<string[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('bonnie_dream_sessions')
    .select('patterns_extracted, memory_updates, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(3);

  const patterns: string[] = [];
  for (const row of data || []) {
    const extracted = row.patterns_extracted as unknown;
    if (Array.isArray(extracted)) {
      for (const item of extracted) {
        if (typeof item === 'string') patterns.push(item);
        else if (item && typeof item === 'object' && 'pattern' in item) {
          patterns.push(String((item as { pattern: string }).pattern));
        } else if (item && typeof item === 'object' && 'description' in item) {
          patterns.push(String((item as { description: string }).description));
        }
      }
    }
    const updates = row.memory_updates as unknown;
    if (Array.isArray(updates)) {
      for (const item of updates) {
        if (typeof item === 'string') patterns.push(item);
        else if (item && typeof item === 'object' && 'update' in item) {
          patterns.push(String((item as { update: string }).update));
        }
      }
    }
  }
  return patterns.slice(0, limit);
}
