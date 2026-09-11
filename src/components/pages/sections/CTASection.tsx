import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '../../ui/UIComponents';

const CTASection: React.FC = () => {
    return (
        <section className="py-32 px-4 relative overflow-hidden">
            <div className="absolute inset-x-0 bottom-0 h-96 bg-gradient-to-t from-teal-500/5 to-transparent -z-10" />
            <div className="max-w-4xl mx-auto text-center">
                <h2 className="text-4xl md:text-6xl font-black mb-8 tracking-tighter text-white">
                    Ready for <span className="hero-metallic-text">Unified Control?</span>
                </h2>
                <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed font-medium">
                    Start your 14-day trial and build your operating workspace before you pay.
                </p>
                <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                    <Link href="/auth/login?register=true&type=business&plan=starter" className="w-full sm:w-auto">
                        <button className="cta-primary w-full px-12 py-5 text-xl rounded-2xl">
                            Deploy Now
                        </button>
                    </Link>
                    <Link href="/about" className="w-full sm:w-auto">
                        <button className="cta-secondary w-full px-12 py-5 text-xl rounded-2xl">
                            Learn More
                        </button>
                    </Link>
                </div>
                <p className="mt-10 text-xs font-black text-slate-500 uppercase tracking-[0.3em]">
                    No Credit Card Required • Clear Trial Terms • Cancel Anytime
                </p>
            </div>
        </section>
    );
};

export default CTASection;
