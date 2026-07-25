/**
 * Compact conversion-focused AlphaClone product proof for the marketing hero.
 * Keeps the preview readable without dominating laptop viewports.
 */

import { ProductPreviewGlow } from './atmosphere';

const METRICS = [
  { label: 'Revenue', value: '$48.2k' },
  { label: 'Invoices', value: '128' },
  { label: 'Leads', value: '64' },
  { label: 'Projects', value: '23' },
] as const;

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
            {['Dashboard', 'CRM', 'Projects', 'Invoices', 'Bonnie AI'].map((item, index) => (
              <div key={item} className={`mkt-preview-nav-item${index === 0 ? ' is-active' : ''}`}>
                <span className="mkt-preview-nav-dot" />
                {item}
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
