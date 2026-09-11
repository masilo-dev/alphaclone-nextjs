'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/UIComponents';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/marketing/ui/sheet';
import { Separator } from '@/components/marketing/ui/separator';
import { SOCIAL_PROFILES } from '@/lib/seo/siteEntity';
import {
  BUSINESS_SIGNUP_HREF,
  COMPANY_NAV_GROUP,
  COMPANY_PATHS,
  LOGIN_HREF,
  MARKETING_PRIMARY_LINKS,
  PRODUCT_NAV_GROUP,
  PRODUCT_PATHS,
  RESOURCES_NAV_GROUP,
  RESOURCES_PATHS,
  type MarketingNavGroup,
  type MarketingNavLink,
} from '@/lib/marketing/siteNavigation';

interface PublicNavigationProps {
  onLoginClick: () => void;
}

type NavDropdownGroup = MarketingNavGroup;
type NavLink = MarketingNavLink;

const DESKTOP_PRIMARY_LINKS = MARKETING_PRIMARY_LINKS;
const PRODUCT_DROPDOWN_GROUPS: NavDropdownGroup[] = [PRODUCT_NAV_GROUP];
const RESOURCES_DROPDOWN_GROUPS: NavDropdownGroup[] = [RESOURCES_NAV_GROUP];
const COMPANY_DROPDOWN_GROUPS: NavDropdownGroup[] = [COMPANY_NAV_GROUP];

const NAV_LINK_ACTIVE =
  'text-cyan-400 bg-cyan-500/10';
const NAV_LINK_IDLE =
  'text-slate-300 hover:text-white hover:bg-slate-900/50';

