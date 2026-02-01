import React, { useState } from 'react';
import { Building2, ArrowRight, Loader2, Check, Sparkles } from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';

import { SubscriptionPlan, PLAN_PRICING } from '../../services/tenancy/types';

interface PlanOption {
  id: SubscriptionPlan;
  name: string;
  price: number;
  period: string;
  features: string[];
  popular?: boolean;
}

const plans: PlanOption[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 25,
    period: 'per month',
    popular: true,
    features: [
      '5 team members',
      '25 projects',
      '10 Video Meetings/mo',
      '60 mins per meeting',
      'Advanced Booking System',
      'Payment Processing'
    ]
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 89,
    period: 'per month',
    features: [
      '20 team members',
      '100 projects',
      '50 Video Meetings/mo',
      '90 mins per meeting',
      'AI Sales Assistant',
      'Contract Generation'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 200,
    period: 'per month',
    features: [
      'Unlimited team members',
      'Unlimited projects',
      '200 Video Meetings/mo',
      '180 mins per meeting',
      'Full CRM & Automation',
      'Custom API Access'
    ]
  }
];

export default function CreateBusinessOnboarding() {
  const { user } = useAuth();
  const { createTenant } = useTenant();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [businessName, setBusinessName] = useState('');
  const [businessSlug, setBusinessSlug] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('starter');

  // Auto-generate slug from business name
  const handleBusinessNameChange = (name: string) => {
    setBusinessName(name);

    // Auto-generate slug
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    setBusinessSlug(slug);
  };

  const handleCreateBusiness = async () => {
    setError(null);

    // Validation
    if (!businessName.trim()) {
      setError('Business name is required');
      return;
    }

    if (!businessSlug.trim()) {
      setError('Business URL is required');
      return;
    }

    if (businessSlug.length < 3) {
      setError('Business URL must be at least 3 characters');
      return;
    }

    // Check slug format (alphanumeric and hyphens only)
    if (!/^[a-z0-9-]+$/.test(businessSlug)) {
      setError('Business URL can only contain lowercase letters, numbers, and hyphens');
      return;
    }

    try {
      setIsCreating(true);

      // Create tenant
      const tenant = await createTenant({
        name: businessName.trim(),
        slug: businessSlug.trim(),
        plan: selectedPlan
      });

      // If it's a paid plan, redirect to Stripe Checkout
      if (selectedPlan !== 'free') {
        const planPricing = PLAN_PRICING[selectedPlan];
        if (planPricing.stripePriceId) {
          try {
            const response = await fetch('/api/stripe/create-checkout-session', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                priceId: planPricing.stripePriceId,
                tenantId: tenant.id,
                adminEmail: user?.email,
                successUrl: window.location.origin + '/dashboard?checkout=success',
                cancelUrl: window.location.origin + '/dashboard?checkout=cancelled',
              })
            });

            const { url, error: stripeError } = await response.json();
            if (url) {
              window.location.href = url;
              return;
            }
            if (stripeError) throw new Error(stripeError);
          } catch (checkoutErr: any) {
            console.error('Checkout redirect failed:', checkoutErr);
            // Fallback: just go to dashboard if Stripe fails
            router.push('/dashboard');
          }
        }
      }

      // Success! Redirect to dashboard (if not already handled by Stripe)
      router.push('/dashboard');

    } catch (err: any) {
      console.error('Failed to create business:', err);

      if (err.message?.includes('duplicate') || err.message?.includes('already exists')) {
        setError('This business URL is already taken. Please choose another.');
      } else {
        setError(err.message || 'Failed to create business. Please try again.');
      }

      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Building2 className="w-12 h-12 text-teal-400" />
            <h1 className="text-4xl font-bold text-white">Create Your Business</h1>
          </div>
          <p className="text-slate-400 text-lg">
            Set up your business operating system in minutes
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <StepIndicator number={1} label="Business Info" active={step === 1} completed={step > 1} />
          <div className="w-16 h-0.5 bg-slate-700" />
          <StepIndicator number={2} label="Choose Plan" active={step === 2} completed={step > 2} />
        </div>

        {/* Content */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 backdrop-blur-sm">
          {step === 1 && (
            <div className="max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold text-white mb-6">Tell us about your business</h2>

              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400">
                  {error}
                </div>
              )}

              <div className="space-y-6">
                {/* Business Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Business Name
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => handleBusinessNameChange(e.target.value)}
                    placeholder="e.g., Acme Design Studio"
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
                    autoFocus
                  />
                </div>

                {/* Business Slug */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Business URL
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={businessSlug}
                      onChange={(e) => setBusinessSlug(e.target.value.toLowerCase())}
                      placeholder="acme-design"
                      className="flex-1 px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
                    />
                    <span className="text-slate-400 text-sm">.alphaclone.com</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    This will be your unique business URL. Only lowercase letters, numbers, and hyphens allowed.
                  </p>
                </div>

                {/* Industry (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Industry (Optional)
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500 transition-colors"
                  >
                    <option value="">Select your industry</option>
                    <option value="agency">Agency / Creative Services</option>
                    <option value="consulting">Consulting / Professional Services</option>
                    <option value="restaurant">Restaurant / Food Service</option>
                    <option value="retail">Retail / E-commerce</option>
                    <option value="fitness">Fitness / Health</option>
                    <option value="legal">Legal Services</option>
                    <option value="real-estate">Real Estate</option>
                    <option value="other">Other</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-2">
                    Helps us customize your experience
                  </p>
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!businessName.trim() || !businessSlug.trim()}
                className="w-full mt-8 px-6 py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white font-semibold rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue to Plan Selection
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-2 text-center">Choose Your Plan</h2>
              <p className="text-slate-400 text-center mb-8">
                Start with a 14-day free trial on any plan. Cancel anytime.
              </p>

              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 max-w-2xl mx-auto">
                  {error}
                </div>
              )}

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {plans.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`relative p-6 rounded-xl border-2 transition-all text-left ${selectedPlan === plan.id
                      ? 'border-teal-500 bg-teal-500/10 scale-105'
                      : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                      }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <div className="px-3 py-1 bg-gradient-to-r from-teal-500 to-teal-600 text-white text-xs font-bold rounded-full flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          POPULAR
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                      {selectedPlan === plan.id && (
                        <Check className="w-6 h-6 text-teal-400" />
                      )}
                    </div>

                    <div className="mb-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-white">
                          ${plan.price}
                        </span>
                        <span className="text-slate-400 text-sm">/{plan.period}</span>
                      </div>
                    </div>

                    <ul className="space-y-2">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-slate-300">
                          <Check className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>

              <div className="max-w-2xl mx-auto space-y-4">
                <button
                  onClick={handleCreateBusiness}
                  disabled={isCreating}
                  className="w-full px-6 py-4 bg-gradient-to-r from-teal-500 to-teal-600 text-white text-lg font-semibold rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creating your business...
                    </>
                  ) : (
                    <>
                      Create My Business
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>

                <button
                  onClick={() => setStep(1)}
                  disabled={isCreating}
                  className="w-full px-6 py-3 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  ← Back to Business Info
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-slate-500 text-sm">
          By creating a business, you agree to our Terms of Service and Privacy Policy
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ number, label, active, completed }: { number: number; label: string; active: boolean; completed: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${completed
        ? 'bg-teal-500 text-white'
        : active
          ? 'bg-teal-500 text-white'
          : 'bg-slate-700 text-slate-400'
        }`}>
        {completed ? <Check className="w-5 h-5" /> : number}
      </div>
      <span className={`text-sm font-medium ${active ? 'text-white' : 'text-slate-500'}`}>
        {label}
      </span>
    </div>
  );
}
