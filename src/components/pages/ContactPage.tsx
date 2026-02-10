'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, Phone, MapPin, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button, Input } from '../ui/UIComponents';
import PublicNavigation from '../PublicNavigation';
import { contactService } from '../../services/contactFormService';
import { contactSchema } from '../../schemas/validation';

const ContactPage: React.FC = () => {
    const [, setIsLoginOpen] = React.useState(false);
    const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
    const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
    const [validationError, setValidationError] = useState<string>('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('sending');
        setValidationError('');

        // Validate form data
        try {
            contactSchema.parse({
                name: formData.name,
                email: formData.email,
                message: `${formData.subject}\n\n${formData.message}`
            });
        } catch (error: any) {
            setStatus('error');
            setValidationError(error.errors[0]?.message || 'Please check your input');
            setTimeout(() => {
                setStatus('idle');
                setValidationError('');
            }, 5000);
            return;
        }

        const { error } = await contactService.submitContact(
            formData.name,
            formData.email,
            `${formData.subject}\n\n${formData.message}`
        );

        if (!error) {
            setStatus('success');
            setFormData({ name: '', email: '', subject: '', message: '' });
            setTimeout(() => setStatus('idle'), 5000);
        } else {
            setStatus('error');
            setValidationError(error);
            setTimeout(() => {
                setStatus('idle');
                setValidationError('');
            }, 5000);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white relative">
            {/* Animated Background - matching landing page */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute inset-0 bg-slate-950" />
                <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-teal-500/8 blur-[80px] animate-blob" style={{ animationDuration: '20s' }} />
                <div className="absolute top-[-5%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-teal-400/6 blur-[80px] animate-blob" style={{ animationDuration: '25s', animationDelay: '2s' }} />
                <div className="absolute bottom-[-10%] left-[10%] w-[40vw] h-[40vw] rounded-full bg-teal-600/7 blur-[80px] animate-blob" style={{ animationDuration: '30s', animationDelay: '4s' }} />
            </div>

            <div className="relative z-10">
                <PublicNavigation onLoginClick={() => setIsLoginOpen(true)} />
                <div className="max-w-7xl mx-auto px-4 py-20 pt-32">
                    <Link href="/" className="inline-flex items-center text-teal-400 hover:text-teal-300 mb-8">
                        <ArrowLeft className="w-5 h-5 mr-2" />
                        Back to Home
                    </Link>

                    <div className="text-center mb-16">
                        <p className="text-base sm:text-lg md:text-xl text-slate-400 max-w-3xl mx-auto mb-10">
                            Get in touch to discuss your project. For the fastest response, use WhatsApp or book a meeting directly.
                        </p>
                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <Button
                                onClick={() => window.open('https://calendly.com/bonniiehendrix/30min', '_blank')}
                                className="bg-teal-600 hover:bg-teal-500 text-white font-bold h-12 px-8"
                            >
                                Book a Consultation
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => window.open('https://wa.me/48517809674', '_blank')}
                                className="border-teal-500/50 hover:bg-teal-500/10 text-teal-400 font-bold h-12 px-8"
                            >
                                Chat on WhatsApp
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        {/* Contact Info */}
                        <div>
                            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold mb-8">Get In Touch</h2>
                            <div className="space-y-6 mb-8">
                                <div className="flex items-start gap-4">
                                    <Mail className="w-6 h-6 text-teal-400 mt-1 flex-shrink-0" />
                                    <div>
                                        <div className="font-semibold mb-1">Email</div>
                                        <a href="mailto:info@alphaclone.tech" className="text-teal-400 hover:text-teal-300">
                                            info@alphaclone.tech
                                        </a>
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
                                        <div className="font-semibold mb-1">Location</div>
                                        <div className="text-slate-400">Global Remote Team</div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                                <h3 className="font-bold mb-3">Business Hours</h3>
                                <div className="space-y-2 text-slate-400">
                                    <div>Monday - Friday: 9:00 AM - 6:00 PM</div>
                                    <div>Saturday: 10:00 AM - 4:00 PM</div>
                                    <div>Sunday: Closed</div>
                                </div>
                            </div>
                        </div>

                        {/* Contact Form */}
                        <div>
                            <h2 className="text-2xl font-bold mb-8">Send a Message</h2>
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
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Message</label>
                                    <textarea
                                        value={formData.message}
                                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                        required
                                        rows={6}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                        placeholder="Tell us about your project..."
                                    />
                                </div>
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
                                    disabled={status === 'sending'}
                                    isLoading={status === 'sending'}
                                    size="lg"
                                    className="w-full"
                                >
                                    {status === 'sending' ? 'Sending...' : 'Send Message'}
                                    {status !== 'sending' && <Send className="w-5 h-5 ml-2 inline" />}
                                </Button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContactPage;

