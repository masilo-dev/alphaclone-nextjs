import Link from 'next/link';

type RelatedLink = {
  label: string;
  href: string;
};

type MarketingRelatedLinksProps = {
  links: RelatedLink[];
};

const CORE_LINKS: RelatedLink[] = [
  { label: 'About', href: '/about' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Services', href: '/services' },
];

/** Cross-links product pages to core marketing routes for crawl depth and sitelink signals. */
export default function MarketingRelatedLinks({ links }: MarketingRelatedLinksProps) {
  const merged = [...links];
  for (const core of CORE_LINKS) {
    if (!merged.some((link) => link.href === core.href)) {
      merged.push(core);
    }
  }

  return (
    <p className="mt-6 text-sm text-slate-400">
      Related pages:{' '}
      {merged.map((link, index) => (
        <span key={link.href}>
          {index > 0 ? ', ' : null}
          <Link href={link.href} className="text-cyan-300 hover:text-cyan-200">
            {link.label}
          </Link>
        </span>
      ))}
    </p>
  );
}
