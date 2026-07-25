/**
 * Marketing product mock — visual composition matching the homepage hero reference.
 * Demonstration data only; not a live workspace screenshot.
 */

const NAV = [
  'Dashboard',
  'CRM',
  'Projects',
  'Invoices',
  'Calendar',
  'Documents',
  'Marketing',
  'Reports',
  'AI Assistant',
  'Settings',
] as const;

const METRICS = [
  { label: 'Total Revenue', value: '$48,290', delta: '+12.4%', tone: 'teal' },
  { label: 'Invoices', value: '128', delta: '+8.1%', tone: 'blue' },
  { label: 'New Leads', value: '64', delta: '+18.2%', tone: 'teal' },
  { label: 'Projects', value: '23', delta: '+4.0%', tone: 'blue' },
] as const;

const UPCOMING = [
  { title: 'Client kickoff — Nexa', time: '10:00 AM' },
  { title: 'Invoice review', time: '1:30 PM' },
  { title: 'Proposal call', time: '4:00 PM' },
] as const;

const ACTIVITY = [
  { text: 'Invoice #1842 marked paid', meta: '2m ago' },
  { text: 'New lead from website form', meta: '14m ago' },
  { text: 'Contract signed — Vision Studio', meta: '1h ago' },
] as const;

export default function DashboardMockup() {
  return (
    <figure className="mkt-dashboard-wrap" aria-label="AlphaClone workspace preview">
      <div className="mkt-dashboard" role="img" aria-label="Demonstration AlphaClone dashboard with sample metrics">
        <aside className="mkt-dashboard-sidebar" aria-hidden="true">
          <div className="mkt-dashboard-brand">
            <span className="mkt-dashboard-brand-mark">A</span>
            <span>AlphaClone</span>
          </div>
          <nav className="mkt-dashboard-nav">
            {NAV.map((item, index) => (
              <div
                key={item}
                className={`mkt-dashboard-nav-item${index === 0 ? ' is-active' : ''}`}
              >
                <span className="mkt-dashboard-nav-dot" />
                {item}
              </div>
            ))}
          </nav>
        </aside>

        <div className="mkt-dashboard-main" aria-hidden="true">
          <header className="mkt-dashboard-topbar">
            <div>
              <p className="mkt-dashboard-greeting">Good morning, Daniel.</p>
              <p className="mkt-dashboard-sub">Here is what needs attention today.</p>
            </div>
            <div className="mkt-dashboard-avatar">D</div>
          </header>

          <div className="mkt-dashboard-metrics">
            {METRICS.map((metric) => (
              <div key={metric.label} className="mkt-dashboard-metric">
                <p className="mkt-dashboard-metric-label">{metric.label}</p>
                <p className="mkt-dashboard-metric-value">{metric.value}</p>
                <div className={`mkt-dashboard-spark tone-${metric.tone}`} />
                <p className="mkt-dashboard-metric-delta">{metric.delta}</p>
              </div>
            ))}
          </div>

          <div className="mkt-dashboard-panels">
            <div className="mkt-dashboard-panel">
              <p className="mkt-dashboard-panel-title">Upcoming</p>
              <ul className="mkt-dashboard-list">
                {UPCOMING.map((item) => (
                  <li key={item.title}>
                    <span>{item.title}</span>
                    <span>{item.time}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mkt-dashboard-panel">
              <p className="mkt-dashboard-panel-title">Recent Activity</p>
              <ul className="mkt-dashboard-list">
                {ACTIVITY.map((item) => (
                  <li key={item.text}>
                    <span>{item.text}</span>
                    <span>{item.meta}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mkt-dashboard-panel mkt-dashboard-actions">
              <p className="mkt-dashboard-panel-title">Quick Actions</p>
              <div className="mkt-dashboard-action-grid">
                <button type="button" tabIndex={-1}>New invoice</button>
                <button type="button" tabIndex={-1}>Add lead</button>
                <button type="button" tabIndex={-1}>Create project</button>
                <button type="button" tabIndex={-1}>Ask Bonnie</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-center text-sm text-[var(--marketing-text-muted)]">
        AlphaClone workspace preview — demonstration data
      </figcaption>
    </figure>
  );
}
