
import React, { useState } from 'react';
import { Button, Input, Modal } from '../ui/UIComponents';
import Image from 'next/image';
import { User } from '../../types';
import { UserPlus, LogIn, AlertCircle, ShieldCheck } from 'lucide-react';
import { LOGO_URL } from '../../constants';
import { useTenant } from '../../contexts/TenantContext';
import SocialAuthButtons from './SocialAuthButtons';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: User) => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLogin }) => {
  const { refreshTenants } = useTenant();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showMfaChallenge, setShowMfaChallenge] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mfaCode.length !== 6) return;

    setIsLoading(true);
    setError('');

    try {
      const { supabase } = await import('../../lib/supabase');
      const challenges = await supabase.auth.mfa.listFactors();
      if (challenges.error) throw challenges.error;

      const factor = (challenges.data.all as any[]).find((f: any) => f.status === 'verified');
      if (!factor) throw new Error('No verified MFA factor found');

      const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (challenge.error) throw challenge.error;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        challengeId: challenge.data.id,
        code: mfaCode
      });

      if (verifyError) {
        setError(verifyError);
        setIsLoading(false);
        return;
      }

      const { authService } = await import('../../services/authService');
      const { user } = await authService.getCurrentUser();
      if (user) {
        onLogin(user);
      } else {
        setError('Failed to retrieve user after MFA verification');
      }
    } catch (err) {
      setError('MFA verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // 1. REGISTRATION FLOW
      if (isRegistering) {
        if (!name || !email || !password) {
          setError('All fields are required to create an account.');
          setIsLoading(false);
          return;
        }

        const referralCode = typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('ref')?.trim() || undefined
          : undefined;

        const { authService } = await import('../../services/authService');
        const role = 'tenant_admin';
        const { user, error: signUpError, needsEmailConfirmation } = await authService.signUp(email, password, name, role, {
          businessName,
          referralCode,
        });

        if (signUpError) {
          console.error("LoginModal SignUp Error:", signUpError);
          setError(signUpError);
          setIsLoading(false);
          return;
        }

        if (needsEmailConfirmation) {
          setError('');
          onClose();
          return;
        }

        if (user) {
          try {
            const { tenantService } = await import('../../services/tenancy/TenantService');
            const orgName = businessName.trim() || `${name}'s Organization`;
            const randomSuffix = Array.from({ length: 5 }, () =>
              String.fromCharCode(97 + Math.floor(Math.random() * 26))
            ).join('');
            const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + randomSuffix;
            await tenantService.createTenant({
              name: orgName,
              slug,
              adminUserId: user.id,
            });
            await refreshTenants();
          } catch (tenantErr) {
            console.error('Tenant Creation Error:', tenantErr);
            setError('Account created but workspace setup failed. Please refresh or contact support.');
            setIsLoading(false);
            return;
          }
          onLogin(user);
        }
        setIsLoading(false);
        return;
      }

      // 2. LOGIN FLOW
      const { authService } = await import('../../services/authService');
      const { user, needsMfa, error: signInError } = await authService.signIn(email, password);

      if (signInError) {
        setError('Invalid credentials. Please verify your email and password.');
        setIsLoading(false);
        return;
      }

      if (needsMfa) {
        setShowMfaChallenge(true);
        setIsLoading(false);
        return;
      }

      if (user) {
        onLogin(user);
      }
      setIsLoading(false);
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isRegistering ? "Create Account" : "Secure Access Login"}>
      <div className="mb-4 text-center">
        <div className="mx-auto mb-2 flex justify-center relative w-12 h-12">
          <Image
            src={LOGO_URL}
            alt="AlphaClone Logo"
            fill
            className="object-contain"
          />
        </div>
        <h4 className="text-slate-200 font-medium text-base">AlphaClone Systems</h4>
        <p className="text-xs text-slate-500 mt-0.5">
          {isRegistering ? '14-day free trial · workspace auto-created' : 'Business OS secure access'}
        </p>
      </div>

      {!showMfaChallenge && (
        <SocialAuthButtons
          isLoading={isLoading}
          onError={setError}
          onLoadingChange={setIsLoading}
          className="mb-3"
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {showMfaChallenge ? (
          <div className="animate-slide-up space-y-5">
            <div className="text-center space-y-2">
              <ShieldCheck className="w-12 h-12 text-teal-400 mx-auto" />
              <h5 className="font-bold text-white">Security Verification</h5>
              <p className="text-sm text-slate-400">Enter the 6-digit code from your authenticator app.</p>
            </div>

            <Input
              label="Verification Code"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              placeholder="000000"
              required
              className="text-center text-2xl tracking-[0.5em] font-bold"
            />

            <Button
              onClick={handleMfaVerify}
              className="w-full h-12 text-base font-semibold bg-teal-500 hover:bg-teal-400"
              isLoading={isLoading}
              disabled={mfaCode.length !== 6 || isLoading}
            >
              Verify & Continue
            </Button>

            <button
              type="button"
              onClick={() => setShowMfaChallenge(false)}
              className="w-full text-xs text-slate-500 hover:text-slate-400"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <>
            {!showMfaChallenge && (
              <div className="relative my-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-wide">
                  <span className="bg-slate-900 px-2 text-slate-500">Or use email</span>
                </div>
              </div>
            )}

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
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm flex items-start gap-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full h-10 text-sm font-semibold bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400" isLoading={isLoading}>
              {isRegistering ? 'Create Account with Email' : 'Sign In with Email'}
            </Button>
          </>
        )}

      </form>

      <div className="mt-6 pt-6 border-t border-slate-800 text-center space-y-4">
        <button
          onClick={() => {
            setIsRegistering(!isRegistering);
            setError('');
          }}
          className="text-sm text-teal-400 hover:text-teal-300 font-medium flex items-center justify-center gap-2 mx-auto"
        >
          {isRegistering ? (
            <>
              <LogIn className="w-4 h-4" /> Already have an account? Log In
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4" /> Create Business Workspace
            </>
          )}
        </button>

        <p className="text-xs text-slate-600 uppercase tracking-wider mb-3">
          Secured by AlphaClone 256-bit Encryption
        </p>

        <div className="flex justify-center gap-4 text-xs text-slate-500">
          <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:text-teal-400 transition-colors">Privacy Policy</a>
          <span>•</span>
          <a href="/terms-of-service" target="_blank" rel="noopener noreferrer" className="hover:text-teal-400 transition-colors">Terms of Service</a>
        </div>
      </div>
    </Modal>
  );
};

export default LoginModal;
