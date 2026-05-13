'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
    CheckCircle2, 
    Rocket, 
    Zap, 
    ShieldCheck, 
    ArrowRight, 
    Star,
    Crown,
    Check
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { PLAN_PRICING, SubscriptionPlan } from '@/services/tenancy/types';
import { Button } from '@/components/ui/UIComponents';
import toast from 'react-hot-toast';

const PAID_PLANS: SubscriptionPlan[] = ['starter', 'pro', 'enterprise'];

export default function UpgradePage() {
    const { currentTenant, isLoading: tenantLoading } = useTenant();
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('pro');
    const [isProcessing, setIsProcessing] = useState(false);

    if (tenantLoading || authLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const handleUpgrade = async () => {
        if (!currentTenant || !user) {
            toast.error('Session expired. Please log in again.');
            router.push('/auth/login');
            return;
        }

        setIsProcessing(true);
        try {
            const response = await fetch('/api/stripe/create-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan: selectedPlan,
                    tenantId: currentTenant.id,
                    userId: user.id,
                }),
            });
            const data = await response.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error(data.error || 'No checkout URL returned');
            }
        } catch (error) {
            console.error('Upgrade error:', error);
            toast.error('Failed to initiate checkout. Please try again.');
            setIsProcessing(false);
        }
    };

    const planConfig = {
        starter: {
            icon: Rocket,
            color: 'teal',
            tagline: 'Scale Your Business',
            gradient: 'from-teal-500/20 to-emerald-500/20',
            borderColor: 'border-teal-500/30'
        },
        pro: {
            icon: Zap,
            color: 'indigo',
            tagline: 'Most Popular',
            gradient: 'from-indigo-500/20 to-purple-500/20',
            borderColor: 'border-indigo-500/50'
        },
        enterprise: {
            icon: Crown,
            color: 'amber',
            tagline: 'Full Power',
            gradient: 'from-amber-500/20 to-orange-500/20',
            borderColor: 'border-amber-500/30'
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-teal-500/30 overflow-x-hidden pb-20">
            {/* Background elements */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-500/10 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 pt-12 md:pt-20">
                {/* Header */}
                <div className="text-center mb-16">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm font-bold mb-6"
                    >
                        <Star className="w-4 h-4" />
                        <span>Ready to unleash AlphaClone?</span>
                    </motion.div>
                    
                    <motion.h1 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-4xl md:text-6xl font-black tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-slate-400"
                    >
                        Pick Your Power Level
                    </motion.h1>
                    
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto"
                    >
                        You're currently on the <span className="text-teal-400 font-bold uppercase">{currentTenant?.subscription_plan}</span> plan. 
                        Upgrade to remove limits and unlock elite automation.
                    </motion.p>
                </div>

                {/* Plan Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
                    {PAID_PLANS.map((planId, index) => {
                        const pricing = PLAN_PRICING[planId];
                        const config = planConfig[planId as keyof typeof planConfig];
                        const Icon = config.icon;
                        const isSelected = selectedPlan === planId;
                        const isCurrent = currentTenant?.subscription_plan === planId;

                        return (
                            <motion.div
                                key={planId}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 * (index + 3) }}
                                onClick={() => setSelectedPlan(planId)}
                                className={`relative group cursor-pointer rounded-3xl p-1 transition-all duration-500 ${
                                    isSelected 
                                        ? `bg-gradient-to-b from-${config.color}-500 to-transparent shadow-2xl shadow-${config.color}-500/20 scale-[1.02]` 
                                        : 'bg-slate-800/50 hover:bg-slate-800 transition-colors'
                                }`}
                            >
                                <div className={`h-full rounded-[22px] p-8 bg-slate-900/95 backdrop-blur-xl flex flex-col ${
                                    isSelected ? '' : 'border border-slate-800'
                                }`}>
                                    {/* Plan Header */}
                                    <div className="flex justify-between items-start mb-6">
                                        <div className={`p-3 rounded-2xl bg-${config.color}-500/10 border border-${config.color}-500/20`}>
                                            <Icon className={`w-6 h-6 text-${config.color}-400`} />
                                        </div>
                                        {planId === 'pro' && (
                                            <span className="px-3 py-1 rounded-full bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest">
                                                Best Value
                                            </span>
                                        )}
                                    </div>

                                    <div className="mb-8">
                                        <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">{planId}</h3>
                                        <p className="text-slate-400 text-sm leading-relaxed min-h-[40px]">
                                            {pricing.description}
                                        </p>
                                    </div>

                                    <div className="mb-8">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-4xl font-black text-white">${pricing.monthly}</span>
                                            <span className="text-slate-500 font-bold">/mo</span>
                                        </div>
                                        <div className="text-teal-500/80 text-xs font-bold mt-1">
                                            or ${pricing.yearly} billed annually (Save 20%)
                                        </div>
                                    </div>

                                    {/* Features */}
                                    <ul className="space-y-4 mb-10 flex-1">
                                        {pricing.featureList.map((feature, fIdx) => (
                                            <li key={fIdx} className="flex items-start gap-3 text-sm text-slate-300">
                                                <div className={`mt-0.5 w-5 h-5 rounded-full bg-${config.color}-500/10 flex items-center justify-center shrink-0`}>
                                                    <Check className={`w-3 h-3 text-${config.color}-400`} />
                                                </div>
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    {/* Action */}
                                    <div className={`absolute -bottom-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-${config.color}-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Checkout Summary Footer */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.8 }}
                    className="max-w-3xl mx-auto bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <ShieldCheck className="w-24 h-24 text-teal-500" />
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                        <div className="text-center md:text-left">
                            <h4 className="text-xl font-bold text-white mb-2 flex items-center justify-center md:justify-start gap-2">
                                <CheckCircle2 className="w-5 h-5 text-teal-400" />
                                Selected: {selectedPlan.toUpperCase()}
                            </h4>
                            <p className="text-slate-400 text-sm">
                                No long term contracts. Switch or cancel any time. 
                                Securely processed via Stripe.
                            </p>
                        </div>

                        <Button
                            onClick={handleUpgrade}
                            isLoading={isProcessing}
                            className="w-full md:w-auto px-10 h-14 bg-teal-600 hover:bg-teal-500 text-white font-black text-lg rounded-2xl flex items-center justify-center gap-3 group transition-all"
                        >
                            {isProcessing ? 'Setting up secure checkout...' : 'Upgrade Now'}
                            {!isProcessing && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                        </Button>
                    </div>
                </motion.div>

                {/* Trust Section */}
                <div className="mt-16 text-center">
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em] mb-6">Secured by industry leaders</p>
                    <div className="flex flex-wrap justify-center items-center gap-8 opacity-40 grayscale contrast-125">
                        <span className="text-xl font-black italic">STRIPE</span>
                        <span className="text-xl font-black italic">VISA</span>
                        <span className="text-xl font-black italic">MASTERCARD</span>
                        <span className="text-xl font-black italic">PAYPAL</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
