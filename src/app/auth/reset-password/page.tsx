'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input, Button } from '@/components/ui/UIComponents';
import { LOGO_URL } from '@/constants';
import { AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { authService } from '@/services/authService';

export default function ResetPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

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
        } catch (err) {
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

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-teal-500/5 blur-[80px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-blue-600/5 blur-[80px]" />
            </div>

            <div className="max-w-md w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10">
                <div className="mb-8 text-center">
                    <img
                        src={LOGO_URL}
                        alt="AlphaClone Logo"
                        className="w-16 h-16 object-contain mx-auto mb-4"
                    />
                    <h1 className="text-2xl font-bold text-white mb-2">Set New Password</h1>
                    <p className="text-slate-400">Secure your account with a strong password</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <Input
                            label="New Password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />

                        <Input
                            label="Confirm New Password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />

                        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3 space-y-2">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Security Requirements</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                <div className={`flex items-center gap-2 text-[10px] ${password.length >= 8 ? 'text-teal-400' : 'text-slate-500'}`}>
                                    <div className={`w-1 h-1 rounded-full ${password.length >= 8 ? 'bg-teal-400' : 'bg-slate-500'}`} />
                                    8+ Characters
                                </div>
                                <div className={`flex items-center gap-2 text-[10px] ${/[A-Z]/.test(password) ? 'text-teal-400' : 'text-slate-500'}`}>
                                    <div className={`w-1 h-1 rounded-full ${/[A-Z]/.test(password) ? 'bg-teal-400' : 'bg-slate-500'}`} />
                                    Uppercase
                                </div>
                                <div className={`flex items-center gap-2 text-[10px] ${/[0-9]/.test(password) ? 'text-teal-400' : 'text-slate-500'}`}>
                                    <div className={`w-1 h-1 rounded-full ${/[0-9]/.test(password) ? 'bg-teal-400' : 'bg-slate-500'}`} />
                                    Number
                                </div>
                                <div className={`flex items-center gap-2 text-[10px] ${/[^A-Za-z0-9]/.test(password) ? 'text-teal-400' : 'text-slate-500'}`}>
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
