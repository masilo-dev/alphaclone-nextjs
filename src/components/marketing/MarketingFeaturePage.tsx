import Link from 'next/link';
import type { ComparisonRow } from '@/config/marketingCopy';

type Props = {
  title: string;
  description: string;
  bullets: string[];
  comparison: ComparisonRow[];
  competitorName: string;
};

export default function MarketingFeaturePage({ title, description, bullets, comparison, competitorName }: Props) {
  return (
    <main className="max-w-4xl mx-auto px-4 py-16 space-y-10">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">{title}</h1>
        <p className="text-lg text-slate-400">{description}</p>
      </div>
      <ul className="space-y-3">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-3 text-slate-300">
            <span className="mt-1.5 w-2 h-2 rounded-full bg-teal-400 flex-shrink-0" />
            {b}
          </li>
        ))}
      </ul>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-slate-900/80">
              <th className="text-left p-4 text-slate-400 font-medium">Feature</th>
              <th className="text-left p-4 text-teal-400 font-bold">Alphaclone</th>
              <th className="text-left p-4 text-slate-400">{competitorName}</th>
            </tr>
          </thead>
          <tbody>
            {comparison.map((row) => (
              <tr key={row.feature} className="border-b border-white/5">
                <td className="p-4 text-white">{row.feature}</td>
                <td className="p-4 text-teal-300 font-medium">{row.alphaclone}</td>
                <td className="p-4 text-slate-400">{row.competitor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Link
        href="/auth/login?register=true&type=business&plan=starter"
        className="inline-flex px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-bold transition-colors"
      >
        Start free trial
      </Link>
    </main>
  );
}
