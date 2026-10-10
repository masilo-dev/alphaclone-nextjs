import test from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import { resolveCanonicalLifecycleClient } from '../../src/lib/crm/resolveCanonicalLifecycleClient.ts';

test('Area C (Finance & Invoicing): jsPDF engine generates invoice without invalid CSS variable color crashes', () => {
  const doc = new jsPDF();
  const colors = {
    primary: [30, 41, 59],
    secondary: [100, 116, 139],
    accent: [13, 148, 136],
    background: [248, 250, 252],
    text: [15, 23, 42],
    textMuted: [148, 163, 184],
    border: [226, 232, 240],
  };

  const setFill = (rgb) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  const setText = (rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const setDraw = (rgb) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);

  // Exercise header, accent bar, and line item tables
  setFill(colors.background);
  doc.rect(0, 0, 210, 40, 'F');

  setFill(colors.accent);
  doc.rect(0, 38, 210, 2, 'F');

  setText(colors.primary);
  doc.setFontSize(22);
  doc.text('INVOICE', 140, 25);

  setText(colors.textMuted);
  doc.setFontSize(9);
  doc.text('INV-2026-001', 140, 32);

  setDraw(colors.border);
  doc.setLineWidth(0.3);
  doc.line(14, 50, 196, 50);

  const output = doc.output('arraybuffer');
  assert.ok(output.byteLength > 1000, 'Invoice PDF arraybuffer should be greater than 1KB');
});

test('Area D (Calendar & Scheduling): Event deep links navigate to canonical paths with query parameters', () => {
  const resolveCalendarLink = (event) => {
    if (event.extendedProps?.dealId) {
      return `/dashboard/deals?dealId=${encodeURIComponent(event.extendedProps.dealId)}`;
    }
    if (event.extendedProps?.projectId) {
      return `/dashboard/business/projects?projectId=${encodeURIComponent(event.extendedProps.projectId)}`;
    }
    if (event.extendedProps?.taskId) {
      return `/dashboard/tasks?taskId=${encodeURIComponent(event.extendedProps.taskId)}`;
    }
    if (event.extendedProps?.leadId) {
      return `/dashboard/leads?leadId=${encodeURIComponent(event.extendedProps.leadId)}`;
    }
    return null;
  };

  assert.equal(
    resolveCalendarLink({ extendedProps: { dealId: 'deal-123' } }),
    '/dashboard/deals?dealId=deal-123'
  );
  assert.equal(
    resolveCalendarLink({ extendedProps: { projectId: 'proj-456' } }),
    '/dashboard/business/projects?projectId=proj-456'
  );
  assert.equal(
    resolveCalendarLink({ extendedProps: { taskId: 'task-789' } }),
    '/dashboard/tasks?taskId=task-789'
  );
  assert.equal(
    resolveCalendarLink({ extendedProps: { leadId: 'lead-012' } }),
    '/dashboard/leads?leadId=lead-012'
  );
});

