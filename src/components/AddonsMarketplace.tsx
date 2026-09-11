'use client';

import { useState, useEffect } from 'react';
import { Database, Zap, Video, Users, Activity, Check, ShoppingCart } from 'lucide-react';
import { subscriptionService, ADDON_PRICING } from '../services/subscriptionService';
import { useTenant } from '../contexts/TenantContext';
import { toast } from 'react-hot-toast';

const ADDON_ICONS = {
    storage: Database,
    ai_requests: Zap,
    video_minutes: Video,
    team_members: Users,
    api_calls: Activity,
};

export function AddonsMarketplace() {
    const { currentTenant: tenant } = useTenant();
    const [activeAddons, setActiveAddons] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState<string | null>(null);

    useEffect(() => {
        loadActiveAddons();
    }, [tenant]);

    async function loadActiveAddons() {
        if (!tenant) return;

        setLoading(true);
        const addons = await subscriptionService.getActiveAddons(tenant.id);
        setActiveAddons(addons);
        setLoading(false);
    }

    async function handlePurchase(addonType: string) {
        if (!tenant) {
            toast.error('Please log in to purchase add-ons');
            return;
        }

        setPurchasing(addonType);

        try {
            const addonConfig = ADDON_PRICING[addonType as keyof typeof ADDON_PRICING];

            // In production, this would create a Stripe checkout session
            // For now, we'll simulate the purchase
            const result = await subscriptionService.purchaseAddon(
                tenant.id,
                {
                    addonType: addonType as any,
                    addonName: addonConfig.name,
                    quantity: addonConfig.quantity,
                    priceCents: addonConfig.priceCents,
                    billingCycle: 'billingCycle' in addonConfig ? addonConfig.billingCycle : 'one_time',
                }
            );

            if (result.success) {
                toast.success(`Successfully purchased ${addonConfig.name}!`);
                loadActiveAddons();
            } else {
                toast.error(result.error || 'Failed to purchase add-on');
            }
        } catch (error) {
            toast.error('An error occurred while purchasing');
            console.error('Purchase error:', error);
        } finally {
            setPurchasing(null);
        }
    }

    function hasAddon(addonType: string): boolean {
        return activeAddons.some(a => a.addon_type === addonType && a.status === 'active');
    }

    const availableAddons = subscriptionService.getAvailableAddons();

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
                <div className="flex items-center mb-2">
                    <ShoppingCart className="h-8 w-8 mr-3" />
                    <h2 className="text-2xl font-bold">Add-ons Marketplace</h2>
                </div>
                <p className="text-blue-100">
                    Expand your capacity with flexible add-ons. Pay only for what you need.
                </p>
            </div>

            {/* Active Add-ons */}
            {activeAddons.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Active Add-ons</h3>
                    <div className="space-y-3">
                        {activeAddons.map(addon => (
                            <div
                                key={addon.id}
                                className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200"
                            >
                                <div className="flex items-center">
                                    <Check className="h-5 w-5 text-green-600 mr-3" />
                                    <div>
                                        <div className="font-medium text-gray-900">{addon.addon_name}</div>
                                        <div className="text-sm text-gray-600">
                                            {addon.usage_remaining
                                                ? `${addon.usage_remaining} / ${addon.quantity} remaining`
                                                : 'Active'}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-semibold text-gray-900">
                                        {subscriptionService.formatPrice(addon.price_cents)}
                                    </div>
                                    {addon.billing_cycle !== 'one_time' && (
                                        <div className="text-sm text-gray-600">per {addon.billing_cycle}</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Available Add-ons */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {availableAddons.map(addon => {
                    const Icon = ADDON_ICONS[addon.type as keyof typeof ADDON_ICONS];
                    const isActive = hasAddon(addon.type);
                    const isPurchasing = purchasing === addon.type;

                    return (
                        <div
                            key={addon.type}
                            className={`bg-white rounded-xl border-2 p-6 transition-all hover:shadow-lg ${
                                isActive ? 'border-green-400' : 'border-gray-200 hover:border-blue-400'
                            }`}
                        >
                            {/* Icon */}
                            <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg mb-4 ${
                                isActive ? 'bg-green-100' : 'bg-blue-100'
                            }`}>
                                <Icon className={`h-6 w-6 ${isActive ? 'text-green-600' : 'text-blue-600'}`} />
                            </div>

                            {/* Title */}
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">{addon.name}</h3>

                            {/* Description */}
                            <p className="text-sm text-gray-600 mb-4">
                                {addon.type === 'storage' && 'Extra storage space for your files and documents'}
                                {addon.type === 'ai_requests' && 'Additional AI-powered features and requests'}
                                {addon.type === 'video_minutes' && 'More video call minutes for your team'}
                                {addon.type === 'team_members' && 'Add another team member to your workspace'}
                                {addon.type === 'api_calls' && 'Extra API calls for integrations'}
                            </p>

                            {/* Quantity */}
                            <div className="text-2xl font-bold text-gray-900 mb-1">
                                {addon.quantity.toLocaleString()}
                                <span className="text-sm font-normal text-gray-600 ml-1">
                                    {addon.type === 'storage' && 'MB'}
                                    {addon.type === 'ai_requests' && 'requests'}
                                    {addon.type === 'video_minutes' && 'minutes'}
                                    {addon.type === 'team_members' && 'member'}
                                    {addon.type === 'api_calls' && 'calls'}
                                </span>
                            </div>

                            {/* Price */}
                            <div className="text-sm text-gray-600 mb-4">
                                {subscriptionService.formatPrice(addon.priceCents)}
                                {('billingCycle' in addon && addon.billingCycle === 'monthly') && ` / monthly`}
                            </div>

                            {/* CTA */}
                            <button
                                onClick={() => handlePurchase(addon.type)}
                                disabled={isPurchasing || isActive}
                                className={`w-full py-2.5 rounded-lg font-semibold transition-colors ${
                                    isActive
                                        ? 'bg-green-100 text-green-700 cursor-not-allowed'
                                        : isPurchasing
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                            >
                                {isActive ? 'Active' : isPurchasing ? 'Processing...' : 'Purchase'}
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Help Text */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                <strong>Need help?</strong> Add-ons are charged immediately and can be used until depleted. For recurring
                add-ons, you'll be charged monthly and can cancel anytime. Contact support for custom add-on packages.
            </div>
        </div>
    );
}
