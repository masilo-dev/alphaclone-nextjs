'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Rocket, Shield, Zap, HeartHandshake, Target, TrendingUp } from 'lucide-react';
import PublicNavigation from '../PublicNavigation';

const EcosystemPage: React.FC = () => {
    const [, setIsLoginOpen] = React.useState(false);

    const advantages = [
        {
            name: 'Lightning-Fast Delivery',
            description: 'Get your project from concept to launch in record time without sacrificing quality',
            icon: Zap
        },
        {
            name: 'Enterprise-Grade Security',
            description: 'Your data and your clients\' data protected with bank-level security standards',
            icon: Shield
        },
        {
            name: 'Scalable Solutions',
            description: 'Built to grow with your business - from startup to enterprise scale',
            icon: TrendingUp
        },
        {
            name: 'Dedicated Support',
            description: '24/7 support and ongoing maintenance to keep your business running smoothly',
            icon: HeartHandshake
        },
        {
            name: 'Results-Driven',
            description: 'We focus on metrics that matter - conversions, engagement, and ROI',
            icon: Target
        },
        {
            name: 'Future-Proof Technology',
            description: 'Built with cutting-edge technology that stays relevant as trends evolve',
            icon: Rocket
        },
    ];

    const services = [
        {
            title: 'Web Development',
            features: ['Custom Web Applications', 'E-Commerce Platforms', 'Landing Pages & Marketing Sites', 'Progressive Web Apps']
        },
        {
            title: 'Mobile Solutions',
            features: ['iOS & Android Apps', 'Cross-Platform Development', 'App Store Optimization', 'Mobile-First Design']
        },
        {
            title: 'Business Tools',
            features: ['CRM & Project Management', 'Real-Time Collaboration', 'Analytics & Reporting', 'Workflow Automation']
        },
        {
            title: 'Digital Strategy',
            features: ['SEO Optimization', 'Performance Marketing', 'Brand Development', 'Growth Consulting']
        },
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-white relative">
            {/* Animated Background - matching landing page */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute inset-0 bg-slate-950" />
                <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-teal-500/8 blur-[80px] animate-blob" style={{ animationDuration: '20s' }} />
                <div className="absolute top-[-5%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-teal-400/6 blur-[80px] animate-blob" style={{ animationDuration: '25s', animationDelay: '2s' }} />
                <div className="absolute bottom-[-10%] left-[10%] w-[40vw] h-[40vw] rounded-full bg-teal-600/7 blur-[80px] animate-blob" style={{ animationDuration: '30s', animationDelay: '4s' }} />
            </div>

            <div className="relative z-10">
                <PublicNavigation onLoginClick={() => setIsLoginOpen(true)} />
                <div className="max-w-7xl mx-auto px-4 py-20 pt-32">
                    <Link href="/" className="inline-flex items-center text-teal-400 hover:text-teal-300 mb-8">
                        <ArrowLeft className="w-5 h-5 mr-2" />
                        Back to Home
                    </Link>

                    <div className="text-center mb-16">
                        <Rocket className="w-12 h-12 sm:w-16 sm:h-16 text-teal-400 mx-auto mb-6" />
                        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
                            Why Choose <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-teal-600">AlphaClone</span>
                        </h1>
                        <p className="text-base sm:text-lg md:text-xl text-slate-400 max-w-3xl mx-auto">
                            We don't just build websites and apps - we build digital experiences that drive real business results
                        </p>
                    </div>

                    {/* Our Advantages */}
                    <section className="mb-20">
                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-8 text-center">
                            The <span className="text-teal-400">AlphaClone</span> Advantage
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {advantages.map((advantage, idx) => (
                                <div
                                    key={idx}
                                    className="bg-slate-900/60 backdrop-blur-sm p-6 rounded-xl border border-slate-800 hover:border-teal-500/50 transition-all group"
                                >
                                    <advantage.icon className="w-10 h-10 text-teal-400 mb-4 group-hover:scale-110 transition-transform" />
                                    <h3 className="text-lg font-bold mb-2">{advantage.name}</h3>
                                    <p className="text-sm text-slate-400">{advantage.description}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Our Services */}
                    <section className="mb-20">
                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-8 text-center">
                            Comprehensive <span className="text-teal-400">Digital Services</span>
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {services.map((service, idx) => (
                                <div
                                    key={idx}
                                    className="bg-slate-900/60 backdrop-blur-sm p-8 rounded-xl border border-slate-800 hover:border-teal-500/30 transition-all"
                                >
                                    <h3 className="text-2xl font-bold mb-4 text-teal-400">{service.title}</h3>
                                    <ul className="space-y-3">
                                        {service.features.map((feature, fIdx) => (
                                            <li key={fIdx} className="flex items-start gap-3 text-slate-300">
                                                <div className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-2 flex-shrink-0" />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Value Proposition */}
                    <section>
                        <div className="bg-gradient-to-br from-teal-600 to-teal-700 p-8 sm:p-12 rounded-2xl text-center">
                            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">
                                Ready to Transform Your Business?
                            </h2>
                            <p className="text-lg sm:text-xl text-teal-50 mb-8 max-w-2xl mx-auto">
                                Join hundreds of satisfied clients who've accelerated their growth with AlphaClone's digital solutions
                            </p>
                            <Link
                                href="/contact"
                                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-teal-600 font-bold rounded-lg hover:bg-slate-100 transition-colors shadow-xl"
                            >
                                Get Started Today
                                <Rocket className="w-5 h-5" />
                            </Link>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default EcosystemPage;
