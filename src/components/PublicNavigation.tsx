'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Button } from './ui/UIComponents';

interface PublicNavigationProps {
    onLoginClick: () => void;
}

const PublicNavigation: React.FC<PublicNavigationProps> = ({ onLoginClick }) => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        if (mobileMenuOpen) {
            document.body.classList.add('menu-open');
        } else {
            document.body.classList.remove('menu-open');
        }
        return () => document.body.classList.remove('menu-open');
    }, [mobileMenuOpen]);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll(); // Initial check
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const navItems = [
        { label: 'Home', path: '/' },
        { label: 'Services', path: '/services' },
        { label: 'Ecosystem', path: '/ecosystem' },
        { label: 'About', path: '/about' },
        { label: 'User Guide', path: '/guide' },
        { label: 'Docs', path: '/docs' },
        { label: 'Pricing', path: '/pricing' },
        { label: 'Contact', path: '/contact' },
    ];

    const isActive = (path: string) => pathname === path;

    return (
        <nav className={`fixed w-full z-[120] pt-safe transition-all duration-300 ${isScrolled && !mobileMenuOpen
                ? 'max-lg:bg-transparent max-lg:border-transparent max-lg:backdrop-blur-none lg:bg-slate-950/95 lg:backdrop-blur-md lg:border-b lg:border-slate-800/50'
                : 'bg-slate-950/95 backdrop-blur-md border-b border-slate-800/50'
            }`}>
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
                                href="/auth/login"
                                className="inline-flex items-center h-10 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
                            >
                                Login
                            </Link>
                            <Link href="/register" className="inline-flex items-center">
                                <Button size="sm" className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold shadow-lg shadow-teal-500/20">
                                    Start Free Trial
                                </Button>
                            </Link>
                        </div>
                    </div>

                    {/* Mobile Menu Button and Early CTAs */}
                    <div className="lg:hidden relative z-[140] pointer-events-auto flex items-center gap-3 h-full">
                        <Link
                            href="/auth/login"
                            className="text-sm font-semibold text-slate-300 hover:text-white transition-colors"
                        >
                            Login
                        </Link>
                        <Link href="/register">
                            <Button size="sm" className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-3 py-1.5 h-auto text-xs shadow-lg shadow-teal-500/20">
                                Start Free
                            </Button>
                        </Link>
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className={`p-1.5 rounded-lg border transition-all duration-300 ml-1 ${isScrolled && !mobileMenuOpen
                                    ? 'bg-slate-950/80 backdrop-blur-md border-slate-700 text-white shadow-lg shadow-black/50'
                                    : 'bg-slate-900/50 border-slate-800 text-white hover:text-teal-400'
                                }`}
                            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                        >
                            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>

                {/* Mobile Nav Overlay */}
                {mobileMenuOpen && (
                    <div
                        className="lg:hidden fixed inset-0 z-[130] bg-slate-950/98 backdrop-blur-2xl animate-fade-in p-6 pt-24 flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex-1 overflow-y-auto">
                            <div className="space-y-1 pb-6">
                                {navItems.map((item) => (
                                    <Link
                                        key={item.path}
                                        href={item.path}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={`block text-lg font-bold py-3.5 border-b border-slate-900/50 transition-colors ${isActive(item.path)
                                            ? 'text-teal-400'
                                            : 'text-slate-300 hover:text-white'
                                            }`}
                                    >
                                        {item.label}
                                    </Link>
                                ))}
                            </div>
                        </div>
                        <div className="pt-4 pb-6 flex flex-col gap-3 mt-auto border-t border-slate-800/80">
                            <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)}>
                                <Button variant="outline" className="w-full py-3.5 text-center font-bold text-slate-300 border border-slate-700/50 rounded-xl hover:bg-slate-900 transition-colors text-base">
                                    Login
                                </Button>
                            </Link>
                            <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                                <Button className="w-full py-3.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-teal-500/20 text-base h-auto">
                                    Start Free Trial
                                </Button>
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
};

export default PublicNavigation;
