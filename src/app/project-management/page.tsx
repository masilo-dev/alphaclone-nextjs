import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'AlphaClone Project Management | Tasks and Delivery',
  description:
    'AlphaClone project management helps teams plan execution, track tasks, monitor due dates, and deliver client work with operational visibility.',
  keywords: [
    'AlphaClone project management',
    'project management platform',
    'task scheduler',
    'team delivery software',
    'business task management',
  ],
  alternates: { canonical: 'https://alphaclone.tech/project-management' },
  openGraph: {
    title: 'AlphaClone Project Management',
    description: 'Manage tasks, milestones, and delivery workflows in AlphaClone.',
    url: 'https://alphaclone.tech/project-management',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function ProjectManagementPage() {
  return (
    <main className="min-h-screen bg-[#040A12] text-slate-200">
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-black text-white mb-4">AlphaClone Project Management</h1>
        <p className="text-slate-300 mb-6">
          Coordinate projects with business context from CRM, billing, and communication flows.
        </p>
        <div className="rounded-2xl border border-cyan-500/20 bg-[#081228]/90 p-6 text-sm text-slate-300">
          <ul className="space-y-2">
            <li>Task scheduling and due-date intelligence</li>
            <li>Milestone tracking and workload visibility</li>
            <li>Delivery alignment with deals, contracts, and invoices</li>
            <li>Unified workspace for execution teams</li>
          </ul>
        </div>
        <p className="mt-6 text-sm">
          Related pages: <Link href="/crm" className="text-cyan-300 hover:text-cyan-200">CRM</Link>,{' '}
          <Link href="/video-meetings" className="text-cyan-300 hover:text-cyan-200">Video Meetings</Link>.
        </p>
      </section>
    </main>
  );
}

