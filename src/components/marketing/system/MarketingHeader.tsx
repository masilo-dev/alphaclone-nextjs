'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/marketing/ui/sheet';
import { CTA_LABELS, DEMO_HREF, LOGIN_HREF, TRIAL_HREF } from '@/lib/marketing/cta';
import {
  COMPANY_NAV_GROUP,
  PRODUCT_NAV_GROUPS,
  RESOURCES_NAV_GROUP,
  SOLUTIONS_NAV_GROUP,
  type MarketingNavGroup,
  type MarketingNavLink,
} from '@/lib/marketing/siteNavigation';

type DropdownKey = 'product' | 'solutions' | 'resources' | 'company';

type DesktopDropdown = {
  key: DropdownKey;
  label: string;
  description: string;
  groups: MarketingNavGroup[];
  align?: 'left' | 'right';
  featured?: { title: string; body: string; href: string; cta: string };
};

const DESKTOP_DROPDOWNS: DesktopDropdown[] = [
  {
    key: 'product',
    label: 'Product',
    description: 'CRM, delivery, billing, documents, marketing, and AI.',
    groups: PRODUCT_NAV_GROUPS,
    featured: {
      title: 'See the full platform',
      body: 'One workspace from lead to paid invoice — with Bonnie AI in the loop.',
      href: '/ecosystem',
      cta: 'Explore platform',
    },
  },
  {
    key: 'solutions',
    label: 'Solutions',
    description: 'Ways service businesses use AlphaClone.',
    groups: [SOLUTIONS_NAV_GROUP],
  },
  {
    key: 'resources',
    label: 'Resources',
    description: 'Guides, documentation, and workflow examples.',
    groups: [RESOURCES_NAV_GROUP],
  },
  {
    key: 'company',
    label: 'Company',
    description: 'Policies, security, and company information.',
    groups: [COMPANY_NAV_GROUP],
    align: 'right',
  },
];

const MOBILE_SECTIONS = [
  { label: 'Product', groups: PRODUCT_NAV_GROUPS },
  { label: 'Solutions', groups: [SOLUTIONS_NAV_GROUP] },
  { label: 'Resources', groups: [RESOURCES_NAV_GROUP] },
  { label: 'Company', groups: [COMPANY_NAV_GROUP] },
] satisfies Array<{ label: string; groups: MarketingNavGroup[] }>;

function normalizePath(path: string): string {
  const [basePath] = path.split('#');
  return basePath || path;
}

function Logo() {
  return (
    <Link href="/" className="mkt-brand" aria-label="AlphaClone home">
      <span className="mkt-brand-mark" aria-hidden="true">
        <Image src="/logo.png" alt="" width={28} height={28} priority className="h-7 w-7 object-contain" />
      </span>
      <span className="mkt-brand-word">AlphaClone</span>
    </Link>
  );
}

