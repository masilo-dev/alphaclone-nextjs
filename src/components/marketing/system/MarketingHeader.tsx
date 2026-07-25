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

type DropdownKey = 'product' | 'solutions' | 'resources' | 'company';

type SimpleLink = { label: string; path: string };

const PRODUCT_LINKS: SimpleLink[] = [
  { label: 'CRM', path: '/crm' },
  { label: 'Leads', path: '/lead-management' },
  { label: 'Projects', path: '/project-management' },
  { label: 'Invoicing', path: '/docs#financials' },
  { label: 'Documents', path: '/docs' },
  { label: 'Bonnie AI', path: '/ai-agents' },
  { label: 'Integrations', path: '/ecosystem' },
];

const SOLUTIONS_LINKS: SimpleLink[] = [
  { label: 'Agencies', path: '/solutions/agencies' },
  { label: 'Consultants', path: '/solutions/consultants' },
  { label: 'Sole founders', path: '/solutions/solo-founders' },
  { label: 'Who we serve', path: '/who-we-serve' },
];

const RESOURCES_LINKS: SimpleLink[] = [
  { label: 'Docs', path: '/docs' },
  { label: 'Guide', path: '/guide' },
  { label: 'FAQ', path: '/faq' },
  { label: 'Blog', path: '/blog' },
  { label: 'Results', path: '/results' },
];

const COMPANY_LINKS: SimpleLink[] = [
  { label: 'About', path: '/about' },
  { label: 'Contact', path: '/contact' },
  { label: 'Security', path: '/security-policy' },
  { label: 'Status', path: '/platform-status' },
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
    };
  }, [pathname]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 24);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!activeDropdown) return;
    const onPointer = (event: PointerEvent) => {
      if (!desktopNavRef.current?.contains(event.target as Node)) setActiveDropdown(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveDropdown(null);
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
      <header className={`mkt-header${isScrolled || activeDropdown ? ' is-scrolled' : ''}`}>
        <div className="mkt-container">
          <div className="mkt-header-bar">
            <Logo />

            <nav ref={desktopNavRef} className="mkt-nav-desktop" aria-label="Primary">
              {DROPDOWNS.map((dropdown) => {
                const isOpen = activeDropdown === dropdown.key;
                const isActive = isOpen || activeSections[dropdown.key];
                return (
                  <div key={dropdown.key} className="mkt-nav-item">
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
                      <div id={`marketing-nav-${dropdown.key}`} className="mkt-simple-menu">
                        {dropdown.links.map((item) => (
                          <Link
                            key={item.path}
                            href={item.path}
                            className="mkt-simple-menu-link"
                            onClick={() => setActiveDropdown(null)}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
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
                  className="mkt-mobile-sheet w-[min(100vw,22rem)] overflow-y-auto border-[var(--border-subtle)] bg-[var(--background-root)]"
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

                  <div className="grid gap-2">
                    <Link
                      href={TRIAL_HREF}
                      onClick={() => setMobileOpen(false)}
                      className="mkt-btn mkt-btn-primary w-full"
                    >
                      {CTA_LABELS.primary}
                    </Link>
                    <Link
                      href={DEMO_HREF}
                      onClick={() => setMobileOpen(false)}
                      className="mkt-btn mkt-btn-secondary w-full"
                    >
                      {CTA_LABELS.secondary}
                    </Link>
                    <Link
                      href={LOGIN_HREF}
                      onClick={() => setMobileOpen(false)}
                      data-login-trigger
                      className="mkt-btn mkt-btn-ghost w-full border border-[var(--border-subtle)]"
                    >
                      {CTA_LABELS.tertiaryLogin}
                    </Link>
                  </div>

                  <nav className="grid gap-4 pt-2" aria-label="Mobile navigation">
                    <Link
                      href="/pricing"
                      onClick={() => setMobileOpen(false)}
                      className="mkt-mobile-pricing"
                    >
                      Pricing
                    </Link>
                    {DROPDOWNS.map((section) => (
                      <div key={section.key}>
                        <p className="mkt-mobile-section-label">{section.label}</p>
                        <div className="mt-2 grid gap-1">
                          {section.links.map((item) => (
                            <Link
                              key={item.path}
                              href={item.path}
                              onClick={() => setMobileOpen(false)}
                              className="mkt-simple-menu-link"
                            >
                              {item.label}
                            </Link>
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
