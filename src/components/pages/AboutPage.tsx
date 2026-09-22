'use client';

import Image from 'next/image';
import { ArrowDown, ArrowRight, CheckCircle2, CircleDot, Workflow } from 'lucide-react';
import AnimateIn from '@/components/common/AnimateIn';
import { PrimaryCTA } from '@/components/marketing/system/CtaButtons';
import { DEMO_HREF } from '@/lib/marketing/cta';

const chapters = [
  { number: '01', label: 'Before AlphaClone', title: 'Before AlphaClone, I was dealing with the same problem.', quote: 'I had information everywhere, but execution still depended on me.', body: ['Before AlphaClone, I tried building businesses of my own. One of my early attempts was dropshipping. It failed.', 'I also worked in business development and management for a web-services outsourcing business. The work put me close to clients, delivery, follow-up, and the operational effort required after an opportunity appeared.', '[NAME AND DETAILS OF THE OTHER BUSINESS OR PROJECT I FOUNDED]', 'CRM. Email. Leads. Social media. Projects. Documents. Contracts. Invoices. Calendars. Communication.', 'The problem was not simply the number of applications. The problem was that I still had to remember what belonged where, move the information, trigger the next action, and check that it actually happened.'] },
  { number: '02', label: 'The friction', title: "I realized I wasn't running the business. I was operating the software.", quote: 'Find the application. Find the record. Copy the context. Repeat the action. Check the result.', body: ['Every ordinary task became a chain of small operational decisions.', '[SPECIFIC EXAMPLE OF A REPEATED TASK THAT CONSUMED TIME]', 'A lead could begin in one place, continue in an inbox, become a project somewhere else, and end in a document or invoice with no shared history. The software stored information. I was still the coordination layer.'] },
  { number: '03', label: 'The question', title: 'Then I started asking a different question.', quote: 'What if I could simply tell the system what I wanted to accomplish?', body: ['[THE MOMENT I REALIZED THE QUESTION WAS BIGGER THAN ANY ONE TOOL]', 'Not: Which application should I open?', 'Not: Where is the customer record?', 'Not: How do I connect another automation?', 'The useful question was simpler: What needs to happen?'] },
  { number: '04', label: 'The first version', title: "The first version wasn't the vision. It was the beginning.", quote: '[EARLY EXPERIMENT]', body: ['[WHAT THE FIRST PROTOTYPE DID]', '[WHAT WORKED]', '[WHAT FAILED OR HAD TO BE REBUILT]', '[LESSON LEARNED]', 'AlphaClone did not appear fully formed. It evolved by testing whether real instructions could become controlled, visible business actions without losing context or human judgment.'] },
  { number: '05', label: 'The realization', title: "The problem wasn't another missing tool.", quote: 'Businesses already had software. What they lacked was coordination and execution.', body: ['AI could understand an instruction. Business systems contained the records and capabilities. But the space between intent and completed work was still largely manual.', 'That missing operational layer became the central AlphaClone thesis: connect understanding to business context, permissions, tools, approval, execution, and verification.'] },
  { number: '06', label: 'What AlphaClone became', title: 'From an idea into an execution layer.', quote: 'Human-led. AI-assisted. System-executed.', body: ['The user expresses an outcome. The AI interprets the instruction. AlphaClone resolves the workspace context, connected systems, permissions, and available workflows.', 'Important actions remain reviewable. Approved work runs through the connected tools. The result returns to the workspace as a visible activity record.', 'AlphaClone is not meant to be another dashboard people must continuously operate. It is being built as the operational layer that helps turn intent into accountable execution.'] },
  { number: '07', label: "The founder's belief", title: 'This is what I believe business software should become.', quote: 'The technology should serve the operator — not force the operator to serve the technology.', body: ['I believe people should spend more time deciding what matters and less time manually moving information between software systems.', 'Software should increasingly understand intent, coordinate the right systems, and execute approved work. But people should remain in control of important decisions.', 'That balance matters. Useful execution requires capability. Trust requires boundaries, approval, and a record of what happened.'] },
  { number: '08', label: 'The future', title: "I don't think we're finished.", quote: 'Intent → Context → Approval → Execution → Verification', body: ['I believe business software may gradually move away from people manually operating dozens of disconnected interfaces.', 'The future may feel more like directing a business system: state the outcome, review the proposed action, approve what matters, and verify the result.', 'AlphaClone is being built toward that future.'] },
] as const;

