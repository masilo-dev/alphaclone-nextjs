import Link from 'next/link';
import { AlphaIcon, IconFrame, type AlphaIconName } from '@/components/marketing/icons';

const ICON_ALIASES: Record<string, AlphaIconName> = {
  users: 'crm',
  target: 'leads',
  check: 'projects',
  file: 'documents',
  video: 'calendar',
  receipt: 'invoicing',
  bot: 'bonnie',
  mail: 'marketing',
  workflow: 'workflow',
  megaphone: 'marketing',
};

export function FeatureCard({
  name,
  outcome,
  href,
  icon,
}: {
  name: string;
  outcome: string;
  href: string;
  icon: string;
}) {
  const iconName = ICON_ALIASES[icon] ?? 'connected';
  return (
    <Link
      href={href}
      className="mkt-surface group block p-5 transition-colors hover:border-[rgba(20,184,166,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-focus)]"
    >
      <IconFrame size="sm" className="mb-4">
        <AlphaIcon name={iconName} variant="feature" size="md" />
      </IconFrame>
      <h3 className="text-lg font-semibold text-[var(--marketing-text-primary)] group-hover:text-[var(--marketing-accent-hover)]">
        {name}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--marketing-text-secondary)]">{outcome}</p>
    </Link>
  );
}

export function WorkflowStep({
  step,
  title,
  body,
}: {
  step: number;
  title: string;
  body: string;
}) {
  return (
    <div className="relative mkt-surface p-6">
      <div className="mb-3 text-sm font-bold text-[var(--marketing-accent-hover)]">Step {step}</div>
      <h3 className="text-lg font-semibold text-[var(--marketing-text-primary)]">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--marketing-text-secondary)]">{body}</p>
    </div>
  );
}

export function TrustStrip({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-full border border-[var(--marketing-border)] bg-[var(--marketing-surface)] px-3.5 py-1.5 text-xs sm:text-sm font-medium text-[var(--marketing-text-secondary)]"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}
