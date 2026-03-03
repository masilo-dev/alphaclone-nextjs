'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Rocket, Shield, Zap, HeartHandshake, Target, TrendingUp, Check } from 'lucide-react';
import PublicNavigation from '../PublicNavigation';
import AnimateIn from '../common/AnimateIn';
import MarketingFooter from '../landing/MarketingFooter';

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
        <div className="min-h-screen bg-transparent text-white">
            <PublicNavigation onLoginClick={() => setIsLoginOpen(true)} />
            <div className="max-w-7xl mx-auto px-4 py-20 pt-32">
                <AnimateIn type="fadeIn">
                    <Link href="/" className="inline-flex items-center text-teal-400 hover:text-teal-300 mb-8">
                        <ArrowLeft className="w-5 h-5 mr-2" />
                        Back to Home
                    </Link>
                </AnimateIn>

                <div className="text-center mb-16">
                    <AnimateIn type="scaleIn">
                        <Rocket className="w-12 h-12 sm:w-16 sm:h-16 text-teal-400 mx-auto mb-6" />
                    </AnimateIn>
                    <AnimateIn type="fadeUp" delay={0.1}>
                        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold font-marketing-heading mb-6">
                            Why Choose <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-teal-600">AlphaClone</span>
                        </h1>
                    </AnimateIn>
                    <AnimateIn type="fadeUp" delay={0.2}>
                        <p className="text-base sm:text-lg md:text-xl text-slate-400 max-w-3xl mx-auto">
                            We don't just build websites and apps - we build digital experiences that drive real business results
                        </p>
                    </AnimateIn>
                </div>

                {/* Our Advantages */}
                <section className="mb-20">
                    <AnimateIn type="fadeUp">
                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold font-marketing-heading mb-8 text-center">
                            The <span className="text-teal-400">AlphaClone</span> Advantage
                        </h2>
                    </AnimateIn>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {advantages.map((advantage, idx) => (
                            <AnimateIn key={idx} type="stagger" index={idx}>
                                <div className="bg-white/[0.04] backdrop-blur-sm p-6 rounded-xl border border-slate-700/60 hover:border-teal-500/50 transition-all group h-full">
                                    <advantage.icon className="w-10 h-10 text-teal-400 mb-4 group-hover:scale-110 transition-transform" />
                                    <h3 className="text-lg font-bold font-marketing-heading mb-2">{advantage.name}</h3>
                                    <p className="text-sm text-slate-400">{advantage.description}</p>
                                </div>
                            </AnimateIn>
                        ))}
                    </div>
                </section>

                {/* Our Services */}
                <section className="mb-20">
                    <AnimateIn type="fadeUp">
                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold font-marketing-heading mb-8 text-center">
                            Comprehensive <span className="text-teal-400">Digital Services</span>
                        </h2>
                    </AnimateIn>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {services.map((service, idx) => (
                            <AnimateIn key={idx} type={idx % 2 === 0 ? 'fadeLeft' : 'fadeRight'} delay={idx * 0.08}>
                                <div className="bg-white/[0.04] backdrop-blur-sm p-8 rounded-xl border border-slate-700/60 hover:border-teal-500/30 transition-all h-full">
                                    <h3 className="text-2xl font-bold font-marketing-heading mb-4 text-teal-400">{service.title}</h3>
                                    <ul className="space-y-3">
                                        {service.features.map((feature, fIdx) => (
                                            <li key={fIdx} className="flex items-start gap-3 text-slate-300 group/feature">
                                                <div className="w-5 h-5 rounded bg-teal-500/10 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover/feature:bg-teal-500/20 transition-colors">
                                                    <Check className="w-3 h-3 text-teal-400" />
                                                </div>
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </AnimateIn>
                        ))}
                    </div>
                </section>

                {/* Value Proposition */}
                <section>
                    <AnimateIn type="scaleIn">
                        <div className="bg-gradient-to-br from-teal-600 to-teal-700 p-8 sm:p-12 rounded-2xl text-center">
                            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-marketing-heading mb-4">
                                Ready to Transform Your Business?
                            </h2>
                            <p className="text-lg sm:text-xl text-teal-50 mb-8 max-w-2xl mx-auto">
                                Join hundreds of satisfied clients who've accelerated their growth with AlphaClone's digital solutions
                            </p>
                            <Link
                                href="/contact"
                                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-teal-600 font-bold rounded-lg hover:bg-slate-100 transition-colors shadow-xl font-marketing-heading uppercase tracking-tight"
                            >
                                Get Started Today
                                <Rocket className="w-5 h-5" />
                            </Link>
                        </div>
                    </AnimateIn>
                </section>
            </div>
            <MarketingFooter />
        </div>
    );
};

export default EcosystemPage;
