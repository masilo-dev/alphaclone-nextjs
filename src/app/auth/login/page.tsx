'use client';

// Force Next.js to not statically cache this page in production
export const dynamic = 'force-dynamic';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import nextDynamic from 'next/dynamic';
import { Input, Button } from '@/components/ui/UIComponents';
import { LOGO_URL } from '@/constants';
import { AlertCircle, LogIn, UserPlus, FileText, Shield, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { usePWA } from '@/contexts/PWAContext';
import { SubscriptionPlan, PLAN_PRICING } from '@/services/tenancy/types';
import Image from 'next/image';
import { getPostAuthDashboardPath } from '@/lib/auth/postAuthRedirect';
import SocialAuthButtons from '@/components/auth/SocialAuthButtons';

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

    const resolveExplicitNextRedirect = (): string | null => {
      if (nextParam) {
        try {
          const decoded = decodeURIComponent(nextParam);
          if (decoded.startsWith('/oauth/') || decoded.startsWith('/authorize') || decoded.startsWith('/dashboard')) {
            return decoded;
          }
        } catch {
          // ignore malformed next param
        }
      }
      return null;
    };

    const [isRegistering, setIsRegistering] = useState(isRegisterMode);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [name, setName] = useState('');
    const [businessName, setBusinessName] = useState(businessNameParam || '');
    const [selectedPlan] = useState<SubscriptionPlan>(
        (['free', 'starter', 'pro', 'enterprise'] as const).includes(planParam as never)
            ? (planParam as SubscriptionPlan)
            : 'starter'
    );
    const [legalAccepted, setLegalAccepted] = useState(false);
    const [marketingOptIn, setMarketingOptIn] = useState(false);
    const [euConsent, setEuConsent] = useState(false);
    const [ageConfirmed, setAgeConfirmed] = useState(false);
    const [isEuLikeRegistration, setIsEuLikeRegistration] = useState(false);
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

    useEffect(() => {
        if (!isRegistering) return;
        const loadRegistrationContext = async () => {
            try {
                const response = await fetch('/api/account/registration-context', { cache: 'no-store' });
                const payload = await response.json().catch(() => ({}));
                setIsEuLikeRegistration(Boolean(payload?.requiresGdprConsent));
            } catch {
                setIsEuLikeRegistration(false);
            }
        };
        loadRegistrationContext();
    }, [isRegistering]);



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

                if (isEuLikeRegistration && (!euConsent || !ageConfirmed)) {
                    setError('EU/UK consent and age confirmation are required to continue.');
                    setIsLoading(false);
                    return;
                }

                const toastId = toast.loading('Creating your account...', { id: 'registration' });
                let newUser = null;

                try {
                    const { authService } = await import('@/services/authService');
                    const role = 'tenant_admin';
                    const signupResult = await authService.signUp(email, password, name, role, {
                        businessName,
                        plan: selectedPlan,
                    });
                    
                    if (signupResult.error) {
                        throw new Error(signupResult.error);
                    }
                    newUser = signupResult.user;

                    if (signupResult.needsEmailConfirmation) {
                        toast.success('Account created! Check your email to confirm, then sign in.', {
                            id: 'registration',
                            duration: 10000,
                        });
                        setIsRegistering(false);
                        setIsLoading(false);
                        return;
                    }

                    try {
                        const { supabase } = await import('@/lib/supabase');
                        const { data: sessionData } = await supabase.auth.getSession();
                        const sessionToken = sessionData.session?.access_token;
                        if (sessionToken) {
                            await fetch('/api/account/communication-prefs', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${sessionToken}`,
                                },
                                body: JSON.stringify({
                                    communicationPrefs: {
                                        transactional: true,
                                        product_updates: true,
                                        marketing: marketingOptIn,
                                        sms: false,
                                    },
                                    acceptedLegal: true,
                                    marketingOptIn,
                                    euConsent,
                                    ageConfirmed,
                                    isRegistration: true,
                                }),
                            });
                        }
                    } catch (consentErr) {
                        console.warn('Failed to persist registration consent:', consentErr);
                    }

                    toast.success('Account created successfully!', { id: 'registration' });
                } catch (signUpError: any) {
                    const errorMsg = signUpError.message || 'Failed to register';
                    console.error("SignUp Error:", errorMsg);
                    if (errorMsg.toLowerCase().includes('user already registered') ||
                        errorMsg.toLowerCase().includes('already exists') ||
                        errorMsg.toLowerCase().includes('already been registered')) {
                        setError('An account with this email already exists. Please sign in instead, or reset your password.');
                    } else if (errorMsg.toLowerCase().includes('permanently blocked') || errorMsg.toLowerCase().includes('blocked after account deletion')) {
                        setError('This email was permanently deleted and is banned from registering again.');
                    } else if (errorMsg.toLowerCase().includes('password')) {
                        setError('Your password does not meet the security requirements. Use at least 8 characters.');
                    } else {
                        setError(errorMsg);
                    }
                    toast.error(`Registration failed: ${errorMsg}`, { id: 'registration' });
                    setIsLoading(false);
                    return;
                }

                if (newUser) {
                    toast.loading('Provisioning workspace...', { id: 'workspace' });
                    const trialEndDate = new Date();
                    trialEndDate.setDate(trialEndDate.getDate() + 14);

                    const workspaceName = businessName?.trim() || `${name}'s Organization`;
                    const randomSuffix = Array.from({ length: 5 }, () =>
                        String.fromCharCode(97 + Math.floor(Math.random() * 26))
                    ).join('');
                    const slug = workspaceName.toLowerCase().replace(/[^a-z]+/g, '-') + '-' + randomSuffix;

                    let newTenant = null;
                    try {
                        const { tenantService } = await import('@/services/tenancy/TenantService');
                        newTenant = await tenantService.createTenant({
                            name: workspaceName,
                            slug,
                            adminUserId: newUser.id,
                            plan: selectedPlan,
                        });
                        toast.success('Workspace provisioned!', { id: 'workspace' });
                    } catch (tenantErr: any) {
                        const errorMsg = tenantErr.message || 'Failed to create workspace';
                        console.error('Tenant creation failed:', tenantErr);
                        toast.error(`Workspace provisioning failed: ${errorMsg}. Please try again or contact support.`, { id: 'workspace' });
                        setError(errorMsg);
                        setIsLoading(false);
                        return;
                    }

                    try {
                        const { tenantService } = await import('@/services/tenancy/TenantService');
                        await tenantService.updateTenant(newTenant.id, {
                            trial_ends_at: trialEndDate,
                            subscription_status: 'trial',
                            subscription_plan: selectedPlan,
                        });
                    } catch (trialErr) {
                        console.warn('Subscription setup failed:', trialErr);
                    }

                    try {
                        const { supabase } = await import('@/lib/supabase');
                        const { data: { session } } = await supabase.auth.getSession();
                        if (session?.access_token) {
                            void fetch(`${window.location.origin}/api/email/platform-transactional`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${session.access_token}`,
                                },
                                body: JSON.stringify({
                                    templateName: 'Welcome Email',
                                    variables: {
                                        name,
                                        trial_ends_at: trialEndDate.toLocaleDateString(),
                                        workspace_name: workspaceName,
                                    },
                                }),
                            }).catch((err) => console.warn('Welcome email trigger failed:', err));
                        }
                    } catch (emailErr) {
                        console.warn('Failed to start welcome email network call:', emailErr);
                    }

                    try {
                        void triggerOnboardingWorkflow(newTenant.id);
                    } catch (onboardErr) {
                        console.warn('Failed to trigger onboarding workflow:', onboardErr);
                    }

                    toast.success('Welcome to AlphaClone! Redirecting...');
                    router.push(getPostAuthDashboardPath('tenant_admin'));
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
                    setError('Incorrect email or password. If you signed up with Google, use "Continue with Google" instead. Otherwise use "Forgot?" to reset your password.');
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
                router.push(resolveExplicitNextRedirect() ?? getPostAuthDashboardPath(loggedInUser.role));
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
            const { businessInvoiceService } = await import('@/services/businessInvoiceService');
            const amount = selectedPlan === 'starter' ? 15 : selectedPlan === 'pro' ? 45 : 80;

            const { invoice, error: invoiceErr } = await businessInvoiceService.createInvoice(newTenantData.id, {
                total: amount,
                notes: `First month subscription — ${selectedPlan} plan`,
                status: 'draft',
                dueDate: new Date().toISOString().split('T')[0],
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

            router.push(getPostAuthDashboardPath('tenant_admin'));
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

            const { authService: postMfaAuth } = await import('@/services/authService');
            const { user: verifiedUser } = await postMfaAuth.getCurrentUser();
            router.push(resolveExplicitNextRedirect() ?? getPostAuthDashboardPath(verifiedUser?.role));
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
                        onClick={() => { window.location.href = '/dashboard'; }}
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
        <div className="min-h-[100dvh] page-network-bg marketing-theme bg-transparent flex flex-col items-center justify-start sm:justify-center p-3 py-3 relative overflow-x-hidden">
            {/* Background Effects */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <HeroBackground />
            </div>

            <div className="w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-xl p-4 sm:p-5 shadow-2xl relative z-10 flex-shrink-0 my-auto">
                <div className="mb-3 text-center">
                    {isPWA ? (
                        <div className="mx-auto mb-2 flex justify-center inline-block">
                            <Image
                                src={LOGO_URL}
                                alt="AlphaClone Logo"
                                width={40}
                                height={40}
                                className="object-contain"
                                priority
                            />
                        </div>
                    ) : (
                        <Link href="/" className="mx-auto mb-2 flex justify-center inline-block">
                            <Image
                                src={LOGO_URL}
                                alt="AlphaClone Logo"
                                width={40}
                                height={40}
                                className="object-contain hover:scale-105 transition-transform"
                                priority
                            />
                        </Link>
                    )}
                    <h1 className="text-base font-bold text-white mb-0.5">AlphaClone Systems</h1>
                    <p className="text-slate-400 text-[11px]">
                        {isRegistering
                            ? '14-day free trial · workspace ready in seconds'
                            : 'Sign in to your business workspace'}
                    </p>
                </div>

                <SocialAuthButtons
                    isLoading={isLoading}
                    onError={setError}
                    onLoadingChange={setIsLoading}
                    className="mb-3"
                />

                <div className="relative my-3">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-800" />
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase tracking-wide">
                        <span className="bg-slate-900/80 px-2 text-slate-500">Or use email</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-2">
                    {isRegistering && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Input
                                label="Full Name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="John Doe"
                                required={isRegistering}
                            />
                            <Input
                                label="Business Name"
                                value={businessName}
                                onChange={(e) => setBusinessName(e.target.value)}
                                placeholder="Optional"
                            />
                        </div>
                    )}

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
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            className={!isRegistering ? 'pr-20' : 'pr-12'}
                            autoComplete={isRegistering ? 'new-password' : 'current-password'}
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
                                className="absolute right-0 top-0 text-[10px] text-teal-500 hover:text-teal-400 font-bold uppercase tracking-wider"
                            >
                                Forgot?
                            </button>
                        )}
                    </div>

                    {!isRegistering && passwordResetSentTo && (
                        <div className="bg-teal-500/10 border border-teal-500/20 rounded-lg p-2 text-teal-300 text-xs">
                            Reset link sent to <span className="font-semibold">{passwordResetSentTo}</span>.
                        </div>
                    )}

                    {isRegistering && (
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 py-0.5">
                            <div className={`flex items-center gap-1 text-[10px] ${password.length >= 8 ? 'text-teal-400' : 'text-slate-500'}`}>
                                <div className={`w-1 h-1 rounded-full ${password.length >= 8 ? 'bg-teal-400' : 'bg-slate-500'}`} />
                                8+ chars
                            </div>
                            <div className={`flex items-center gap-1 text-[10px] ${/[A-Z]/.test(password) ? 'text-teal-400' : 'text-slate-500'}`}>
                                <div className={`w-1 h-1 rounded-full ${/[A-Z]/.test(password) ? 'bg-teal-400' : 'bg-slate-500'}`} />
                                Upper
                            </div>
                            <div className={`flex items-center gap-1 text-[10px] ${/[0-9]/.test(password) ? 'text-teal-400' : 'text-slate-500'}`}>
                                <div className={`w-1 h-1 rounded-full ${/[0-9]/.test(password) ? 'bg-teal-400' : 'bg-slate-500'}`} />
                                Number
                            </div>
                            <div className={`flex items-center gap-1 text-[10px] ${/[^A-Za-z0-9]/.test(password) ? 'text-teal-400' : 'text-slate-500'}`}>
                                <div className={`w-1 h-1 rounded-full ${/[^A-Za-z0-9]/.test(password) ? 'bg-teal-400' : 'bg-slate-500'}`} />
                                Special
                            </div>
                        </div>
                    )}

                    {isRegistering && (
                        <div className="space-y-1.5 text-[11px] text-slate-400">
                            <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={legalAccepted}
                                    onChange={(e) => setLegalAccepted(e.target.checked)}
                                    className="mt-0.5 accent-teal-500"
                                />
                                <span>
                                    I agree to the{' '}
                                    <Link href="/terms-of-service" target="_blank" className="text-teal-400 hover:text-teal-300 underline">Terms</Link>
                                    {' '}and{' '}
                                    <Link href="/privacy-policy" target="_blank" className="text-teal-400 hover:text-teal-300 underline">Privacy Policy</Link>.
                                </span>
                            </label>
                            <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={marketingOptIn}
                                    onChange={(e) => setMarketingOptIn(e.target.checked)}
                                    className="mt-0.5 accent-teal-500"
                                />
                                <span>Send me product updates (optional).</span>
                            </label>
                        </div>
                    )}

                    {isRegistering && isEuLikeRegistration && (
                        <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-[11px] text-slate-400">
                            <p className="font-semibold text-teal-300 uppercase tracking-wide text-[10px]">EU / UK consent</p>
                            <label className="flex items-start gap-2 cursor-pointer">
                                <input type="checkbox" checked={euConsent} onChange={(e) => setEuConsent(e.target.checked)} className="mt-0.5 accent-teal-500" />
                                <span>I consent to data processing per the Privacy Policy.</span>
                            </label>
                            <label className="flex items-start gap-2 cursor-pointer">
                                <input type="checkbox" checked={ageConfirmed} onChange={(e) => setAgeConfirmed(e.target.checked)} className="mt-0.5 accent-teal-500" />
                                <span>I am 16 years of age or older.</span>
                            </label>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 text-red-400 text-xs flex items-start gap-2 animate-fade-in">
                            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <Button
                        type="submit"
                        className="w-full h-9 text-sm font-semibold bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 shadow-lg shadow-teal-500/20"
                        isLoading={isLoading}
                    >
                        {isRegistering ? 'Create Account with Email' : 'Sign In with Email'}
                    </Button>
                </form>

                <div className="mt-3 pt-2 border-t border-slate-800 text-center space-y-1.5">
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
                                <LogIn className="w-4 h-4" /> Already have an account? Sign In
                            </>
                        ) : (
                            <>
                                <UserPlus className="w-4 h-4" /> Don't have an account? Start Free Trial
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
