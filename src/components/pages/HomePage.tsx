import React from 'react';
import Link from 'next/link';
import { User } from '../../types';
import { Zap, Command, Shield, ArrowRight } from 'lucide-react';
import HeroBackground from '../landing/HeroBackground';
import AnimateIn from '@/components/common/AnimateIn';

// Lazy load heavy components
const LoginModal = React.lazy(() => import('../auth/LoginModal'));
const PublicNavigation = React.lazy(() => import('../PublicNavigation'));

// Lazy load non-critical sections
const ServicesSection = React.lazy(() => import('./sections/ServicesSection'));
const FeaturesSection = React.lazy(() => import('./sections/FeaturesSection'));
const CTASection = React.lazy(() => import('./sections/CTASection'));

interface HomePageProps {
    onLogin: (user: User) => void;
}

const HomePage: React.FC<HomePageProps> = ({ onLogin }) => {
    const [isLoginOpen, setIsLoginOpen] = React.useState(false);
    const [showBelowFold, setShowBelowFold] = React.useState(false);

    // Defer loading below-the-fold content
    React.useEffect(() => {
        // Use requestIdleCallback for non-critical content, fallback to setTimeout
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => setShowBelowFold(true), { timeout: 1000 });
        } else {
            setTimeout(() => setShowBelowFold(true), 100);
        }
    }, []);

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Critical above-the-fold content - loads immediately */}
            <React.Suspense fallback={
                <nav className="fixed w-full z-50 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/50">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between h-20">
                            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-blue-500">
                                AlphaClone
                            </span>
                        </div>
                    </div>
                </nav>
            }>
                <PublicNavigation onLoginClick={() => setIsLoginOpen(true)} />
            </React.Suspense>

            <div className="relative pt-20">
                {/* Hero Section - High-Authority Cinematic */}
                <section className="relative min-h-[90vh] flex items-center justify-center px-4 py-20 overflow-hidden">
                    <HeroBackground />
                    
                    {/* Cinematic Gradient Overlays */}
                    <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black to-transparent z-10" />

                    <div className="max-w-7xl mx-auto text-center relative z-20">
                        <AnimateIn type="fadeIn" delay={0}>
                            <div className="inline-flex items-center gap-2 mb-10 ai-badge">
                                <Command className="w-3.5 h-3.5 text-teal-400" />
                                <span>THE UNIFIED BUSINESS OPERATING ENGINE</span>
                            </div>
                        </AnimateIn>

                        <AnimateIn type="fadeUp" delay={0.1}>
                            <h1 className="text-5xl md:text-7xl font-black mb-10 tracking-tighter leading-[0.9]">
                                Command Your <br />
                                <span className="hero-metallic-text">Business OS.</span>
                            </h1>
                        </AnimateIn>

                        <AnimateIn type="fadeUp" delay={0.2}>
                            <p className="text-xl md:text-2xl text-slate-400 mb-12 max-w-3xl mx-auto leading-relaxed font-medium">
                                The high-authority platform for agencies and solo-professionals. <br className="hidden md:block" />
                                Replace 10+ fragmented tools with one engineered system.
                            </p>
                        </AnimateIn>

                        <AnimateIn type="scaleIn" delay={0.3}>
                            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                                <button 
                                    onClick={() => setIsLoginOpen(true)}
                                    className="cta-primary px-12 py-5 text-xl rounded-2xl w-full sm:w-auto"
                                >
                                    Deploy Your OS
                                </button>
                                <Link href="/who-we-serve">
                                    <button className="cta-secondary px-12 py-5 text-xl rounded-2xl w-full sm:w-auto">
                                        Explore Scope
                                    </button>
                                </Link>
                            </div>
                        </AnimateIn>

                        <AnimateIn type="fadeIn" delay={0.5}>
                            <div className="mt-16 flex items-center justify-center gap-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
                                <span className="flex items-center gap-2"><Shield className="w-3 h-3" /> Encrypted</span>
                                <span>• Multi-Tenant</span>
                                <span>• AI Integrated</span>
                            </div>
                        </AnimateIn>
                    </div>
                </section>

                {/* Below-the-fold content - deferred loading */}
                {showBelowFold && (
                    <React.Suspense fallback={
                        <div className="py-20 px-4 text-center">
                            <div className="animate-pulse text-slate-600">Loading...</div>
                        </div>
                    }>
                        <ServicesSection />
                        <FeaturesSection />
                        <CTASection />
                    </React.Suspense>
                )}
            </div>

            {/* Login Modal - only loaded when needed */}
            {isLoginOpen && (
                <React.Suspense fallback={null}>
                    <LoginModal
                        isOpen={isLoginOpen}
                        onClose={() => setIsLoginOpen(false)}
                        onLogin={onLogin}
                    />
                </React.Suspense>
            )}
        </div>
    );
};

export default HomePage;

