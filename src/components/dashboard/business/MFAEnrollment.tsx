import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Input } from '../../ui/UIComponents';
import { Shield, ShieldCheck, ShieldAlert, Loader2, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MFAEnrollment() {
    const [isEnrolled, setIsEnrolled] = useState(false);
    const [factorId, setFactorId] = useState<string | null>(null);
    const [qrCodeData, setQrCodeData] = useState<string | null>(null);
    const [secret, setSecret] = useState<string | null>(null);
    const [verificationCode, setVerificationCode] = useState('');
    const [loading, setLoading] = useState(true);
    const [enrolling, setEnrolling] = useState(false);
    const [verifying, setVerifying] = useState(false);

    useEffect(() => {
        checkMFAStatus();
    }, []);

    const checkMFAStatus = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
            if (error) throw error;

            const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
            if (factorsError) throw factorsError;

            // Supabase returns { data: { all: Factor[], active: Factor[] } }
            const allFactors = (factorsData as any)?.all || [];
            const totpFactor = allFactors.find((f: any) => f.factor_type === 'totp' && f.status === 'verified');

            if (totpFactor) {
                setIsEnrolled(true);
                setFactorId(totpFactor.id);
            } else {
                setIsEnrolled(false);
                setFactorId(null);
            }
        } catch (error) {
            console.error('Error checking MFA status:', error);
        } finally {
            setLoading(false);
        }
    };

    const startEnrollment = async () => {
        setEnrolling(true);
        try {
            const { data, error } = await supabase.auth.mfa.enroll({
                factorType: 'totp',
            });
            if (error) throw error;

            setFactorId(data.id);
            // data.totp.qr_code is an SVG string
            setQrCodeData(data.totp.qr_code);
            setSecret(data.totp.secret);
        } catch (error: any) {
            console.error('Error starting MFA enrollment:', error);
            toast.error(error.message || 'Failed to start MFA enrollment');
        } finally {
            setEnrolling(false);
        }
    };

    const verifyEnrollment = async () => {
        if (!factorId || !verificationCode) return;
        setVerifying(true);
        try {
            const challengeResponse = await supabase.auth.mfa.challenge({ factorId });
            if (challengeResponse.error) throw challengeResponse.error;

            const verifyResponse = await supabase.auth.mfa.verify({
                factorId,
                challengeId: challengeResponse.data.id,
                code: verificationCode,
            });

            if (verifyResponse.error) throw verifyResponse.error;

            toast.success('Two-Factor Authentication enabled successfully!');
            await checkMFAStatus(); // Refresh status
            setQrCodeData(null);
            setSecret(null);
            setVerificationCode('');
        } catch (error: any) {
            console.error('Error verifying MFA:', error);
            toast.error(error.message || 'Invalid verification code');
        } finally {
            setVerifying(false);
        }
    };

    const unenroll = async () => {
        if (!factorId) return;
        const confirmDelete = window.confirm('Are you sure you want to disable Two-Factor Authentication? This will reduce your account security.');
        if (!confirmDelete) return;

        setLoading(true);
        try {
            const { error } = await supabase.auth.mfa.unenroll({ factorId });
            if (error) throw error;

            toast.success('Two-Factor Authentication disabled');
            setIsEnrolled(false);
            setFactorId(null);
        } catch (error: any) {
            console.error('Error unenrolling MFA:', error);
            toast.error(error.message || 'Failed to disable 2FA');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center gap-3 p-4 bg-slate-800 rounded-xl border border-slate-700 h-24">
                <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />
                <span className="text-slate-400">Loading security settings...</span>
            </div>
        );
    }

    return (
        <div className="p-5 bg-slate-800 rounded-xl border border-slate-700">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isEnrolled ? 'bg-teal-500/20' : 'bg-slate-700'}`}>
                        {isEnrolled ? (
                            <ShieldCheck className="w-6 h-6 text-teal-400" />
                        ) : (
                            <ShieldAlert className="w-6 h-6 text-slate-400" />
                        )}
                    </div>
                    <div>
                        <h4 className="font-bold text-white flex items-center gap-2">
                            Two-Factor Authentication (2FA)
                            {isEnrolled && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-400 font-bold uppercase tracking-wider">
                                    Enabled
                                </span>
                            )}
                        </h4>
                        <p className="text-sm text-slate-400">
                            {isEnrolled
                                ? 'Your account is secured with a TOTP authenticator app.'
                                : 'Protect your account by requiring a code from your authenticator app.'}
                        </p>
                    </div>
                </div>

                {isEnrolled ? (
                    <button
                        onClick={unenroll}
                        className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-bold transition-colors"
                    >
                        Disable 2FA
                    </button>
                ) : (
                    !qrCodeData && (
                        <Button
                            onClick={startEnrollment}
                            isLoading={enrolling}
                            className="bg-teal-600 hover:bg-teal-500 text-white text-sm"
                        >
                            <Shield className="w-4 h-4 mr-2" />
                            Enable 2FA
                        </Button>
                    )
                )}
            </div>

            {qrCodeData && !isEnrolled && (
                <div className="mt-6 pt-6 border-t border-slate-700 animate-fade-in text-slate-400">
                    <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700">
                        <h5 className="font-bold text-white mb-2 text-lg">Set up Authenticator App</h5>
                        <p className="text-sm text-slate-400 mb-6">
                            1. Open your authenticator app (e.g., Google Authenticator, Authy, or 1Password).<br />
                            2. Scan the QR code below or enter the setup key manually.
                        </p>

                        <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                            <div className="bg-white p-4 rounded-xl shadow-xl shrink-0">
                                {/* SVG string returned from Supabase contains full SVG tag */}
                                <div
                                    dangerouslySetInnerHTML={{ __html: qrCodeData }}
                                    className="w-48 h-48 md:w-56 md:h-56 [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
                                />
                            </div>

                            <div className="flex-1 w-full space-y-5">
                                <div>
                                    <label className="text-xs text-slate-500 font-medium uppercase tracking-wider">Setup Key (Manual Entry)</label>
                                    <div className="flex bg-slate-800 rounded-lg p-3 text-sm font-mono text-teal-400 border border-slate-700 mt-1">
                                        {secret}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-slate-500 font-medium uppercase tracking-wider">Verification Code</label>
                                    <div className="flex gap-3 mt-1">
                                        <Input
                                            value={verificationCode}
                                            onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                                            placeholder="123456"
                                            className="font-mono tracking-[0.5em] text-center text-xl h-14 bg-slate-800 border-slate-700 text-white focus:border-teal-500"
                                        />
                                        <Button
                                            onClick={verifyEnrollment}
                                            disabled={verificationCode.length !== 6 || verifying}
                                            isLoading={verifying}
                                            className="bg-teal-500 hover:bg-teal-400 text-black font-bold whitespace-nowrap px-8 h-14 rounded-xl"
                                        >
                                            Verify & Save
                                        </Button>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2 italic">Enter the 6-digit code generated by your app to verify setup.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
