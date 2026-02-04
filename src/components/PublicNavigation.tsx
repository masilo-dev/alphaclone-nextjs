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
    const pathname = usePathname();

    // Scroll Lock Effect
    useEffect(() => {
        if (mobileMenuOpen) {
            document.body.classList.add('menu-open');
        } else {
            document.body.classList.remove('menu-open');
        }
        return () => document.body.classList.remove('menu-open');
    }, [mobileMenuOpen]);

    const navItems = [
        { label: 'Home', path: '/' },
        { label: 'Ecosystem', path: '/ecosystem' },
        { label: 'Services', path: '/services' },
        { label: 'About', path: '/about' },
        { label: 'Contact', path: '/contact' },
        { label: 'Portfolio', path: '/portfolio' }
    ];

    const isActive = (path: string) => pathname === path;

    return (
        <nav className="fixed w-full z-50 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/50 pt-safe">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2">
                        <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-blue-500">
                            AlphaClone
                        </span>
                    </Link>

                    {/* Desktop Nav */}
                    <div className="hidden lg:flex items-center gap-8">
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                href={item.path}
                                className={`text-sm font-medium transition-colors ${isActive(item.path)
                                    ? 'text-teal-400'
                                    : 'text-slate-300 hover:text-white'
                                    }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                        <div className="flex items-center gap-4 ml-4 pl-4 border-l border-slate-800">
                            <button
                                onClick={onLoginClick}
                                className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
                            >
                                Login
                            </button>
                            <Link href="/register">
                                <Button size="sm" className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold shadow-lg shadow-teal-500/20">
                                    Start Free Trial
                                </Button>
                            </Link>
                        </div>
                    </div>

                    {/* Mobile Menu Button - High Z-Index to stay above overlay */}
                    <div className="lg:hidden relative z-[10000]">
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="text-white hover:text-teal-400 p-2 rounded-lg bg-slate-900/50 border border-slate-800 transition-colors"
                            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                        >
                            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>

                {/* Mobile Nav Overlay - Block interactions behind it */}
                {mobileMenuOpen && (
                    <div
                        className="lg:hidden fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-xl animate-fade-in p-8 pt-24 overflow-y-auto touch-none"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="space-y-4">
                            {navItems.map((item) => (
                                <Link
                                    key={item.path}
                                    href={item.path}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`block text-2xl font-bold py-4 border-b border-slate-900 transition-colors ${isActive(item.path)
                                        ? 'text-teal-400'
                                        : 'text-slate-300 hover:text-white'
                                        }`}
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                        <div className="pt-8 flex flex-col gap-4">
                            <Button onClick={onLoginClick} variant="outline" className="w-full py-4 text-center font-bold text-slate-300 border border-slate-800 rounded-2xl hover:bg-slate-900 transition-colors text-lg">
                                Login
                            </Button>
                            <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                                <Button className="w-full py-4 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-2xl shadow-lg shadow-teal-500/20 text-lg h-auto">
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

