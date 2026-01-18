import React from 'react';
import { CheckCircle2 } from 'lucide-react';

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
        <section className="py-20 px-4">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold mb-4">Why Choose Us</h2>
                    <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                        Enterprise-grade solutions with professional service
                    </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    {features.map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                            <CheckCircle2 className="w-6 h-6 text-teal-400 flex-shrink-0" />
                            <span className="text-slate-300">{feature}</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default FeaturesSection;
