'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input, Button } from '@/components/ui/UIComponents';
import { LOGO_URL } from '@/constants';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { authService } from '@/services/authService';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';

export default function ResetPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    // null = verifying the recovery link, true = valid session, false = invalid/expired
    const [linkValid, setLinkValid] = useState<boolean | null>(null);

    // Establish the recovery session from the email link before allowing a password change.
    useEffect(() => {
        let settled = false;

        const markValid = () => {
            if (!settled) {
                settled = true;
                setLinkValid(true);
            }
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || session) {
                markValid();
            }
        });

        supabase.auth.getSession().then(({ data }) => {
            if (data.session) markValid();
        });

        // If no recovery session is established shortly after load, the link is invalid/expired.
        const timeout = setTimeout(() => {
            if (!settled) {
                settled = true;
                setLinkValid(false);
            }
        }, 4000);

        return () => {
            subscription.unsubscribe();
            clearTimeout(timeout);
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setIsLoading(true);
        try {
            const { error: updateErr } = await authService.updatePassword(password);
            if (updateErr) {
                setError(updateErr);
            } else {
                setIsSuccess(true);
                toast.success('Password updated successfully!');
                setTimeout(() => {
                    router.push('/auth/login');
                }, 3000);
            }
        } catch {
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
                    <div className="w-20 h-20 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-10 h-10 text-teal-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Password Reset!</h2>
                    <p className="text-slate-400 mb-8">
                        Your password has been updated. You will be redirected to the login page shortly.
                    </p>
                    <Button onClick={() => router.push('/auth/login')} className="w-full">
                        Return to Login
                    </Button>
                </div>
            </div>
        );
    }

    if (linkValid === null) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
                    <Loader2 className="w-10 h-10 text-teal-400 animate-spin mx-auto mb-6" />
                    <h2 className="text-xl font-bold text-white mb-2">Verifying your reset link…</h2>
                    <p className="text-slate-400 text-sm">Just a moment while we securely open your password reset session.</p>
                </div>
            </div>
        );
    }

    if (linkValid === false) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
                    <div className="w-20 h-20 bg-amber-500/15 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="w-10 h-10 text-amber-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Reset link expired</h2>
                    <p className="text-slate-400 mb-8">
                        This password reset link is invalid or has expired. Reset links are single-use and time-limited — please request a new one.
                    </p>
                    <Button onClick={() => router.push('/auth/login')} className="w-full">
                        Request a new link
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-teal-500/5 blur-[80px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-blue-600/5 blur-[80px]" />
            </div>

            <div className="max-w-md w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10">
                <div className="mb-8 text-center">
                    <Image
                        src={LOGO_URL}
                        alt="AlphaClone Logo"
                        width={64}
                        height={64}
                        className="object-contain mx-auto mb-4"
                        priority
                    />
                    <h1 className="text-2xl font-bold text-white mb-2">Set New Password</h1>
                    <p className="text-slate-400">Secure your account with a strong password</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <div className="relative">
                            <Input
                                label="New Password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="........"
                                required
                                className="pr-14"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((prev) => !prev)}
                                className="absolute right-3 top-9 text-slate-400 hover:text-teal-400 transition-colors"
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                title={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>

                        <div className="relative">
                            <Input
                                label="Confirm New Password"
                                type={showConfirmPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="........"
                                required
                                className="pr-14"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword((prev) => !prev)}
                                className="absolute right-3 top-9 text-slate-400 hover:text-teal-400 transition-colors"
                                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                                title={showConfirmPassword ? 'Hide password' : 'Show password'}
                            >
                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>

                        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3 space-y-2">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Security Requirements</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                <div className={`flex items-center gap-2 text-xs ${password.length >= 8 ? 'text-teal-400' : 'text-slate-500'}`}>
                                    <div className={`w-1 h-1 rounded-full ${password.length >= 8 ? 'bg-teal-400' : 'bg-slate-500'}`} />
                                    8+ Characters
                                </div>
                                <div className={`flex items-center gap-2 text-xs ${/[A-Z]/.test(password) ? 'text-teal-400' : 'text-slate-500'}`}>
                                    <div className={`w-1 h-1 rounded-full ${/[A-Z]/.test(password) ? 'bg-teal-400' : 'bg-slate-500'}`} />
                                    Uppercase
                                </div>
                                <div className={`flex items-center gap-2 text-xs ${/[0-9]/.test(password) ? 'text-teal-400' : 'text-slate-500'}`}>
                                    <div className={`w-1 h-1 rounded-full ${/[0-9]/.test(password) ? 'bg-teal-400' : 'bg-slate-500'}`} />
                                    Number
                                </div>
                                <div className={`flex items-center gap-2 text-xs ${/[^A-Za-z0-9]/.test(password) ? 'text-teal-400' : 'text-slate-500'}`}>
                                    <div className={`w-1 h-1 rounded-full ${/[^A-Za-z0-9]/.test(password) ? 'bg-teal-400' : 'bg-slate-500'}`} />
                                    Special Char
                                </div>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <Button type="submit" className="w-full h-12 text-base font-semibold bg-gradient-to-r from-teal-600 to-teal-500 shadow-lg shadow-teal-500/20" isLoading={isLoading}>
                        Update Password
                    </Button>
                </form>
            </div>
        </div>
    );
}

