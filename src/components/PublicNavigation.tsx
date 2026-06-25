'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, ChevronDown } from 'lucide-react';
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

interface PublicNavigationProps {
  onLoginClick: () => void;
}

const BUSINESS_SIGNUP_HREF = '/auth/login?register=true&type=business&plan=starter';
const LOGIN_HREF = '/auth/login';

const PublicNavigation: React.FC<PublicNavigationProps> = ({ onLoginClick: _onLoginClick }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const exploreRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exploreRef.current && !exploreRef.current.contains(e.target as Node)) {
        setExploreOpen(false);
      }
    };
    if (exploreOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exploreOpen]);

  const navItems = [
    { label: 'Home', path: '/' },
    { label: 'Services', path: '/services' },
    { label: 'Ecosystem', path: '/ecosystem' },
    { label: 'About', path: '/about' },
    { label: 'Results', path: '/results' },
    { label: 'User Guide', path: '/guide' },
    { label: 'Search', path: '/search' },
    { label: 'Docs', path: '/docs' },
    { label: 'FAQ', path: '/faq' },
    { label: 'Pricing', path: '/pricing' },
    { label: 'Contact', path: '/contact' },
  ];

  const primaryMobileItems = navItems.filter((item) =>
    ['Home', 'Services', 'Results', 'Pricing', 'About', 'Contact'].includes(item.label)
  );
  const secondaryMobileItems = navItems.filter(
    (item) => !primaryMobileItems.some((primary) => primary.path === item.path)
  );

  const isActive = (path: string) => pathname === path;
  const showMobileBack = pathname !== '/';

  const handleMobileBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/');
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <nav className="fixed w-full z-[120] pt-safe transition-all duration-300 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`flex items-center justify-between transition-all duration-300 ${
            isScrolled && !mobileMenuOpen ? 'h-16 lg:h-20' : 'h-20'
          }`}
        >
          <Link
            href="/"
            className="flex items-center gap-3 flex-shrink-0 transition-transform transition-opacity duration-300 pointer-events-auto opacity-100 translate-y-0"
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
                    'w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center shadow-lg shadow-teal-500/20';
                  fallback.innerHTML =
                    '<span class="text-slate-950 font-black text-lg">AS</span>';
                  e.currentTarget.parentElement?.appendChild(fallback);
                }}
              />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">AlphaClone</span>
          </Link>

          <div className="hidden lg:flex items-center gap-1">
            {/* Explore dropdown */}
            <div className="relative" ref={exploreRef}>
              <button
                type="button"
                onClick={() => setExploreOpen((v) => !v)}
                className={`inline-flex items-center gap-1.5 h-10 px-3 text-sm font-semibold rounded-lg transition-colors ${
                  exploreOpen ? 'text-teal-400 bg-teal-500/10' : 'text-slate-300 hover:text-white hover:bg-slate-900/50'
                }`}
              >
                Explore
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${exploreOpen ? 'rotate-180' : ''}`} />
              </button>
              {exploreOpen && (
                <div className="absolute top-[calc(100%+8px)] left-0 w-52 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden z-50 py-1">
                  {navItems.map((item) => (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={() => setExploreOpen(false)}
                      className={`flex items-center px-4 py-2.5 text-sm font-medium transition-colors ${
                        isActive(item.path)
                          ? 'text-teal-400 bg-teal-500/5'
                          : 'text-slate-300 hover:text-white hover:bg-slate-900'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Pricing — standalone so it's always visible */}
            <Link
              href="/pricing"
              className={`inline-flex items-center h-10 px-3 text-sm font-semibold rounded-lg transition-colors ${
                isActive('/pricing') ? 'text-teal-400 bg-teal-500/10' : 'text-slate-300 hover:text-white hover:bg-slate-900/50'
              }`}
            >
              Pricing
            </Link>

            <div className="flex items-center gap-2 ml-3 pl-3 border-l border-slate-800">
              {/* Login — highlighted with teal border */}
              <Link
                href={LOGIN_HREF}
                className="inline-flex items-center h-9 px-4 text-sm font-semibold rounded-lg border border-teal-500/40 text-teal-400 hover:text-teal-300 hover:border-teal-400/70 transition-colors"
              >
                Login
              </Link>

              {/* Start Free Trial — primary CTA */}
              <Link href={BUSINESS_SIGNUP_HREF} className="inline-flex items-center">
                <Button
                  size="sm"
                  className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold shadow-lg shadow-teal-500/20"
                >
                  Start Free Trial
                </Button>
              </Link>
            </div>
          </div>

          <div className="lg:hidden relative z-[140] pointer-events-auto flex items-center gap-2 h-full">
            {showMobileBack && (
              <button
                onClick={handleMobileBack}
                className="inline-flex items-center justify-center h-11 w-11 rounded-xl border border-slate-800 bg-slate-900/50 text-slate-300 hover:text-white transition-colors"
                aria-label="Go back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            {!mobileMenuOpen && (
              <Link
                href={BUSINESS_SIGNUP_HREF}
                className="inline-flex items-center h-9 px-4 rounded-xl bg-teal-500 text-slate-950 text-xs font-bold hover:bg-teal-400 transition-colors shadow-md shadow-teal-500/20"
              >
                Start free
              </Link>
            )}

            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <button
                  className={`relative w-11 h-11 flex flex-col items-center justify-center rounded-xl border transition-all duration-300 ${
                    mobileMenuOpen
                      ? 'bg-slate-900 border-teal-500/50 text-teal-400 shadow-lg shadow-teal-500/10'
                      : 'bg-slate-900/50 border-slate-800 text-white hover:text-teal-400 hover:border-teal-500/30'
                  }`}
                  aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                >
                  <div className="relative w-5 h-5 flex flex-col items-center justify-center">
                    <span className={`absolute h-0.5 bg-current transition-all duration-300 ${mobileMenuOpen ? 'w-full rotate-45' : 'w-full -translate-y-1.5'}`} />
                    <span className={`absolute h-0.5 w-full bg-current transition-all duration-300 ${mobileMenuOpen ? 'opacity-0 scale-x-0' : ''}`} />
                    <span className={`absolute h-0.5 bg-current transition-all duration-300 ${mobileMenuOpen ? 'w-full -rotate-45' : 'w-full translate-y-1.5'}`} />
                  </div>
                </button>
              </SheetTrigger>

              <SheetContent side="right" className="w-[min(100vw,24rem)] overflow-y-auto pb-safe">
                <SheetHeader className="pr-8">
                  <SheetTitle>AlphaClone</SheetTitle>
                  <SheetDescription>
                    Your all-in-one business platform.
                  </SheetDescription>
                </SheetHeader>

                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500 font-semibold mb-2 px-1">
                      Explore
                    </p>
                    <div className="space-y-1">
                      {primaryMobileItems.map((item) => (
                        <Link
                          key={item.path}
                          href={item.path}
                          onClick={closeMobileMenu}
                          className={`block text-lg font-bold py-3.5 border-b border-slate-900/50 transition-colors ${
                            isActive(item.path)
                              ? 'text-teal-400'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500 font-semibold mb-2 px-1">
                      More
                    </p>
                    <div className="space-y-1">
                      {secondaryMobileItems.map((item) => (
                        <Link
                          key={item.path}
                          href={item.path}
                          onClick={closeMobileMenu}
                          className={`flex items-center justify-between text-base font-semibold py-3 px-4 rounded-xl border border-slate-900/50 transition-colors ${
                            isActive(item.path)
                              ? 'text-teal-400 bg-teal-500/5'
                              : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
                          }`}
                        >
                          <span>{item.label}</span>
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      ))}
                    </div>
                  </div>

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
                        className="text-sm font-semibold text-slate-400 hover:text-teal-400"
                      >
                        LinkedIn
                      </a>
                      <a
                        href={SOCIAL_PROFILES.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-slate-400 hover:text-teal-400"
                      >
                        Facebook
                      </a>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2.5">
                    <Link href={LOGIN_HREF} onClick={closeMobileMenu}>
                      <Button
                        variant="outline"
                        className="w-full py-3.5 text-center font-bold text-slate-300 border border-slate-700/50 rounded-xl hover:bg-slate-900 transition-colors text-base h-auto"
                      >
                        Login
                      </Button>
                    </Link>
                    <Link href={BUSINESS_SIGNUP_HREF} onClick={closeMobileMenu}>
                      <Button className="w-full py-3.5 text-center font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-xl transition-colors text-base h-auto shadow-lg shadow-teal-500/20">
                        Start Free Trial
                      </Button>
                    </Link>
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
