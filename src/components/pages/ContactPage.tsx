'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, Phone, MapPin, Send, CheckCircle2, AlertCircle, Calendar } from 'lucide-react';
import { Button, Input } from '../ui/UIComponents';
import { formatLegalAddress } from '@/lib/seo/siteEntity';
import { contactSchema } from '../../schemas/validation';
import AnimateIn from '../common/AnimateIn';
import ObfuscatedEmail from '../common/ObfuscatedEmail';
import TurnstileWidget, { TURNSTILE_BYPASS_TOKEN } from '@/components/security/TurnstileWidget';
import { PUBLIC_DEMO_BOOKING_URL, isExternalHref, withPreservedQuery } from '@/lib/marketing/cta';
import { useLanguage } from '@/contexts/LanguageContext';

type FormState = {
  name: string;
  email: string;
  company: string;
  phone: string;
  subject: string;
  message: string;
  website: string; // Honeypot — rendered visually hidden, never shown to users
};

const EMPTY_FORM: FormState = {
  name: '',
  email: '',
  company: '',
  phone: '',
  subject: '',
  message: '',
  website: '',
};

const ContactPage: React.FC = () => {
  const { t } = useLanguage();
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileNonce, setTurnstileNonce] = useState(0);
  const [turnstileUnavailable, setTurnstileUnavailable] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [notificationSent, setNotificationSent] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  const handleChange =
    (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setStatus('sending');
    setErrorMessage('');

    // Frontend schema validation
    const validationResult = contactSchema.safeParse({
      name: formData.name,
      email: formData.email,
      subject: formData.subject,
      message: formData.message,
      company: formData.company || undefined,
      phone: formData.phone || undefined,
      website: formData.website || undefined, // Honeypot
    });

    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      setStatus('error');
      setErrorMessage(firstError?.message || 'Please check your form inputs and try again.');
      return;
    }

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          subject: formData.subject || 'General Inquiry',
          message: formData.message,
          company: formData.company || undefined,
          phone: formData.phone || undefined,
          website: formData.website || undefined, // Honeypot
          turnstileToken:
            turnstileToken ||
            (turnstileUnavailable ? TURNSTILE_BYPASS_TOKEN : undefined),
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (response.ok && payload?.success) {
        setStatus('success');
        setNotificationSent(payload.notificationSent !== false);
        setFormData(EMPTY_FORM);
        setTurnstileToken('');
        setTurnstileUnavailable(false);
        setTurnstileNonce((n) => n + 1);
      } else {
        setStatus('error');
        setErrorMessage(
          payload?.error ||
          'Something went wrong. Please try again or email us directly at info@alphaclonesystems.com.'
        );
        setTurnstileToken('');
        setTurnstileUnavailable(false);
        setTurnstileNonce((n) => n + 1);
      }
    } catch {
      setStatus('error');
      setErrorMessage(
        'Network error. Please check your connection and try again.'
      );
    }
  };

  const bookingDestination = (() => {
    try {
      return withPreservedQuery(PUBLIC_DEMO_BOOKING_URL, typeof window !== 'undefined' ? window.location.search : '');
    } catch {
      return PUBLIC_DEMO_BOOKING_URL;
    }
  })();
  const bookingIsExternal = isExternalHref(bookingDestination);

  const isSubmitting = status === 'sending';
  // Allow send when Turnstile is healthy OR when it failed over to the
  // explicit bypass sentinel (widget timeout / Cloudflare 600010). Never
  // leave the marketing contact form permanently stuck disabled.
  const turnstileReady =
    !turnstileEnabled ||
    Boolean(turnstileToken) ||
    turnstileUnavailable;
  const submitDisabled = isSubmitting || !turnstileReady;

  return (
    <div className="min-h-screen bg-white text-[var(--marketing-text-primary)] relative overflow-hidden">
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center pt-16 pb-10 px-4 sm:px-6">
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <AnimateIn type="fadeUp">
            <p className="type-caption font-bold uppercase tracking-caps text-[var(--marketing-accent-hover)] mb-3">{t('Get in touch')}</p>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold font-marketing-heading text-[var(--marketing-text-primary)] mb-4 tracking-tight leading-tight">
              {t("Let's Build Your")} <br />
              <span className="text-[var(--marketing-accent)]">{t('Growth Engine.')}</span>
            </h1>
            <p className="text-base sm:text-lg text-[var(--marketing-text-on-light)] max-w-2xl mx-auto mb-8 leading-relaxed">
              {t('Get in touch to discuss your workflows. For the fastest response, book a walkthrough or reach out directly.')}
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <a
                href={bookingDestination}
                target={bookingIsExternal ? '_blank' : undefined}
                rel={bookingIsExternal ? 'noopener noreferrer' : undefined}
                className="mkt-btn mkt-btn-primary inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-colors shadow-sm type-ui"
              >
                <Calendar className="w-4 h-4 mr-1 inline" />
                {t('Book a Walkthrough')}
              </a>
              <Button
                variant="outline"
                onClick={() => window.open('https://wa.me/48517809674', '_blank')}
                className="mkt-btn-secondary font-semibold h-11 px-6 rounded-xl type-ui"
              >
                <span className="relative z-10">{t('Chat on WhatsApp')}</span>
              </Button>
            </div>
          </AnimateIn>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-24 relative z-10 border-t border-[var(--marketing-border)] pt-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Info */}
          <AnimateIn type="fadeLeft" delay={0.1}>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold font-marketing-heading text-[var(--marketing-text-primary)] mb-6 tracking-tight">
                {t('Direct Channels')}
              </h2>
              <div className="space-y-6 mb-8">
                <div className="flex items-start gap-4">
                  <Mail className="w-5 h-5 text-[var(--marketing-accent)] mt-1 flex-shrink-0" />
                  <div>
                    <div className="font-bold text-[var(--marketing-text-primary)] mb-1">{t('Email')}</div>
                    <div className="flex flex-col gap-1 type-ui">
                      <div className="text-[var(--marketing-accent-hover)]">
                        {t('General')}: <ObfuscatedEmail email="info@alphaclonesystems.com" className="hover:underline" />
                      </div>
                      <div className="text-[var(--marketing-accent-hover)]">
                        {t('Sales')}: <ObfuscatedEmail email="sales@alphaclonesystems.com" className="hover:underline" />
                      </div>
                      <div className="text-[var(--marketing-accent-hover)]">
                        {t('Administration')}: <ObfuscatedEmail email="admin@alphaclonesystems.com" className="hover:underline" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <Phone className="w-5 h-5 text-[var(--marketing-accent)] mt-1 flex-shrink-0" />
                  <div>
                    <div className="font-bold text-[var(--marketing-text-primary)] mb-1">{t('Phone & WhatsApp')}</div>
                    <div className="flex flex-col gap-1 type-ui">
                      <a href="tel:+48517809674" className="text-[var(--marketing-accent-hover)] hover:underline transition-colors font-medium">
                        +48 517 809 674
                      </a>
                      <a
                        href="https://wa.me/48517809674"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="type-caption text-[var(--marketing-text-on-light)] hover:text-[var(--marketing-accent)] transition-colors"
                      >
                        {t('Send WhatsApp message')}
                      </a>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <MapPin className="w-5 h-5 text-[var(--marketing-accent)] mt-1 flex-shrink-0" />
                  <div>
                    <div className="font-bold text-[var(--marketing-text-primary)] mb-1">{t('Registered office')}</div>
                    <div className="text-[var(--marketing-text-on-light)] type-ui">{formatLegalAddress()}</div>
                    <div className="text-[var(--marketing-text-muted)] type-caption mt-1">
                      {t('Support is available by phone and WhatsApp — remote team, US-registered entity.')}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-[var(--marketing-bg-secondary)] border border-[var(--marketing-border)] rounded-2xl">
                <p className="type-card-description font-bold text-[var(--marketing-text-primary)] mb-1">{t('Prefer a live call?')}</p>
                <p className="type-card-description text-[var(--marketing-text-on-light)] mb-4">
                  {t('Skip the inbox and schedule a live walkthrough directly.')}
                </p>
                <a
                  href={bookingDestination}
                  target={bookingIsExternal ? '_blank' : undefined}
                  rel={bookingIsExternal ? 'noopener noreferrer' : undefined}
                  className="inline-flex items-center gap-2 type-ui font-semibold text-[var(--marketing-accent-hover)] hover:text-[var(--marketing-accent)] transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  {t('Book a free meeting')}
                </a>
              </div>
            </div>
          </AnimateIn>

          {/* Contact Form */}
          <AnimateIn type="fadeRight" delay={0.15}>
            <div className="p-6 sm:p-8 rounded-2xl bg-white border border-[var(--marketing-border)] shadow-sm">
              <h2 className="text-xl sm:text-2xl font-bold font-marketing-heading text-[var(--marketing-text-primary)] mb-6 tracking-tight">
                {t('Send a Message')}
              </h2>

              {/* Success Banner */}
              {status === 'success' && (
                <div className="flex items-start gap-3 text-emerald-800 bg-emerald-50 border border-emerald-200 p-4 rounded-xl mb-6 animate-fadeIn">
                  <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0 text-emerald-600" />
                  <div>
                    <p className="font-semibold">{t('Inquiry received!')}</p>
                    <p className="type-card-description text-emerald-700">
                      {notificationSent
                        ? t('We received your inquiry and will be in touch within 24 hours.')
                        : t('Your inquiry is saved, but the email notification could not be delivered. For an urgent reply, email bonnie@alphaclonesystems.com.')}
                    </p>
                  </div>
                </div>
              )}

              {/* Error Banner */}
              {status === 'error' && (
                <div className="flex items-start gap-3 text-red-800 bg-red-50 border border-red-200 p-4 rounded-xl mb-6">
                  <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-red-600" />
                  <span className="type-ui">{errorMessage ? t(errorMessage) : t('Failed to send message. Please try again.')}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {/* Honeypot field — hidden from real users, filled by bots */}
                <div
                  aria-hidden="true"
                  style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}
                >
                  <label htmlFor="contact-website">Website</label>
                  <input
                    id="contact-website"
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={formData.website}
                    onChange={handleChange('website')}
                  />
                </div>

                <Input
                  label={t('Full name *')}
                  id="contact-name"
                  value={formData.name}
                  onChange={handleChange('name')}
                  required
                  disabled={isSubmitting}
                  placeholder={t('Your name')}
                />

                <Input
                  label={t('Email address *')}
                  id="contact-email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange('email')}
                  required
                  disabled={isSubmitting}
                  placeholder="your.email@example.com"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label={t('Company')}
                    id="contact-company"
                    value={formData.company}
                    onChange={handleChange('company')}
                    disabled={isSubmitting}
                    placeholder={t('Your company (optional)')}
                  />
                  <Input
                    label={t('Phone')}
                    id="contact-phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange('phone')}
                    disabled={isSubmitting}
                    placeholder={t('+1 555 000 0000 (optional)')}
                  />
                </div>

                <Input
                  label={t('Subject *')}
                  id="contact-subject"
                  value={formData.subject}
                  onChange={handleChange('subject')}
                  required
                  disabled={isSubmitting}
                  placeholder={t('What is this regarding?')}
                />

                <div>
                  <label htmlFor="contact-message" className="block type-label font-medium text-[var(--marketing-text-secondary)] mb-1.5">
                    {t('Message *')}
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange('message')}
                    required
                    disabled={isSubmitting}
                    rows={5}
                    className="w-full bg-white border border-[var(--marketing-border)] rounded-xl px-4 py-3 text-[var(--marketing-text-primary)] placeholder-[var(--marketing-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--marketing-accent)] focus:border-transparent disabled:opacity-60 transition-colors resize-none"
                    placeholder={t('Tell us about your business or what you need help with…')}
                  />
                </div>

                {turnstileEnabled && (
                  <TurnstileWidget
                    key={turnstileNonce}
                    className="flex justify-center"
                    bypassOnError
                    onTokenChange={(token) => {
                      setTurnstileToken(token);
                      if (token === TURNSTILE_BYPASS_TOKEN) {
                        setTurnstileUnavailable(true);
                      } else if (token) {
                        setTurnstileUnavailable(false);
                      }
                    }}
                    onExpire={() => {
                      setTurnstileToken('');
                      setTurnstileUnavailable(false);
                    }}
                    onError={() => {
                      setTurnstileUnavailable(true);
                      setTurnstileToken(TURNSTILE_BYPASS_TOKEN);
                    }}
                  />
                )}
                {turnstileEnabled && !turnstileToken && !turnstileUnavailable && (
                  <p className="type-ui text-[var(--marketing-text-on-light)]" role="status">
                    {t('Complete the security check to send your message. If it does not load, email info@alphaclonesystems.com directly.')}
                  </p>
                )}
                {turnstileEnabled && turnstileUnavailable && (
                  <p className="type-ui text-[var(--marketing-text-on-light)]" role="status">
                    {t('Security check unavailable — you can still send your message. We also monitor submissions by rate limit and spam filters.')}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={submitDisabled}
                  isLoading={isSubmitting}
                  size="lg"
                  className="mkt-btn-primary w-full font-semibold rounded-xl py-3.5 transition-colors shadow-sm"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isSubmitting ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {t('Sending…')}
                      </>
                    ) : (
                      <>
                        {t('Send Message')}
                        <Send className="w-4 h-4" />
                      </>
                    )}
                  </span>
                </Button>
              </form>
            </div>
          </AnimateIn>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
