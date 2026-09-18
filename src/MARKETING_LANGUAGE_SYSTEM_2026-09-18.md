# Marketing Language and Visual System Audit

**Repository:** `masilo-dev/alphaclone-nextjs`  
**Date:** 2026-09-18  
**Scope:** Public marketing homepage, positioning source of truth, workflow preview, integration preview, and marketing visual cues.

## Language direction

The marketing site should describe observable business behavior rather than imply autonomous magic. The preferred narrative is **instruction → approval → action → verification**. Copy should name the record or action involved, such as updating a CRM record, preparing an email, creating an invoice, or starting a follow-up workflow.

Avoid vague AI-category language such as “revolutionary,” “effortless,” “unlock,” “magic,” “next-generation,” and unsupported claims of autonomous operation. Avoid presenting simulated content as live system telemetry. When a preview is illustrative, label it clearly as illustrative and describe whether a step is queued, awaiting approval, or verified.

## Changes applied

The shared positioning source now leads with “Business workflows with an approval trail,” “Turn an approved instruction into accountable business work,” and “Connect the decision to the action.” The hero explanation now names concrete outcomes: updating records, preparing communications, creating invoices, and starting follow-up workflows.

The homepage problem section now focuses on handoff ownership rather than generic tool fragmentation. The connected-workflow panel now uses “One accountable workflow” and “Context stays attached.” The Bonnie section was reframed as “Reviewable execution,” with “Cross-system steps” and “Approval checkpoints” instead of hype-oriented automation claims.

Illustrative integration and workflow previews no longer use fake live-status language such as “Connected” or “Bonnie Engine Online.” They now use “Permission preview,” “Reviewable,” “Illustrative workflow,” and “Review before run,” which accurately describes what visitors are seeing.

## Visual direction

The visual system should prioritize hierarchy, evidence, and calm confidence over constant motion or neon intensity. Interactive elements keep clear focus states, preview cards use explicit status labels, and motion remains reduced when requested by the visitor’s operating system.

## Verification

The marketing copy and visual changes pass `git diff --check` and the repository TypeScript check. The existing marketing reduced-motion safeguards remain in place.
