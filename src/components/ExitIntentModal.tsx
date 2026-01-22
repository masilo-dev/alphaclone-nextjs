'use client';

import React, { useState, useEffect } from 'react';
import { X, CheckCircle } from 'lucide-react';
import { Button, Input } from './ui/UIComponents';
import { User } from '../types';
import { useExitIntent } from '../hooks/useExitIntent';
import { shouldShowExitIntent, markExitIntentCompleted, getUserType } from '../utils/exitIntentUtils';
import { improvementService } from '../services/improvementService';

interface ExitIntentModalProps {
    user: User | null;
}

const ExitIntentModal: React.FC<ExitIntentModalProps> = ({ user }) => {
    const { exitIntentTriggered, resetTrigger } = useExitIntent();
    const [isVisible, setIsVisible] = useState(false);
    const [message, setMessage] = useState('');
    const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);

    // Check if modal should be shown
    useEffect(() => {
        if (shouldShowExitIntent(user, exitIntentTriggered)) {
            setIsVisible(true);
        }
    }, [exitIntentTriggered, user]);

    const handleDismiss = () => {
        // Mark as completed (dismissal counts as completion)
        markExitIntentCompleted();

        // Update user profile if logged in
        if (user?.id) {
            improvementService.markUserAsCompleted(user.id, false);
        }

        setIsVisible(false);
        resetTrigger();
    };

    const handleSubmit = async () => {
        if (!message.trim()) {
            return;
        }

        setIsSubmitting(true);

        try {
            const { error } = await improvementService.submitImprovement({
                message: message.trim(),
                severity,
                page_url: window.location.href,
                user_type: getUserType(user),
                user_id: user?.id
            });

            if (error) {
                console.error('Failed to submit improvement:', error);
                alert('Failed to submit feedback. Please try again.');
                setIsSubmitting(false);
                return;
            }

            // Mark as completed
            markExitIntentCompleted();

            // Update user profile if logged in
            if (user?.id) {
                await improvementService.markUserAsCompleted(user.id, true);
            }

            // Show confirmation
            setShowConfirmation(true);

            // Hide modal after 2 seconds
            setTimeout(() => {
                setIsVisible(false);
                resetTrigger();
            }, 2000);
        } catch (err) {
            console.error('Unexpected error submitting improvement:', err);
            alert('An unexpected error occurred. Please try again.');
            setIsSubmitting(false);
        }
    };

    if (!isVisible) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
            {/* Bottom sheet modal */}
            <div className="pointer-events-auto w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-t-2xl shadow-2xl p-6 animate-slide-up">
                {showConfirmation ? (
                    // Confirmation state
                    <div className="flex flex-col items-center justify-center py-8">
                        <div className="w-16 h-16 bg-teal-500/10 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle className="w-8 h-8 text-teal-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Thank You!</h3>
                        <p className="text-slate-400 text-center">
                            Your feedback has been submitted and will help us improve the platform.
                        </p>
                    </div>
                ) : (
                    // Input form
                    <>
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-white mb-1">
                                    Before you go...
                                </h3>
                                <p className="text-sm text-slate-400">
                                    What do you think should be improved on this platform?
                                </p>
                            </div>
                            <button
                                onClick={handleDismiss}
                                className="text-slate-400 hover:text-white transition-colors"
                                aria-label="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Message input */}
                            <div>
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Share your thoughts..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 resize-none"
                                    rows={3}
                                    disabled={isSubmitting}
                                />
                            </div>

                            {/* Severity selector */}
                            <div>
                                <label className="text-sm text-slate-400 mb-2 block">
                                    Priority (optional)
                                </label>
                                <div className="flex gap-2">
                                    {(['low', 'medium', 'high'] as const).map((level) => (
                                        <button
                                            key={level}
                                            onClick={() => setSeverity(level)}
                                            disabled={isSubmitting}
                                            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${severity === level
                                                    ? level === 'high'
                                                        ? 'bg-red-500 text-white'
                                                        : level === 'medium'
                                                            ? 'bg-orange-500 text-white'
                                                            : 'bg-blue-500 text-white'
                                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                                }`}
                                        >
                                            {level.charAt(0).toUpperCase() + level.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <Button
                                    onClick={handleDismiss}
                                    variant="outline"
                                    className="flex-1"
                                    disabled={isSubmitting}
                                >
                                    Skip
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    className="flex-1 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold"
                                    disabled={!message.trim() || isSubmitting}
                                >
                                    {isSubmitting ? 'Submitting...' : 'Submit'}
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ExitIntentModal;
