'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, Phone, MapPin, Send, CheckCircle2, AlertCircle, Calendar } from 'lucide-react';
import { Button, Input } from '../ui/UIComponents';
import { formatLegalAddress } from '@/lib/seo/siteEntity';
import { contactSchema } from '../../schemas/validation';
import AnimateIn from '../common/AnimateIn';
import ObfuscatedEmail from '../common/ObfuscatedEmail';
import TurnstileWidget from '@/components/security/TurnstileWidget';
import { PUBLIC_DEMO_BOOKING_URL, isExternalHref, withPreservedQuery } from '@/lib/marketing/cta';

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
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileNonce, setTurnstileNonce] = useState(0);
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
          turnstileToken: turnstileToken || undefined,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (response.ok && payload?.success) {
        setStatus('success');
        setNotificationSent(payload.notificationSent !== false);
        setFormData(EMPTY_FORM);
        setTurnstileToken('');
        setTurnstileNonce((n) => n + 1);
      } else {
        setStatus('error');
        setErrorMessage(
          payload?.error ||
          'Something went wrong. Please try again or email us directly at info@alphaclonesystems.com.'
        );
        setTurnstileToken('');
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
  const submitDisabled = isSubmitting || (turnstileEnabled && !turnstileToken);

  return (
    <div className="min-h-screen bg-white text-[#07152f] relative overflow-hidden">
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center pt-16 pb-10 px-4 sm:px-6">
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <AnimateIn type="fadeUp">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#075fc7] mb-3">Get in touch</p>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold font-marketing-heading text-[#07152f] mb-4 tracking-tight leading-[1.05]">
              Let&apos;s Build Your <br />
              <span className="text-[#0878f9]">Growth Engine.</span>
            </h1>
            <p className="text-base sm:text-lg text-[#52627b] max-w-2xl mx-auto mb-8 leading-relaxed">
              Get in touch to discuss your workflows. For the fastest response, book a walkthrough or reach out directly.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <a
                href={bookingDestination}
                target={bookingIsExternal ? '_blank' : undefined}
                rel={bookingIsExternal ? 'noopener noreferrer' : undefined}
                aria-label="Book a consultation"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#07152f] hover:bg-[#0c2f61] text-white font-semibold transition-colors shadow-sm text-sm"
              >
                <Calendar className="w-4 h-4 mr-1 inline" />
                Book a Walkthrough
              </a>
              <Button
                variant="outline"
                onClick={() => window.open('https://wa.me/48517809674', '_blank')}
                className="border-[#dfe6ef] hover:border-[#0878f9] text-[#07152f] font-semibold h-11 px-6 rounded-xl text-sm"
              >
                <span className="relative z-10">Chat on WhatsApp</span>
              </Button>
            </div>
          </AnimateIn>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-24 relative z-10 border-t border-[#dfe6ef] pt-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Info */}
          <AnimateIn type="fadeLeft" delay={0.1}>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold font-marketing-heading text-[#07152f] mb-6 tracking-tight">
                Direct Channels
              </h2>
              <div className="space-y-6 mb-8">
                <div className="flex items-start gap-4">
                  <Mail className="w-5 h-5 text-[#0878f9] mt-1 flex-shrink-0" />
                  <div>
                    <div className="font-bold text-[#07152f] mb-1">Email</div>
                    <div className="flex flex-col gap-1 text-sm">
                      <div className="text-[#075fc7]">
                        General: <ObfuscatedEmail email="info@alphaclonesystems.com" className="hover:underline" />
                      </div>
                      <div className="text-[#075fc7]">
                        Sales: <ObfuscatedEmail email="sales@alphaclonesystems.com" className="hover:underline" />
                      </div>
                      <div className="text-[#075fc7]">
                        Administration: <ObfuscatedEmail email="admin@alphaclonesystems.com" className="hover:underline" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <Phone className="w-5 h-5 text-[#0878f9] mt-1 flex-shrink-0" />
                  <div>
                    <div className="font-bold text-[#07152f] mb-1">Phone &amp; WhatsApp</div>
                    <div className="flex flex-col gap-1 text-sm">
                      <a href="tel:+48517809674" className="text-[#075fc7] hover:underline transition-colors font-medium">
                        +48 517 809 674
                      </a>
                      <a
                        href="https://wa.me/48517809674"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#52627b] hover:text-[#0878f9] transition-colors"
                      >
                        Send WhatsApp message
                      </a>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <MapPin className="w-5 h-5 text-[#0878f9] mt-1 flex-shrink-0" />
                  <div>
                    <div className="font-bold text-[#07152f] mb-1">Registered office</div>
                    <div className="text-[#52627b] text-sm">{formatLegalAddress()}</div>
                    <div className="text-[#76849a] text-xs mt-1">
                      Support is available by phone and WhatsApp — remote team, US-registered entity.
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-[#f7f9fc] border border-[#dfe6ef] rounded-2xl">
                <p className="text-sm font-bold text-[#07152f] mb-1">Prefer a live call?</p>
                <p className="text-sm text-[#52627b] mb-4">
                  Skip the inbox and schedule a 30-minute walkthrough directly.
                </p>
                <a
                  href={bookingDestination}
                  target={bookingIsExternal ? '_blank' : undefined}
                  rel={bookingIsExternal ? 'noopener noreferrer' : undefined}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#075fc7] hover:text-[#0878f9] transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  Book a free 30-min meeting
                </a>
              </div>
            </div>
          </AnimateIn>

          {/* Contact Form */}
          <AnimateIn type="fadeRight" delay={0.15}>
            <div className="p-6 sm:p-8 rounded-2xl bg-white border border-[#dfe6ef] shadow-sm">
              <h2 className="text-xl sm:text-2xl font-bold font-marketing-heading text-[#07152f] mb-6 tracking-tight">
                Send a Message
              </h2>

              {/* Success Banner */}
              {status === 'success' && (
                <div className="flex items-start gap-3 text-emerald-800 bg-emerald-50 border border-emerald-200 p-4 rounded-xl mb-6 animate-fadeIn">
                  <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0 text-emerald-600" />
                  <div>
                    <p className="font-semibold">Inquiry received!</p>
                    <p className="text-sm text-emerald-700">
                      {notificationSent
                        ? 'We received your inquiry and will be in touch within 24 hours.'
                        : 'Your inquiry is saved, but the email notification could not be delivered. For an urgent reply, email bonnie@alphaclonesystems.com.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Error Banner */}
              {status === 'error' && (
                <div className="flex items-start gap-3 text-red-800 bg-red-50 border border-red-200 p-4 rounded-xl mb-6">
                  <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-red-600" />
                  <span className="text-sm">{errorMessage || 'Failed to send message. Please try again.'}</span>
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
                  label="Full name *"
                  id="contact-name"
                  value={formData.name}
                  onChange={handleChange('name')}
                  required
                  disabled={isSubmitting}
                  placeholder="Your name"
                />

                <Input
                  label="Email address *"
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
                    label="Company"
                    id="contact-company"
                    value={formData.company}
                    onChange={handleChange('company')}
                    disabled={isSubmitting}
                    placeholder="Your company (optional)"
                  />
                  <Input
                    label="Phone"
                    id="contact-phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange('phone')}
                    disabled={isSubmitting}
                    placeholder="+1 555 000 0000 (optional)"
                  />
                </div>

                <Input
                  label="Subject *"
                  id="contact-subject"
                  value={formData.subject}
                  onChange={handleChange('subject')}
                  required
                  disabled={isSubmitting}
                  placeholder="What is this regarding?"
                />

                <div>
                  <label htmlFor="contact-message" className="block text-sm font-medium text-[#33445e] mb-1.5">
                    Message *
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange('message')}
                    required
                    disabled={isSubmitting}
                    rows={5}
                    className="w-full bg-white border border-[#dfe6ef] rounded-xl px-4 py-3 text-[#07152f] placeholder-[#76849a] focus:outline-none focus:ring-2 focus:ring-[#0878f9] focus:border-transparent disabled:opacity-60 transition-colors resize-none"
                    placeholder="Tell us about your business or what you need help with…"
                  />
                </div>

                {turnstileEnabled && (
                  <TurnstileWidget
                    key={turnstileNonce}
                    className="flex justify-center"
                    onTokenChange={setTurnstileToken}
                    onExpire={() => setTurnstileToken('')}
                    onError={() => setTurnstileToken('')}
                  />
                )}

                <Button
                  type="submit"
                  disabled={submitDisabled}
                  isLoading={isSubmitting}
                  size="lg"
                  className="w-full font-semibold rounded-xl py-3.5 bg-[#07152f] text-white hover:bg-[#0c2f61] transition-colors shadow-sm"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isSubmitting ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        Send Message
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