function NavDropdownPanel({
  title,
  subtitle,
  groups,
  footer,
  align = 'left',
  onNavigate,
}: {
  title: string;
  subtitle: string;
  groups: NavDropdownGroup[];
  footer?: React.ReactNode;
  align?: 'left' | 'right';
  onNavigate?: () => void;
}) {
  return (
    <div
      className={`absolute top-[calc(100%+8px)] ${align === 'right' ? 'right-0' : 'left-0'} w-72 bg-slate-950/95 backdrop-blur-xl border border-cyan-500/20 rounded-2xl shadow-[0_0_40px_-12px_rgba(34,211,238,0.25)] overflow-hidden z-50`}
    >
      <div className="px-4 py-3 border-b border-slate-800/80 bg-gradient-to-r from-cyan-500/10 via-transparent to-blue-500/10">
        <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-400/90">{title}</p>
        <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
      </div>
      {groups.map((group) => (
        <div key={group.label} className="px-2 py-2">
          <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={onNavigate}
                  className="flex items-start gap-3 px-2 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-900/80 transition-colors group"
                >
                  {Icon && (
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/15">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold leading-tight">{item.label}</span>
                    {item.description && (
                      <span className="block text-xs text-slate-500 group-hover:text-slate-400 mt-0.5">
                        {item.description}
                      </span>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
      {footer}
    </div>
  );
}

function MobileNavAccordion({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800/80 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm font-bold text-slate-200 hover:bg-slate-900/50 transition-colors"
        aria-expanded={open}
      >
        {title}
        <ChevronDown className={`h-4 w-4 text-cyan-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-slate-800/80 px-2 py-2 space-y-1">{children}</div>}
    </div>
  );
}

const PublicNavigation: React.FC<PublicNavigationProps> = ({ onLoginClick: _onLoginClick }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileProductOpen, setMobileProductOpen] = useState(false);
  const [mobileResourcesOpen, setMobileResourcesOpen] = useState(false);
  const [mobileCompanyOpen, setMobileCompanyOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const productRef = useRef<HTMLDivElement>(null);
  const resourcesRef = useRef<HTMLDivElement>(null);
  const companyRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setMobileMenuOpen(false);
    setProductOpen(false);
    setResourcesOpen(false);
    setCompanyOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      setMobileProductOpen(false);
      setMobileResourcesOpen(false);
      setMobileCompanyOpen(false);
    }
  }, [mobileMenuOpen]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (productRef.current && !productRef.current.contains(e.target as Node)) {
        setProductOpen(false);
      }
      if (resourcesRef.current && !resourcesRef.current.contains(e.target as Node)) {
        setResourcesOpen(false);
      }
      if (companyRef.current && !companyRef.current.contains(e.target as Node)) {
        setCompanyOpen(false);
      }
    };
    if (productOpen || resourcesOpen || companyOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [productOpen, resourcesOpen, companyOpen]);

  const isActive = (path: string) => pathname === path;
  const isProductSectionActive = pathname != null && PRODUCT_PATHS.has(pathname);
  const isResourcesSectionActive = pathname != null && RESOURCES_PATHS.has(pathname);
  const isCompanySectionActive = pathname != null && COMPANY_PATHS.has(pathname);
  const showMobileBack = pathname !== '/';

  const handleMobileBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/');
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);
  const closeDropdowns = () => {
    setProductOpen(false);
    setResourcesOpen(false);
    setCompanyOpen(false);
  };

  const productFooter = (
    <div className="px-4 py-3 border-t border-slate-800/80 bg-cyan-500/5">
      <Link
        href={BUSINESS_SIGNUP_HREF}
        onClick={closeDropdowns}
        className="flex items-center justify-between text-xs font-semibold text-cyan-300 hover:text-cyan-200 transition-colors"
      >
        New here? Start free trial
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );

  const primaryMobileItems: NavLink[] = DESKTOP_PRIMARY_LINKS;

  return (
    <nav className="fixed w-full z-[120] pt-safe transition-all duration-300 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`flex items-center justify-between gap-4 transition-all duration-300 ${
            isScrolled && !mobileMenuOpen ? 'h-16 lg:h-20' : 'h-20'
          }`}
        >
          {/* Desktop logo — left only */}
          <Link
            href="/"
            className="hidden lg:flex items-center gap-3 flex-shrink-0 transition-transform transition-opacity duration-300 pointer-events-auto opacity-100 translate-y-0"
          >
            <div className="relative w-9 h-9 flex-shrink-0 flex items-center justify-center">
              <img
                src="/logo.png"
                alt="AlphaClone Systems Logo"
                width={36}
                height={36}
                className="object-contain max-h-full max-w-full"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = document.createElement('div');
                  fallback.className =
                    'w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20';
                  fallback.innerHTML =
                    '<span class="text-slate-950 font-black text-lg">AS</span>';
                  e.currentTarget.parentElement?.appendChild(fallback);
                }}
              />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">AlphaClone</span>
          </Link>

          {/* Desktop nav — spaced well to the right of the brand */}
          <div className="hidden lg:flex items-center gap-0.5 ml-auto mr-10 xl:mr-16 min-w-0">
              {DESKTOP_PRIMARY_LINKS.map((item) => {
                const active =
                  item.path === '/'
                    ? pathname === '/'
                    : isActive(item.path);
                const linkClass = `inline-flex items-center h-10 px-2 xl:px-2.5 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  active ? NAV_LINK_ACTIVE : NAV_LINK_IDLE
                }`;
                return (
                  <Link key={item.path} href={item.path} className={linkClass}>
                    {item.label}
                  </Link>
                );
              })}

              <div className="relative" ref={productRef}>
                <button
                  type="button"
                  onClick={() => {
                    setResourcesOpen(false);
                    setCompanyOpen(false);
                    setProductOpen((v) => !v);
                  }}
                  className={`inline-flex items-center gap-1.5 h-10 px-2.5 xl:px-3 text-sm font-semibold rounded-lg transition-colors ${
                    productOpen || isProductSectionActive ? NAV_LINK_ACTIVE : NAV_LINK_IDLE
                  }`}
                >
                  Product
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${productOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {productOpen && (
                  <NavDropdownPanel
                    title="Product"
                    subtitle="CRM, billing, delivery & AI"
                    groups={PRODUCT_DROPDOWN_GROUPS}
                    footer={productFooter}
                    align="left"
                    onNavigate={closeDropdowns}
                  />
                )}
              </div>

              <div className="relative" ref={resourcesRef}>
                <button
                  type="button"
                  onClick={() => {
                    setProductOpen(false);
                    setCompanyOpen(false);
                    setResourcesOpen((v) => !v);
                  }}
                  className={`inline-flex items-center gap-1.5 h-10 px-2.5 xl:px-3 text-sm font-semibold rounded-lg transition-colors ${
                    resourcesOpen || isResourcesSectionActive ? NAV_LINK_ACTIVE : NAV_LINK_IDLE
                  }`}
                >
                  Resources
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${resourcesOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {resourcesOpen && (
                  <NavDropdownPanel
                    title="Resources"
                    subtitle="Docs, guides & support"
                    groups={RESOURCES_DROPDOWN_GROUPS}
                    align="left"
                    onNavigate={closeDropdowns}
                  />
                )}
              </div>

              <div className="relative" ref={companyRef}>
                <button
                  type="button"
                  onClick={() => {
                    setProductOpen(false);
                    setResourcesOpen(false);
                    setCompanyOpen((v) => !v);
                  }}
                  className={`inline-flex items-center gap-1.5 h-10 px-2.5 xl:px-3 text-sm font-semibold rounded-lg transition-colors ${
                    companyOpen || isCompanySectionActive ? NAV_LINK_ACTIVE : NAV_LINK_IDLE
                  }`}
                >
                  Company
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${companyOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {companyOpen && (
                  <NavDropdownPanel
                    title="Company"
                    subtitle="About AlphaClone"
                    groups={COMPANY_DROPDOWN_GROUPS}
                    align="right"
                    onNavigate={closeDropdowns}
                  />
                )}
              </div>
          </div>

          {/* Mobile logo (when desktop nav hidden) */}
          <Link
            href="/"
            className="lg:hidden flex items-center gap-3 flex-shrink-0 transition-transform transition-opacity duration-300 pointer-events-auto opacity-100 translate-y-0"
          >
            <div className="relative w-9 h-9 flex-shrink-0 flex items-center justify-center">
              <img
                src="/logo.png"
                alt="AlphaClone Systems Logo"
                width={36}
                height={36}
                className="object-contain max-h-full max-w-full"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = document.createElement('div');
                  fallback.className =
                    'w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20';
                  fallback.innerHTML =
                    '<span class="text-slate-950 font-black text-lg">AS</span>';
                  e.currentTarget.parentElement?.appendChild(fallback);
                }}
              />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">AlphaClone</span>
          </Link>

          {/* Right cluster: CTAs */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            <Link
              href={LOGIN_HREF}
              className="inline-flex items-center h-9 px-4 text-sm font-semibold rounded-lg border border-cyan-500/40 text-cyan-400 hover:text-cyan-300 hover:border-cyan-400/70 transition-colors whitespace-nowrap"
            >
              Login
            </Link>

            <Link href={BUSINESS_SIGNUP_HREF} className="inline-flex items-center shrink-0">
              <Button
                size="sm"
                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-lg shadow-cyan-500/20 whitespace-nowrap"
              >
                Start Free Trial
              </Button>
            </Link>
          </div>

          <div className="lg:hidden relative z-[140] pointer-events-auto flex items-center gap-2 h-full ml-auto">
            {showMobileBack && (
              <button
                onClick={handleMobileBack}
                className="inline-flex items-center justify-center h-11 w-11 rounded-xl border border-slate-800 bg-slate-900/50 text-slate-300 hover:text-white transition-colors"
                aria-label="Go back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <button
                  className={`relative w-11 h-11 flex flex-col items-center justify-center rounded-xl border transition-all duration-300 ${
                    mobileMenuOpen
                      ? 'bg-slate-900 border-cyan-500/50 text-cyan-400 shadow-lg shadow-cyan-500/10'
                      : 'bg-slate-900/50 border-slate-800 text-white hover:text-cyan-400 hover:border-cyan-500/30'
                  }`}
                  aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                >
                  <div className="relative w-5 h-5 flex flex-col items-center justify-center">
                    <span
                      className={`absolute h-0.5 bg-current transition-all duration-300 ${mobileMenuOpen ? 'w-full rotate-45' : 'w-full -translate-y-1.5'}`}
                    />
                    <span
                      className={`absolute h-0.5 w-full bg-current transition-all duration-300 ${mobileMenuOpen ? 'opacity-0 scale-x-0' : ''}`}
                    />
                    <span
                      className={`absolute h-0.5 bg-current transition-all duration-300 ${mobileMenuOpen ? 'w-full -rotate-45' : 'w-full translate-y-1.5'}`}
                    />
                  </div>
                </button>
              </SheetTrigger>

              <SheetContent side="right" showCloseButton={false} className="w-[min(100vw,24rem)] overflow-y-auto pb-safe">
                <SheetHeader>
                  <SheetTitle>AlphaClone</SheetTitle>
                  <SheetDescription>Your all-in-one business platform.</SheetDescription>
                </SheetHeader>

                <div className="space-y-4">
                  {/* CTAs first — visible without scrolling */}
                  <div className="space-y-2.5">
                    <Link href={BUSINESS_SIGNUP_HREF} onClick={closeMobileMenu} className="block">
                      <Button className="w-full py-3.5 text-center font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl transition-colors text-base h-auto shadow-lg shadow-cyan-500/20">
                        Start Free Trial
                      </Button>
                    </Link>
                    <Link href={LOGIN_HREF} onClick={closeMobileMenu} className="block">
                      <Button
                        variant="outline"
                        className="w-full py-3.5 text-center font-bold text-slate-300 border border-slate-700/50 rounded-xl hover:bg-slate-900 transition-colors text-base h-auto"
                      >
                        Login
                      </Button>
                    </Link>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500 font-semibold mb-2 px-1">
                      Explore
                    </p>
                    <div className="space-y-1">
                      {primaryMobileItems.map((item) => {
                        const mobileClass = `block text-lg font-bold py-3.5 border-b border-slate-900/50 transition-colors ${
                          isActive(item.path) ? 'text-cyan-400' : 'text-slate-300 hover:text-white'
                        }`;
                        return (
                          <Link
                            key={item.path}
                            href={item.path}
                            onClick={closeMobileMenu}
                            className={mobileClass}
                          >
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  <MobileNavAccordion
                    title="Product"
                    open={mobileProductOpen}
                    onToggle={() => setMobileProductOpen((v) => !v)}
                  >
                    {PRODUCT_DROPDOWN_GROUPS.map((group) => (
                      <div key={group.label} className="mb-2 last:mb-0">
                        <div className="space-y-0.5">
                          {group.items.map((item) => {
                            const Icon = item.icon;
                            const basePath = item.path.split('#')[0] ?? item.path;
                            return (
                              <Link
                                key={item.path}
                                href={item.path}
                                onClick={closeMobileMenu}
                                className={`flex items-center gap-3 py-2.5 px-2 rounded-lg transition-colors ${
                                  isActive(basePath)
                                    ? 'text-cyan-400 bg-cyan-500/5'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
                                }`}
                              >
                                {Icon && <Icon className="w-4 h-4 shrink-0 text-cyan-500" />}
                                <span className="text-sm font-semibold">{item.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </MobileNavAccordion>

                  <MobileNavAccordion
                    title="Resources"
                    open={mobileResourcesOpen}
                    onToggle={() => setMobileResourcesOpen((v) => !v)}
                  >
                    {RESOURCES_DROPDOWN_GROUPS.map((group) => (
                      <div key={group.label} className="mb-2 last:mb-0">
                        <div className="space-y-0.5">
                          {group.items.map((item) => {
                            const Icon = item.icon;
                            const basePath = item.path.split('#')[0] ?? item.path;
                            return (
                              <Link
                                key={item.path}
                                href={item.path}
                                onClick={closeMobileMenu}
                                className={`flex items-center gap-3 py-2.5 px-2 rounded-lg transition-colors ${
                                  isActive(basePath)
                                    ? 'text-cyan-400 bg-cyan-500/5'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
                                }`}
                              >
                                {Icon && <Icon className="w-4 h-4 shrink-0 text-cyan-500" />}
                                <span className="text-sm font-semibold">{item.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </MobileNavAccordion>

                  <MobileNavAccordion
                    title="Company"
                    open={mobileCompanyOpen}
                    onToggle={() => setMobileCompanyOpen((v) => !v)}
                  >
                    {COMPANY_DROPDOWN_GROUPS.map((group) => (
                      <div key={group.label} className="mb-2 last:mb-0">
                        <div className="space-y-0.5">
                          {group.items.map((item) => {
                            const Icon = item.icon;
                            return (
                              <Link
                                key={item.path}
                                href={item.path}
                                onClick={closeMobileMenu}
                                className={`flex items-center justify-between py-2.5 px-2 rounded-lg transition-colors ${
                                  isActive(item.path)
                                    ? 'text-cyan-400 bg-cyan-500/5'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
                                }`}
                              >
                                <span className="flex items-center gap-3">
                                  {Icon && <Icon className="w-4 h-4 shrink-0 text-cyan-500" />}
                                  <span className="text-sm font-semibold">{item.label}</span>
                                </span>
                                <ArrowRight className="w-4 h-4 shrink-0 opacity-50" />
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </MobileNavAccordion>

                  <Separator />

                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500 font-semibold mb-3 px-1">
                      Follow us
                    </p>
                    <div className="flex gap-3 px-1">
                      <a
                        href={SOCIAL_PROFILES.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={closeMobileMenu}
                        className="text-sm font-semibold text-slate-400 hover:text-cyan-400"
                      >
                        LinkedIn
                      </a>
                      <a
                        href={SOCIAL_PROFILES.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={closeMobileMenu}
                        className="text-sm font-semibold text-slate-400 hover:text-cyan-400"
                      >
                        Facebook
                      </a>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default PublicNavigation;
