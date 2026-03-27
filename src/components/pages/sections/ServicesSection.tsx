import React from 'react';
import { Code, Smartphone, Zap, Database, Shield } from 'lucide-react';

const ServicesSection: React.FC = () => {
    const services = [
        {
            icon: Code,
            title: 'Custom Web Development',
            description: 'Enterprise-grade web applications built with modern frameworks and best practices.',
            color: 'text-blue-400'
        },
        {
            icon: Smartphone,
            title: 'Mobile App Development',
            description: 'Native and cross-platform mobile solutions for iOS and Android.',
            color: 'text-purple-400'
        },
        {
            icon: Zap,
            title: 'AI Integration',
            description: 'Intelligent automation and AI-powered features for your business.',
            color: 'text-teal-400'
        },
        {
            icon: Database,
            title: 'Enterprise CRM',
            description: 'Custom CRM systems tailored to your business processes.',
            color: 'text-green-400'
        },
        {
            icon: Shield,
            title: 'Security Solutions',
            description: 'Enterprise security, compliance, and data protection.',
            color: 'text-red-400'
        },
        {
            icon: Zap,
            title: 'Performance Optimization',
            description: 'Speed, scalability, and reliability for high-traffic applications.',
            color: 'text-yellow-400'
        }
    ];

    return (
        <section id="services" className="py-32 px-4 relative overflow-hidden bg-black">
            {/* Ambient Background */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-teal-500/5 blur-[120px] rounded-full -z-10" />

            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-24">
                    <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tighter">
                        Engineered <span className="hero-metallic-text">Capabilities.</span>
                    </h2>
                    <p className="text-xl text-slate-400 max-w-2xl mx-auto font-medium">
                        The high-performance layer for your enterprise operations. Consolidated, secured, and AI-amplified.
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {services.map((service, idx) => (
                        <div
                            key={idx}
                            className="glass-card p-10 rounded-3xl border border-white/[0.03] hover:scale-[1.02] transition-all group relative overflow-hidden h-full flex flex-col"
                        >
                            {/* Inner Glow */}
                            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                            
                            <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center mb-8 group-hover:bg-teal-500 group-hover:text-slate-950 transition-all duration-500 shadow-2xl">
                                <service.icon className="w-7 h-7" />
                            </div>
                            <h3 className="text-2xl font-black mb-4 text-white tracking-tight">{service.title}</h3>
                            <p className="text-slate-400 leading-relaxed text-sm flex-grow font-medium">
                                {service.description}
                            </p>
                            
                            <div className="mt-8 flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-teal-400 transition-colors">
                                <span>Learn Protocol</span>
                                <div className="h-[1px] w-8 bg-slate-800 group-hover:bg-teal-500 transition-all" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default ServicesSection;
