'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Calendar, CheckCircle2, Clock, ExternalLink } from 'lucide-react';
import CalComEmbed from '@/components/marketing/system/CalComEmbed';
import { getBookingConfig, resolvePlatformBookingUrl } from '@/lib/marketing/booking';
import { MARKETING_PRICING } from '@/config/pricingPlans';
import { TRIAL_HREF } from '@/lib/marketing/cta';
import { useLanguage } from '@/contexts/LanguageContext';

const COPY = {
  en: {
    back: 'Back to AlphaClone', eyebrow: 'Free live product walkthrough', title: 'See one instruction become real work.',
    intro: 'In 30 minutes, we will use your workflow to show how AlphaClone plans, requests approval, executes through connected tools, and records the result.',
    points: ['No pitch deck — see the product', 'Demo built around one of your workflows', 'Clear next steps and trial access'],
    plans: 'Plans', trial: 'Free trial', days: '14 days', exploreFirst: 'Prefer to explore first?', startTrial: 'Start free trial', watchDemo: 'Watch the recorded demo',
    pickTime: 'Pick a time', newTab: 'Open scheduler', timezone: 'Times are shown in your local timezone', explore: 'Explore the platform',
    links: ['Platform overview', 'Pricing plans', 'Why AlphaClone exists', 'CRM and pipeline', 'Bonnie execution assistant', 'Integrations'],
  },
  pl: {
    back: 'Wróć do AlphaClone', eyebrow: 'Bezpłatna prezentacja produktu na żywo', title: 'Zobacz, jak jedno polecenie staje się wykonaną pracą.',
    intro: 'W ciągu 30 minut wykorzystamy Twój proces, aby pokazać, jak AlphaClone planuje, prosi o zatwierdzenie, wykonuje działania w połączonych narzędziach i zapisuje wynik.',
    points: ['Bez prezentacji sprzedażowej — zobacz produkt', 'Demo oparte na jednym z Twoich procesów', 'Jasne kolejne kroki i dostęp próbny'],
    plans: 'Plany', trial: 'Bezpłatny okres próbny', days: '14 dni', exploreFirst: 'Wolisz najpierw sprawdzić platformę?', startTrial: 'Rozpocznij bezpłatny okres próbny', watchDemo: 'Obejrzyj nagrane demo',
    pickTime: 'Wybierz termin', newTab: 'Otwórz kalendarz', timezone: 'Terminy są pokazane w Twojej lokalnej strefie czasowej', explore: 'Poznaj platformę',
    links: ['Przegląd platformy', 'Plany cenowe', 'Dlaczego powstał AlphaClone', 'CRM i pipeline', 'Asystent wykonawczy Bonnie', 'Integracje'],
  },
  es: {
    back: 'Volver a AlphaClone', eyebrow: 'Demostración gratuita del producto en vivo', title: 'Mira cómo una instrucción se convierte en trabajo realizado.',
    intro: 'En 30 minutos usaremos tu flujo de trabajo para mostrar cómo AlphaClone planifica, solicita aprobación, ejecuta mediante herramientas conectadas y registra el resultado.',
    points: ['Sin presentación comercial: mira el producto', 'Demo basada en uno de tus flujos de trabajo', 'Próximos pasos claros y acceso de prueba'],
    plans: 'Planes', trial: 'Prueba gratuita', days: '14 días', exploreFirst: '¿Prefieres explorar primero?', startTrial: 'Iniciar prueba gratuita', watchDemo: 'Ver la demo grabada',
    pickTime: 'Elige una hora', newTab: 'Abrir calendario', timezone: 'Las horas se muestran en tu zona horaria local', explore: 'Explora la plataforma',
    links: ['Vista general de la plataforma', 'Planes de precios', 'Por qué existe AlphaClone', 'CRM y pipeline', 'Asistente de ejecución Bonnie', 'Integraciones'],
  },
} as const;

export default function BookDemoContent() {
  const { language } = useLanguage();
  const copy = COPY[language];
  const config = getBookingConfig('demo');
  const bookingUrl = resolvePlatformBookingUrl(config.bookingUrl);

  return (
    <div className="marketing-theme min-h-screen text-white">
      <section className="pt-24 pb-6 sm:pt-28 sm:pb-10 px-4">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center text-teal-400 hover:text-teal-300 transition-colors mb-5 sm:mb-8 text-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {copy.back}
          </Link>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-8 lg:gap-10 items-start">
            <div className="order-1">
              <p className="text-xs font-semibold text-teal-400 uppercase tracking-widest mb-3">
                {copy.eyebrow}
              </p>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight mb-3 sm:mb-4">
                {copy.title}
              </h1>
              <p className="text-base text-slate-400 mb-5 sm:mb-6 leading-relaxed">
                {copy.intro}
              </p>

              <ul className="space-y-2.5 mb-5 sm:mb-6">
                {[
                  { icon: Clock, text: copy.points[0] },
                  { icon: CheckCircle2, text: copy.points[1] },
                  { icon: CheckCircle2, text: copy.points[2] },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3 text-sm text-slate-300">
                    <Icon className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
                    {text}
                  </li>
                ))}
              </ul>

              <div className="hidden sm:grid grid-cols-2 gap-3 mb-6">
                {[
                  { label: copy.plans, value: MARKETING_PRICING.startingPriceLine },
                  { label: copy.trial, value: copy.days },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="p-3.5 bg-slate-900/60 border border-slate-700/50 rounded-xl text-center"
                  >
                    <p className="text-lg font-black text-white">{value}</p>
                    <p className="text-xs text-slate-500">{label}</p>
                  </div>
                ))}
              </div>

              <p className="text-sm text-slate-500">
                {copy.exploreFirst}{' '}
                <Link href={TRIAL_HREF} className="text-teal-400 hover:text-teal-300 font-medium transition-colors">
                  {copy.startTrial} →
                </Link>
                <span aria-hidden="true"> · </span>
                <Link href="/demo" className="text-teal-400 hover:text-teal-300 font-medium transition-colors">
                  {copy.watchDemo} →
                </Link>
              </p>
            </div>

            <div id="book-demo-calendar" className="order-2 scroll-mt-24">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-teal-400" />
                  <h2 className="text-base font-bold text-white">{copy.pickTime}</h2>
                </div>
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-teal-400 transition-colors"
                >
                  {copy.newTab}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <CalComEmbed bookingUrl={bookingUrl} variant="page" />

              <p className="text-center text-xs text-slate-600 mt-3">
                {copy.timezone}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 sm:pb-20">
        <div className="max-w-5xl mx-auto">
          <nav
            className="rounded-xl border border-slate-800 bg-slate-900/40 p-6"
            aria-label="Explore AlphaClone"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-400 mb-4">
              {copy.explore}
            </p>
            <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 text-sm">
              {[
                { href: '/services', label: copy.links[0] },
                { href: '/pricing', label: copy.links[1] },
                { href: '/about', label: copy.links[2] },
                { href: '/crm', label: copy.links[3] },
                { href: '/ai-agents', label: copy.links[4] },
                { href: '/ecosystem', label: copy.links[5] },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-slate-300 hover:text-teal-400 transition-colors">
                    {label} →
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>
    </div>
  );
}
