# Mail and Chat Scroll/Focus Audit Plan

## Scope

Audit and repair the communication surfaces where users read or reply to mail, channel messages, and team chat:

- `/dashboard/mail` mailbox and all-channels tabs
- `/dashboard/comms` communication hub where it embeds the same inbox pieces
- `/dashboard/business/messages` team/client chat
- legacy `/dashboard/messages` alias behavior

Primary focus: scroll containment, mobile keyboard focus, selected-thread navigation, composer reachability, and avoiding nested page/body scrolling.

## Current Findings

1. Team chat is not fully included in the dashboard scroll containment rules.
   - `src/components/Dashboard.tsx` gives `overflow-hidden` only to `/dashboard/mail`.
   - The inner wrapper gives full-height chat layout to `/dashboard/mail` and `/dashboard/messages`, but the canonical route is `/dashboard/business/messages`.
   - Result: the business messages page can use the outer dashboard scroll instead of only the chat pane, especially on mobile.

2. `MessagesTab` forces textarea focus scrolling.
   - `src/components/dashboard/MessagesTab.tsx` calls `scrollIntoView({ block: 'center' })` on textarea focus.
   - On mobile keyboards this can fight the chat container, dashboard shell, and browser viewport resize.
   - Result: composer jumps, thread position shifts, or the wrong scroll container moves.

3. Chat autoscroll always runs on broad dependency changes.
   - `MessagesTab` scrolls to bottom whenever `filteredMessages`, `unifiedMessages`, `selectedClient`, `pendingAttachments`, or `typingUsers` changes.
   - Result: users reading older messages can be yanked to the bottom when typing state or attachments change.

4. Mailbox scroll containment is better than chat but should be tested explicitly.
   - `UnifiedInbox` and `UnifiedInboxView` use `h-full min-h-0` and inner `overflow-y-auto` regions.
   - Existing Playwright checks verify tab visibility, not containment or composer reachability.

5. All-channels inbox has potential desktop-first layout risk.
   - `UnifiedInboxTab` uses a fixed sidebar width and a two-pane layout.
   - Needs a mobile pass for selected-message reading and reply composer visibility.

## Implementation Plan

### Phase 1: Normalize Shell Containment

- In `src/components/Dashboard.tsx`, treat these as communication full-height routes:
  - `/dashboard/mail`
  - `/dashboard/comms`
  - `/dashboard/messages`
  - `/dashboard/business/messages`
  - `/dashboard/business/unified-inbox`
- Apply the same `overflow-hidden`, `h-full`, and `flex flex-col` shell behavior to all of them.
- Keep ordinary dashboard pages on `overflow-y-auto`.

### Phase 2: Make Chat Autoscroll Respect User Intent

- Add a `messagesListRef` to the chat scroll container in `MessagesTab`.
- Track whether the user is near the bottom before forcing autoscroll.
- Autoscroll when:
  - a conversation is first selected,
  - the current user sends a message,
  - a new inbound message arrives while already near the bottom.
- Do not autoscroll merely because typing indicators or attachment previews changed.

### Phase 3: Replace Forced Focus Scrolling

- Remove textarea `scrollIntoView({ block: 'center' })`.
- Use layout containment instead:
  - keep the input `flex-shrink-0`,
  - keep the messages list `flex-1 min-h-0 overflow-y-auto`,
  - add `scroll-padding-bottom` on the message list if needed.
- If mobile Safari still needs help, call `scrollIntoView({ block: 'nearest' })` only when the composer is actually clipped.

### Phase 4: Mobile Inbox Hardening

- Verify `UnifiedInboxView` on 390px width:
  - list pane appears first,
  - selecting an email hides list and shows reader,
  - back button restores list,
  - reply/compose actions remain reachable,
  - only the intended list or reader pane scrolls.
- Verify `UnifiedInboxTab` on 390px width:
  - channel filters do not steal all horizontal space,
  - selected conversation and draft reply area are reachable,
  - quick email action scrolls the reply composer inside the correct pane.

### Phase 5: Test Coverage

- Extend Playwright coverage with scroll/focus assertions:
  - `/dashboard/mail` body/main should not become the active scroll container when scrolling mailbox list.
  - `/dashboard/business/messages` body/main should stay stable while the messages pane scrolls.
  - focusing the chat textarea should keep the composer visible and not jump the message list unexpectedly.
  - selecting a chat on mobile should show the conversation and keep the back button visible.
- Add tests to `tests/mobile-unified-inbox.spec.js` and a new or existing messages spec.

## Acceptance Criteria

- No double-scroll on mail, comms, or business messages pages.
- Chat list/sidebar and chat body scroll independently.
- Composer remains visible after selecting a thread and after focusing the textarea on mobile.
- Users reading old messages are not forced to bottom unless they send or are already near bottom.
- Existing inbox tests continue to pass.
- New Playwright tests cover the scroll/focus behavior directly.

## Suggested First Patch

Start with `src/components/Dashboard.tsx` route containment and the `MessagesTab` focus/autoscroll changes. Those are the smallest changes with the highest chance of fixing the reported behavior.
