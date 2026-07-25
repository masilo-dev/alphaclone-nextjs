'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, Phone, MapPin, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button, Input } from '../ui/UIComponents';
import { formatLegalAddress } from '@/lib/seo/siteEntity';
import { contactSchema } from '../../schemas/validation';
import AnimateIn from '../common/AnimateIn';
import ObfuscatedEmail from '../common/ObfuscatedEmail';
import TurnstileWidget from '@/components/security/TurnstileWidget';
import { SecondaryCTA } from '@/components/marketing/system/CtaButtons';

const ContactPage: React.FC = () => {
    const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
    const [turnstileToken, setTurnstileToken] = useState('');
    const [turnstileNonce, setTurnstileNonce] = useState(0);
    const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
    const [validationError, setValidationError] = useState<string>('');
    const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        setStatus('sending');
        setValidationError('');

        try {
            contactSchema.parse({
                name: formData.name,
                email: formData.email,
                message: `${formData.subject}\n\n${formData.message}`
            });
        } catch (error: any) {
            setStatus('error');
            setValidationError(error.errors[0]?.message || 'Please check your input');
            setTimeout(() => { setStatus('idle'); setValidationError(''); }, 5000);
            return;
        }

        const response = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: formData.name,
                email: formData.email,
                subject: formData.subject || 'General Inquiry',
                message: formData.message,
                turnstileToken: turnstileToken || undefined,
            }),
        });
        const payload = await response.json().catch(() => ({}));

        if (response.ok && payload?.success) {
            setStatus('success');
            setFormData({ name: '', email: '', subject: '', message: '' });
            setTurnstileToken('');
            setTurnstileNonce((value) => value + 1);
            setTimeout(() => setStatus('idle'), 5000);
        } else {
            setStatus('error');
            setValidationError(payload?.error || 'Failed to send message');
            setTurnstileToken('');
            setTurnstileNonce((value) => value + 1);
            setTimeout(() => { setStatus('idle'); setValidationError(''); }, 5000);
        }
    };

    return (
        <div className="marketing-theme min-h-screen page-network-bg text-white relative overflow-hidden">
            {/* Contact Hero Area */}
            <section className="relative min-h-[40vh] flex flex-col items-center justify-center pt-32">
                
                <div className="relative z-10 max-w-7xl mx-auto px-4 text-center">
                    <AnimateIn type="fadeUp">
                        <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tighter leading-[0.9]">
                            Let's Build Your <br />
                            <span className="hero-metallic-text">Growth Engine.</span>
                        </h1>
                    </AnimateIn>
                </div>
            </section>

            <div className="max-w-7xl mx-auto px-4 py-20 relative z-10">
                <AnimateIn type="fadeIn">
                    <Link href="/" className="inline-flex items-center text-teal-400 hover:text-teal-300 mb-8">
                        <ArrowLeft className="w-5 h-5 mr-2" />
                        Back to Home
                    </Link>
                </AnimateIn>

                <AnimateIn type="fadeUp" delay={0.1}>
                    <div className="text-center mb-16">
                        <p className="text-base sm:text-lg md:text-xl text-slate-400 max-w-3xl mx-auto mb-10">
                            Get in touch to discuss your project. For the fastest response, use WhatsApp or book a meeting directly.
                        </p>
                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <SecondaryCTA className="w-full sm:w-auto font-marketing-heading uppercase tracking-tight">
                                Book a Consultation
                            </SecondaryCTA>
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
                            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold font-marketing-heading mb-8">Get In Touch</h2>
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
                                        <div className="font-semibold mb-1">Phone & WhatsApp</div>
                                        <div className="flex flex-col gap-1">
                                            <a href="tel:+48517809674" className="text-teal-400 hover:text-teal-300">
                                                +48 517 809 674
                                            </a>
                                            <a href="https://wa.me/48517809674" target="_blank" rel="noopener noreferrer" className="text-sm text-teal-400/80 hover:text-teal-300">
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
                                        <div className="text-slate-500 text-sm mt-1">Support is available by phone and WhatsApp — remote team, US-registered entity.</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </AnimateIn>

                    {/* Contact Form */}
                    <AnimateIn type="fadeRight" delay={0.15}>
                        <div>
                            <h2 className="text-2xl font-bold font-marketing-heading mb-8">Send a Message</h2>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <Input
                                    label="Name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    placeholder="Your name"
                                />
                                <Input
                                    label="Email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                    placeholder="your.email@example.com"
                                />
                                <Input
                                    label="Subject"
                                    value={formData.subject}
                                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                    required
                                    placeholder="What is this regarding?"
                                />
                                <div>
                                    <label htmlFor="contact-message" className="block text-sm font-medium text-slate-300 mb-2">Message</label>
                                    <textarea
                                        id="contact-message"
                                        name="message"
                                        value={formData.message}
                                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                        required
                                        rows={6}
                                        className="w-full bg-slate-900/90 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                        placeholder="Tell us about your project..."
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

                                
                                {status === 'success' && (
                                    <div className="flex items-center gap-2 text-green-400 bg-green-400/10 p-4 rounded-lg">
                                        <CheckCircle2 className="w-5 h-5" />
                                        <span>Message sent successfully! We'll get back to you soon.</span>
                                    </div>
                                )}
                                {status === 'error' && (
                                    <div className="flex items-start gap-2 text-red-400 bg-red-400/10 p-4 rounded-lg">
                                        <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                                        <span>{validationError || 'Failed to send message. Please try again.'}</span>
                                    </div>
                                )}
                                <Button
                                    type="submit"
                                    disabled={status === 'sending' || (turnstileEnabled && !turnstileToken)}
                                    isLoading={status === 'sending'}
                                    size="lg"
                                    className="w-full font-marketing-heading uppercase tracking-tight button-fill-hover bg-teal-500 text-slate-950"
                                >
                                    <span className="relative z-10">
                                        {status === 'sending' ? 'Sending...' : 'Send Message'}
                                        {status !== 'sending' && <Send className="w-5 h-5 ml-2 inline" />}
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
