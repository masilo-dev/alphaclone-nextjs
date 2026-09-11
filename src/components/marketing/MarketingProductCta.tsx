import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const SIGNUP_HREF = '/auth/login?register=true&type=business&plan=starter';

export default function MarketingProductCta() {
  return (
    <div className="mt-10 rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 via-slate-950/60 to-blue-500/10 p-6 sm:p-8">
      <h2 className="text-xl font-black text-white mb-2">Try it with your real workflow</h2>
      <p className="text-sm text-slate-300 mb-6 leading-relaxed">
        14-day trial, no card required — run lead-to-invoice in one workspace before you commit.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href={SIGNUP_HREF}
          className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-sm font-bold transition-colors shadow-lg shadow-cyan-500/20"
        >
          Start free trial
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/book-demo"
          className="inline-flex items-center justify-center h-12 px-6 rounded-xl border border-slate-700 text-slate-200 hover:text-white hover:border-slate-500 text-sm font-semibold transition-colors"
        >
          Book a demo
        </Link>
      </div>
    </div>
  );
}
