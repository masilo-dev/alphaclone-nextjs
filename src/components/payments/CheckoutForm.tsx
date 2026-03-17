import React, { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { Button } from '../ui/UIComponents';
import { Loader2, AlertCircle } from 'lucide-react';

interface CheckoutFormProps {
    amount: number;
    currency: string;
    onSuccess: (paymentIntentId: string) => void;
    onCancel: () => void;
}

export const CheckoutForm: React.FC<CheckoutFormProps> = ({ amount, currency, onSuccess, onCancel }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!stripe || !elements) {
            // Stripe.js has not yet loaded.
            return;
        }

        setIsProcessing(true);
        setErrorMessage(null);

        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            redirect: 'if_required', // Handle redirect manually if needed, or 'always'
            confirmParams: {
                // Return URL where the customer should be redirected after the payment
                return_url: window.location.origin + '/dashboard/payments',
            },
        });

        if (error) {
            // This point will only be reached if there is an immediate error when
            // confirming the payment. Show error to your customer (e.g., payment
            // details incomplete)
            setErrorMessage(error.message || 'An unexpected error occurred.');
            setIsProcessing(false);
        } else if (paymentIntent && paymentIntent.status === 'succeeded') {
            // Payment succeeded!
            onSuccess(paymentIntent.id);
            setIsProcessing(false);
        } else {
            // Payment processing or requires action (3DS)
            setIsProcessing(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-slate-800 p-4 rounded-lg mb-4">
                <div className="flex justify-between items-center text-white mb-2">
                    <span className="text-slate-400">Total to pay</span>
                    <span className="text-2xl font-bold">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amount)}
                    </span>
                </div>
            </div>

            <PaymentElement options={{
                layout: 'tabs',
            }} />

            {errorMessage && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm">{errorMessage}</span>
                </div>
            )}

            <div className="flex gap-3 pt-4">
                <Button variant="outline" type="button" onClick={onCancel} disabled={isProcessing} className="w-full">
                    Cancel
                </Button>
                <Button type="submit" disabled={!stripe || isProcessing} className="w-full relative">
                    {isProcessing ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                        </>
                    ) : (
                        `Pay ${new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amount)}`
                    )}
                </Button>
            </div>
        </form>
    );
};