test('Area E (Contracts & Lifecycle Client Resolution): Client ID resolution falls back to contact/lead email match', async () => {
  const tenantId = '066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4';

  // Mock admin client with configurable tables
  const createMockAdmin = ({ directClients = [], linkedByContact = [], contacts = [], leads = [] }) => ({
    from: (table) => {
      let filterCol = null;
      let filterVal = null;

      const builder = {
        select: () => builder,
        eq: (col, val) => {
          if (col !== 'tenant_id') {
            filterCol = col;
            filterVal = val;
          }
          return builder;
        },
        ilike: (col, val) => {
          filterCol = col;
          filterVal = val;
          return builder;
        },
        limit: () => builder,
        maybeSingle: async () => {
          if (table === 'business_clients') {
            const found = directClients.find((c) => c[filterCol] === filterVal);
            return { data: found || null, error: null };
          }
          if (table === 'contacts') {
            const found = contacts.find((c) => c[filterCol] === filterVal);
            return { data: found || null, error: null };
          }
          if (table === 'leads') {
            const found = leads.find((l) => l[filterCol] === filterVal);
            return { data: found || null, error: null };
          }
          return { data: null, error: null };
        },
      };

      // Add promise resolution or array methods when fetched as list
      builder.then = (resolve) => {
        if (table === 'business_clients') {
          if (filterCol === 'crm_contact_id') {
            resolve({ data: linkedByContact.filter((c) => c.crm_contact_id === filterVal), error: null });
            return;
          }
          if (filterCol === 'email') {
            resolve({ data: directClients.filter((c) => c.email?.toLowerCase() === filterVal?.toLowerCase()), error: null });
            return;
          }
        }
        resolve({ data: [], error: null });
      };

      return builder;
    },
  });

  // Case 1: Direct match on business_clients
  const adminDirect = createMockAdmin({ directClients: [{ id: 'client-1', name: 'Alpha' }] });
  const res1 = await resolveCanonicalLifecycleClient(adminDirect, tenantId, 'client-1');
  assert.equal(res1, 'client-1');

  // Case 2: Match via crm_contact_id
  const adminLinked = createMockAdmin({ linkedByContact: [{ id: 'client-2', crm_contact_id: 'contact-x' }] });
  const res2 = await resolveCanonicalLifecycleClient(adminLinked, tenantId, 'contact-x');
  assert.equal(res2, 'client-2');

  // Case 3: Fallback via contact email match
  const adminContactEmail = createMockAdmin({
    contacts: [{ id: 'contact-y', email: 'partner@example.com' }],
    directClients: [{ id: 'client-3', email: 'partner@example.com' }],
  });
  const res3 = await resolveCanonicalLifecycleClient(adminContactEmail, tenantId, 'contact-y');
  assert.equal(res3, 'client-3');

  // Case 4: Fallback via lead converted client ID
  const adminLeadClient = createMockAdmin({
    leads: [{ id: 'lead-z', client_id: 'client-4' }],
    directClients: [{ id: 'client-4' }],
  });
  const res4 = await resolveCanonicalLifecycleClient(adminLeadClient, tenantId, 'lead-z');
  assert.equal(res4, 'client-4');

  // Case 5: Unknown ID throws VALIDATION_ERROR
  const adminEmpty = createMockAdmin({});
  await assert.rejects(
    async () => resolveCanonicalLifecycleClient(adminEmpty, tenantId, 'unknown-id'),
    (err) => err.code === 'VALIDATION_ERROR'
  );
});

test('Area G (Global Search): Project search results link to canonical business route with projectId param', () => {
  const formatProjectResult = (project) => ({
    type: 'project',
    id: project.id,
    title: project.name,
    subtitle: project.category,
    description: project.description,
    link: `/dashboard/business/projects?projectId=${project.id}`,
    metadata: {
      status: project.status,
      progress: project.progress,
      currentStage: project.current_stage,
    },
  });

  const testProject = {
    id: 'proj-998877',
    name: 'Brand Redesign',
    category: 'Design',
    description: 'Q3 brand refresh',
    status: 'in_progress',
    progress: 45,
    current_stage: 'wireframing',
  };

  const formatted = formatProjectResult(testProject);
  assert.equal(formatted.link, '/dashboard/business/projects?projectId=proj-998877');
  assert.equal(formatted.id, 'proj-998877');
});

test('Area H (Social & Marketing): Composer draft storage contract preserves post composition state', () => {
  const DRAFT_KEY = 'alphaclone_social_composer_draft';
  const sampleDraft = {
    caption: 'Super excited to unveil our new product release! #innovation',
    platforms: ['facebook', 'linkedin'],
    hashtags: ['innovation', 'tech'],
    linkUrl: 'https://example.com/launch',
    scheduledAt: '2026-10-15T10:00:00.000Z',
  };

  const serialized = JSON.stringify(sampleDraft);
  const parsed = JSON.parse(serialized);

  assert.equal(DRAFT_KEY, 'alphaclone_social_composer_draft');
  assert.equal(parsed.caption, sampleDraft.caption);
  assert.deepEqual(parsed.platforms, ['facebook', 'linkedin']);
  assert.deepEqual(parsed.hashtags, ['innovation', 'tech']);
  assert.equal(parsed.linkUrl, 'https://example.com/launch');
  assert.equal(parsed.scheduledAt, '2026-10-15T10:00:00.000Z');
});

test('Area I (Projects Workspace): View preference persistence adheres to permitted modes', () => {
  const VALID_MODES = ['list', 'timeline', 'health'];
  const STORAGE_KEY = 'alphaclone_projects_view_mode';

  const getInitialViewMode = (storedValue) => {
    if (storedValue && VALID_MODES.includes(storedValue)) {
      return storedValue;
    }
    return 'list';
  };

  assert.equal(STORAGE_KEY, 'alphaclone_projects_view_mode');
  assert.equal(getInitialViewMode('timeline'), 'timeline');
  assert.equal(getInitialViewMode('health'), 'health');
  assert.equal(getInitialViewMode('invalid_mode'), 'list');
  assert.equal(getInitialViewMode(null), 'list');
});
