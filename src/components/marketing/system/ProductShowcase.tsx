'use client';

import { Check, ChevronRight, Download, FileText, FolderKanban, Link2, Mail, Users } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

type ShowcaseSlug = 'crm' | 'project-management';

const PIPELINE = [
  { stage: 'New enquiry', value: '$3,200', name: 'Mosaic Health', work: 'Brand refresh', next: 'Discovery call', status: 'Next step planned' },
  { stage: 'Proposal', value: '$8,400', name: 'Northstar Studio', work: 'Website redesign', next: 'Review proposal', status: 'Awaiting approval' },
  { stage: 'Won', value: '$6,800', name: 'Lumen Works', work: 'Client onboarding', next: 'Open linked project', status: 'Ready for delivery' },
] as const;
const MILESTONES = [
  { name: 'Scope & discovery', detail: 'Client brief and agreed deliverables', date: 'Complete', complete: true },
  { name: 'Design & content', detail: 'Prepare the first client review', date: '12 Oct', complete: false },
  { name: 'Build & quality checks', detail: 'Responsive layout and core flows', date: '19 Oct', complete: false },
  { name: 'Client handover', detail: 'Final review and delivery documents', date: '26 Oct', complete: false },
] as const;

/** Responsive illustration, exported from this same markup. Never presents demo data as live. */
export default function ProductShowcase({ slug }: { slug: ShowcaseSlug }) {
  const { t } = useLanguage();
  const crm = slug === 'crm';
  const Icon = crm ? Users : FolderKanban;
  const label = crm ? 'CRM' : 'Projects';
  const asset = crm ? 'alphaclone-crm-showcase' : 'alphaclone-projects-showcase';
  return (
    <figure className="ac-showcase-figure" aria-label={t(`${label} workspace illustration with demonstration data`)}>
      <div className="ac-showcase" data-product-showcase={slug}>
        <header className="ac-showcase-bar">
          <span className="ac-showcase-brand"><Icon aria-hidden="true" /> AlphaClone <span>/ {t(label)}</span></span>
          <span className="ac-showcase-demo">{t('Demonstration data')}</span>
        </header>
        <div className="ac-showcase-heading">
          <div><p className="ac-showcase-eyebrow">{t(crm ? 'From first conversation to paid work' : 'From agreed scope to client handover')}</p>
            <h3>{t(crm ? 'Your pipeline. The whole client story.' : 'Clear milestones. Connected client work.')}</h3>
          </div>
          <span className="ac-showcase-context"><Link2 aria-hidden="true" /> {t('Connected workspace')}</span>
        </div>
        <div className="ac-showcase-layout">
          <section className="ac-showcase-work" aria-label={t(crm ? 'Example sales pipeline' : 'Example project milestones')}>
            {crm ? <>
              <div className="ac-showcase-section-title"><h4>{t('Sales pipeline')}</h4><span>{t('3 example opportunities')}</span></div>
              <div className="ac-showcase-pipeline">{PIPELINE.map((deal, index) => <article className="ac-showcase-stage" key={deal.stage}>
                <div className="ac-showcase-stage-title"><span className={`ac-showcase-dot ac-showcase-dot-${index}`} /><h5>{t(deal.stage)}</h5><span>1</span></div>
                <div className={`ac-showcase-deal ${index === 1 ? 'ac-showcase-selected' : ''}`}>
                  <span className="ac-showcase-avatar">{deal.name.slice(0, 1)}</span>
                  <h6>{deal.name}</h6><p>{t(deal.work)}</p><strong className="ac-showcase-value">{deal.value}</strong>
                  <span className={`ac-showcase-status ${index === 1 ? 'ac-showcase-status-review' : ''}`}>{t(deal.status)}</span>
                  <div className="ac-showcase-next"><span>{t(deal.next)}</span><ChevronRight aria-hidden="true" /></div>
                </div>
              </article>)}</div>
              <div className="ac-showcase-note"><Link2 aria-hidden="true" /><p>{t('The same client record connects the conversation, project and invoice.')}</p></div>
            </> : <>
              <div className="ac-showcase-project-title"><span className="ac-showcase-avatar"><FolderKanban aria-hidden="true" /></span><div><h4>{t('Northstar website redesign')}</h4><p>Northstar Studio <span>· {t('Client project')}</span></p></div><span className="ac-showcase-status">{t('In progress')}</span></div>
              <div className="ac-showcase-progress"><div><span>{t('Milestones completed')}</span><strong>1 / 4</strong></div><div className="ac-showcase-progress-track"><span /></div></div>
              <ol className="ac-showcase-milestones">{MILESTONES.map((milestone, index) => <li key={milestone.name}>
                <span className={`ac-showcase-step ${milestone.complete ? 'ac-showcase-step-done' : ''}`}>{milestone.complete ? <Check aria-hidden="true" /> : index + 1}</span>
                <div><h5>{t(milestone.name)}</h5><p>{t(milestone.detail)}</p></div><span className="ac-showcase-date">{t(milestone.date)}</span>
              </li>)}</ol>
            </>}
          </section>
          <aside className="ac-showcase-detail" aria-label={t('Connected client context')}>
            <p className="ac-showcase-eyebrow">{t(crm ? 'Selected client' : 'Linked client record')}</p>
            <div className="ac-showcase-client"><span className="ac-showcase-avatar">N</span><div><h4>Northstar Studio</h4><p>{t(crm ? 'Website redesign · proposal' : 'Website redesign · delivery')}</p></div></div>
            <div className="ac-showcase-detail-section"><h5>{t(crm ? 'Next action' : 'Next client review')}</h5><p>{t(crm ? 'Review the proposal before sending it.' : 'Review the first design and content draft.')}</p><span className="ac-showcase-status ac-showcase-status-review">{t('Your approval comes first')}</span></div>
            <div className="ac-showcase-detail-section"><h5>{t('Connected records')}</h5><ul className="ac-showcase-records">
              <li><Mail aria-hidden="true" /><span>{t('Client conversation')}</span><span>{t('Linked')}</span></li>
              <li><FolderKanban aria-hidden="true" /><span>{t('Website redesign')}</span><span>{t(crm ? 'Scope' : 'Project')}</span></li>
              <li><FileText aria-hidden="true" /><span>{t('Service agreement')}</span><span>{t('Draft')}</span></li>
              <li><FileText aria-hidden="true" /><span>{t('Project invoice')}</span><span>{t('Draft')}</span></li>
            </ul></div>
            <div className="ac-showcase-review"><Check aria-hidden="true" /><p>{t('Review before external action. Keep the result on the client record.')}</p></div>
          </aside>
        </div>
      </div>
      <figcaption className="ac-showcase-caption"><p>{t('Illustrative workspace with fictional client data.')}</p><a href={`/showcases/${asset}.png`} download={`${asset}.png`}><Download aria-hidden="true" /> {t('Download high-resolution preview')}</a></figcaption>
    </figure>
  );
}
