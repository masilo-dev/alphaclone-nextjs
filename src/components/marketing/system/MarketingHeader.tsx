'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from '@/components/marketing/ui/sheet';
import {
  CTA_LABELS,
  DEMO_HREF,
  LOGIN_HREF,
  PRODUCT_NAV_GROUP,
  SOLUTIONS_NAV_GROUP,
  RESOURCES_NAV_GROUP,
  COMPANY_NAV_GROUP,
  type MarketingNavLink,
} from '@/lib/marketing/siteNavigation';
import { SecondaryCTA } from '@/components/marketing/system/CtaButtons';
import { AlphaIcon, type AlphaIconName } from '@/components/marketing/icons';
import { useLanguage } from '@/contexts/LanguageContext';

type DropdownKey = 'product' | 'solutions' | 'resources' | 'company';

const LUCIDE_TO_ALPHA: Record<string, AlphaIconName> = {
  Users: 'crm',
  Compass: 'leads',
  CheckSquare: 'projects',
  FileText: 'documents',
  Video: 'connected',
  Receipt: 'invoicing',
  Mail: 'leads',
  Workflow: 'setup',
  Megaphone: 'marketing',
  Calendar: 'reports',
  Bot: 'bonnie',
  Plug: 'integrations',
  Layers: 'connected',
  Briefcase: 'growth',
  Building2: 'organisation',
  BookOpen: 'setup',
  HelpCircle: 'reports',
  Newspaper: 'marketing',
  Shield: 'security',
};

const PRODUCT_LINKS: MarketingNavLink[] = PRODUCT_NAV_GROUP.items.filter(
  (item) =>
    // Drop "Documents & contracts" (/docs#contracts) — the "Docs" entry
    // under Resources already takes visitors to /docs. The anchor variant
    // duplicates that surface and wastes a mobile list row.
    !(item.path === '/docs#contracts') &&
    // Drop "Invoicing & billing" (/docs#financials) — same rationale.
    !(item.path === '/docs#financials')
);

const SOLUTIONS_LINKS: MarketingNavLink[] = SOLUTIONS_NAV_GROUP.items;
const RESOURCES_LINKS: MarketingNavLink[] = RESOURCES_NAV_GROUP.items;
const COMPANY_LINKS: MarketingNavLink[] = COMPANY_NAV_GROUP.items;

const HOW_IT_WORKS_LINK: MarketingNavLink = {
  label: 'How it works',
  path: '/how-it-works',
  description: 'Decide, approve, execute, verify',
};

const DROPDOWNS: Array<{ key: DropdownKey; label: string; links: MarketingNavLink[] }> = [
  { key: 'product', label: 'Product', links: PRODUCT_LINKS },
  { key: 'solutions', label: 'Solutions', links: SOLUTIONS_LINKS },
  { key: 'resources', label: 'Resources', links: RESOURCES_LINKS },
  { key: 'company', label: 'Company', links: COMPANY_LINKS },
];

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

function iconName(link: MarketingNavLink): AlphaIconName | undefined {
  if (!link.icon) return undefined;
  const name = (link.icon as { displayName?: string; name?: string })?.name ?? link.icon.toString();
  return LUCIDE_TO_ALPHA[name] ?? (name as AlphaIconName);
}

function lucideIconMatch(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(LUCIDE_TO_ALPHA, name);
}

