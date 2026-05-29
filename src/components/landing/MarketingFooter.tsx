'use client';

import React from 'react';
import Link from 'next/link';
import { Github, Twitter, Linkedin, Mail, Shield, Globe, Lock } from 'lucide-react';
import Image from 'next/image';
import ObfuscatedEmail from '../common/ObfuscatedEmail';

const MarketingFooter: React.FC = () => {
    const currentYear = new Date().getFullYear();

    const footerSections = [
        {
            title: 'Product',
            links: [
                { label: 'Features', href: '/services' },
                { label: 'CRM', href: '/crm' },
                { label: 'Lead Management', href: '/lead-management' },
                { label: 'Project Management', href: '/project-management' },
                { label: 'AI Agents', href: '/ai-agents' },
                { label: 'Video Meetings', href: '/video-meetings' },
                { label: 'Claude and Manus', href: '/claude-manus-integrations' },
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
                { label: 'User Guide', href: '/guide' },
                { label: 'Docs', href: '/docs' },
                { label: 'Login', href: '/auth/login' },
            ],
        },
        {
            title: 'Legal',
            links: [
                { label: 'Legal Hub', href: '/legal' },
                { label: 'Privacy Policy', href: '/privacy-policy' },
                { label: 'Terms of Service', href: '/terms-of-service' },
                { label: 'Cookie Policy', href: '/cookie-policy' },
                                { label: 'Data Deletion', href: '/data-deletion' },
                { label: 'Platform Status', href: '/platform-status' },
                { label: 'Security Policy', href: '/security-policy' },
                { label: 'Compliance', href: '/compliance' },
                { label: 'Security', href: 'mailto:security@alphaclonesystems.com' },
            ],
        },
    ];

    // Note: We'll obfuscate the actual link in the render loop below if it's a mailto

    return (
        <footer className="relative bg-slate-950/90 border-t border-slate-900/50 pt-20 pb-10 backdrop-blur-md overflow-hidden">
            {/* Subtle background glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-teal-500/50 to-transparent" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-16">
                    <div className="col-span-2">
                        <Link href="/" className="inline-flex items-center gap-3 mb-6">
                            <div className="relative w-9 h-9 flex-shrink-0 flex items-center justify-center">
                                <Image
                                    src="/logo.png"
                                    alt="AlphaClone Systems Logo"
                                    width={36}
                                    height={36}
                                    className="object-contain"
                                />
                            </div>
                            <span className="text-xl font-bold tracking-tight text-white">
                                AlphaClone
                            </span>
                        </Link>
                        <p className="text-slate-400 text-sm max-w-xs leading-relaxed mb-8">
                            The all-in-one platform for business operations. Built for agencies and service teams with transparent legal policies and clear data controls.
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
                                        {link.href.startsWith('mailto:') ? (
                                            <ObfuscatedEmail 
                                                email={link.href.replace('mailto:', '')} 
                                                label={link.label}
                                                className="hover:text-teal-400 transition-colors"
                                            />
                                        ) : (
                                            <Link href={link.href} className="hover:text-teal-400 transition-colors">
                                                {link.label}
                                            </Link>
                                        )}
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
                            <span>Security Controls</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-blue-500/50" />
                            <span>Cloud Infrastructure</span>
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
