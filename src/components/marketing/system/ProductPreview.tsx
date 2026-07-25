/**
 * Compact conversion-focused AlphaClone product proof for the marketing hero.
 * Keeps the preview readable without dominating laptop viewports.
 */

import { AlphaIcon, type AlphaIconName } from '@/components/marketing/icons';
import { ProductPreviewGlow } from './atmosphere';

const METRICS = [
  { label: 'Revenue', value: '$48.2k' },
  { label: 'Invoices', value: '128' },
  { label: 'Leads', value: '64' },
  { label: 'Projects', value: '23' },
] as const;

const NAV: Array<{ label: string; icon: AlphaIconName; active?: boolean }> = [
  { label: 'Dashboard', icon: 'connected', active: true },
  { label: 'CRM', icon: 'crm' },
  { label: 'Projects', icon: 'projects' },
  { label: 'Invoices', icon: 'invoicing' },
  { label: 'Bonnie AI', icon: 'bonnie' },
];

export default function ProductPreview() {
  return (
    <figure className="mkt-preview-wrap">
      <ProductPreviewGlow />
      <div
        className="mkt-preview mkt-preview-compact"
        role="img"
        aria-label="AlphaClone workspace preview with demonstration dashboard metrics"
      >
        <aside className="mkt-preview-sidebar" aria-hidden="true">
          <div className="mkt-preview-brand">
            <span className="mkt-preview-brand-mark">A</span>
            <span>AlphaClone</span>
          </div>
          <nav className="mkt-preview-nav">
            {NAV.map((item) => (
              <div key={item.label} className={`mkt-preview-nav-item${item.active ? ' is-active' : ''}`}>
                <AlphaIcon name={item.icon} variant="nav" size="xs" className="mkt-preview-nav-icon" />
                {item.label}
              </div>
            ))}
          </nav>
        </aside>

        <div className="mkt-preview-main" aria-hidden="true">
          <div className="mkt-preview-greeting">
            <strong>Your business, one workspace</strong>
            <span>Clients · projects · invoices · AI</span>
          </div>
          <div className="mkt-preview-metrics">
            {METRICS.map((metric) => (
              <div key={metric.label} className="mkt-preview-metric">
                <p className="mkt-preview-metric-label">{metric.label}</p>
                <p className="mkt-preview-metric-value">{metric.value}</p>
              </div>
            ))}
          </div>
          <div className="mkt-preview-convert-row">
            <span>Lead → Project → Invoice</span>
            <span>Connected</span>
          </div>
        </div>
      </div>
      <figcaption className="mkt-preview-caption">
        Product preview — demonstration data
      </figcaption>
    </figure>
  );
}
