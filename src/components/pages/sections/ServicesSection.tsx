import React from 'react';
import { Code, Smartphone, Bot, Database, Shield, Zap } from 'lucide-react';

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
            icon: Bot,
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
        <section id="services" className="py-20 px-4 bg-slate-950">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold mb-4">Our Services</h2>
                    <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                        Comprehensive software solutions for modern businesses
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {services.map((service, idx) => (
                        <div
                            key={idx}
                            className="bg-slate-900 p-8 rounded-xl border border-slate-800 hover:border-teal-500/50 transition-all group"
                        >
                            <service.icon className={`w-12 h-12 ${service.color} mb-4 group-hover:scale-110 transition-transform`} />
                            <h3 className="text-xl font-bold mb-3">{service.title}</h3>
                            <p className="text-slate-400">{service.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default ServicesSection;
