import React from 'react';
import Link from 'next/link';
import { User } from '../../types';

// Lazy load heavy components
const LoginModal = React.lazy(() => import('../auth/LoginModal'));
const PublicNavigation = React.lazy(() => import('../PublicNavigation'));

// Lazy load non-critical sections
const ServicesSection = React.lazy(() => import('./sections/ServicesSection'));
const FeaturesSection = React.lazy(() => import('./sections/FeaturesSection'));
const CTASection = React.lazy(() => import('./sections/CTASection'));

// Critical inline Button component for hero (no external dependency)
const HeroButton: React.FC<{
    children: React.ReactNode;
    onClick?: () => void;
    variant?: 'primary' | 'outline';
    className?: string;
}> = ({ children, onClick, variant = 'primary', className = '' }) => {
    const baseStyles = "inline-flex items-center justify-center rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-slate-900 active:scale-95 h-12 px-6 text-base";
    const variantStyles = variant === 'primary'
        ? "bg-teal-600 text-white hover:bg-teal-500 shadow-lg shadow-teal-900/20"
        : "border border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white";

    return (
        <button onClick={onClick} className={`${baseStyles} ${variantStyles} ${className}`}>
            {children}
        </button>
    );
};

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

            <div className="pt-20">
                {/* Hero Section - Critical, loads instantly */}
                <section className="relative min-h-screen flex items-center justify-center px-4 py-20">
                    <div className="max-w-7xl mx-auto text-center">
                        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-teal-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                            Enterprise Software Solutions
                        </h1>
                        <p className="text-xl md:text-2xl text-slate-400 mb-8 max-w-3xl mx-auto">
                            Building the future of digital business with cutting-edge technology and AI integration
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <HeroButton onClick={() => setIsLoginOpen(true)} className="text-lg px-8 py-4">
                                Get Started
                            </HeroButton>
                            <Link href="/portfolio">
                                <HeroButton variant="outline" className="text-lg px-8 py-4">
                                    View Portfolio
                                </HeroButton>
                            </Link>
                        </div>
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

