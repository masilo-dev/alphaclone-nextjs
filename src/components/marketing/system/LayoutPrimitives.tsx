import type { ReactNode } from 'react';

export function MarketingContainer({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'header' | 'footer' | 'nav';
}) {
  return <Tag className={`mkt-container ${className}`.trim()}>{children}</Tag>;
}

export function MarketingSection({
  id,
  children,
  className = '',
  tone = 'default',
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  tone?: 'default' | 'muted' | 'accent';
}) {
  const toneClass =
    tone === 'muted'
      ? 'bg-[var(--background-section)]'
      : tone === 'accent'
        ? 'bg-[var(--background-elevated)]'
        : '';

  return (
    <section id={id} className={`mkt-section ${toneClass} ${className}`.trim()}>
      {children}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  as: Tag = 'h2',
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'center' | 'left';
  as?: 'h1' | 'h2' | 'h3';
}) {
  return (
    <div className={`mb-10 max-w-3xl ${align === 'center' ? 'mx-auto text-center' : 'text-left'}`}>
      {eyebrow ? <p className="mkt-label mb-4">{eyebrow}</p> : null}
      <Tag className="font-marketing-heading tracking-tight text-[var(--marketing-text-primary)]">
        {title}
      </Tag>
      {description ? (
        <p className="mt-4 text-sm sm:text-base text-[var(--marketing-text-secondary)] leading-relaxed">
          {description}
        </p>
      ) : null}
    </div>
  );
}
