/**
 * Unit tests for platform KPI registry and date range utilities.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  PLATFORM_METRIC_REGISTRY,
  getMetricDefinition,
  getMetricsForModule,
  metricPolarityIsBetterHigher,
} = await import('../../src/lib/metrics/platformMetricRegistry.ts');

const {
  resolveMetricDateRange,
  periodPresetToIsoRange,
  METRIC_PERIOD_OPTIONS,
} = await import('../../src/lib/metrics/dateRange.ts');

const {
  platformKpiFromDashboardMetric,
  platformKpiFromModuleStat,
  platformKpiFromNumbers,
} = await import('../../src/lib/metrics/metricPresentation.ts');

test('platform metric registry includes core home and admin metrics', () => {
  assert.ok(getMetricDefinition('home.total_revenue'));
  assert.ok(getMetricDefinition('crm.total_contacts'));
  assert.ok(getMetricDefinition('admin.total_users'));
  assert.equal(getMetricsForModule('home').length >= 8, true);
});

test('lower-is-better metrics invert sentiment polarity', () => {
  const overdue = getMetricDefinition('home.outstanding_invoices');
  assert.ok(overdue);
  assert.equal(metricPolarityIsBetterHigher(overdue.polarity), false);
});

test('resolveMetricDateRange compares against prior equivalent period', () => {
  const now = new Date('2026-08-28T12:00:00Z');
  const range = resolveMetricDateRange('last_7_days', now);
  assert.equal(range.label, 'Last 7 days');
  assert.equal(range.comparisonLabel, 'vs previous 7 days');
  assert.ok(range.previousEnd < range.start);
});

test('periodPresetToIsoRange returns ISO bounds', () => {
  const iso = periodPresetToIsoRange('last_30_days');
  assert.ok(iso.startIso);
  assert.ok(iso.endIso);
  assert.ok(iso.previousStartIso);
  assert.ok(iso.comparisonLabel.includes('30'));
});

test('METRIC_PERIOD_OPTIONS covers required presets', () => {
  const ids = METRIC_PERIOD_OPTIONS.map((o) => o.id);
  for (const id of ['today', 'last_7_days', 'last_30_days', 'this_month', 'this_quarter', 'this_year']) {
    assert.ok(ids.includes(id), `missing preset ${id}`);
  }
});

test('platformKpiFromDashboardMetric respects lower-is-better registry polarity', () => {
  const model = platformKpiFromDashboardMetric(
    { label: 'Outstanding', value: '$12,000', delta: '+5%', deltaColor: 'green' },
    { metricId: 'home.outstanding_invoices' },
  );
  assert.equal(model.isBetterHigher, false);
});

test('platformKpiFromModuleStat preserves formatted values', () => {
  const model = platformKpiFromModuleStat({
    label: 'Paid invoices',
    value: '$4,200',
    sub: 'vs last month',
  });
  assert.equal(model.formattedValue, '$4,200');
  assert.equal(model.state, 'ready');
});

test('platformKpiFromNumbers uses empty state when value is null', () => {
  const model = platformKpiFromNumbers({
    label: 'Forecast revenue',
    current: null,
  });
  assert.equal(model.state, 'empty');
});

test('every registry entry has required metadata', () => {
  for (const def of Object.values(PLATFORM_METRIC_REGISTRY)) {
    assert.ok(def.id);
    assert.ok(def.label);
    assert.ok(def.description);
    assert.ok(def.dataSource);
    assert.ok(['number', 'currency', 'percent', 'duration', 'text'].includes(def.format));
  }
});

test('platformKpiFromDashboardMetric preserves comparison label', () => {
  const model = platformKpiFromDashboardMetric(
    {
      label: 'Emails sent',
      value: 120,
      delta: '20%',
      deltaDir: 'up',
      deltaColor: 'green',
      comparisonText: 'vs previous 30 days',
    },
  );
  assert.equal(model.referencePeriod, 'vs previous 30 days');
  assert.ok(model.previous != null);
});

test('periodPresetToIsoRange exposes month comparison label', () => {
  const iso = periodPresetToIsoRange('this_month');
  assert.equal(iso.comparisonLabel, 'vs previous month');
});
