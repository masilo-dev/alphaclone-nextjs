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
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/marketing/ui/sheet';
import { CTA_LABELS, DEMO_HREF, LOGIN_HREF, TRIAL_HREF } from '@/lib/marketing/cta';
import { SecondaryCTA } from '@/components/marketing/system/CtaButtons';
import { AlphaIcon, type AlphaIconName } from '@/components/marketing/icons';

type DropdownKey = 'product' | 'solutions' | 'resources' | 'company';

type SimpleLink = { label: string; path: string; icon?: AlphaIconName };

const PRODUCT_LINKS: SimpleLink[] = [
  { label: 'Platform overview', path: '/services', icon: 'connected' },
  { label: 'CRM', path: '/crm', icon: 'crm' },
  { label: 'Leads', path: '/lead-management', icon: 'leads' },
  { label: 'Projects', path: '/project-management', icon: 'projects' },
  { label: 'Invoicing', path: '/docs#financials', icon: 'invoicing' },
  { label: 'Documents', path: '/docs', icon: 'documents' },
  { label: 'Bonnie AI', path: '/ai-agents', icon: 'bonnie' },
  { label: 'Integrations', path: '/ecosystem', icon: 'integrations' },
];

const SOLUTIONS_LINKS: SimpleLink[] = [
  { label: 'Agencies', path: '/solutions/agencies', icon: 'organisation' },
  { label: 'Consultants', path: '/solutions/consultants', icon: 'workflow' },
  { label: 'Sole founders', path: '/solutions/solo-founders', icon: 'growth' },
  { label: 'Who we serve', path: '/who-we-serve', icon: 'connected' },
];

const RESOURCES_LINKS: SimpleLink[] = [
  { label: 'Docs', path: '/docs', icon: 'documents' },
  { label: 'Guide', path: '/guide', icon: 'setup' },
  { label: 'FAQ', path: '/faq', icon: 'reports' },
  { label: 'Blog', path: '/blog', icon: 'marketing' },
  { label: 'Results', path: '/results', icon: 'growth' },
];

const COMPANY_LINKS: SimpleLink[] = [
  { label: 'About', path: '/about', icon: 'connected' },
  { label: 'Contact', path: '/contact', icon: 'leads' },
  { label: 'Legal hub', path: '/legal', icon: 'documents' },
  { label: 'Compliance', path: '/compliance', icon: 'security' },
  { label: 'Security', path: '/security-policy', icon: 'security' },
  { label: 'Status', path: '/platform-status', icon: 'automation' },
];

