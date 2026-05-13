'use client';

// Force Next.js to not statically cache this page in production
export const dynamic = 'force-dynamic';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import nextDynamic from 'next/dynamic';
import { Input, Button } from '@/components/ui/UIComponents';
import { LOGO_URL } from '@/constants';
import { AlertCircle, LogIn, UserPlus, FileText, CheckCircle2, Shield, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { usePWA } from '@/contexts/PWAContext';
import { SubscriptionPlan, PLAN_PRICING } from '@/services/tenancy/types';
import Image from 'next/image';

const HeroBackground = nextDynamic(() => import('@/components/landing/HeroBackground'), {
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-slate-950" />,
});

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-[100dvh] page-network-bg marketing-theme bg-transparent flex items-center justify-center"><div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>}>
            <LoginContent />
        </Suspense>
    );
}

function LoginContent() {
    const { isPWA } = usePWA();
    const router = useRouter();
    const searchParams = useSearchParams();
    const isRegisterMode = searchParams?.get('register') === 'true';
    const typeParam = searchParams?.get('type');
    const planParam = searchParams?.get('plan') as SubscriptionPlan | null;
    const businessNameParam = searchParams?.get('businessName');
    const nextParam = searchParams?.get('next') || searchParams?.get('returnTo') || null;

    const postLoginRedirect = (() => {
      if (nextParam) {
        try {
          const decoded = decodeURIComponent(nextParam);
          if (decoded.startsWith('/oauth/') || decoded.startsWith('/authorize')) return decoded;
        } catch {
          // ignore malformed next param
        }
      }
      return '/dashboard/business';
    })();

    const [isRegistering, setIsRegistering] = useState(isRegisterMode);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [name, setName] = useState('');
    const [businessName, setBusinessName] = useState(businessNameParam || '');
    const [isBusiness] = useState(true);
    const [selectedPlan] = useState<SubscriptionPlan>('starter');
    const [legalAccepted, setLegalAccepted] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPayment, setShowPayment] = useState(false);
    const [newTenantData, setNewTenantData] = useState<{ id: string, name: string } | null>(null);
    const [paymentProcessing, setPaymentProcessing] = useState(false);
    const [showMfaChallenge, setShowMfaChallenge] = useState(false);
    const [mfaCode, setMfaCode] = useState('');
    const [humanVerified, setHumanVerified] = useState(false);
    const [registrationOpen, setRegistrationOpen] = useState(true);
    const [policyLoaded, setPolicyLoaded] = useState(false);
    const [passwordResetSentTo, setPasswordResetSentTo] = useState('');

    const PAID_PLANS: SubscriptionPlan[] = ['starter', 'pro', 'enterprise'];

    useEffect(() => {
        const loadPolicy = async () => {
            try {
                const response = await fetch('/api/platform/policy', { cache: 'no-store' });
                const payload = await response.json().catch(() => ({}));
                const open = payload?.policy?.openRegistration !== false;
                setRegistrationOpen(open);
                if (!open && isRegistering) {
                    setIsRegistering(false);
                    setError('New registrations are currently closed by platform policy.');
                }
            } catch {
                setRegistrationOpen(true);
            } finally {
                setPolicyLoaded(true);
            }
        };
        loadPolicy();
    }, []);



    const triggerOnboardingWorkflow = async (tenantId: string) => {
        try {
            const { supabase } = await import('@/lib/supabase');
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) return;

            await fetch('/api/onboarding/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ tenantId }),
            });
        } catch (error) {
            console.warn('Failed to start onboarding workflow:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading) return;
        setError('');
        setPasswordResetSentTo('');
        setIsLoading(true);

        try {
            // 1. REGISTRATION FLOW
            if (isRegistering) {
                if (!registrationOpen) {
                    setError('New registrations are currently closed by platform policy.');
                    setIsLoading(false);
                    return;
                }
                if (!name || !email || !password) {
                    setError('All fields are required to create an account.');
                    setIsLoading(false);
                    return;
                }

                if (!legalAccepted) {
                    setError('Please agree to the Terms of Service and Privacy Policy to continue.');
                    setIsLoading(false);
                    return;
                }

                if (isBusiness && !businessName) {
                    setError('Business Name is required.');
                    setIsLoading(false);
                    return;
                }

                const { authService } = await import('@/services/authService');
                const role = 'tenant_admin';
                const { user: newUser, error: signUpError } = await authService.signUp(email, password, name, role);

                if (signUpError) {
                    console.error("SignUp Error:", signUpError);
                    if (signUpError.toLowerCase().includes('user already registered') ||
                        signUpError.toLowerCase().includes('already exists') ||
                        signUpError.toLowerCase().includes('already been registered')) {
                        setError('An account with this email already exists. Please sign in instead, or reset your password if you\'ve forgotten it.');
                    } else if (signUpError.toLowerCase().includes('password')) {
                        setError('Your password does not meet the security requirements. Please use at least 8 characters with uppercase, lowercase, a number, and a special character.');
                    } else {
                        setError(signUpError);
                    }
                    setIsLoading(false);
                    return;
                }

                if (newUser) {
                    // 2. TENANT CREATION (If Business selected)
                    if (isBusiness && businessName) {
                        try {
                            const { tenantService } = await import('@/services/tenancy/TenantService');
                            const slug = businessName.toLowerCase().replace(/[^a-z0-9]/g, '-');

                            // Create Tenant
                            const newTenant = await tenantService.createTenant({
                                name: businessName,
                                slug: slug,
                                adminUserId: newUser.id
                            });

                            // Set Trial and Plan
                            const trialEndDate = new Date();
                            trialEndDate.setDate(trialEndDate.getDate() + 14); // 14 Days Trial

                            await tenantService.updateTenant(newTenant.id, {
                                trial_ends_at: trialEndDate,
                                subscription_status: 'trial',
                                subscription_plan: selectedPlan
                            });

                            // 3. Welcome Email
                            fetch('/api/email/welcome', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    email: newUser.email,
                                    name: name,
                                    trial_ends_at: trialEndDate,
                                    workspace_name: businessName
                                })
                            }).catch(err => console.warn('Welcome email trigger failed:', err));

                            void triggerOnboardingWorkflow(newTenant.id);
                        } catch (tenantErr) {
                            console.error('Tenant creation failed:', tenantErr);
                        }
                    }
                    // Redirect to dashboard for all successful registrations
                    router.push('/dashboard/business');
                    return;
                }
                setIsLoading(false);
                return;
            }

            // 2. LOGIN FLOW
            const { authService: signInAuth } = await import('@/services/authService');
            const { user: loggedInUser, error: signInError, needsMfa } = await signInAuth.signIn(email, password);

            if (signInError) {
                // Map Supabase raw errors to user-friendly messages
                if (signInError.toLowerCase().includes('invalid login credentials') ||
                    signInError.toLowerCase().includes('invalid credentials')) {
                    setError('Incorrect email or password. Please check your details and try again, or use "Forgot?" to reset your password.');
                } else if (signInError.toLowerCase().includes('email not confirmed')) {
                    setError('Please check your inbox and confirm your email address before signing in.');
                } else if (signInError.toLowerCase().includes('too many requests') || signInError.toLowerCase().includes('rate limit')) {
                    setError('Too many login attempts. Please wait a few minutes before trying again.');
                } else {
                    setError(signInError);
                }
                setIsLoading(false);
                return;
            }

            if (needsMfa) {
                setShowMfaChallenge(true);
                setIsLoading(false);
                return;
            }

            if (loggedInUser) {
                router.push(postLoginRedirect);
            }
            setIsLoading(false);
        } catch (err) {
            console.error('Submit Error:', err);
            setError('An unexpected error occurred. Please try again.');
            setIsLoading(false);
        }
    };

    const handlePayment = async () => {
        if (!newTenantData) return;
        setPaymentProcessing(true);
        setError('');

        try {
            const { paymentService } = await import('@/services/paymentService');
            // 1. Create a setup/first invoice for the subscription
            const amount = selectedPlan === 'starter' ? 15 : selectedPlan === 'pro' ? 45 : 80;

            const { invoice, error: invoiceErr } = await paymentService.createInvoice({
                user_id: 'pending', // Will be linked during processing or use current user
                amount: amount,
                currency: 'usd',
                description: `First month subscription - ${selectedPlan} plan`,
                items: [{ description: `${selectedPlan} Plan Subscription`, quantity: 1, unit_price: amount, amount: amount }],
                due_date: new Date().toISOString()
            });

            if (invoiceErr) throw new Error(invoiceErr);

            // In a real flow, we'd open Stripe here.
            // For now, we simulate a successful payment activation.
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Mark tenant as active/paid (simplified for now)
            const { tenantService } = await import('@/services/tenancy/TenantService');
            await tenantService.updateTenant(newTenantData.id, {
                subscription_status: 'active'
            });

            router.push('/dashboard/business');
        } catch (err: any) {
            setError(`Payment failed: ${err.message}. Please try again.`);
        } finally {
            setPaymentProcessing(false);
        }
    };

    const handleMfaVerify = async () => {
        setIsLoading(true);
        setError('');
        try {
            const { supabase } = await import('@/lib/supabase');
            const { data: factorsData } = await supabase.auth.mfa.listFactors();
            // Supabase returns { data: { all: Factor[], active: Factor[] } }
            const allFactors = (factorsData as any)?.all || [];
            const totpFactor = allFactors.find((f: any) => f.factor_type === 'totp' && f.status === 'verified');

            if (!totpFactor) {
                setError('No verified MFA factor found.');
                setIsLoading(false);
                return;
            }

            const challengeResponse = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
            if (challengeResponse.error) throw challengeResponse.error;

            const verifyResponse = await supabase.auth.mfa.verify({
                factorId: totpFactor.id,
                challengeId: challengeResponse.data.id,
                code: mfaCode,
            });

            if (verifyResponse.error) throw verifyResponse.error;

            router.push(postLoginRedirect);
        } catch (err: any) {
            setError(err.message || 'Invalid verification code');
        } finally {
            setIsLoading(false);
        }
    };

    if (showPayment && newTenantData) {
        return (
            <div className="min-h-[100dvh] page-network-bg marketing-theme bg-transparent flex flex-col items-center justify-center p-4 py-12 relative overflow-x-hidden overflow-y-auto">
                <div className="fixed inset-0 z-0 pointer-events-none">
                    <HeroBackground />
                </div>

                <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-2xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 my-auto animate-slide-up">
                    <h2 className="text-2xl font-bold text-white mb-2 text-center">Your 14-Day Trial is Active</h2>
                    <p className="text-slate-400 text-sm text-center mb-8">
                        No charge now. Add a payment method after your trial to continue.
                    </p>

                    <div className="bg-slate-800/50 rounded-2xl p-6 mb-6 space-y-4">
                        <div className="flex justify-between items-center pb-4 border-b border-slate-700">
                            <span className="text-slate-400">Plan Selected</span>
                            <span className="text-white font-semibold">{selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)}</span>
                        </div>
                        <div className="flex justify-between items-center pb-4 border-b border-slate-700">
                            <span className="text-slate-400">Billing Cycle</span>
                            <span className="text-white font-semibold">Monthly</span>
                        </div>
                        <div className="flex justify-between items-center pb-4 border-b border-slate-700">
                            <span className="text-slate-400">Trial Period</span>
                            <span className="text-teal-400 font-semibold">14 days free</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-white font-bold">Due After Trial</span>
                            <span className="text-2xl font-black text-teal-400">
                                ${PLAN_PRICING[selectedPlan]?.monthly ?? '—'}/mo
                            </span>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-start gap-3 text-left mb-6">
                            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-rose-200">{error}</p>
                        </div>
                    )}

                    <Button
                        onClick={() => { window.location.href = '/dashboard/business'; }}
                        className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 py-4 text-lg font-bold rounded-2xl shadow-lg shadow-teal-500/20"
                    >
                        Go to Dashboard
                    </Button>

                    <p className="text-xs text-slate-500 mt-4 flex items-center justify-center gap-2 text-center">
                        <FileText className="w-3 h-3 flex-shrink-0" />
                        You will be reminded before your trial ends to add a payment method.
                    </p>
                </div>
            </div>
        );
    }

    if (showMfaChallenge) {
        return (
            <div className="min-h-[100dvh] page-network-bg marketing-theme bg-transparent flex flex-col items-center justify-center p-4 py-12 relative overflow-x-hidden overflow-y-auto">
                <div className="fixed inset-0 z-0 pointer-events-none">
                    <HeroBackground />
                </div>

                <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-2xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 text-center my-auto animate-slide-up">
                    <div className="w-20 h-20 bg-teal-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Shield className="w-10 h-10 text-teal-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Two-Factor Authentication</h2>
                    <p className="text-slate-400 mb-8 text-sm">
                        Enter the 6-digit verification code from your authenticator app to continue.
                    </p>

                    <div className="mb-6 text-left">
                        <Input
                            label="Verification Code"
                            type="text"
                            value={mfaCode}
                            onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                            placeholder="123456"
                            className="font-mono text-center tracking-[0.5em] text-2xl h-14"
                        />
                    </div>

                    {error && (
                        <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-start gap-3 text-left mb-6 animate-fade-in">
                            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-rose-200">{error}</p>
                        </div>
                    )}

                    <Button
                        onClick={handleMfaVerify}
                        disabled={mfaCode.length !== 6 || isLoading}
                        isLoading={isLoading}
                        className="w-full h-12 text-base font-bold bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 rounded-xl shadow-lg shadow-teal-500/20"
                    >
                        Verify Identity
                    </Button>

                    <button
                        onClick={async () => {
                            const { supabase } = await import('@/lib/supabase');
                            await supabase.auth.signOut();
                            setShowMfaChallenge(false);
                            setMfaCode('');
                            setError('');
                        }}
                        className="mt-6 text-sm text-slate-500 hover:text-slate-300 transition-colors"
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[100dvh] page-network-bg marketing-theme bg-transparent flex flex-col items-center justify-center p-3 py-4 sm:py-6 relative overflow-x-hidden overflow-y-auto">
            {/* Background Effects */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <HeroBackground />
            </div>

            <div className={`w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-xl p-4 sm:p-5 shadow-2xl relative z-10 flex-shrink-0 max-w-md`}>
                <div className="mb-4 text-center">
                    {isPWA ? (
                        <div className="mx-auto mb-3 flex justify-center inline-block">
                            <Image
                                src={LOGO_URL}
                                alt="AlphaClone Logo"
                                width={48}
                                height={48}
                                className="object-contain"
                                priority
                            />
                        </div>
                    ) : (
                        <Link href="/" className="mx-auto mb-3 flex justify-center inline-block">
                            <Image
                                src={LOGO_URL}
                                alt="AlphaClone Logo"
                                width={48}
                                height={48}
                                className="object-contain hover:scale-105 transition-transform"
                                priority
                            />
                        </Link>
                    )}
                    <h1 className="text-lg font-bold text-white mb-1">AlphaClone Systems</h1>
                    <p className="text-slate-400 text-xs">
                        {isRegistering ? 'Create your Business OS workspace' : 'Sign in to your Business OS dashboard'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                    {isRegistering && (
                        <div className="animate-slide-up space-y-2">
                            <div className="max-w-md mx-auto rounded-lg border border-teal-500/20 bg-teal-500/10 px-3 py-2 text-center">
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-300">Business OS Access</p>
                                <p className="mt-0.5 text-xs text-slate-300">Business workspace provisioning enabled.</p>
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

                            <div className="animate-slide-up space-y-4">
                                <div className="max-w-md mx-auto w-full">
                                    <Input
                                        label="Business Name"
                                        value={businessName}
                                        onChange={(e) => setBusinessName(e.target.value)}
                                        placeholder="AlphaCorp Industries"
                                        required={isBusiness}
                                    />
                                </div>


                            </div>
                        </div>
                    )}

                    <div className="max-w-md mx-auto w-full space-y-4">
                        <Input
                            label="Email Address"
                            type="email"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                if (passwordResetSentTo) setPasswordResetSentTo('');
                            }}
                            placeholder="name@company.com"
                            required
                            autoComplete="email"
                        />

                        <div className="relative">
                            <Input
                                label="Password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className={!isRegistering ? 'pr-20' : 'pr-12'}
                                autoComplete={isRegistering ? "new-password" : "current-password"}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((prev) => !prev)}
                                className={`absolute top-9 ${!isRegistering ? 'right-16' : 'right-3'} text-slate-400 hover:text-teal-400 transition-colors`}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                title={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            {!isRegistering && (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (!email) {
                                            setError('Please enter your email address first to reset your password.');
                                            return;
                                        }
                                        setIsLoading(true);
                                        const { authService } = await import('@/services/authService');
                                        const { error: resetErr } = await authService.resetPassword(email);
                                        if (resetErr) {
                                            setError(resetErr);
                                            setPasswordResetSentTo('');
                                        } else {
                                            setError('');
                                            setPasswordResetSentTo(email);
                                            toast.success('Password reset link sent to your email!');
                                        }
                                        setIsLoading(false);
                                    }}
                                    className="absolute right-0 top-0 text-xs text-teal-500 hover:text-teal-400 font-bold uppercase tracking-wider"
                                >
                                    Forgot?
                                </button>
                            )}
                        </div>

                        {!isRegistering && passwordResetSentTo && (
                            <div className="bg-teal-500/10 border border-teal-500/20 rounded-lg p-3 text-teal-300 text-sm">
                                Reset link sent to <span className="font-semibold">{passwordResetSentTo}</span>. Open the email, set a new password, then return here to sign in.
                            </div>
                        )}

                        {isRegistering && (
                            <div className="flex flex-wrap gap-x-3 gap-y-1 py-1">
                                <div className={`flex items-center gap-1.5 text-[10px] ${password.length >= 8 ? 'text-teal-400' : 'text-slate-500'}`}>
                                    <div className={`w-1 h-1 rounded-full ${password.length >= 8 ? 'bg-teal-400' : 'bg-slate-500'}`} />
                                    8+ Chars
                                </div>
                                <div className={`flex items-center gap-1.5 text-[10px] ${/[A-Z]/.test(password) ? 'text-teal-400' : 'text-slate-500'}`}>
                                    <div className={`w-1 h-1 rounded-full ${/[A-Z]/.test(password) ? 'bg-teal-400' : 'bg-slate-500'}`} />
                                    Upper
                                </div>
                                <div className={`flex items-center gap-1.5 text-[10px] ${/[0-9]/.test(password) ? 'text-teal-400' : 'text-slate-500'}`}>
                                    <div className={`w-1 h-1 rounded-full ${/[0-9]/.test(password) ? 'bg-teal-400' : 'bg-slate-500'}`} />
                                    Number
                                </div>
                                <div className={`flex items-center gap-1.5 text-[10px] ${/[^A-Za-z0-9]/.test(password) ? 'text-teal-400' : 'text-slate-500'}`}>
                                    <div className={`w-1 h-1 rounded-full ${/[^A-Za-z0-9]/.test(password) ? 'bg-teal-400' : 'bg-slate-500'}`} />
                                    Special
                                </div>
                            </div>
                        )}

                        {isRegistering && (
                            <label className="flex items-start gap-3 cursor-pointer group">
                                <div className="relative flex-shrink-0 mt-0.5">
                                    <input
                                        type="checkbox"
                                        checked={legalAccepted}
                                        onChange={(e) => setLegalAccepted(e.target.checked)}
                                        className="peer sr-only"
                                    />
                                    <div className="w-4 h-4 border-2 border-slate-600 rounded peer-checked:bg-teal-500 peer-checked:border-teal-500 transition-all" />
                                    <CheckCircle2 className="w-2.5 h-2.5 text-white absolute top-0.5 left-0.5 opacity-0 peer-checked:opacity-100 transition-opacity" />
                                </div>
                                <span className="text-xs text-slate-400 leading-relaxed">
                                    By creating an account, you agree to our{' '}
                                    <Link href="/legal?tab=terms" target="_blank" className="text-teal-400 hover:text-teal-300 underline underline-offset-2">Terms of Service</Link>
                                    {' '}and{' '}
                                    <Link href="/legal?tab=privacy" target="_blank" className="text-teal-400 hover:text-teal-300 underline underline-offset-2">Privacy Policy</Link>.
                                </span>
                            </label>
                        )}

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm flex items-start gap-2 animate-fade-in">
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full h-10 text-base font-semibold bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 shadow-lg shadow-teal-500/20"
                            isLoading={isLoading}
                        >
                            {isRegistering ? 'Create Account' : 'Sign In'}
                        </Button>
                    </div>

                    <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-800"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-slate-900/60 px-2 text-slate-500">Or continue with</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-3">
                        <button
                            type="button"
                            aria-label="Sign in with Google"
                            title="Sign in with Google"
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
                                } catch {
                                    setError('Failed to initialize Google sign-in');
                                    setIsLoading(false);
                                }
                            }}
                            disabled={isLoading}
                            className="w-9 h-9 flex items-center justify-center bg-white hover:bg-gray-50 rounded-full border border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                        </button>

                        <button
                            type="button"
                            aria-label="Sign in with LinkedIn"
                            title="Sign in with LinkedIn"
                            onClick={async () => {
                                setIsLoading(true);
                                setError('');
                                try {
                                    const { authService } = await import('@/services/authService');
                                    const { error: linkedInError } = await authService.signInWithLinkedIn();
                                    if (linkedInError) {
                                        setError(linkedInError);
                                        setIsLoading(false);
                                    }
                                } catch {
                                    setError('Failed to initialize LinkedIn sign-in');
                                    setIsLoading(false);
                                }
                            }}
                            disabled={isLoading}
                            className="w-9 h-9 flex items-center justify-center bg-[#0A66C2] hover:bg-[#0958A8] text-white rounded-full border border-[#0A66C2] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.03-1.84-3.03-1.85 0-2.13 1.45-2.13 2.94v5.66H9.36V9h3.42v1.56h.05c.48-.9 1.64-1.84 3.37-1.84 3.6 0 4.26 2.37 4.26 5.46v6.27zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
                            </svg>
                        </button>

                        <button
                            type="button"
                            aria-label="Sign in with Facebook"
                            title="Sign in with Facebook"
                            onClick={async () => {
                                setIsLoading(true);
                                setError('');
                                try {
                                    const { authService } = await import('@/services/authService');
                                    const { error: facebookError } = await authService.signInWithFacebook();
                                    if (facebookError) {
                                        setError(facebookError);
                                        setIsLoading(false);
                                    }
                                } catch {
                                    setError('Failed to initialize Facebook sign-in');
                                    setIsLoading(false);
                                }
                            }}
                            disabled={isLoading}
                            className="w-9 h-9 flex items-center justify-center bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-full border border-[#1877F2] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.03 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.88v2.26h3.32l-.53 3.49h-2.79V24C19.61 23.09 24 18.1 24 12.07z" />
                            </svg>
                        </button>
                    </div>
                </form>

                <div className="mt-4 pt-3 border-t border-slate-800 text-center space-y-2">
                    <button
                        onClick={() => {
                            if (!registrationOpen && !isRegistering) {
                                setError('New registrations are currently closed by platform policy.');
                                return;
                            }
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
                    {!registrationOpen && policyLoaded && (
                        <p className="text-[11px] text-amber-400">Account registration is temporarily closed.</p>
                    )}
                    <p className="text-xs text-slate-600 uppercase tracking-wider">
                        Secured by AlphaClone 256-bit Encryption
                    </p>
                </div>
            </div>
        </div>
    );
}

