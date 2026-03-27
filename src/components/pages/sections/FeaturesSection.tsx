import React from 'react';
import { Check } from 'lucide-react';

const FeaturesSection: React.FC = () => {
    const features = [
        '24/7 Support & Monitoring',
        'Agile Development Process',
        'Enterprise-Grade Security',
        'Scalable Architecture',
        'Modern Tech Stack',
        'Performance Optimized'
    ];

    return (
        <section className="py-24 px-4 bg-transparent relative overflow-hidden">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tighter text-white">
                        Operational <span className="hero-metallic-text">Standards.</span>
                    </h2>
                    <p className="text-xl text-slate-400 max-w-2xl mx-auto font-medium">
                        Enterprise-grade reliability for high-performance service delivery.
                    </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {features.map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-4 p-6 glass-card rounded-2xl border-white/[0.03] hover:border-teal-500/30 transition-all group">
                            <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-teal-500 group-hover:text-slate-950 transition-all">
                                <Check className="w-5 h-5 text-teal-400 group-hover:text-inherit" />
                            </div>
                            <span className="text-slate-300 font-bold tracking-tight">{feature}</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default FeaturesSection;
