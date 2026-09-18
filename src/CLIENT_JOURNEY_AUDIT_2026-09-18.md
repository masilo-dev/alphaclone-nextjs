# End-to-End Client Journey Audit

**Repository:** `masilo-dev/alphaclone-nextjs`  
**Date:** 2026-09-18  
**Scope:** Admin client handoff, client portal access, portal orientation, capabilities, empty states, and permission boundaries.

## Main usability gap

The secure portal access backend already supported setting a client portal password, rotating the portal session salt, revoking prior sessions, writing audit events, and returning a generated portal URL. However, the admin client detail view did not expose a clear control for this flow. An administrator could manage a CRM client but could not easily prepare the email, password, and portal link needed for a client handoff.

The client portal also contained the necessary Projects, Invoices, Quotes, Contracts, Documents, and Messages surfaces, but the overview assumed visitors would understand those capabilities without orientation. Empty states explained when data would appear, but there was no first-visit map of what to do next.

## Changes applied

Added a guided **Client portal** action to the admin client detail view. The new panel lets an authorized admin enter or correct the client email, set a temporary password, create secure portal access through the existing protected endpoint, open the portal, and copy a ready-to-send handoff message. Passwords are not placed in URLs or logs; the server stores only a hash and revokes prior sessions when access is reset.

Added a client-portal overview guide with three clear next actions: **Track work**, **Handle billing**, and **Stay aligned**. Each action navigates to the relevant portal surface, making the client capabilities discoverable without requiring product knowledge.

## Security and product boundaries

The portal grant endpoint remains restricted to tenant roles `owner`, `admin`, and `billing_manager`. The handoff panel does not email credentials automatically; it gives the administrator an explicit, copyable handoff so credentials can be sent through a secure channel. The client is instructed to change the temporary password after first sign-in.

External email delivery, OAuth provider permissions, and production tenant policy cannot be fully verified from this local checkout and remain deployment-environment checks.
