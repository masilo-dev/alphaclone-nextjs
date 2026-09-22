'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Globe2, Menu, X } from 'lucide-react';
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/marketing/ui/sheet';
import { PrimaryCTA } from '@/components/marketing/system/CtaButtons';
import { DEMO_HREF, LOGIN_HREF } from '@/lib/marketing/cta';
import { LANGUAGES, useLanguage, type SupportedLanguage } from '@/contexts/LanguageContext';

type MenuKey = 'product' | 'solutions' | 'resources';

type MenuLink = {
  label: string;
  href: string;
  description?: string;
};

const MENUS: Array<{ key: MenuKey; label: string; items: MenuLink[] }> = [
  {
    key: 'product',
    label: 'Product',
    items: [
      { label: 'Platform overview', href: '/services', description: 'One connected workspace' },
      { label: 'How it works', href: '/how-it-works', description: 'Decide, approve, execute, verify' },
      { label: 'CRM & pipeline', href: '/crm', description: 'Customer context from lead to revenue' },
      { label: 'Project delivery', href: '/project-management', description: 'Turn sold work into visible delivery' },
    ],
  },
  {
    key: 'solutions',
    label: 'Solutions',
    items: [
      { label: 'Who we serve', href: '/who-we-serve', description: 'Find the right path for your team' },
      { label: 'Agencies', href: '/solutions/agencies' },
      { label: 'Consultants', href: '/solutions/consultants' },
      { label: 'Solo founders', href: '/solutions/solo-founders' },
    ],
  },
  {
    key: 'resources',
    label: 'Resources',
    items: [
      { label: 'Documentation', href: '/docs' },
      { label: 'Getting started', href: '/guide' },
      { label: 'Blog', href: '/blog' },
      { label: 'Recorded demo', href: '/demo' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Results & workflows', href: '/results' },
    ],
  },
];

function Logo() {
  return (
    <Link href="/" className="mkt-brand mkt-brand-redesign" aria-label="AlphaClone home">
      <span className="mkt-brand-mark" aria-hidden="true">
        <Image src="/logo.png" alt="" width={34} height={34} priority className="h-[34px] w-[34px] object-contain" />
      </span>
      <span className="mkt-brand-copy">
        <span className="mkt-brand-word">AlphaClone</span>
        <span className="mkt-brand-system">SYSTEMS</span>
      </span>
    </Link>
  );
}

function LanguageSwitcher({ mobile = false }: { mobile?: boolean }) {
  const { language, setLanguage, languageCode } = useLanguage();
  return (
    <label className={`mkt-language-control${mobile ? ' is-mobile' : ''}`}>
      <Globe2 className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only">Language</span>
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as SupportedLanguage)}
        aria-label="Select language"
      >
        {LANGUAGES.map((item) => <option key={item.code} value={item.code}>{mobile ? item.nativeName : item.code.toUpperCase()}</option>)}
      </select>
      {!mobile && <span aria-hidden="true">{languageCode}</span>}
      <ChevronDown className="h-3 w-3" aria-hidden="true" />
    </label>
  );
}

const LanguageControl = LanguageSwitcher;

