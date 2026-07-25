'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Menu, X } from 'lucide-react';
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
};

const DESKTOP_DROPDOWNS: DesktopDropdown[] = [
  {
    key: 'product',
    label: 'Product',
    description: 'CRM, delivery, billing, documents, marketing, and AI.',
    groups: PRODUCT_NAV_GROUPS,
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
    <Link
      href="/"
      className="inline-flex items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--marketing-focus)]"
      aria-label="AlphaClone home"
    >
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
        <Image
          src="/logo.png"
          alt=""
          width={36}
          height={36}
          priority
          className="h-9 w-9 object-contain"
        />
      </span>
      <span className="font-marketing-heading text-xl font-bold tracking-tight text-[var(--marketing-text-primary)]">
        AlphaClone
      </span>
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
  return (
    <div
      id={`marketing-nav-${dropdown.key}`}
      className={`absolute top-[calc(100%+0.75rem)] z-50 w-[min(42rem,calc(100vw-2rem))] overflow-hidden rounded-[var(--marketing-radius-lg)] border border-[var(--marketing-border)] bg-[var(--marketing-bg-secondary)] shadow-[var(--marketing-shadow-md)] ${
        dropdown.align === 'right' ? 'right-0' : 'left-0'
      }`}
    >
      <div className="border-b border-[var(--marketing-border)] bg-[var(--marketing-accent-soft)] px-5 py-4">
        <p className="text-sm font-semibold text-[var(--marketing-accent-hover)]">
          {dropdown.label}
        </p>
        <p className="mt-1 text-sm text-[var(--marketing-text-secondary)]">
          {dropdown.description}
        </p>
      </div>
      <div className="grid gap-1 p-3 sm:grid-cols-2">
        {dropdown.groups.map((group) => (
          <div key={group.label} className="rounded-[var(--marketing-radius-md)] p-2">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--marketing-text-muted)]">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavItemLink key={item.path} item={item} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
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
    <Link
      href={item.path}
      onClick={onNavigate}
      className="group flex items-start gap-3 rounded-[var(--marketing-radius-md)] px-2 py-2.5 text-[var(--marketing-text-secondary)] transition-colors hover:bg-[var(--marketing-surface)] hover:text-[var(--marketing-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-focus)]"
    >
      {Icon ? (
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--marketing-radius-sm)] bg-[var(--marketing-accent-soft)] text-[var(--marketing-accent-hover)]">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      ) : null}
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-5">{item.label}</span>
        {item.description ? (
          <span className="mt-0.5 block text-xs leading-5 text-[var(--marketing-text-muted)]">
            {item.description}
          </span>
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
    const handleScroll = () => setIsScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!activeDropdown) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (desktopNavRef.current?.contains(event.target as Node)) {
        return;
      }
      setActiveDropdown(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveDropdown(null);
      }
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

  const navButtonClass = (isActive: boolean) =>
    `inline-flex h-10 items-center gap-1.5 rounded-[var(--marketing-radius-sm)] px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-focus)] ${
      isActive
        ? 'bg-[var(--marketing-accent-soft)] text-[var(--marketing-accent-hover)]'
        : 'text-[var(--marketing-text-secondary)] hover:bg-[var(--marketing-surface)] hover:text-[var(--marketing-text-primary)]'
    }`;

  return (
    <>
      <a href="#main-content" className="mkt-skip-link">
        Skip to main content
      </a>
      <header
        className={`fixed inset-x-0 top-0 z-[1000] border-b transition-colors ${
          isScrolled
            ? 'border-[var(--marketing-border)] bg-[var(--marketing-bg-primary)]/95 backdrop-blur-xl'
            : 'border-transparent bg-[var(--marketing-bg-primary)]/90 backdrop-blur-lg'
        }`}
      >
        <div className="mkt-container">
          <div className="flex h-20 items-center justify-between gap-4">
            <Logo />

            <div ref={desktopNavRef} className="hidden items-center gap-1 lg:flex">
              {DESKTOP_DROPDOWNS.map((dropdown) => {
                const isOpen = activeDropdown === dropdown.key;
                const isActive = isOpen || activeSections[dropdown.key];

                return (
                  <div key={dropdown.key} className="relative">
                    <button
                      type="button"
                      className={navButtonClass(isActive)}
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
                        className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                    </button>
                    {isOpen ? (
                      <DropdownPanel dropdown={dropdown} onNavigate={closeDropdowns} />
                    ) : null}
                  </div>
                );
              })}

              <Link href="/pricing" className={navButtonClass(activeSections.pricing)}>
                Pricing
              </Link>
            </div>

            <div className="hidden items-center gap-2 lg:flex">
              <Link href={LOGIN_HREF} data-login-trigger className="mkt-btn mkt-btn-ghost">
                {CTA_LABELS.tertiaryLogin}
              </Link>
              <Link href={TRIAL_HREF} className="mkt-btn mkt-btn-primary">
                {CTA_LABELS.primary}
              </Link>
              <Link href={DEMO_HREF} className="mkt-btn mkt-btn-secondary">
                {CTA_LABELS.secondary}
              </Link>
            </div>

            <div className="lg:hidden">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--marketing-radius-md)] border border-[var(--marketing-border)] text-[var(--marketing-text-primary)] transition-colors hover:border-[var(--marketing-accent)] hover:text-[var(--marketing-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-focus)]"
                    aria-label="Open navigation menu"
                    aria-expanded={mobileOpen}
                  >
                    <Menu className="h-5 w-5" aria-hidden="true" />
                  </button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  showCloseButton={false}
                  className="w-[min(100vw,26rem)] overflow-y-auto border-[var(--marketing-border)] bg-[var(--marketing-bg-primary)] shadow-[0_24px_80px_-32px_rgba(20,184,166,0.35)]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <Logo />
                    <SheetClose className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--marketing-radius-md)] border border-[var(--marketing-border)] text-[var(--marketing-text-secondary)] transition-colors hover:border-[var(--marketing-accent)] hover:text-[var(--marketing-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-focus)]">
                      <X className="h-5 w-5" aria-hidden="true" />
                      <span className="sr-only">Close navigation menu</span>
                    </SheetClose>
                  </div>

                  <SheetHeader>
                    <SheetTitle className="text-[var(--marketing-text-primary)]">
                      AlphaClone navigation
                    </SheetTitle>
                    <SheetDescription className="text-[var(--marketing-text-secondary)]">
                      Explore the connected platform for service businesses.
                    </SheetDescription>
                  </SheetHeader>

                  <div className="grid gap-3">
                    <Link
                      href={TRIAL_HREF}
                      onClick={closeMobile}
                      className="mkt-btn mkt-btn-primary w-full"
                    >
                      {CTA_LABELS.primary}
                    </Link>
                    <Link
                      href={DEMO_HREF}
                      onClick={closeMobile}
                      className="mkt-btn mkt-btn-secondary w-full"
                    >
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
                      <p className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--marketing-text-muted)]">
                        Pricing
                      </p>
                      <Link
                        href="/pricing"
                        onClick={closeMobile}
                        className="mt-2 flex min-h-12 items-center rounded-[var(--marketing-radius-md)] border border-[var(--marketing-border)] px-4 py-3 text-base font-semibold text-[var(--marketing-text-primary)] transition-colors hover:border-[var(--marketing-accent)] hover:text-[var(--marketing-accent-hover)]"
                      >
                        See plans and pricing
                      </Link>
                    </div>

                    {MOBILE_SECTIONS.map((section) => (
                      <div key={section.label}>
                        <p className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--marketing-text-muted)]">
                          {section.label}
                        </p>
                        <div className="mt-2 grid gap-3">
                          {section.groups.map((group) => (
                            <div
                              key={group.label}
                              className="rounded-[var(--marketing-radius-md)] border border-[var(--marketing-border)] p-2"
                            >
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
