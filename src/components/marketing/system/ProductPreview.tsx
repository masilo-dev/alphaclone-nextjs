'use client';

import { useEffect, useRef } from 'react';

const NAV = [
  'Dashboard',
  'CRM',
  'Projects',
  'Invoices',
  'Calendar',
  'Documents',
  'Marketing',
  'Reports',
  'Bonnie AI',
  'Settings',
] as const;

const METRICS = [
  { label: 'Revenue', value: '$48,290', delta: '+12.4%', tone: 'teal' as const },
  { label: 'Invoices', value: '128', delta: '+8.1%', tone: 'blue' as const },
  { label: 'New leads', value: '64', delta: '+18.2%', tone: 'teal' as const },
  { label: 'Projects', value: '23', delta: '+4.0%', tone: 'blue' as const },
];

const UPCOMING = [
  { title: 'Client kickoff', time: '10:00' },
  { title: 'Invoice review', time: '13:30' },
  { title: 'Proposal call', time: '16:00' },
];

const ACTIVITY = [
  { text: 'Invoice #1842 marked paid', meta: '2m' },
  { text: 'New lead from website form', meta: '14m' },
  { text: 'Contract signed', meta: '1h' },
];

/**
 * HTML/CSS AlphaClone product demonstration for marketing.
 * Uses illustrative demo data only — not live customer information.
 */
export default function ProductPreview() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (reduceMotion || coarse) return;

    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      el.style.transform = `perspective(1200px) rotateX(${(-y * 1.4).toFixed(2)}deg) rotateY(${(x * 1.4).toFixed(2)}deg)`;
    };

    const onLeave = () => {
      el.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg)';
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <figure className="mkt-preview-wrap">
      <div
        ref={ref}
        className="mkt-preview"
        role="img"
        aria-label="AlphaClone workspace preview showing dashboard metrics, schedule, and activity with demonstration data"
      >
        <aside className="mkt-preview-sidebar" aria-hidden="true">
          <div className="mkt-preview-brand">
            <span className="mkt-preview-brand-mark">A</span>
            <span>AlphaClone</span>
          </div>
          <nav className="mkt-preview-nav">
            {NAV.map((item, index) => (
              <div key={item} className={`mkt-preview-nav-item${index === 0 ? ' is-active' : ''}`}>
                <span className="mkt-preview-nav-dot" />
                {item}
              </div>
            ))}
          </nav>
        </aside>

        <div className="mkt-preview-main" aria-hidden="true">
          <div className="mkt-preview-topbar">
            <div className="mkt-preview-search">Search workspace…</div>
            <div className="mkt-preview-top-actions">
              <span className="mkt-preview-pill">Workspace</span>
              <span className="mkt-preview-pill">3</span>
              <span className="mkt-preview-avatar">A</span>
            </div>
          </div>

          <div className="mkt-preview-greeting">
            <strong>Good morning</strong>
            <span>Here is what needs attention today.</span>
          </div>

          <div className="mkt-preview-metrics">
            {METRICS.map((metric) => (
              <div key={metric.label} className="mkt-preview-metric">
                <p className="mkt-preview-metric-label">{metric.label}</p>
                <p className="mkt-preview-metric-value">{metric.value}</p>
                <div className={`mkt-preview-spark ${metric.tone}`} />
                <p className="mkt-preview-metric-delta">{metric.delta}</p>
              </div>
            ))}
          </div>

          <div className="mkt-preview-panels">
            <div className="mkt-preview-panel">
              <p className="mkt-preview-panel-title">Upcoming</p>
              <ul className="mkt-preview-list">
                {UPCOMING.map((item) => (
                  <li key={item.title}>
                    <span>{item.title}</span>
                    <span>{item.time}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mkt-preview-panel">
              <p className="mkt-preview-panel-title">Recent activity</p>
              <ul className="mkt-preview-list">
                {ACTIVITY.map((item) => (
                  <li key={item.text}>
                    <span>{item.text}</span>
                    <span>{item.meta}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mkt-preview-panel">
              <p className="mkt-preview-panel-title">Quick actions</p>
              <div className="mkt-preview-actions">
                <span>New invoice</span>
                <span>Add lead</span>
                <span>Create project</span>
                <span>Ask Bonnie</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mkt-preview-caption">
        AlphaClone workspace preview — demonstration data
      </figcaption>
    </figure>
  );
}
