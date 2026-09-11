import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('companion capability matrix covers the required product levels', () => {
  const source = read('src/config/pwaCompanionCapabilities.ts');
  for (const level of ['FULL', 'COMPANION', 'READ_ONLY', 'DESKTOP']) {
    assert.match(source, new RegExp(`'${level}'`));
  }
  for (const moduleName of [
    'home', 'bonnie', 'notifications', 'calendar', 'tasks', 'projects', 'crm', 'leads',
    'invoices', 'quotes', 'contracts', 'social', 'documents', 'marketing', 'money',
    'reporting', 'goals', 'nexus', 'control', 'settings', 'admin',
  ]) {
    assert.match(source, new RegExp(`\\b${moduleName}:`), `missing ${moduleName} capability`);
  }
});

test('installed companion navigation is Home Work Bonnie Inbox More', () => {
  const source = read('src/components/dashboard/BottomNav.tsx');
  const labels = ['Home', 'Work', 'Bonnie', 'Inbox', 'More'];
  let previous = -1;
  for (const label of labels) {
    const index = source.indexOf(`label: '${label}'`);
    assert.ok(index > previous, `${label} should appear in canonical order`);
    previous = index;
  }
  assert.doesNotMatch(source, /navigator\.userAgent/);
});

test('device experience centralizes behavior capabilities', () => {
  const source = read('src/hooks/useDeviceExperience.ts');
  for (const capability of [
    'supportsAdvancedWorkspace',
    'supportsDenseTables',
    'supportsDragDrop',
    'supportsLargeEditor',
    'supportsDesktopOnlyAction',
  ]) {
    assert.match(source, new RegExp(capability));
  }
});

test('desktop handoff is a product state, not an error state', () => {
  const source = read('src/components/ui/os/DesktopRequired.tsx');
  assert.match(source, /Advanced controls are available on desktop/);
  assert.match(source, /mobile companion/);
  assert.match(source, /Open desktop version/);
  assert.doesNotMatch(source, /error/i);
});
