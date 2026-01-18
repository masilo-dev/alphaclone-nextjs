'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, MessageCircle, Video, FileText, DollarSign, Sparkles, Users, Shield, CheckCircle } from 'lucide-react';
import PublicNavigation from '../PublicNavigation';

const PlatformGuide: React.FC = () => {
    const [, setIsLoginOpen] = React.useState(false);

    const sections = [
        {
            icon: MessageCircle,
            title: 'Stay Connected Throughout Your Project',
            color: 'teal',
            description: 'Direct communication with your development team, no middlemen or delays.',
            steps: [
                {
                    title: 'Direct Team Access',
                    description: 'Message your development team directly through the platform. Get responses within hours, not days. No email chains or lost messages.',
                },
                {
                    title: 'Real-Time Updates',
                    description: 'See when your team is online and get instant responses to urgent questions. Perfect for quick clarifications during development.',
                },
                {
                    title: 'File Sharing Made Easy',
                    description: 'Share design mockups, documents, or feedback directly in the conversation. Everything stays organized in one place.',
                },
            ],
        },
        {
            icon: Video,
            title: 'Face-to-Face When You Need It',
            color: 'blue',
            description: 'HD video meetings for project kickoffs, demos, and important discussions.',
            steps: [
                {
                    title: 'Project Kickoff Meetings',
                    description: 'Start your project right with a face-to-face discussion. Share your vision, ask questions, and align on goals.',
                },
                {
                    title: 'Live Demos & Previews',
                    description: 'See your project come to life with live screen sharing. Provide feedback in real-time and ensure everything matches your vision.',
                },
                {
                    title: 'No Software Required',
                    description: 'Join meetings directly from your browser. Works on desktop, tablet, or mobile. Crystal clear quality every time.',
                },
            ],
        },
        {
            icon: FileText,
            title: 'Simple, Transparent Agreements',
            color: 'purple',
            description: 'Clear contracts with digital signatures. Know exactly what you\'re getting.',
            steps: [
                {
                    title: 'Clear Terms, No Fine Print',
                    description: 'Review your project scope, deliverables, timeline, and pricing in plain English. No confusing legal jargon.',
                },
                {
                    title: 'Sign Digitally in Seconds',
                    description: 'Review and sign your agreement online. Legally binding and secure. Start your project within minutes, not weeks.',
                },
                {
                    title: 'Request Changes Anytime',
                    description: 'Not happy with something? Add comments directly to the contract. We\'ll revise and resend until you\'re satisfied.',
                },
            ],
        },
        {
            icon: DollarSign,
            title: 'Secure & Flexible Payments',
            color: 'green',
            description: 'Pay securely with multiple payment options. Track every transaction.',
            steps: [
                {
                    title: 'Bank-Level Security',
                    description: 'All payments processed through Stripe with industry-leading encryption. Your financial information is never stored on our servers.',
                },
                {
                    title: 'Milestone-Based Payments',
                    description: 'Pay as your project progresses. Deposit to start, milestones during development, final payment at completion. Fair and transparent.',
                },
                {
                    title: 'Multiple Payment Options',
                    description: 'Credit card, debit card, or bank transfer. Choose what works best for you. Instant payment confirmation.',
                },
            ],
        },
        {
            icon: Users,
            title: 'Track Your Project Progress',
            color: 'orange',
            description: 'See exactly where your project stands at every stage of development.',
            steps: [
                {
                    title: 'Visual Progress Tracking',
                    description: 'Watch your project move from Discovery through Design, Development, Testing, and finally Deployment. Know what\'s happening at every stage.',
                },
                {
                    title: 'All Information in One Place',
                    description: 'Access your contract, invoices, messages, meeting recordings, and project files from one central dashboard. No more searching through emails.',
                },
                {
                    title: 'Instant Notifications',
                    description: 'Get notified when milestones are completed, payments are due, or your team needs your input. Never miss an important update.',
                },
            ],
        },
    ];

    const quickStart = [
        {
            step: 1,
            title: 'Share Your Vision',
            description: 'Tell us about your project through our contact form. Get a response within 24 hours.',
        },
        {
            step: 2,
            title: 'Review Your Proposal',
            description: 'Receive a detailed proposal with project scope, timeline, and transparent pricing. No hidden fees.',
        },
        {
            step: 3,
            title: 'Sign & Start',
            description: 'Review and digitally sign your agreement. Request changes if needed. Your project begins immediately after.',
        },
        {
            step: 4,
            title: 'Secure Deposit',
            description: 'Make a safe, encrypted payment to officially kickstart development. Multiple payment methods accepted.',
        },
        {
            step: 5,
            title: 'Collaborate & Track',
            description: 'Access your dedicated portal. Message your team, join video calls, and watch your project progress in real-time.',
        },
    ];

    return (
        <div className="min-h-screen bg-black text-white">
            <PublicNavigation onLoginClick={() => setIsLoginOpen(true)} />
            <div className="max-w-7xl mx-auto px-4 py-20 pt-32">
                <Link href="/" className="inline-flex items-center text-teal-400 hover:text-teal-300 mb-8 transition-colors">
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Back to Home
                </Link>

                {/* Hero */}
                <div className="text-center mb-16">
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">How We Build Your Project Together</h1>
                    <p className="text-base sm:text-lg md:text-xl text-slate-400 max-w-3xl mx-auto">
                        Our client portal gives you complete transparency and control throughout your custom development project. Stay connected, track progress, and collaborate seamlessly from start to finish.
                    </p>
                </div>

                {/* Quick Start */}
                <section className="mb-20">
                    <div className="bg-teal-500/10 border border-teal-500/20 rounded-2xl p-8 sm:p-12">
                        <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center">From Idea to Launch in 5 Simple Steps</h2>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                            {quickStart.map((item) => (
                                <div key={item.step} className="text-center">
                                    <div className="w-12 h-12 bg-teal-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                                        {item.step}
                                    </div>
                                    <h3 className="font-bold text-white mb-2">{item.title}</h3>
                                    <p className="text-sm text-slate-400">{item.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Features */}
                <section className="space-y-12">
                    <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">What You Get as Our Client</h2>
                    {sections.map((section) => (
                        <div key={section.title} className="bg-slate-900 rounded-2xl border border-slate-800 p-6 sm:p-8">
                            <div className="mb-6">
                                <div className="flex items-center gap-4 mb-3">
                                    <div className={`p-3 rounded-xl bg-${section.color}-500/10`}>
                                        <section.icon className={`w-8 h-8 text-${section.color}-400`} />
                                    </div>
                                    <h3 className="text-2xl font-bold">{section.title}</h3>
                                </div>
                                <p className="text-slate-400 text-sm ml-16">{section.description}</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {section.steps.map((step, idx) => (
                                    <div key={idx} className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                                        <div className="flex items-start gap-3 mb-3">
                                            <CheckCircle className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                                            <h4 className="font-semibold text-white">{step.title}</h4>
                                        </div>
                                        <p className="text-sm text-slate-400 leading-relaxed">{step.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </section>

                {/* Support */}
                <section className="mt-20">
                    <div className="bg-gradient-to-r from-teal-500/10 to-purple-500/10 border border-teal-500/20 rounded-2xl p-8 sm:p-12 text-center">
                        <Shield className="w-16 h-16 text-teal-400 mx-auto mb-6" />
                        <h2 className="text-2xl sm:text-3xl font-bold mb-4">Need Help?</h2>
                        <p className="text-slate-400 max-w-2xl mx-auto mb-8">
                            Our team is here to help you succeed. Contact us anytime through the platform messaging system or email us directly.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <a
                                href="mailto:info@alphaclone.tech"
                                className="px-8 py-4 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-xl transition-colors"
                            >
                                Email Support
                            </a>
                            <Link
                                href="/contact"
                                className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition-colors border border-slate-700"
                            >
                                Contact Form
                            </Link>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default PlatformGuide;