const DROPDOWNS: Array<{ key: DropdownKey; label: string; links: SimpleLink[] }> = [
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

export default function MarketingHeader() {
  const pathname = usePathname();
  const [activeDropdown, setActiveDropdown] = useState<DropdownKey | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const desktopNavRef = useRef<HTMLDivElement>(null);

  const activeSections = useMemo(() => {
    const current = pathname ?? '/';
    const hit = (links: SimpleLink[]) =>
      links.some((item) => {
        const base = item.path.split('#')[0] || item.path;
        return current === base || (base !== '/' && current.startsWith(`${base}/`));
      });
    return {
      product: hit(PRODUCT_LINKS),
      solutions: hit(SOLUTIONS_LINKS),
      resources: hit(RESOURCES_LINKS),
      company: hit(COMPANY_LINKS),
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
          .forEach((node) => {
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

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  return (
    <>
      <a href="#main-content" className="mkt-skip-link">
        Skip to main content
      </a>
      <header className={`mkt-header${isScrolled || activeDropdown ? ' is-scrolled' : ''}${mobileOpen ? ' is-open' : ''}`}>
        <div className="mkt-container">
          <div className="mkt-header-bar">
            <Logo />

            <nav ref={desktopNavRef} className="mkt-nav-desktop" aria-label="Primary">
              {DROPDOWNS.map((dropdown) => {
                const isActive = activeSections[dropdown.key];
                return (
                  <details
                    key={dropdown.key}
                    className="mkt-nav-item"
                    open={activeDropdown === dropdown.key}
                    onToggle={(event) => {
                      event.preventDefault();
                      setActiveDropdown((current) =>
                        current === dropdown.key ? null : dropdown.key,
                      );
                    }}
                  >
                    <summary
                      className={`mkt-nav-trigger${isActive || activeDropdown === dropdown.key ? ' is-active' : ''}`}
                      aria-controls={`marketing-nav-${dropdown.key}`}
                    >
                      {dropdown.label}
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${activeDropdown === dropdown.key ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                    </summary>
                    <div id={`marketing-nav-${dropdown.key}`} className="mkt-simple-menu" role="menu">
                      {dropdown.links.map((item) => (
                        <Link
                          key={item.path}
                          href={item.path}
                          className="mkt-simple-menu-link"
                          role="menuitem"
                          onClick={() => setActiveDropdown(null)}
                        >
                          {item.icon ? (
                            <AlphaIcon name={item.icon} variant="nav" size="sm" className="mkt-nav-icon" />
                          ) : null}
                          {item.label}
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
                Pricing
              </Link>
            </nav>

            <div className="mkt-header-actions">
              <Link href={LOGIN_HREF} data-login-trigger className="mkt-nav-login">
                {CTA_LABELS.tertiaryLogin}
              </Link>
              <SecondaryCTA href={DEMO_HREF} className="mkt-btn-compact">
                {CTA_LABELS.secondary}
              </SecondaryCTA>
              <Link href={TRIAL_HREF} className="mkt-btn mkt-btn-primary mkt-btn-compact">
                {CTA_LABELS.primary}
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
                  className="mkt-mobile-sheet h-[100dvh] w-[min(100vw,22rem)] overscroll-contain overflow-y-auto border-[var(--border-subtle)] bg-[var(--background-root)] pb-[max(1rem,env(safe-area-inset-bottom))]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <Logo />
                    <SheetClose className="mkt-mobile-toggle">
                      <X className="h-5 w-5" aria-hidden="true" />
                      <span className="sr-only">Close navigation menu</span>
                    </SheetClose>
                  </div>
                  <SheetHeader>
                    <SheetTitle className="text-[var(--text-primary)]">Menu</SheetTitle>
                  </SheetHeader>

                  <nav className="grid gap-2 pt-2" aria-label="Mobile navigation">
                    <details className="group rounded-xl border border-cyan-500/30 bg-cyan-500/[0.06]" open>
                      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3 text-sm font-semibold text-white">
                        Account
                        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                      </summary>
                      <div className="grid gap-2 border-t border-cyan-500/20 p-3">
                        <Link href={LOGIN_HREF} onClick={() => setMobileOpen(false)} data-login-trigger className="mkt-btn mkt-btn-secondary w-full">
                          {CTA_LABELS.tertiaryLogin}
                        </Link>
                        <SecondaryCTA href={DEMO_HREF} onClick={() => setMobileOpen(false)} className="w-full mkt-btn-compact">
                          {CTA_LABELS.secondary}
                        </SecondaryCTA>
                        <Link href={TRIAL_HREF} onClick={() => setMobileOpen(false)} className="mkt-btn mkt-btn-primary w-full">
                          {CTA_LABELS.primary}
                        </Link>
                      </div>
                    </details>
                    <Link
                      href="/pricing"
                      onClick={() => setMobileOpen(false)}
                      className="mkt-mobile-pricing"
                    >
                      Pricing
                    </Link>
                    {DROPDOWNS.map((section) => (
                      <details key={section.key} className="group rounded-xl border border-[var(--border-subtle)] bg-white/[0.02]">
                        <summary className="mkt-mobile-section-label flex min-h-12 cursor-pointer list-none items-center justify-between px-3">
                          {section.label}
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
                              {item.icon ? (
                                <AlphaIcon name={item.icon} variant="nav" size="sm" className="mkt-nav-icon" />
                              ) : null}
                              {item.label}
                            </Link>
                          ))}

                        </div>
                      </details>
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
