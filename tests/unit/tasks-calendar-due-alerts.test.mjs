import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'path';
import { addUtcDays, applyDueOnDay, utcToday } from '../../src/lib/workspace/dateColumnRange.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.resolve(here, rel), 'utf8');

describe('due-date day range', () => {
  it('covers a full UTC day so timestamptz due dates are not missed', () => {
    const calls = [];
    const query = {
      gte(column, value) {
        calls.push(['gte', column, value]);
        return this;
      },
      lt(column, value) {
        calls.push(['lt', column, value]);
        return this;
      },
    };
    applyDueOnDay(query, 'due_date', '2026-09-07');
    assert.deepEqual(calls, [
      ['gte', 'due_date', '2026-09-07'],
      ['lt', 'due_date', '2026-09-08'],
    ]);
    assert.equal(addUtcDays('2026-09-07', 1), '2026-09-08');
    assert.match(utcToday(), /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('tasks list scroll', () => {
  it('gives the full task list its own overflow, not ac-scroll-full', () => {
    const source = read('../../src/components/dashboard/TasksTab.tsx');
    assert.match(source, /data-testid="tasks-scroll-list"/);
    assert.match(source, /overflow-y-auto/);
    assert.equal(source.includes('ac-scroll-full'), false);
    const layout = read('../../src/components/ui/ModulePageLayout.tsx');
    assert.match(layout, /overflow-y-auto/);
  });
});

describe('calendar shows dated workspace work', () => {
  it('loads every tenant task with a due date, plus leads and deals', () => {
    const source = read('../../src/services/calendarService.ts');
    assert.equal(source.includes(".eq('assigned_to', userId)"), false);
    assert.match(source, /\.from\('leads'\)/);
    assert.match(source, /\.from\('deals'\)/);
    assert.match(source, /localeCompare/);
    assert.match(source, /type: 'lead'/);
    assert.match(source, /type: 'deal'/);
  });

  it('puts leads and deals on the business calendar, sorted A–Z on each day', () => {
    const source = read('../../src/components/dashboard/business/CalendarPage.tsx');
    assert.match(source, /source: 'lead'/);
    assert.match(source, /new Set\(\['event', 'task', 'project', 'deal', 'lead', 'booking'\]\)/);
    assert.match(source, /localeCompare/);
    assert.match(source, /isFinishedProject/);
  });
});

describe('due / stuck / finished notifications', () => {
  it('task reminders use a day range and then send project + stale-lead alerts', () => {
    const source = read('../../src/lib/cron/directCronExecutors.ts');
    assert.match(source, /applyDueOnDay/);
    assert.match(source, /runWorkspaceDueAlerts\(\{ includeTasks: false \}\)/);
  });

  it('stale leads and project due dates email the owner and try WhatsApp', () => {
    const source = read('../../src/lib/workspace/workspaceDueAlerts.ts');
    assert.match(source, /Lead sitting with no action/);
    assert.match(source, /Project due tomorrow/);
    assert.match(source, /sendWhatsAppMessage/);
  });

  it('the Railway daily cron sends chase owner briefs', () => {
    const source = read('../../src/app/api/cron/daily/route.ts');
    assert.match(source, /runChaseMorningBriefEmails/);
    assert.match(source, /runCriticalChaseAlerts/);
    assert.match(source, /runChaseEndOfDayEmails/);
  });

  it('marking a project finished emails the owner and the client even without a portal', () => {
    const notify = read('../../src/lib/projects/projectClientNotification.ts');
    assert.match(notify, /export async function notifyProjectFinished/);
    assert.match(notify, /projectFinishedClient/);
    assert.match(notify, /projectFinishedOwner/);
    assert.doesNotMatch(
      notify.slice(notify.indexOf('export async function notifyProjectFinished')),
      /portal_not_enabled/,
    );
    const route = read('../../src/app/api/tenant/[tenantId]/projects/[projectId]/route.ts');
    assert.match(route, /notifyProjectFinished/);
    assert.match(route, /justFinished/);
  });
});