function DropdownPanel({
  dropdown,
  onNavigate,
}: {
  dropdown: DesktopDropdown;
  onNavigate: () => void;
}) {
  const columns = Math.min(Math.max(dropdown.groups.length, 1), 3);

  return (
    <div
      id={`marketing-nav-${dropdown.key}`}
      className={`mkt-mega ${dropdown.align === 'right' ? 'is-right' : ''}`}
    >
      <div className="mkt-mega-inner">
        <div className="mkt-mega-copy">
          <p className="mkt-mega-eyebrow">{dropdown.label}</p>
          <p className="mkt-mega-desc">{dropdown.description}</p>
        </div>
        <div
          className="mkt-mega-grid"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {dropdown.groups.map((group) => (
            <div key={group.label} className="mkt-mega-col">
              <p className="mkt-mega-col-label">{group.label}</p>
              <div className="mkt-mega-links">
                {group.items.map((item) => (
                  <NavItemLink key={item.path} item={item} onNavigate={onNavigate} />
                ))}
              </div>
            </div>
          ))}
        </div>
        {dropdown.featured ? (
          <Link href={dropdown.featured.href} onClick={onNavigate} className="mkt-mega-featured">
            <span className="mkt-mega-featured-title">{dropdown.featured.title}</span>
            <span className="mkt-mega-featured-body">{dropdown.featured.body}</span>
            <span className="mkt-mega-featured-cta">
              {dropdown.featured.cta}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function NavItemLink({
  item,
  onNavigate,
}: {
  item: MarketingNavLink;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link href={item.path} onClick={onNavigate} className="mkt-mega-link">
      {Icon ? (
        <span className="mkt-mega-link-icon">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      ) : null}
      <span className="min-w-0">
        <span className="mkt-mega-link-label">{item.label}</span>
        {item.description ? (
          <span className="mkt-mega-link-desc">{item.description}</span>
        ) : null}
      </span>
    </Link>
  );
}

export default function MarketingHeader() {
  const pathname = usePathname();
  const [activeDropdown, setActiveDropdown] = useState<DropdownKey | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const desktopNavRef = useRef<HTMLDivElement>(null);

  const activeSections = useMemo(() => {
    const current = pathname ?? '/';
    const hasActiveItem = (groups: MarketingNavGroup[]) =>
      groups.some((group) =>
        group.items.some((item) => {
          const basePath = normalizePath(item.path);
          return current === basePath || (basePath !== '/' && current.startsWith(`${basePath}/`));
        })
      );

    return {
      product: hasActiveItem(PRODUCT_NAV_GROUPS),
      solutions: hasActiveItem([SOLUTIONS_NAV_GROUP]),
      resources: hasActiveItem([RESOURCES_NAV_GROUP]),
      company: hasActiveItem([COMPANY_NAV_GROUP]),
      pricing: current === '/pricing',
    };
  }, [pathname]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 32);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!activeDropdown) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (desktopNavRef.current?.contains(event.target as Node)) return;
      setActiveDropdown(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveDropdown(null);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeDropdown]);

  useEffect(() => {
    setActiveDropdown(null);
    setMobileOpen(false);
  }, [pathname]);

  const closeDropdowns = () => setActiveDropdown(null);
  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      <a href="#main-content" className="mkt-skip-link">
        Skip to main content
      </a>
      <header className={`mkt-header${isScrolled ? ' is-scrolled' : ''}${activeDropdown ? ' is-open' : ''}`}>
        <div className="mkt-container">
          <div className="mkt-header-bar">
            <Logo />

            <nav ref={desktopNavRef} className="mkt-nav-desktop" aria-label="Primary">
              {DESKTOP_DROPDOWNS.map((dropdown) => {
                const isOpen = activeDropdown === dropdown.key;
                const isActive = isOpen || activeSections[dropdown.key];

                return (
                  <div
                    key={dropdown.key}
                    className="mkt-nav-item"
                    onMouseEnter={() => setActiveDropdown(dropdown.key)}
                    onFocusCapture={() => setActiveDropdown(dropdown.key)}
                  >
                    <button
                      type="button"
                      className={`mkt-nav-trigger${isActive ? ' is-active' : ''}`}
                      aria-expanded={isOpen}
                      aria-controls={`marketing-nav-${dropdown.key}`}
                      onClick={() =>
                        setActiveDropdown((current) =>
                          current === dropdown.key ? null : dropdown.key
                        )
                      }
                    >
                      {dropdown.label}
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                    </button>
                    {isOpen ? (
                      <DropdownPanel dropdown={dropdown} onNavigate={closeDropdowns} />
                    ) : null}
                  </div>
                );
              })}

              <Link
                href="/pricing"
                className={`mkt-nav-trigger${activeSections.pricing ? ' is-active' : ''}`}
              >
                Pricing
              </Link>
            </nav>

            <div className="mkt-header-actions">
              <Link href={LOGIN_HREF} data-login-trigger className="mkt-nav-login">
                {CTA_LABELS.tertiaryLogin}
              </Link>
              <Link href={TRIAL_HREF} className="mkt-btn mkt-btn-primary mkt-btn-compact">
                {CTA_LABELS.primary}
              </Link>
              <Link href={DEMO_HREF} className="mkt-btn mkt-btn-secondary mkt-btn-compact">
                {CTA_LABELS.secondary}
              </Link>
            </div>

            <div className="mkt-header-mobile">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    className="mkt-mobile-toggle"
                    aria-label="Open navigation menu"
                    aria-expanded={mobileOpen}
                  >
                    <Menu className="h-5 w-5" aria-hidden="true" />
                  </button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  showCloseButton={false}
                  className="mkt-mobile-sheet w-[min(100vw,26rem)] overflow-y-auto border-[var(--marketing-border)] bg-[var(--marketing-bg-primary)]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <Logo />
                    <SheetClose className="mkt-mobile-toggle">
                      <X className="h-5 w-5" aria-hidden="true" />
                      <span className="sr-only">Close navigation menu</span>
                    </SheetClose>
                  </div>

                  <SheetHeader>
                    <SheetTitle className="text-[var(--marketing-text-primary)]">
                      Navigate AlphaClone
                    </SheetTitle>
                    <SheetDescription className="text-[var(--marketing-text-secondary)]">
                      Product, solutions, resources, and company pages.
                    </SheetDescription>
                  </SheetHeader>

                  <div className="grid gap-3">
                    <Link href={TRIAL_HREF} onClick={closeMobile} className="mkt-btn mkt-btn-primary w-full">
                      {CTA_LABELS.primary}
                    </Link>
                    <Link href={DEMO_HREF} onClick={closeMobile} className="mkt-btn mkt-btn-secondary w-full">
                      {CTA_LABELS.secondary}
                    </Link>
                    <Link
                      href={LOGIN_HREF}
                      onClick={closeMobile}
                      data-login-trigger
                      className="mkt-btn mkt-btn-ghost w-full border border-[var(--marketing-border)]"
                    >
                      {CTA_LABELS.tertiaryLogin}
                    </Link>
                  </div>

                  <nav className="grid gap-6 pt-2" aria-label="Mobile navigation">
                    <div>
                      <p className="mkt-mobile-section-label">Pricing</p>
                      <Link href="/pricing" onClick={closeMobile} className="mkt-mobile-pricing">
                        See plans and pricing
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </div>

                    {MOBILE_SECTIONS.map((section) => (
                      <div key={section.label}>
                        <p className="mkt-mobile-section-label">{section.label}</p>
                        <div className="mt-2 grid gap-3">
                          {section.groups.map((group) => (
                            <div key={group.label} className="mkt-mobile-group">
                              {section.groups.length > 1 ? (
                                <p className="px-2 py-2 text-xs font-semibold text-[var(--marketing-accent-hover)]">
                                  {group.label}
                                </p>
                              ) : null}
                              <div className="grid gap-1">
                                {group.items.map((item) => (
                                  <NavItemLink
                                    key={item.path}
                                    item={item}
                                    onNavigate={closeMobile}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
