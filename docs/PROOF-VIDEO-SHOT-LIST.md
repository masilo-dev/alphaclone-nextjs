# Quote-to-Cash Proof Video — Shot List

**Purpose:** Demonstrate the Business Execution Layer on the anchor workflow: **Request → Plan → Approval → Execution → Verify**.

**Audience:** Solo founders / small service businesses evaluating AlphaClone Execution Session.

**Length target:** 90–120 seconds.

**Environment:** Staging or demo tenant with Stripe test mode and a connected email provider.

---

## Scene 1 — Hook (0:00–0:12)

- **Visual:** Split screen of CRM tab + separate invoicing app (or spreadsheet) — then cut to AlphaClone single client record.
- **VO:** “The software works. But you’re still doing the work — re-entering the same client to send an invoice.”
- **On-screen text:** *The software works. But you’re still doing the work.*

## Scene 2 — Request (0:12–0:25)

- **Visual:** Bonnie chat or dashboard: “Create and send invoice for [Demo Client] — $1,200 for March retainer.”
- **VO:** “You direct. You state the outcome in plain language.”
- **Show:** Instruction entered; plan/tasks appear (or invoice draft queued).

## Scene 3 — Plan & readiness (0:25–0:40)

- **Visual:** Readiness check / connected Stripe + email indicators (green or explicit setup prompt if missing).
- **VO:** “AlphaClone checks readiness — connected payment and email — before anything client-facing runs.”
- **Do not claim:** Instant success without integrations connected.

## Scene 4 — Approval (0:40–0:55)

- **Visual:** Approval queue or send confirmation modal — user clicks **Approve** / **Send**.
- **VO:** “You stay in control. Important steps wait for your approval.”
- **On-screen text:** *Approve → Execute*

## Scene 5 — Execution (0:55–1:15)

- **Visual:** Invoice created on client record → Send → PDF/payment link generated.
- **VO:** “One client record. Invoice sent with payment link — no copy-paste between tools.”
- **Capture:** Stripe test payment link URL (blur if needed).

## Scene 6 — Verify (1:15–1:30)

- **Visual:** Invoice status → Sent / Paid (test payment) or delivery receipt in activity timeline.
- **VO:** “You see the result — or a clear failure message if something blocks delivery.”
- **Optional:** Show a deliberate failure (provider error) and recovery path — 15 sec B-roll.

## Scene 7 — CTA (1:30–1:45)

- **Visual:** `/execution-session` page or calendar embed.
- **VO:** “Bring one workflow to an Execution Session. We’ll map it and show the safest path from instruction to verified result.”
- **CTA on-screen:** *Book an execution session* · *Execute your first workflow*

---

## Production checklist

- [ ] Use **demo data** only — label “Demonstration workspace” in corner
- [ ] No fabricated customer names/logos unless permissioned
- [ ] No revenue or time-saved statistics unless measured
- [ ] Include disclaimer footnote: *Provider limits and approvals apply*
- [ ] Export 16:9 for YouTube/LinkedIn + 9:16 cut for short-form

---

## File placement after publish

- Embed on `/execution-session`
- Link from homepage secondary CTA (“Watch a real execution”) when URL is ready
- Add to proof section in `SEO-AUDIT.md` claim ledger