export default function MarketingHeader() {
  const pathname = usePathname();
  const [activeDropdown, setActiveDropdown] = useState<DropdownKey | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { t } = useLanguage();
  const desktopNavRef = useRef<HTMLDivElement>(null);
  const mobileSheetRef = useRef<HTMLDivElement | null>(null);

  const activeSections = useMemo(() => {
    const current = pathname ?? '/';
    const hit = (links: MarketingNavLink[]) =>
      links.some((item) => {
        const base = item.path.split('#')[0] || item.path;
        return current === base || (base !== '/' && current.startsWith(`${base}/`));
      });
    return {
      product: hit(PRODUCT_LINKS),
      solutions: hit(SOLUTIONS_LINKS),
      resources: hit(RESOURCES_LINKS),
      company: hit(COMPANY_LINKS),
      howItWorks: current === '/how-it-works',
      pricing: current === '/pricing',
      bookDemo: current === '/book-demo',
    };
  }, [pathname]);

  useEffect(() => {
    let rafId: number;
    const handleScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => setIsScrolled(window.scrollY > 24));
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    if (!activeDropdown) return;
    const onPointer = (event: PointerEvent) => {
      if (!desktopNavRef.current?.contains(event.target as Node)) {
        setActiveDropdown(null);
        desktopNavRef.current
          ?.querySelectorAll('details.mkt-nav-item[open]')
          .forEach((node) => {
            (node as HTMLDetailsElement).open = false;
          });
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveDropdown(null);
        desktopNavRef.current
          ?.querySelectorAll('details.mkt-nav-item[open]')
          ?.forEach((node) => {
            (node as HTMLDetailsElement).open = false;
          });
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [activeDropdown]);

  useEffect(() => {
    setActiveDropdown(null);
    setMobileOpen(false);
    desktopNavRef.current
      ?.querySelectorAll('details.mkt-nav-item[open]')
      .forEach((node) => {
        (node as HTMLDetailsElement).open = false;
      });
  }, [pathname]);

  // Close any uncontrolled <details> elements inside the mobile sheet when
  // (a) the sheet closes or (b) user presses Escape while the sheet is open.
  // The Radix Sheet already binds Esc-close for the outer dialog — we also
  // collapse expanded section groups so the next open has a clean top-level view.
  const collapseMobileDetails = useCallback(() => {
    const root = mobileSheetRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLDetailsElement>('details.group[open]').forEach((node) => {
      node.open = false;
    });
  }, []);

  useEffect(() => {
    if (mobileOpen) return;
    // Sheet just closed (or was never open). Reset sections.
    collapseMobileDetails();
  }, [mobileOpen, collapseMobileDetails]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        collapseMobileDetails();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen, collapseMobileDetails]);

  return (
    <>
      <a href="#main-content" className="mkt-skip-link">
        Skip to main content
      </a>
      <header className={`mkt-header${isScrolled ? ' is-scrolled' : ''}${mobileOpen ? ' is-open' : ''}`}>
        <div className="mkt-container">
          <div className="mkt-header-bar">
            <Logo />

            <nav ref={desktopNavRef} className="mkt-nav-desktop" aria-label="Primary">
              <Link
                href={HOW_IT_WORKS_LINK.path}
                className={`mkt-nav-trigger${activeSections.howItWorks ? ' is-active' : ''}`}
              >
                {t(HOW_IT_WORKS_LINK.label)}
              </Link>
              {DROPDOWNS.map((dropdown) => {
                const isActive = activeSections[dropdown.key];
                return (
                  <details
                    key={dropdown.key}
                    className="mkt-nav-item"
                    open={activeDropdown === dropdown.key}
                    onToggle={(event) => {
                      const isOpen = event.currentTarget.open;
                      setActiveDropdown((current) => {
                        if (isOpen) return dropdown.key;
                        return current === dropdown.key ? null : current;
                      });
                    }}
                  >
                    <summary
                      className={`mkt-nav-trigger${isActive || activeDropdown === dropdown.key ? ' is-active' : ''}`}
                      aria-controls={`marketing-nav-${dropdown.key}`}
                    >
                      {t(dropdown.label)}
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${activeDropdown === dropdown.key ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                    </summary>
                    <div id={`marketing-nav-${dropdown.key}`} className="mkt-simple-menu" role="menu">
                      {dropdown.key === 'product' ? (
                        <div className="mkt-product-menu-intro">
                          <span className="mkt-product-menu-kicker">One connected workspace</span>
                          <strong>Move from intent to verified result.</strong>
                          <span>Start with the area you need today. The context carries into CRM, delivery, contracts, and billing.</span>
                          <Link href="/how-it-works" onClick={() => setActiveDropdown(null)} className="mkt-product-menu-cta">See how the workflow connects <ArrowRight className="h-3.5 w-3.5" /></Link>
                        </div>
                      ) : null}
                      {dropdown.links.map((item) => (
                        <Link
                          key={item.path}
                          href={item.path}
                          className="mkt-simple-menu-link"
                          role="menuitem"
                          onClick={() => setActiveDropdown(null)}
                        >
                          {(function renderIcon() {
                            const name = iconName(item);
                            if (!name || !lucideIconMatch(name)) return null;
                            return <AlphaIcon name={name} variant="nav" size="sm" className="mkt-nav-icon" />;
                          })()}
                          <span className="mkt-simple-menu-copy">
                            <span className="mkt-simple-menu-label">{t(item.label)}</span>
                            {item.description ? (
                              <span className="mkt-simple-menu-desc">{item.description}</span>
                            ) : null}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </details>
                );
              })}
              <Link
                href="/pricing"
                className={`mkt-nav-trigger${activeSections.pricing ? ' is-active' : ''}`}
              >
                {t('Pricing')}
              </Link>
            </nav>

            <div className="mkt-header-actions">
              <Link href={LOGIN_HREF} data-login-trigger className="mkt-nav-login">
                {t(CTA_LABELS.tertiaryLogin)}
              </Link>
              <SecondaryCTA href={DEMO_HREF} className="mkt-btn-compact mkt-header-cta">
                {t(CTA_LABELS.headerSecondary)}
              </SecondaryCTA>
              <Link
                href="/auth/login?register=true&type=business&plan=free"
                className="mkt-btn mkt-btn-primary mkt-btn-compact mkt-header-cta mkt-header-cta--primary mkt-header-cta--trial"
              >
                {t(CTA_LABELS.headerPrimary)}
              </Link>
            </div>

            <div className="mkt-header-mobile">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    className="mkt-mobile-toggle"
                    aria-label={t('Open navigation menu')}
                    aria-expanded={mobileOpen}
                    aria-controls="mkt-mobile-sheet"
                  >
                    <Menu className="h-5 w-5" aria-hidden="true" />
                  </button>
                </SheetTrigger>
                <SheetContent
                  ref={mobileSheetRef}
                  id="mkt-mobile-sheet"
                  role="dialog"
                  aria-modal="true"
                  aria-label={t('AlphaClone site navigation')}
                  side="right"
                  showCloseButton={false}
                  className="mkt-mobile-sheet h-[100dvh] w-[min(100vw,22rem)] overscroll-contain overflow-y-auto border-[var(--border-subtle)] bg-[var(--background-root)] pb-[max(1rem,env(safe-area-inset-bottom))]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <Logo />
                    <SheetClose className="mkt-mobile-toggle" aria-label={t('Close navigation menu')}>
                      <X className="h-5 w-5" aria-hidden="true" />
                      <span className="sr-only">Close navigation menu</span>
                    </SheetClose>
                  </div>

                  <div className="mkt-mobile-cta-stack pt-3">
                    <SecondaryCTA
                      href={DEMO_HREF}
                      onClick={() => setMobileOpen(false)}
                      className="w-full justify-center"
                    >
                      {t(CTA_LABELS.headerSecondary)}
                    </SecondaryCTA>
                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href={LOGIN_HREF}
                        onClick={() => setMobileOpen(false)}
                        data-login-trigger
                        className="mkt-btn mkt-btn-secondary w-full justify-center text-center"
                      >
                        {t(CTA_LABELS.tertiaryLogin)}
                      </Link>
                      <Link
                        href="/auth/login?register=true&type=business&plan=free"
                        onClick={() => setMobileOpen(false)}
                        className="mkt-btn mkt-btn-ghost mkt-mobile-trial w-full justify-center text-center"
                      >
                        {t(CTA_LABELS.headerPrimary)}
                      </Link>
                    </div>
                  </div>

                  <nav className="grid gap-2" aria-label={t('Mobile navigation')}>
                    <Link
                      href={HOW_IT_WORKS_LINK.path}
                      onClick={() => setMobileOpen(false)}
                      className={`mkt-mobile-top-link${activeSections.howItWorks ? ' is-active' : ''}`}
                    >
                      {t(HOW_IT_WORKS_LINK.label)}
                    </Link>
                    <Link
                      href="/pricing"
                      onClick={() => setMobileOpen(false)}
                      className={`mkt-mobile-top-link${activeSections.pricing ? ' is-active' : ''}`}
                    >
                      {t('Pricing')}
                    </Link>
                    {DROPDOWNS.map((section) => (
                      <details key={section.key} className="group rounded-xl border border-[var(--border-subtle)] bg-white/[0.02]">
                        <summary className="mkt-mobile-section-label flex min-h-12 cursor-pointer list-none items-center justify-between px-3">
                          {t(section.label)}
                          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                        </summary>
                        <div className="grid gap-1 border-t border-[var(--border-subtle)] p-2">
                          {section.links.map((item) => (
                            <Link
                              key={item.path}
                              href={item.path}
                              onClick={() => setMobileOpen(false)}
                              className="mkt-simple-menu-link"
                            >
                              {(function renderIcon() {
                                const name = iconName(item);
                                if (!name || !lucideIconMatch(name)) return null;
                                return <AlphaIcon name={name} variant="nav" size="sm" className="mkt-nav-icon" />;
                              })()}
                              <span className="mkt-simple-menu-copy">
                                <span className="mkt-simple-menu-label">{t(item.label)}</span>
                                {item.description ? (
                                  <span className="mkt-simple-menu-desc">{item.description}</span>
                                ) : null}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </details>
                    ))}
                  </nav>
                  <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
