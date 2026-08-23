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
import { useBookingModal } from '@/contexts/BookingModalContext';

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
  const [errorMessage, setErrorMessage] = useState('');
  const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  let bookingModal: ReturnType<typeof useBookingModal> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    bookingModal = useBookingModal();
  } catch {
    bookingModal = null;
  }

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
      const firstError = validationResult.error.errors[0];
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

  const handleOpenBooking = (e: React.MouseEvent) => {
    e.preventDefault();
    if (bookingModal) {
      bookingModal.openBookingModal('consultation');
    } else {
      window.location.href = '/book-demo';
    }
  };

  const isSubmitting = status === 'sending';
  const submitDisabled = isSubmitting || (turnstileEnabled && !turnstileToken);

  return (
    <div className="marketing-theme min-h-screen text-white relative overflow-hidden">
      {/* Hero */}
      <section className="relative min-h-[40vh] flex flex-col items-center justify-center pt-32 pb-12">
        <div className="relative z-10 max-w-7xl mx-auto px-4 text-center">
          <AnimateIn type="fadeUp">
            <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tighter leading-[0.9]">
              Let&apos;s Build Your <br />
              <span className="hero-metallic-text">Growth Engine.</span>
            </h1>
          </AnimateIn>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 pb-24 relative z-10">
        <AnimateIn type="fadeIn">
          <Link href="/" className="inline-flex items-center text-teal-400 hover:text-teal-300 mb-8 transition-colors">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Home
          </Link>
        </AnimateIn>

        {/* CTA Row */}
        <AnimateIn type="fadeUp" delay={0.1}>
          <div className="text-center mb-16">
            <p className="text-base sm:text-lg md:text-xl text-slate-400 max-w-3xl mx-auto mb-10">
              Get in touch to discuss your project. For the fastest response, use WhatsApp or book a meeting directly.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button
                type="button"
                onClick={handleOpenBooking}
                className="mkt-btn mkt-btn-secondary w-full sm:w-auto font-marketing-heading uppercase tracking-tight"
              >
                <Calendar className="w-4 h-4 mr-2 inline" />
                Book a Consultation
              </button>
              <Button
                variant="outline"
                onClick={() => window.open('https://wa.me/48517809674', '_blank')}
                className="border-teal-500/50 text-teal-400 font-bold h-12 px-8 font-marketing-heading uppercase tracking-tight button-fill-hover"
              >
                <span className="relative z-10">Chat on WhatsApp</span>
              </Button>
            </div>
          </div>
        </AnimateIn>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Info */}
          <AnimateIn type="fadeLeft" delay={0.1}>
            <div>
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold font-marketing-heading mb-8">
                Get In Touch
              </h2>
              <div className="space-y-6 mb-8">
                <div className="flex items-start gap-4">
                  <Mail className="w-6 h-6 text-teal-400 mt-1 flex-shrink-0" />
                  <div>
                    <div className="font-semibold mb-1">Email</div>
                    <div className="flex flex-col gap-1">
                      <div className="text-teal-400">
                        General: <ObfuscatedEmail email="info@alphaclonesystems.com" className="hover:text-teal-300" />
                      </div>
                      <div className="text-teal-400">
                        Sales: <ObfuscatedEmail email="sales@alphaclonesystems.com" className="hover:text-teal-300" />
                      </div>
                      <div className="text-teal-400">
                        Administration: <ObfuscatedEmail email="admin@alphaclonesystems.com" className="hover:text-teal-300" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <Phone className="w-6 h-6 text-teal-400 mt-1 flex-shrink-0" />
                  <div>
                    <div className="font-semibold mb-1">Phone &amp; WhatsApp</div>
                    <div className="flex flex-col gap-1">
                      <a href="tel:+48517809674" className="text-teal-400 hover:text-teal-300 transition-colors">
                        +48 517 809 674
                      </a>
                      <a
                        href="https://wa.me/48517809674"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-teal-400/80 hover:text-teal-300 transition-colors"
                      >
                        Send WhatsApp message
                      </a>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <MapPin className="w-6 h-6 text-teal-400 mt-1 flex-shrink-0" />
                  <div>
                    <div className="font-semibold mb-1">Registered office</div>
                    <div className="text-slate-400">{formatLegalAddress()}</div>
                    <div className="text-slate-500 text-sm mt-1">
                      Support is available by phone and WhatsApp — remote team, US-registered entity.
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 bg-slate-900/50 border border-slate-700/50 rounded-xl">
                <p className="text-sm font-semibold text-slate-300 mb-1">Prefer a live call?</p>
                <p className="text-sm text-slate-400 mb-3">
                  Skip the inbox and schedule a 30-minute call directly.
                </p>
                <button
                  type="button"
                  onClick={handleOpenBooking}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-teal-400 hover:text-teal-300 transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  Book a free 30-min meeting
                </button>
              </div>
            </div>
          </AnimateIn>

          {/* Contact Form */}
          <AnimateIn type="fadeRight" delay={0.15}>
            <div>
              <h2 className="text-2xl font-bold font-marketing-heading mb-8">Send a Message</h2>

              {/* Success Banner */}
              {status === 'success' && (
                <div className="flex items-start gap-3 text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl mb-6 animate-fadeIn">
                  <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Message sent!</p>
                    <p className="text-sm text-emerald-300/80">
                      We received your inquiry and will be in touch within 24 hours.
                    </p>
                  </div>
                </div>
              )}

              {/* Error Banner */}
              {status === 'error' && (
                <div className="flex items-start gap-3 text-red-300 bg-red-500/10 border border-red-500/20 p-4 rounded-xl mb-6">
                  <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{errorMessage || 'Failed to send message. Please try again.'}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
                  <label htmlFor="contact-message" className="block text-sm font-medium text-slate-300 mb-2">
                    Message *
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange('message')}
                    required
                    disabled={isSubmitting}
                    rows={6}
                    className="w-full bg-slate-900/90 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-60 transition-colors resize-none"
                    placeholder="Tell us about your project, your business challenges, or what you need help with…"
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
                  className="w-full font-marketing-heading uppercase tracking-tight button-fill-hover bg-teal-500 text-slate-950 hover:bg-teal-400 transition-colors"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isSubmitting ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
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
