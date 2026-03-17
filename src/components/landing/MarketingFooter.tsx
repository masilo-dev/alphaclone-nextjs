'use client';

import React from 'react';
import Link from 'next/link';
import { Github, Twitter, Linkedin, Mail, Shield, Globe, Lock } from 'lucide-react';

const MarketingFooter: React.FC = () => {
    const currentYear = new Date().getFullYear();

    const footerSections = [
        {
            title: 'Product',
            links: [
                { label: 'Features', href: '/services' },
                { label: 'Ecosystem', href: '/ecosystem' },
                { label: 'Pricing', href: '/pricing' },
                { label: 'Who We Serve', href: '/who-we-serve' },
            ],
        },
        {
            title: 'Company',
            links: [
                { label: 'About', href: '/about' },
                { label: 'Contact', href: '/contact' },
                { label: 'Guide', href: '/guide' },
                { label: 'Docs', href: '/docs' },
            ],
        },
        {
            title: 'Legal',
            links: [
                { label: 'Privacy Policy', href: '/privacy-policy' },
                { label: 'Terms of Service', href: '/terms-of-service' },
                { label: 'Cookie Policy', href: '/cookie-policy' },
                { label: 'Security', href: 'mailto:security@alphaclone.tech' },
            ],
        },
    ];

    return (
        <footer className="relative bg-slate-950/90 border-t border-slate-900/50 pt-20 pb-10 backdrop-blur-md overflow-hidden">
            {/* Subtle background glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-teal-500/50 to-transparent" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-16">
                    <div className="col-span-2">
                        <Link href="/" className="inline-block mb-6">
                            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-blue-500">
                                AlphaClone
                            </span>
                        </Link>
                        <p className="text-slate-400 text-sm max-w-xs leading-relaxed mb-8">
                            The AI-powered Business Operating System that replaces 10+ fragmented SaaS tools. Built for modern teams demand enterprise power without complexity.
                        </p>
                        <div className="flex gap-4">
                            <a href="#" className="p-2 rounded-lg bg-slate-900/50 border border-slate-800 text-slate-400 hover:text-teal-400 hover:border-teal-500/50 transition-all">
                                <Twitter className="w-5 h-5" />
                            </a>
                            <a href="#" className="p-2 rounded-lg bg-slate-900/50 border border-slate-800 text-slate-400 hover:text-teal-400 hover:border-teal-500/50 transition-all">
                                <Linkedin className="w-5 h-5" />
                            </a>
                            <a href="#" className="p-2 rounded-lg bg-slate-900/50 border border-slate-800 text-slate-400 hover:text-teal-400 hover:border-teal-500/50 transition-all">
                                <Github className="w-5 h-5" />
                            </a>
                        </div>
                    </div>

                    {footerSections.map((section) => (
                        <div key={section.title}>
                            <h4 className="text-white font-bold mb-6 text-sm uppercase tracking-wider">{section.title}</h4>
                            <ul className="space-y-4 text-sm text-slate-400">
                                {section.links.map((link) => (
                                    <li key={link.label}>
                                        <Link href={link.href} className="hover:text-teal-400 transition-colors">
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="pt-8 border-t border-slate-900/50 flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-slate-500">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-teal-500/50" />
                            <span>Enterprise Security</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-blue-500/50" />
                            <span>Global Infrastructure</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2" suppressHydrationWarning>
                        <p>&copy; {currentYear} AlphaClone Systems. All rights reserved.</p>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default MarketingFooter;