export default function AboutPage() {
  return (
    <div className="founder-journey">
      <section className="founder-opening">
        <div className="founder-opening__line" aria-hidden="true" />
        <div className="founder-container">
          <AnimateIn type="fadeUp">
            <p className="founder-kicker">Why AlphaClone exists</p>
            <h1>I wasn&apos;t trying to build another software company.</h1>
            <p className="founder-opening__statement">I was trying to solve a problem I kept experiencing myself.</p>
            <p className="founder-opening__identity">Bornface &ldquo;Bonnie&rdquo; Masilo · Founder, AlphaClone Systems</p>
            <a className="founder-scroll" href="#chapter-01">Follow the journey <ArrowDown aria-hidden="true" /></a>
          </AnimateIn>
        </div>
      </section>

      <section className="founder-context" aria-label="The operational problem">
        <div className="founder-container founder-context__grid">
          <AnimateIn type="fadeLeft"><p className="founder-kicker">The work behind the work</p><h2>The tools held the information. I still had to make everything move.</h2></AnimateIn>
          <AnimateIn type="fadeRight"><div className="founder-tool-list" aria-label="Disconnected business operations">{['CRM', 'Leads', 'Email', 'Social', 'Projects', 'Documents', 'Contracts', 'Invoices', 'Calendar'].map((item) => <span key={item}><CircleDot aria-hidden="true" />{item}</span>)}</div></AnimateIn>
        </div>
      </section>

      <div className="founder-timeline">
        {chapters.map((chapter, index) => (
          <section id={`chapter-${chapter.number}`} className="founder-chapter" key={chapter.number}>
            <div className="founder-rail" aria-hidden="true"><span>{chapter.number}</span></div>
            <div className="founder-container founder-chapter__grid">
              <AnimateIn type={index % 2 === 0 ? 'fadeLeft' : 'fadeRight'}>
                <div className="founder-chapter__copy">
                  <p className="founder-kicker">Chapter {chapter.number} · {chapter.label}</p>
                  <h2>{chapter.title}</h2>
                  <blockquote>{chapter.quote}</blockquote>
                  <div className="founder-prose">{chapter.body.map((paragraph) => <p className={paragraph.startsWith('[') ? 'founder-placeholder' : ''} key={paragraph}>{paragraph}</p>)}</div>
                </div>
              </AnimateIn>
              {chapter.number === '04' && <div className="founder-evidence founder-evidence--note"><p>Founder archive</p><strong>[ADD EARLY PROTOTYPE OR WORKFLOW]</strong><span>Use a real screenshot, sketch, commit, or early interface. Do not recreate history.</span></div>}
              {chapter.number === '06' && <div className="founder-evidence founder-evidence--product"><div className="founder-product-frame"><Image src="/screenshots/deals-dashboard.png" alt="AlphaClone workspace showing connected business records" fill sizes="(max-width: 900px) 92vw, 520px" className="object-cover object-top" /></div><ol className="founder-execution-flow">{['Intent', 'Context', 'Approval', 'Execution', 'Verification'].map((step) => <li key={step}><CheckCircle2 aria-hidden="true" />{step}</li>)}</ol></div>}
            </div>
          </section>
        ))}
      </div>

      <section className="founder-final">
        <div className="founder-container founder-final__inner">
          <Workflow aria-hidden="true" />
          <p className="founder-kicker">A note from the founder</p>
          <blockquote><p>I started AlphaClone because I had experienced how much business work still depends on one person coordinating disconnected systems.</p><p>I had tried building businesses, experienced an early dropshipping failure, and worked close to client acquisition and delivery in web-services outsourcing.</p><p>I kept asking what would change if I could tell the system what needed to happen instead of manually operating every application.</p><p>And eventually that question became AlphaClone.</p><p>Today, we&apos;re building an execution layer that connects AI instructions with business context, human approval, connected systems, and a visible record of the result.</p><p>Not to give businesses another tool to operate.</p><p>But to help people spend less time operating their tools — and more time actually running the business.</p></blockquote>
          <h2>Stop operating your tools.<br />Start running your business.</h2>
          <PrimaryCTA href={DEMO_HREF} className="mkt-btn-large">Book a demo <ArrowRight aria-hidden="true" /></PrimaryCTA>
        </div>
      </section>
    </div>
  );
}
