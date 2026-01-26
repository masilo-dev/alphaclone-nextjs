'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input, Button } from '@/components/ui/UIComponents';
import { LOGO_URL } from '@/constants';
import { AlertCircle, LogIn, UserPlus, FileText, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { usePWA } from '@/contexts/PWAContext';
import { SubscriptionPlan } from '@/services/tenancy/types';

export default function LoginPage() {
    const { isPWA } = usePWA();
    const router = useRouter();
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [businessName, setBusinessName] = useState('');
    const [isBusiness, setIsBusiness] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('starter');
    const [legalAccepted, setLegalAccepted] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const plans: { id: SubscriptionPlan, name: string, price: string, features: string[] }[] = [
        {
            id: 'starter',
            name: 'Starter',
            price: '$29/mo',
            features: ['3 Users', 'Basic CRM', '5GB Storage', 'Email Support']
        },
        {
            id: 'professional',
            name: 'Professional',
            price: '$99/mo',
            features: ['10 Users', 'Advanced CRM', 'AI Sales Agent', 'Priority Support']
        },
        {
            id: 'enterprise',
            name: 'Enterprise',
            price: '$299/mo',
            features: ['Unlimited Users', 'Custom Workflows', 'Dedicated Manager', 'API Access']
        }
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            // 1. REGISTRATION FLOW
            if (isRegistering) {
                if (!name || !email || !password) {
                    setError('All fields are required to create an account.');
                    setIsLoading(false);
                    return;
                }

                if (isBusiness) {
                    if (!businessName) {
                        setError('Business Name is required.');
                        setIsLoading(false);
                        return;
                    }
                    if (!legalAccepted) {
                        setError('You must accept the Legal Disclaimer to continue.');
                        setIsLoading(false);
                        return;
                    }
                }

                const { authService } = await import('@/services/authService');
                const { user, error: signUpError } = await authService.signUp(email, password, name);

                if (signUpError) {
                    console.error("SignUp Error:", signUpError);
                    setError(signUpError);
                    setIsLoading(false);
                    return;
                }

                if (user) {
                    // 2. TENANT CREATION (If Business selected)
                    if (isBusiness && businessName) {
                        try {
                            const { tenantService } = await import('@/services/tenancy/TenantService');
                            const slug = businessName.toLowerCase().replace(/[^a-z0-9]/g, '-');

                            // Create Tenant
                            const newTenant = await tenantService.createTenant({
                                name: businessName,
                                slug: slug,
                                adminUserId: user.id
                            });

                            // Set Trial and Plan
                            const trialEndDate = new Date();
                            trialEndDate.setDate(trialEndDate.getDate() + 3); // 3 Days Trial

                            await tenantService.updateTenant(newTenant.id, {
                                trialEndsAt: trialEndDate,
                                subscriptionStatus: 'trial',
                                subscriptionPlan: selectedPlan
                            });

                        } catch (tenantErr) {
                            console.error("Tenant Creation Error:", tenantErr);
                            // Proceed anyway, user is created
                        }
                    }
                    // Redirect to dashboard
                    router.push('/dashboard');
                }
                setIsLoading(false);
                return;
            }

            // 2. LOGIN FLOW
            const { authService } = await import('@/services/authService');
            const { user, error: signInError } = await authService.signIn(email, password);

            if (signInError) {
                setError('Invalid credentials. Please verify your email and password.');
                setIsLoading(false);
                return;
            }

            if (user) {
                router.push('/dashboard');
            }
            setIsLoading(false);
        } catch (err) {
            setError('An unexpected error occurred. Please try again.');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-teal-500/5 blur-[80px] animate-blob" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-blue-600/5 blur-[80px] animate-blob" style={{ animationDelay: '2s' }} />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-5" />
            </div>

            <div className={`w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10 my-8 transition-all duration-500 ${isRegistering && isBusiness ? 'max-w-4xl' : 'max-w-md'}`}>
                <div className="mb-8 text-center">
                    {isPWA ? (
                        <div className="mx-auto mb-6 flex justify-center inline-block">
                            <img
                                src={LOGO_URL}
                                alt="AlphaClone Logo"
                                className="w-20 h-20 object-contain"
                            />
                        </div>
                    ) : (
                        <Link href="/" className="mx-auto mb-6 flex justify-center inline-block">
                            <img
                                src={LOGO_URL}
                                alt="AlphaClone Logo"
                                className="w-20 h-20 object-contain hover:scale-105 transition-transform"
                            />
                        </Link>
                    )}
                    <h1 className="text-2xl font-bold text-white mb-2">AlphaClone Systems</h1>
                    <p className="text-slate-400">
                        {isRegistering ? 'Create your professional account' : 'Sign in to your dashboard'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {isRegistering && (
                        <div className="animate-slide-up space-y-4">
                            <div className="flex p-1 bg-slate-800/50 rounded-lg border border-slate-700/50 mb-4 max-w-md mx-auto">
                                <button
                                    type="button"
                                    onClick={() => setIsBusiness(false)}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${!isBusiness ? 'bg-teal-500 text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    CLIENT ACCOUNT
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsBusiness(true)}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${isBusiness ? 'bg-teal-500 text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    BUSINESS OS
                                </button>
                            </div>

                            <div className="max-w-md mx-auto w-full">
                                <Input
                                    label="Full Name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="John Doe"
                                    required={isRegistering}
                                />
                            </div>

                            {isBusiness && (
                                <div className="animate-slide-up space-y-6">
                                    <div className="max-w-md mx-auto w-full">
                                        <Input
                                            label="Business Name"
                                            value={businessName}
                                            onChange={(e) => setBusinessName(e.target.value)}
                                            placeholder="AlphaCorp Industries"
                                            required={isBusiness}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-3 text-center">Select Your Plan</label>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {plans.map((plan) => (
                                                <button
                                                    key={plan.id}
                                                    type="button"
                                                    onClick={() => setSelectedPlan(plan.id)}
                                                    className={`p-4 rounded-xl border text-left transition-all relative group overflow-hidden ${selectedPlan === plan.id
                                                            ? 'bg-teal-900/20 border-teal-500 ring-1 ring-teal-500'
                                                            : 'bg-slate-800/50 border-slate-700 hover:border-slate-500 hover:bg-slate-800'
                                                        }`}
                                                >
                                                    {selectedPlan === plan.id && (
                                                        <div className="absolute top-0 right-0 p-2">
                                                            <CheckCircle2 className="w-5 h-5 text-teal-400" />
                                                        </div>
                                                    )}
                                                    <div className="font-bold text-lg text-white mb-1">{plan.name}</div>
                                                    <div className="text-xl font-bold text-teal-400 mb-3">{plan.price}</div>

                                                    <ul className="space-y-2">
                                                        {plan.features.map((feature, idx) => (
                                                            <li key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-teal-500/50" />
                                                                {feature}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-xs text-teal-400 mt-3 text-center flex items-center justify-center gap-2">
                                            <span>✨ Includes 3-Day Free Trial</span>
                                            <span className="w-1 h-1 rounded-full bg-teal-500" />
                                            <span>No Card Required</span>
                                        </p>
                                    </div>

                                    {/* Legal Disclaimer */}
                                    <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 space-y-2 max-w-md mx-auto w-full">
                                        <label className="flex items-start gap-3 cursor-pointer group">
                                            <div className="relative flex items-center mt-0.5">
                                                <input
                                                    type="checkbox"
                                                    checked={legalAccepted}
                                                    onChange={(e) => setLegalAccepted(e.target.checked)}
                                                    className="peer sr-only"
                                                />
                                                <div className="w-5 h-5 border-2 border-slate-500 rounded peer-checked:bg-teal-500 peer-checked:border-teal-500 transition-all"></div>
                                                <CheckCircle2 className="w-3.5 h-3.5 text-white absolute top-1 left-1 opacity-0 peer-checked:opacity-100 transition-opacity" />
                                            </div>
                                            <div className="flex-1">
                                                <span className="text-xs text-slate-300 font-medium">Legal Disclaimer Agreement</span>
                                                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                                                    I acknowledge that AlphaClone is a technology platform only. AlphaClone is <span className="text-red-400 font-bold">NOT responsible</span> for any financial, tax, or legal disputes between me and my clients. I assume full responsibility for all transactions.
                                                </p>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="max-w-md mx-auto w-full space-y-5">
                        <Input
                            label="Email Address"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@company.com"
                            required
                            autoComplete="email"
                        />

                        <Input
                            label="Password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            autoComplete={isRegistering ? "new-password" : "current-password"}
                        />

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm flex items-start gap-2 animate-fade-in">
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <Button type="submit" className="w-full h-12 text-base font-semibold bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 shadow-lg shadow-teal-500/20" isLoading={isLoading}>
                            {isRegistering ? 'Create Account' : 'Sign In'}
                        </Button>
                    </div>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-800"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-slate-900/60 px-2 text-slate-500">Or continue with</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={async () => {
                            setIsLoading(true);
                            setError('');
                            try {
                                const { authService } = await import('@/services/authService');
                                const { error: googleError } = await authService.signInWithGoogle();
                                if (googleError) {
                                    setError(googleError);
                                    setIsLoading(false);
                                }
                            } catch (err) {
                                setError('Failed to initialize Google sign-in');
                                setIsLoading(false);
                            }
                        }}
                        disabled={isLoading}
                        className="w-full h-12 flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg border border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                        Sign in with Google
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-800 text-center space-y-4">
                    <button
                        onClick={() => {
                            setIsRegistering(!isRegistering);
                            setError('');
                        }}
                        className="text-sm text-teal-400 hover:text-teal-300 font-medium flex items-center justify-center gap-2 mx-auto transition-colors"
                    >
                        {isRegistering ? (
                            <>
                                <LogIn className="w-4 h-4" /> Already have an account? Log In
                            </>
                        ) : (
                            <>
                                <UserPlus className="w-4 h-4" /> New Client? Create Account
                            </>
                        )}
                    </button>
                    <p className="text-[10px] text-slate-600 uppercase tracking-wider">
                        Secured by AlphaClone 256-bit Encryption
                    </p>
                </div>
            </div>
        </div>
    );
}
