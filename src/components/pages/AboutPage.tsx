'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Target, Users, Award, TrendingUp } from 'lucide-react';
import PublicNavigation from '../PublicNavigation';

const AboutPage: React.FC = () => {
    const [, setIsLoginOpen] = React.useState(false);
    const values = [
        {
            icon: Target,
            title: 'Mission-Driven',
            description: 'We build solutions that solve real business problems and drive measurable results.'
        },
        {
            icon: Users,
            title: 'Client-Focused',
            description: 'Your success is our priority. We work closely with you every step of the way.'
        },
        {
            icon: Award,
            title: 'Quality First',
            description: 'Enterprise-grade code, best practices, and attention to detail in every project.'
        },
        {
            icon: TrendingUp,
            title: 'Innovation',
            description: 'Staying ahead with the latest technologies and methodologies.'
        }
    ];

    const stats = [
        { label: 'Projects Completed', value: '100+' },
        { label: 'Happy Clients', value: '50+' },
        { label: 'Years Experience', value: '5+' },
        { label: 'Team Members', value: '10+' }
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
                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6">About AlphaClone Systems</h1>
                    <p className="text-base sm:text-lg md:text-xl text-slate-400 max-w-3xl mx-auto">
                        Building enterprise software solutions with cutting-edge technology
                    </p>
                </div>

                {/* Story */}
                <section className="mb-20">
                    <div className="bg-slate-900 p-6 sm:p-8 md:p-12 rounded-xl border border-slate-800">
                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-6">Our Story</h2>
                        <div className="space-y-4 text-slate-300 leading-relaxed">
                            <p>
                                AlphaClone Systems was founded with a mission to deliver enterprise-grade software solutions
                                that combine cutting-edge technology with practical business value. We specialize in custom
                                web development, mobile applications, AI integration, and enterprise CRM systems.
                            </p>
                            <p>
                                Our team of experienced developers and designers work collaboratively with clients to understand
                                their unique challenges and deliver solutions that drive real business results. We believe in
                                transparency, quality, and long-term partnerships.
                            </p>
                            <p>
                                With a focus on modern technologies, best practices, and scalable architecture, we help
                                businesses transform their digital presence and achieve their goals.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Stats */}
                <section className="mb-20">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                        {stats.map((stat, idx) => (
                            <div key={idx} className="bg-slate-900 p-4 sm:p-6 rounded-xl border border-slate-800 text-center">
                                <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-teal-400 mb-2">{stat.value}</div>
                                <div className="text-xs sm:text-sm text-slate-400">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Values */}
                <section>
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-8">Our Values</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {values.map((value, idx) => (
                            <div key={idx} className="bg-slate-900 p-8 rounded-xl border border-slate-800">
                                <value.icon className="w-12 h-12 text-teal-400 mb-4" />
                                <h3 className="text-xl font-bold mb-3">{value.title}</h3>
                                <p className="text-slate-400">{value.description}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default AboutPage;

