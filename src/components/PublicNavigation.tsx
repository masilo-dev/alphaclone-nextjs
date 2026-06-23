'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/UIComponents';

interface PublicNavigationProps {
    onLoginClick: () => void;
}

const BUSINESS_SIGNUP_HREF = '/auth/login?register=true&type=business&plan=starter';
const LOGIN_HREF = '/auth/login';
const BOOK_DEMO_HREF = '/book-demo';

const PublicNavigation: React.FC<PublicNavigationProps> = ({ onLoginClick }) => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        setMobileMenuOpen(false);
    }, [pathname]);

    // Scroll lock and Escape key handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setMobileMenuOpen(false);
        };

        if (mobileMenuOpen) {
            document.body.classList.add('menu-open');
            window.addEventListener('keydown', handleKeyDown);
        } else {
            document.body.classList.remove('menu-open');
        }

        return () => {
            document.body.classList.remove('menu-open');
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [mobileMenuOpen]);

    // Simple Focus Trap
    useEffect(() => {
        if (!mobileMenuOpen || !menuRef.current) return;

        const focusableElements = menuRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        const handleTabKey = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    lastElement.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === lastElement) {
                    firstElement.focus();
                    e.preventDefault();
                }
            }
        };

        window.addEventListener('keydown', handleTabKey);
        firstElement?.focus();

        return () => window.removeEventListener('keydown', handleTabKey);
    }, [mobileMenuOpen]);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const navItems = [
        { label: 'Home', path: '/' },
        { label: 'Services', path: '/services' },
        { label: 'Ecosystem', path: '/ecosystem' },
        { label: 'About', path: '/about' },
        { label: 'User Guide', path: '/guide' },
        { label: 'Search', path: '/search' },
        { label: 'Docs', path: '/docs' },
        { label: 'FAQ', path: '/faq' },
        { label: 'Pricing', path: '/pricing' },
        { label: 'Contact', path: '/contact' },
    ];

    const primaryMobileItems = navItems.filter((item) =>
        ['Home', 'Services', 'Pricing', 'About', 'Contact'].includes(item.label)
    );
    const secondaryMobileItems = navItems.filter((item) => !primaryMobileItems.some((primary) => primary.path === item.path));

    const isActive = (path: string) => pathname === path;
    const showMobileBack = pathname !== '/';

    const handleMobileBack = () => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back();
            return;
        }
        router.push('/');
    };

    // Staggered variants — keep container visible; only animate link rows.
    const containerVariants = {
        hidden: { opacity: 1 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.06,
                delayChildren: 0.05,
            },
        },
        exit: {
            opacity: 1,
            transition: {
                staggerChildren: 0.04,
                staggerDirection: -1,
            },
        },
    };

    const itemVariants: any = {
        hidden: { opacity: 0, y: 15 },
        visible: { 
            opacity: 1, 
            y: 0, 
            transition: { 
                duration: 0.4, 
                ease: [0.22, 1, 0.36, 1] 
            } 
        },
        exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
    };

    return (
        <nav className={`fixed w-full z-[120] pt-safe transition-all duration-300 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/50`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className={`flex items-center justify-between transition-all duration-300 ${isScrolled && !mobileMenuOpen ? 'h-16 lg:h-20' : 'h-20'}`}>
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-3 flex-shrink-0 transition-transform transition-opacity duration-300 pointer-events-auto opacity-100 translate-y-0">
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
                                    fallback.className = 'w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center shadow-lg shadow-teal-500/20';
                                    fallback.innerHTML = '<span class="text-slate-950 font-black text-lg">AS</span>';
                                    e.currentTarget.parentElement?.appendChild(fallback);
                                }}
                            />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-white">
                            AlphaClone
                        </span>
                    </Link>

                    {/* Desktop Nav */}
                    <div className="hidden lg:flex items-center gap-6">
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                href={item.path}
                                className={`inline-flex items-center h-10 text-sm font-semibold transition-colors ${isActive(item.path)
                                    ? 'text-teal-400'
                                    : 'text-slate-300 hover:text-white'
                                    }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                        <div className="flex items-center gap-4 ml-4 pl-4 border-l border-slate-800">
                            <Link
                                href={LOGIN_HREF}
                                className="inline-flex items-center h-10 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
                            >
                                Login
                            </Link>
                            <Link href="/book-demo" className="inline-flex items-center">
                                <Button variant="outline" size="sm" className="border-slate-600 hover:border-teal-500/50 text-slate-300 hover:text-teal-400 font-semibold transition-all">
                                    Book Demo
                                </Button>
                            </Link>
                            <Link href={BUSINESS_SIGNUP_HREF} className="inline-flex items-center">
                                <Button size="sm" className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold shadow-lg shadow-teal-500/20">
                                    Start Free Trial
                                </Button>
                            </Link>
                        </div>
                    </div>

                    {/* Mobile Menu Button and Early CTAs */}
                    <div className="lg:hidden relative z-[140] pointer-events-auto flex items-center gap-2 h-full">
                        {showMobileBack && (
                            <button
                                onClick={handleMobileBack}
                                className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-slate-800 bg-slate-900/50 text-slate-300 hover:text-white transition-colors"
                                aria-label="Go back"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                        )}
                        
                        {/* Burger Button with Morphing Icon */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className={`relative w-11 h-11 flex flex-col items-center justify-center rounded-xl border transition-all duration-300 ${mobileMenuOpen
                                    ? 'bg-slate-900 border-teal-500/50 text-teal-400 shadow-lg shadow-teal-500/10'
                                    : 'bg-slate-900/50 border-slate-800 text-white hover:text-teal-400 hover:border-teal-500/30'
                                }`}
                            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                            aria-expanded={mobileMenuOpen}
                            aria-controls="mobile-menu"
                        >
                            <div className="relative w-5 h-5 flex flex-col items-center justify-center">
                                <span className={`absolute h-0.5 w-full bg-current transform transition-all duration-300 ease-in-out ${mobileMenuOpen ? 'rotate-45 translate-y-0' : '-translate-y-1.5'}`} />
                                <span className={`absolute h-0.5 w-full bg-current transform transition-all duration-300 ease-in-out ${mobileMenuOpen ? 'opacity-0 scale-x-0' : 'opacity-100'}`} />
                                <span className={`absolute h-0.5 w-full bg-current transform transition-all duration-300 ease-in-out ${mobileMenuOpen ? '-rotate-45 translate-y-0' : 'translate-y-1.5'}`} />
                            </div>
                        </button>
                    </div>
                </div>

            </div>

            {isMounted && createPortal(
                <AnimatePresence>
                    {mobileMenuOpen && (
                        <motion.div
                            id="mobile-menu"
                            ref={menuRef}
                            role="dialog"
                            aria-modal="true"
                            aria-label="Site navigation"
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={containerVariants}
                            className="lg:hidden fixed inset-0 z-[200] bg-slate-950/98 backdrop-blur-2xl p-6 pt-24 flex flex-col"
                        >
                            <button
                                type="button"
                                className="absolute inset-0 z-0"
                                aria-label="Close menu"
                                onClick={() => setMobileMenuOpen(false)}
                            />
                            <div
                                className="relative z-10 flex-1 overflow-y-auto"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="mb-5 rounded-2xl border border-teal-500/15 bg-teal-500/5 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-300 mb-2">
                                        New here?
                                    </p>
                                    <p className="text-sm text-slate-300 leading-relaxed">
                                        Book a demo if you want a guided walkthrough of our platforms and systems.
                                    </p>
                                    <div className="mt-4">
                                        <Link href={BOOK_DEMO_HREF} onClick={() => setMobileMenuOpen(false)}>
                                            <Button variant="outline" className="w-full h-11 border-teal-500/30 text-teal-300 hover:text-white hover:border-teal-400 rounded-xl text-sm font-semibold">
                                                Book Demo
                                            </Button>
                                        </Link>
                                    </div>
                                </div>

                                <div className="space-y-4 pb-6">
                                    <div>
                                        <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 font-semibold mb-2 px-1">
                                            Explore
                                        </div>
                                        <div className="space-y-1">
                                            {primaryMobileItems.map((item) => (
                                                <motion.div key={item.path} variants={itemVariants}>
                                                    <Link
                                                        href={item.path}
                                                        onClick={() => setMobileMenuOpen(false)}
                                                        className={`block text-lg font-bold py-3.5 border-b border-slate-900/50 transition-colors ${isActive(item.path)
                                                            ? 'text-teal-400'
                                                            : 'text-slate-300 hover:text-white'
                                                            }`}
                                                    >
                                                        {item.label}
                                                    </Link>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 font-semibold mb-2 px-1">
                                            More
                                        </div>
                                        <div className="space-y-1">
                                            {secondaryMobileItems.map((item) => (
                                                <motion.div key={item.path} variants={itemVariants}>
                                                    <Link
                                                        href={item.path}
                                                        onClick={() => setMobileMenuOpen(false)}
                                                        className={`flex items-center justify-between text-base font-semibold py-3 px-4 rounded-xl border border-slate-900/50 transition-colors ${isActive(item.path)
                                                            ? 'text-teal-400 bg-teal-500/5'
                                                            : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
                                                            }`}
                                                    >
                                                        <span>{item.label}</span>
                                                        <ArrowRight className="w-4 h-4" />
                                                    </Link>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-slate-800/80 space-y-2.5">
                                        <Link href={LOGIN_HREF} onClick={() => setMobileMenuOpen(false)}>
                                            <Button variant="outline" className="w-full py-3.5 text-center font-bold text-slate-300 border border-slate-700/50 rounded-xl hover:bg-slate-900 transition-colors text-base h-auto">
                                                Login
                                            </Button>
                                        </Link>
                                        <Link href={BUSINESS_SIGNUP_HREF} onClick={() => setMobileMenuOpen(false)}>
                                            <Button className="w-full py-3.5 text-center font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-xl transition-colors text-base h-auto shadow-lg shadow-teal-500/20">
                                                Start Free Trial
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </nav>
    );
};

export default PublicNavigation;
