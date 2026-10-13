'use client';
import { ChevronDown } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { getTaskGuide } from '@/lib/ui/taskGuides';
import { useLanguage } from '@/contexts/LanguageContext';
export function TaskGuide() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const guide = getTaskGuide(pathname || '');
  if (!guide) return null;
  return <details key={pathname} className="group shrink-0 border-b border-[var(--ws-border)] bg-[var(--ws-toolbar)] px-3">
    <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-[var(--ws-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"><ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />{t('How to use this section')}: {t(guide.title)}</summary>
    <ol className="list-decimal space-y-2 pb-3 pl-5 text-sm text-[var(--ws-text-secondary)]">{guide.steps.map(step => <li key={step}>{t(step)}</li>)}</ol>
  </details>;
}
