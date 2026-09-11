import Link from 'next/link';
import { PLATFORM_BOOKING_URL } from '@/constants';

export default function BookIndexPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-2xl border border-white/10 bg-slate-900/80 p-8 space-y-6 text-center">
        <h1 className="text-2xl font-bold">Book a meeting</h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          Schedule with AlphaClone Systems or use your business&apos;s native booking page at{' '}
          <code className="text-teal-400">/book/your-slug</code>.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/book-demo"
            className="inline-flex items-center justify-center rounded-xl bg-teal-600 hover:bg-teal-500 px-5 py-3 text-sm font-semibold transition-colors"
          >
            Book a platform demo
          </Link>
          <a
            href={PLATFORM_BOOKING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-slate-800 hover:bg-slate-700 px-5 py-3 text-sm font-semibold transition-colors"
          >
            Open Cal.com booking
          </a>
          <Link
            href="/"
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
