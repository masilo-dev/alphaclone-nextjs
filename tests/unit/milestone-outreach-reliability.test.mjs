import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsxRuntime from 'react/jsx-runtime';
import { loadWorkspaceSections } from '../../src/lib/outreach/loadWorkspaceSections.ts';

function load(path, dependencies) {
  const source = fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => dependencies[name] || {}, console, Date, crypto });
  return exports;
}
function dbFixture(tenant = 'tenant', failProgress = false) {
  const state = { projects: [{ id: 'project', tenant_id: tenant, name: 'Client project', status: 'In Progress', current_stage: 'In Progress', progress: 0, client_id: 'client' }], project_milestones: [{ id: 'milestone', project_id: 'project', tenant_id: tenant, name: 'Review', status: 'pending', due_date: '2030-01-01T00:00:00Z', order_index: 1 }], tasks: [] };
  const writes = [];
  const db = { from(table) {
    const filters = []; let payload; let insertion = false;
    const query = {
      select() { return this; }, eq(key, value) { filters.push([key, value]); return this; }, is() { return this; }, or() { return this; }, order() { return this; }, limit() { return this; },
      update(value) { payload = value; return this; }, insert(value) { payload = value; insertion = true; return this; },
      result() {
        let rows = (state[table] || []).filter(row => filters.every(([key, value]) => key === 'project.tenant_id' ? state.projects.some(project => project.id === row.project_id && project.tenant_id === value) : row[key] === value));
        if (payload) {
          if (failProgress && table === 'projects') return { data: null, error: { message: 'Progress unavailable' } };
          writes.push({ table, payload, filters });
          if (insertion) { rows = [{ id: 'new-milestone', ...payload }]; state[table] ||= []; state[table].push(rows[0]); }
          else rows.forEach(row => Object.assign(row, payload));
        }
        return { data: rows, error: null };
      },
      async maybeSingle() { const r = this.result(); return { ...r, data: r.data?.[0] || null }; },
      async single() { const r = this.result(); return { ...r, data: r.data?.[0] || null }; },
      then(resolve) { return Promise.resolve(this.result()).then(resolve); },
    }; return query;
  } };
  return { db, state, writes };
}
function mutationFixture(tenant = 'tenant', failProgress = false) {
  const f = dbFixture(tenant, failProgress); const notifications = [];
  return { ...f, notifications, ...load('src/lib/projects/milestoneMutationServer.ts', {
    './projectEnums': { computeProjectProgressPercent: ({ milestones }) => milestones.every(m => m.status === 'completed') ? 100 : 0 },
    './projectClientNotification': { notifyProjectClientMilestoneUpdate: async args => { notifications.push(args); return { sent: true, status: 'provider_accepted' }; } },
    '@/lib/calendar/nativeCalendarSync': { syncMilestoneToNativeCalendar: async () => {} },
  }) };
}
test('milestone fields preserve index zero and allow due-date clearing', () => {
  const f = mutationFixture();
  const fields = f.milestoneWriteFields({ dueDate: null, orderIndex: 0, status: 'completed' }, { status: 'pending' });
  assert.equal(fields.due_date, null); assert.equal(fields.order_index, 0); assert.ok(fields.completed_at);
  assert.equal(fields.projectId, undefined);
});
test('milestone update persists, recalculates and awaits client notification', async () => {
  const f = mutationFixture();
  const result = await f.mutateProjectMilestone({ admin: f.db, tenantId: 'tenant', userId: 'user', action: 'updated', input: { id: 'milestone', status: 'completed', dueDate: null } });
  assert.equal(f.state.project_milestones[0].status, 'completed');
  assert.equal(f.state.project_milestones[0].due_date, null);
  assert.equal(result.progress, 100); assert.equal(result.notification.status, 'provider_accepted');
  assert.equal(f.notifications.length, 1); assert.equal(f.notifications[0].milestone.id, 'milestone');
});
test('date-only milestone change notifies even when percentage is unchanged', async () => {
  const f = mutationFixture();
  const result = await f.mutateProjectMilestone({ admin: f.db, tenantId: 'tenant', userId: 'user', action: 'updated', input: { id: 'milestone', dueDate: '2030-03-06' } });
  assert.equal(result.progress, 0); assert.equal(f.notifications.length, 1);
});
test('cross-tenant milestone edits do not write or notify', async () => {
  const f = mutationFixture('other-tenant');
  await assert.rejects(() => f.mutateProjectMilestone({ admin: f.db, tenantId: 'tenant', userId: 'user', action: 'updated', input: { id: 'milestone', status: 'completed' } }), /workspace/);
  assert.equal(f.writes.length, 0); assert.equal(f.notifications.length, 0);
});
test('progress failure does not hide a saved milestone or omit its client notification', async () => {
  const f = mutationFixture('tenant', true);
  const result = await f.mutateProjectMilestone({ admin: f.db, tenantId: 'tenant', userId: 'user', action: 'updated', input: { id: 'milestone', status: 'completed' } });
  assert.equal(result.milestone.status, 'completed'); assert.equal(result.warnings.length, 1); assert.equal(f.notifications.length, 1);
});
test('no-op milestone save sends no duplicate notification', async () => {
  const f = mutationFixture();
  const result = await f.mutateProjectMilestone({ admin: f.db, tenantId: 'tenant', userId: 'user', action: 'updated', input: { id: 'milestone', status: 'pending' } });
  assert.equal(result.notification.skipped, 'unchanged'); assert.equal(f.writes.length, 0); assert.equal(f.notifications.length, 0);
});
test('outreach section failure does not discard successful sequence or audience data', async () => {
  const data = [], errors = [];
  await loadWorkspaceSections({ sections: { sequences: 'sequences', health: 'health', audiences: 'audiences' }, fetcher: async url => ({ ok: url !== 'health', json: async () => url === 'health' ? { error: 'Health unavailable' } : { rows: [url] } }), onData: (section, payload) => data.push([section, payload.rows]), onError: (section, error) => errors.push([section, error]) });
  assert.equal(data.length, 2); assert.equal(errors.length, 1); assert.equal(errors[0][0], 'health');
});
test('workspace-switch cancellation prevents stale outreach data from applying', async () => {
  const controller = new AbortController(); controller.abort(); let applied = 0;
  await loadWorkspaceSections({ sections: { sequences: 'sequences' }, signal: controller.signal, fetcher: async () => ({ ok: true, json: async () => ({ sequences: [] }) }), onData: () => applied++, onError: () => applied++ });
  assert.equal(applied, 0);
});
test('client notifications resolve live database columns and do not require a public portal', async () => {
  const sends = [], selected = [];
  const db = { from(table) { return { select(columns) { selected.push([table, columns]); return this; }, eq() { return this; }, limit() { return this; },
    async maybeSingle() { return { data: table === 'projects' ? { id: 'project', tenant_id: 'tenant', name: 'Private project', client_id: 'client', is_public: false, portal_token: null, progress: 25 } : table === 'business_clients' ? { email: 'client@example.invalid', name: 'Client', company: 'Company' } : null }; },
    async insert() { return { error: null }; },
  }; } };
  const f = load('src/lib/projects/projectClientNotification.ts', {
    '@/lib/email/sendEmailServer': { sendEmailServer: async args => { sends.push(args); return { success: true }; } },
    '@/lib/email/emailComposition': { ensureFooter: x => x },
    '@/lib/projects/portalLinks': { buildCanonicalProjectPortalUrl: token => `https://example.invalid/project/${token}` },
    '@/lib/email/escapeHtml': { escapeHtml: x => String(x).replaceAll('<', '&lt;') },
  });
  const result = await f.notifyProjectClientMilestoneUpdate({ admin: db, tenantId: 'tenant', projectId: 'project', milestone: { id: 'milestone', name: 'Private checkpoint', status: 'completed', updated_at: '2030-01-01T12:00:00Z' }, action: 'updated', progress: 25 });
  assert.equal(sends.length, 1); assert.equal(result.status, 'provider_accepted');
  assert.equal(sends[0].to, 'client@example.invalid'); assert.match(sends[0].idempotencyKey, /milestone:tenant:milestone/);
  assert.ok(selected.some(([table, fields]) => table === 'business_clients' && fields === 'email, name, company'));
});
test('campaign overview renders real campaign counts, sender, schedule and retained actions', () => {
  const icon = () => React.createElement('svg');
  const { default: Overview } = load('src/components/dashboard/marketing/CampaignOverview.tsx', { react: React, 'react/jsx-runtime': jsxRuntime, 'lucide-react': { Search: icon, ArrowRight: icon, CalendarClock: icon, Mail: icon } });
  const html = renderToStaticMarkup(React.createElement(Overview, { campaigns: [{ id: 'campaign', name: 'Client follow-up', subject: 'Exact subject', fromEmail: 'sender@example.invalid', status: 'scheduled', totalRecipients: 20, totalSent: 12, totalDelivered: 8, totalBounced: 1, scheduledAt: '2030-01-15T14:37:00Z' }], onOpen() {}, onDuplicate() {}, onDelete() {} }));
  assert.match(html, /Client follow-up/); assert.match(html, /Exact subject/);
  assert.match(html, /sender@example.invalid/); assert.match(html, /12 \/ 20 sent/);
  assert.match(html, /Duplicate/); assert.match(html, /Delete/);
  assert.match(html, /aria-label="Search campaigns"/); assert.match(html, /aria-label="Campaign status"/);
});
