import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  computeProjectProgressPercent,
  finishedProjectWriteFields,
  isFinishedProject,
  normalizeProjectStatus,
} from '../../src/lib/projects/projectEnums.ts';

test('Closure / Completed / done all count as a finished project', () => {
  assert.equal(isFinishedProject({ status: 'Active', currentStage: 'Closure' }), true);
  assert.equal(isFinishedProject({ status: 'Completed', currentStage: 'Execution' }), true);
  assert.equal(isFinishedProject({ status: 'done' }), true);
  assert.equal(isFinishedProject({ status: 'Active', currentStage: 'Execution' }), false);
  assert.equal(normalizeProjectStatus('complete'), 'Completed');
});

test('marking finished writes Completed + Closure + 100% so the list cannot stay open', () => {
  const fields = finishedProjectWriteFields(new Date('2026-09-06T12:00:00Z'));
  assert.equal(fields.status, 'Completed');
  assert.equal(fields.current_stage, 'Closure');
  assert.equal(fields.progress, 100);
});

test('progress prefers tasks over leftover template milestones', () => {
  assert.equal(
    computeProjectProgressPercent({
      status: 'Active',
      currentStage: 'Execution',
      milestones: [{ status: 'pending' }, { status: 'pending' }, { status: 'pending' }],
      tasks: [{ status: 'completed' }, { status: 'completed' }],
    }),
    100,
  );
});

test('a finished project stays at 100% even if milestones are still open', () => {
  assert.equal(
    computeProjectProgressPercent({
      status: 'Completed',
      current_stage: 'Closure',
      milestones: [{ status: 'pending' }, { status: 'pending' }],
      tasks: [{ status: 'todo' }],
    }),
    100,
  );
});

test('opening a project does not plant unfinished milestones', () => {
  const source = readFileSync(
    new URL('../../src/components/dashboard/projects/ProjectWorkspaceDrawer.tsx', import.meta.url),
    'utf8',
  );
  assert.equal(source.includes('DEFAULT_MILESTONE_LABELS'), false);
  assert.equal(source.includes('Kickoff Meeting & Alignment'), false);
  assert.match(source, /No milestones yet/);
});
