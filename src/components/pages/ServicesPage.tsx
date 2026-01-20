'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Code, Smartphone, Bot, Database, Shield, Zap, BarChart, Settings, Globe } from 'lucide-react';
import { Button } from '../ui/UIComponents';
import PublicNavigation from '../PublicNavigation';

const ServicesPage: React.FC = () => {
    const [, setIsLoginOpen] = React.useState(false);
    const services = [
        {
            icon: Code,
            title: 'Custom Web Development',
            description: 'Full-stack web applications with modern frameworks. Responsive, fast, and scalable solutions.',
            features: ['React & Next.js', 'TypeScript', 'API Development', 'Performance Optimization'],
            color: 'from-blue-500 to-blue-600'
        },
        {
            icon: Smartphone,
            title: 'Mobile App Development',
            description: 'Native iOS and Android apps, plus cross-platform solutions. App store optimization included.',
            features: ['iOS Development', 'Android Development', 'React Native', 'App Store Deployment'],
            color: 'from-purple-500 to-purple-600'
        },
        {
            icon: Bot,
            title: 'AI & Machine Learning',
            description: 'Intelligent automation, chatbots, and AI-powered features to enhance your business.',
            features: ['Chatbots', 'Automation', 'Data Analysis', 'Predictive Analytics'],
            color: 'from-teal-500 to-teal-600'
        },
        {
            icon: Database,
            title: 'Enterprise CRM',
            description: 'Custom CRM systems tailored to your workflow. Client management, sales pipelines, and analytics.',
            features: ['Custom Workflows', 'Sales Pipelines', 'Client Management', 'Analytics Dashboard'],
            color: 'from-green-500 to-green-600'
        },
        {
            icon: Shield,
            title: 'Security & Compliance',
            description: 'Enterprise-grade security, data protection, and compliance with industry standards.',
            features: ['Data Encryption', 'Access Control', 'Compliance', 'Security Audits'],
            color: 'from-red-500 to-red-600'
        },
        {
            icon: Zap,
            title: 'Performance Optimization',
            description: 'Speed optimization, scalability improvements, and infrastructure upgrades.',
            features: ['Speed Optimization', 'Scalability', 'CDN Setup', 'Database Optimization'],
            color: 'from-yellow-500 to-yellow-600'
        },
        {
            icon: BarChart,
            title: 'Analytics & Reporting',
            description: 'Custom dashboards, business intelligence, and data visualization solutions.',
            features: ['Custom Dashboards', 'Data Visualization', 'Business Intelligence', 'Real-time Reports'],
            color: 'from-indigo-500 to-indigo-600'
        },
        {
            icon: Settings,
            title: 'System Integration',
            description: 'Connect your existing systems and third-party services seamlessly.',
            features: ['API Integration', 'Webhook Setup', 'Data Synchronization', 'System Migration'],
            color: 'from-slate-500 to-slate-600'
        },
        {
            icon: Globe,
            title: 'Cloud Infrastructure',
            description: 'Cloud migration, infrastructure setup, and DevOps solutions.',
            features: ['Cloud Migration', 'Infrastructure Setup', 'DevOps', 'Monitoring'],
            color: 'from-cyan-500 to-cyan-600'
        }
    ];

    return (
        <div className="min-h-screen bg-black text-white">
            <PublicNavigation onLoginClick={() => setIsLoginOpen(true)} />
            <div className="max-w-7xl mx-auto px-4 py-20 pt-32">
                <Link href="/" className="inline-flex items-center text-teal-400 hover:text-teal-300 mb-8">
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Back to Home
                </Link>

                <div className="text-center mb-16">
                    <h1 className="text-5xl md:text-6xl font-bold mb-6">Our Services</h1>
                    <p className="text-xl text-slate-400 max-w-3xl mx-auto">
                        Comprehensive software solutions designed to drive your business forward
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
                    {services.map((service, idx) => (
                        <div
                            key={idx}
                            className="bg-slate-900 p-8 rounded-xl border border-slate-800 hover:border-teal-500/50 transition-all group"
                        >
                            <div className={`w-16 h-16 rounded-lg bg-gradient-to-br ${service.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                                <service.icon className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-2xl font-bold mb-3">{service.title}</h3>
                            <p className="text-slate-400 mb-6">{service.description}</p>
                            <div className="mt-8 flex flex-col gap-3">
                                <Button
                                    size="sm"
                                    className="bg-teal-600 hover:bg-teal-500 w-full"
                                    onClick={() => window.open('https://calendly.com/alphaclonesystems/new-meeting', '_blank')}
                                >
                                    Book Meeting
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-slate-700 w-full"
                                    onClick={() => window.open('https://wa.me/48517809674', '_blank')}
                                >
                                    WhatsApp
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="text-center bg-slate-900 p-12 rounded-xl border border-slate-800">
                    <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
                    <p className="text-slate-400 mb-8 max-w-2xl mx-auto">
                        Let's discuss your project requirements and create a custom solution for your business
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Button
                            size="lg"
                            className="text-lg px-8 py-4 bg-teal-600 hover:bg-teal-500"
                            onClick={() => window.open('https://calendly.com/alphaclonesystems/new-meeting', '_blank')}
                        >
                            Schedule Consultation
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            className="text-lg px-8 py-4 border-slate-700"
                            onClick={() => window.open('https://wa.me/48517809674', '_blank')}
                        >
                            Chat via WhatsApp
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ServicesPage;