export default function MarketingHeader() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [activeMenu, setActiveMenu] = useState<MenuKey | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setActiveMenu(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!activeMenu) return;
    const onPointer = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setActiveMenu(null);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setActiveMenu(null);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [activeMenu]);

  return (
    <>
      <a href="#main-content" className="mkt-skip-link">{t('Skip to main content')}</a>
      <header className="mkt-header mkt-header-redesign">
        <div className="mkt-container">
          <div className="mkt-header-bar">
            <Logo />
            <nav ref={navRef} className="mkt-nav-redesign" aria-label="Primary navigation">
              {MENUS.slice(0, 2).map((menu) => (
                <div className="mkt-nav-popover" key={menu.key}>
                  <button
                    type="button"
                    className="mkt-nav-link-redesign"
                    aria-expanded={activeMenu === menu.key}
                    aria-controls={`mkt-menu-${menu.key}`}
                    onClick={() => setActiveMenu((current) => current === menu.key ? null : menu.key)}
                  >
                    {t(menu.label)}<ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  {activeMenu === menu.key && (
                    <div id={`mkt-menu-${menu.key}`} className="mkt-nav-menu-redesign">
                      <p>{t(menu.label)}</p>
                      {menu.items.map((item) => (
                        <Link href={item.href} key={item.href} onClick={() => setActiveMenu(null)}>
                          <strong>{t(item.label)}</strong>
                          {item.description && <span>{t(item.description)}</span>}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <Link href="/ecosystem" className="mkt-nav-link-redesign">{t('Integrations')}</Link>
              <Link href="/pricing" className="mkt-nav-link-redesign">{t('Pricing')}</Link>
              {MENUS.slice(2).map((menu) => (
                <div className="mkt-nav-popover" key={menu.key}>
                  <button
                    type="button"
                    className="mkt-nav-link-redesign"
                    aria-expanded={activeMenu === menu.key}
                    aria-controls={`mkt-menu-${menu.key}`}
                    onClick={() => setActiveMenu((current) => current === menu.key ? null : menu.key)}
                  >
                    {t(menu.label)}<ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  {activeMenu === menu.key && (
                    <div id={`mkt-menu-${menu.key}`} className="mkt-nav-menu-redesign is-right">
                      <p>{t(menu.label)}</p>
                      {menu.items.map((item) => (
                        <Link href={item.href} key={item.href} onClick={() => setActiveMenu(null)}>
                          <strong>{t(item.label)}</strong>
                          {item.description && <span>{t(item.description)}</span>}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <Link href="/about" className="mkt-nav-link-redesign">{t('About')}</Link>
            </nav>

            <div className="mkt-header-actions-redesign">
              <LanguageControl />
              <Link href={LOGIN_HREF} data-login-trigger className="mkt-sign-in">{t('Sign in')}</Link>
              <PrimaryCTA href={DEMO_HREF} className="mkt-btn-compact mkt-header-demo">{t('Book a demo')}</PrimaryCTA>
            </div>

            <div className="mkt-header-mobile-redesign">
              <PrimaryCTA href={DEMO_HREF} className="mkt-btn-compact mkt-header-demo-mobile">{t('Book a demo')}</PrimaryCTA>
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <button type="button" className="mkt-mobile-toggle-redesign" aria-label="Open navigation menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}>
                    <Menu className="h-6 w-6" aria-hidden="true" />
                  </button>
                </SheetTrigger>
                <SheetContent
                  id="mkt-mobile-sheet"
                  side="right"
                  showCloseButton={false}
                  className="mkt-mobile-sheet-redesign h-[100dvh] w-[min(100vw,24rem)] overflow-y-auto"
                >
                  <SheetTitle className="sr-only">AlphaClone navigation</SheetTitle>
                  <div className="mkt-mobile-sheet-head">
                    <div onClick={() => setMobileOpen(false)}>
                      <Logo />
                    </div>
                    <SheetClose className="mkt-mobile-toggle-redesign" aria-label="Close navigation menu">
                      <X className="h-6 w-6" aria-hidden="true" />
                    </SheetClose>
                  </div>
                  <PrimaryCTA href={DEMO_HREF} onClick={() => setMobileOpen(false)} className="w-full justify-center">{t('Book a demo')}</PrimaryCTA>
                  <nav className="mkt-mobile-nav-redesign" aria-label="Mobile navigation">
                    <Link href="/how-it-works" onClick={() => setMobileOpen(false)}>{t('How it works')}</Link>
                    <Link href="/ecosystem" onClick={() => setMobileOpen(false)}>{t('Integrations')}</Link>
                    <Link href="/pricing" onClick={() => setMobileOpen(false)}>{t('Pricing')}</Link>
                    {MENUS.map((menu) => (
                      <details key={menu.key}>
                        <summary>{t(menu.label)}<ChevronDown className="h-4 w-4" aria-hidden="true" /></summary>
                        <div>{menu.items.map((item) => <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>{t(item.label)}</Link>)}</div>
                      </details>
                    ))}
                    <Link href="/about" onClick={() => setMobileOpen(false)}>{t('About')}</Link>
                    <Link href={LOGIN_HREF} data-login-trigger onClick={() => setMobileOpen(false)}>{t('Sign in')}</Link>
                  </nav>
                  <LanguageControl mobile />
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
