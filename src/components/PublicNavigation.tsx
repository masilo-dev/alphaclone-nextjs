'use client';

import React, { useState } from 'react';
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
                            <Button onClick={onLoginClick} size="sm" className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold">
                                Sign Up
                            </Button>
                        </div>
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="lg:hidden">
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="text-slate-300"
                            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                        >
                            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>

                {/* Mobile Nav */}
                {mobileMenuOpen && (
                    <div className="lg:hidden bg-slate-900 border-t border-slate-800 p-4 space-y-4">
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                href={item.path}
                                onClick={() => setMobileMenuOpen(false)}
                                className={`block text-sm font-medium py-2 ${isActive(item.path)
                                    ? 'text-teal-400'
                                    : 'text-slate-300 hover:text-white'
                                    }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                        <div className="pt-4 border-t border-slate-800 flex flex-col gap-3">
                            <Button onClick={onLoginClick} variant="outline" className="w-full justify-center">
                                Login
                            </Button>
                            <Button onClick={onLoginClick} className="w-full justify-center bg-teal-500 text-slate-950">
                                Sign Up
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
};

export default PublicNavigation;

