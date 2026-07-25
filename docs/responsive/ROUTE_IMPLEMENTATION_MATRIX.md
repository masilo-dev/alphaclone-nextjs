# AlphaClone Authenticated Dashboard — Route Implementation Matrix

Responsive redesign inventory for every authenticated `/dashboard` route resolved by `hubRoutes.tsx`, nav constants (`TENANT_ADMIN_NAV_ITEMS`, `ADMIN_NAV_ITEMS`, `CLIENT_NAV_ITEMS`), `sharedDashboardRoutes.tsx`, `BusinessDashboard.tsx`, and `Dashboard.tsx`.

**Audience:** tenant admin (primary redesign target), platform admin, and client shells. Alias routes that normalize to the same screen are listed once with aliases noted.

---

## Responsive shell strategy

| Breakpoint | Width | Shell behavior |
|---|---|---|
| **Phone** | `<768px` | No persistent sidebar; **mobile bottom nav**; content full-bleed with safe-area padding; create/edit/detail in **full-screen sheets** |
| **Tablet** | `768–1023px` | Collapsible sidebar (expanded by default ≥768); hybrid table→stacked rows; drawers from the right when space allows |
| **Laptop** | `1024–1279px` | Persistent sidebar (compact labels OK); denser tables; split panes where modules already use them |
| **Desktop** | `1280px+` | Full sidebar + max-width canvas; multi-column module layouts; `EnterpriseDataTable` + side `DetailDrawer` |

**Mobile bottom nav (redesign target):** Home · Customers · Work · Inbox · More  
(`More` opens the full nav sheet / sidebar; PWA may swap the fifth slot for App settings.)

**Shared primitives across routes:**

- `PageHeader` (title, optional subtitle, primary action, overflow menu)
- List modules: **table on laptop/desktop → card/list rows on phone/tablet**
- Detail / create / edit: **right drawer ≥768; full-screen sheet on phone**
- Loading: `TabSkeleton` / `MetricCardSkeleton` / `TableSkeleton`
- Empty / error / permission: shared `EmptyState` + clear next action
- Hub chrome: `wrapRouteInHub` keeps Sales / Money / Marketing / Insights / Documents / Channels / Schedule / Workspace shells consistent

---

## 1. Route matrix (by hub / domain)

Legend for layout cells: **S** = sidebar visible · **BN** = bottom nav · **T→C** = table collapses to cards · **FS** = full-screen sheet for secondary surfaces · **EB** = edge-to-edge (no canvas padding).

### 1.1 Home & shell

| Route | Screen purpose | Desktop layout | Laptop layout | Tablet layout | Phone layout | Primary action | Main responsive risk | Required change |
|---|---|---|---|---|---|---|---|---|
| `/dashboard` | Tenant/client home or platform owner home | S · multi-widget grid | S · 2-col widgets | S · stacked widgets | BN · single-column cards | Open priority item / ask Bonnie | Widget density & overflow | Unify `PageHeader`; stack Momentum/stats; hide non-critical chrome on phone |
| `/dashboard/business` | Alias → tenant home | Same as `/dashboard` | Same | Same | Same | Same | Duplicate title chrome | Normalize via `normalizeBusinessRoute`; one home implementation |
| `/dashboard/pwa-settings` | Mobile/PWA preferences | S · settings form | S · form | S · form | Full-screen settings (header hidden md-) | Save prefs / customize bottom nav | Header hide vs bottom nav clash | Keep full-bleed phone; ensure BN doesn’t cover save CTA |

### 1.2 Sales hub

| Route | Screen purpose | Desktop layout | Laptop layout | Tablet layout | Phone layout | Primary action | Main responsive risk | Required change |
|---|---|---|---|---|---|---|---|---|
| `/dashboard/crm` | Sales overview / CRM module dashboard | S · hub + KPI + charts | S · denser KPIs | S · stacked panels | BN · Customers path · stacked cards | View pipeline / open workspace | Chart + KPI squeeze | ModuleDashboardLayout; charts full-width under 1024 |
| `/dashboard/crm/workspace` | Customer workspace (CRMTab) | S · split list/detail | S · split | S · list → drawer | BN · Customers · list + FS detail | Add contact / log activity | Split-pane too narrow | List-first; detail as drawer/FS sheet |
| `/dashboard/outreach` | Outreach sequences overview | S · hub dashboard | S · dashboard | S · stacked | BN · More → Sales | Start outreach | Dense campaign cards | Card stack; primary CTA sticky |
| `/dashboard/crm/console` | Sales console (multi-panel) | S · multi-pane | S · 2-pane | S · tabs | BN · More · FS tabs | Log call / advance deal | Multi-pane unusable on phone | Tabbed console; FS activity sheet |
| `/dashboard/crm/accounts` | Account list | S · table + drawer | S · table | S · T→C | BN · Customers · cards | New account | Wide account columns | EnterpriseDataTable → cards; FS create |
| `/dashboard/crm/reports` | CRM reports | S · charts + filters | S · charts | S · stacked | BN · More · stacked charts | Export / filter | Filter bar overflow | Collapsible filters; chart stack |
| `/dashboard/crm/unified-contacts` | Unified contacts (ClientsPage) | S · table | S · table | S · T→C | BN · Customers · cards | Add contact | Same as contacts | Shared contacts responsive pattern |
| `/dashboard/crm/follow-ups` | Follow-up queue | S · queue table | S · table | S · T→C | BN · Work · cards | Complete follow-up | Action buttons cramped | Row actions → overflow; swipe/FS complete |
| `/dashboard/leads` | Leads list (ClientsPage) | S · table | S · table | S · T→C | BN · Customers · cards | Add lead / qualify | Status + source columns | Card rows; FS lead detail |
| `/dashboard/leads/campaigns` | Lead Finder / scraper campaigns | S · EB tall module | S · EB | S · scroll EB | BN · More · EB + BN pad | Run / create campaign | Tall scroll + BN overlap | Keep EB scroll; bottom safe padding; sticky primary CTA |
| `/dashboard/contacts` | Contacts list | S · table | S · table | S · T→C | BN · Customers · cards | Add contact | Table horizontal scroll | T→C; FS create/edit |
| `/dashboard/business/clients` | Clients/contacts (tenant) | Same as contacts | Same | Same | Same | Add client | Alias inconsistency | One contacts module; alias only |
| `/dashboard/clients` | Contacts (platform Dashboard) | Same | Same | Same | Same | Add client | Role-specific path | Map into Customers bottom-nav path |
| `/dashboard/deals` | Deal pipeline | S · kanban/table | S · kanban | S · board scroll | BN · Work · vertical stages | New deal | Kanban horizontal scroll | Stage accordion or swipe boards on phone |
| `/dashboard/forecast` | Sales forecast | S · charts + table | S · charts | S · stacked | BN · More · stacked | Adjust forecast | Dense grids | Stack chart then list; hide secondary series |
| `/dashboard/tasks` | Task list / board | S · EB list/board | S · EB | S · EB | BN · Work · EB cards | New task | EB + BN padding | Sticky FAB/CTA; FS create; card rows |
| `/dashboard/sales-agent` | AI growth / sales agent | S · EB agent UI | S · EB | S · EB | BN · More · EB chat | Ask agent / run play | Chat + tools overflow | Single-column chat; tools in sheet |
| `/dashboard/goals` | Goals (shared) | S · goal cards/table | S · cards | S · stacked | BN · Work · cards | Set goal | Nested forms | Card list; FS goal editor |
| `/dashboard/planning` | Annual planning (shared) | S · planning grid | S · grid | S · stacked | BN · More · stacked | Update plan | Wide planning matrix | Collapse quarters; FS cell edit |
| `/dashboard/jobs` | Background jobs queue (shared) | S · table | S · table | S · T→C | BN · More · cards | Retry job | Status + payload columns | Compact cards; payload in FS |
| `/dashboard/webhooks` | Webhooks (shared) | S · table | S · table | S · T→C | BN · More · cards | Add webhook | Secret/URL wrapping | Stack fields; FS editor |
| `/dashboard/business/ingestion` | Lead ingestion panel | S · panel + forms | S · panel | S · stacked | BN · More · stacked | Import / ingest | Multi-step form | Stepper; FS upload sheet |
| `/dashboard/business/referrals` | Referrals | S · table/cards | S · table | S · T→C | BN · More · cards | Invite / share | Share CTAs | Card list; sticky share CTA |

### 1.3 Money hub

| Route | Screen purpose | Desktop layout | Laptop layout | Tablet layout | Phone layout | Primary action | Main responsive risk | Required change |
|---|---|---|---|---|---|---|---|---|
| `/dashboard/accounting` | Accounting dashboard | S · KPI + ledgers | S · denser | S · stacked | BN · More · Money path · cards | New journal / open banking | Dense financial tables | KPI stack; T→C for ledgers |
| `/dashboard/accounting/banking` | Banking center | S · accounts + txns | S · split | S · list→drawer | BN · More · cards + FS | Reconcile / connect bank | Split txn pane | List-first; FS reconciliation |
| `/dashboard/accounting/bills` | Bills payable | S · table | S · table | S · T→C | BN · More · cards | Record bill / pay | Amount + due columns | Card rows; FS pay sheet |
| `/dashboard/accounting/period-close` | Period close checklist | S · checklist + summary | S · checklist | S · stacked | BN · More · stacked | Close period | Multi-step confirmation | Vertical checklist; sticky confirm |
| `/dashboard/finance` | Finance / invoicing overview | S · hub dashboard | S · dashboard | S · stacked | BN · More · cards | Create invoice | Client vs tenant aliases | Shared InvoicingDashboard responsive |
| `/dashboard/finance/manage` | Expense/billing manage (FinanceTab / EnhancedBilling) | S · table + form | S · table | S · T→C | BN · More · cards + FS | Create expense/invoice | Wide manage tables | T→C; FS create (`?create=true`) |
| `/dashboard/business/billing` | Billing overview (tenant) | S · hub | S · hub | S · stacked | BN · More · Money | Manage invoices | Duplicate with finance | Alias-aware header; one overview |
| `/dashboard/billing` | Alias → billing | Same | Same | Same | Same | Same | Path drift | Normalize route |
| `/dashboard/business/billing/manage` | Invoice management (EnhancedBilling) | S · table + drawer | S · table | S · T→C | BN · More · cards + FS | Create invoice | Line-item editor | FS invoice editor; sticky totals |
| `/dashboard/business/invoices` | Invoices tab (shared) | S · table | S · table | S · T→C | BN · More · cards | Create invoice | Overlap with billing/manage | Consolidate UX; shared list pattern |
| `/dashboard/business/expenses` | Expense tracker | S · table + charts | S · table | S · T→C | BN · More · cards | Add expense | Receipt + category cols | Card rows; FS expense form |
| `/dashboard/business/quotes` | Quotes & proposals | S · table | S · table | S · T→C | BN · Work/Sales · cards | New quote | Line items | FS quote builder |
| `/dashboard/quotes` | Quotes (non-tenant path) | Same | Same | Same | Same | New quote | Role path alias | Normalize to business quotes for tenant |
| `/dashboard/business/cash-flow` | Cash flow forecast | S · charts + table | S · charts | S · stacked | BN · More · stacked | Adjust forecast | Timeline density | Horizontal scroll chart; stacked months |
| `/dashboard/business/tax-estimator` | Tax estimator | S · form + results | S · form | S · stacked | BN · More · stacked | Estimate tax | Input density | Single-column form; sticky results |
| `/dashboard/vendors` | Vendors (shared) | S · table | S · table | S · T→C | BN · More · cards | Add vendor | Contact columns | Card rows; FS vendor form |

### 1.4 Marketing hub

| Route | Screen purpose | Desktop layout | Laptop layout | Tablet layout | Phone layout | Primary action | Main responsive risk | Required change |
|---|---|---|---|---|---|---|---|---|
| `/dashboard/business/campaigns` | Email campaigns | S · campaign list | S · list | S · T→C | BN · More · cards | Create campaign | Preview pane | List→FS composer |
| `/dashboard/email-campaigns` | Alias → campaigns | Same | Same | Same | Same | Same | Duplicate path | Alias only |
| `/dashboard/marketing/sequences` | Sequence builder | S · canvas + steps | S · canvas | S · vertical steps | BN · More · vertical | Add step / publish | Canvas drag UI | Linear step list on phone; FS step editor |
| `/dashboard/marketing/deliverability` | Deliverability panel | S · metrics + tables | S · metrics | S · stacked | BN · More · stacked | Fix issues | Metric grid | Stack panels; compact status |
| `/dashboard/business/forms` | Branded forms hub | S · form list | S · list | S · T→C | BN · More · cards | Create form | Builder chrome | List + FS builder |
| `/dashboard/business/social` | Social overview | S · hub dashboard | S · hub | S · stacked | BN · More · cards | Compose post | Multi-network widgets | Stack network cards |
| `/dashboard/social` | Social overview alias | Same | Same | Same | Same | Same | Alias | Normalize |
| `/dashboard/business/social/compose` | Compose social post | S · composer | S · composer | S · stacked | BN · More · FS composer | Publish / schedule | Preview + editor | Full-screen composer on phone |
| `/dashboard/social/compose` | Compose alias | Same | Same | Same | Same | Same | Alias | Normalize |
| `/dashboard/business/social-command` | Social command center | S · calendar + queues | S · dense | S · stacked | BN · More · stacked | Schedule post | Calendar density | Day list on phone; FS post detail |
| `/dashboard/business/sms` | SMS campaigns | S · list + composer | S · list | S · T→C | BN · More · cards | Send / create | Composer + list | List→FS SMS sheet |
| `/dashboard/business/unified-inbox` | Unified inbox (channels) | S · 3-pane inbox | S · 2-pane | S · list→detail | BN · Inbox · list + FS | Reply | Classic inbox panes | List→thread FS; composer sheet |
| `/dashboard/zoho/mail` | Zoho mail inbox | S · EB inbox | S · EB | S · list→detail | BN · Inbox · EB + FS | Compose | Provider chrome + BN | Same inbox pattern; safe padding |
| `/dashboard/business/facebook` | Facebook integration | S · settings + feed | S · stacked | S · stacked | BN · More · stacked | Connect / post | Nested settings | Single column; FS connect |
| `/dashboard/business/linkedin` | LinkedIn manager | Same pattern | Same | Same | BN · More | Connect / post | Same | Same |
| `/dashboard/business/instagram` | Instagram integration | Same pattern | Same | Same | BN · More | Connect / post | Same | Same |
| `/dashboard/business/x` | X (Twitter) manager | Same pattern | Same | Same | BN · More | Connect / post | Same | Same |

### 1.5 Insights hub

| Route | Screen purpose | Desktop layout | Laptop layout | Tablet layout | Phone layout | Primary action | Main responsive risk | Required change |
|---|---|---|---|---|---|---|---|---|
| `/dashboard/executive` | Executive dashboard | S · KPI + charts | S · denser | S · stacked | BN · Work · stacked | Drill into report | Chart overload | Prioritize top KPIs; stack charts |
| `/dashboard/analytics` | Analytics / insights | S · hub + charts | S · charts | S · stacked | BN · Work · stacked | Change range | Filter + chart clash | Collapsible filters; full-width charts |
| `/dashboard/performance` | Business OS performance | S · metrics | S · metrics | S · stacked | BN · More · stacked | Investigate metric | Dense metric cards | 1-col metric stack |
| `/dashboard/business/reports` | Analytics & reports | S · report list + view | S · list | S · T→C | BN · More · cards | Run report | Report tables | T→C; FS report view |
| `/dashboard/reporting` | Reporting alias | Same | Same | Same | Same | Same | Alias | Normalize |
| `/dashboard/notifications` | Notifications & activity (shared) | S · feed/list | S · list | S · list | BN · More · feed | Mark read / open | Dense timestamps | Compact feed rows; FS detail |

### 1.6 Documents hub

| Route | Screen purpose | Desktop layout | Laptop layout | Tablet layout | Phone layout | Primary action | Main responsive risk | Required change |
|---|---|---|---|---|---|---|---|---|
| `/dashboard/business/documents` | Document hub | S · browser + preview | S · split | S · list→preview | BN · More · list + FS | Upload | Preview pane | List-first; FS preview/upload |
| `/dashboard/business/vault` | Document vault | S · secure file list | S · table | S · T→C | BN · More · cards | Upload / unlock | Security + metadata cols | Card rows; FS unlock |
| `/dashboard/contracts` | Contracts overview | S · hub | S · hub | S · stacked | BN · More · cards | New contract | Alias with business path | Shared ContractsDashboard |
| `/dashboard/business/contracts` | Contracts overview (tenant) | Same | Same | Same | Same | New contract | Same | Same |
| `/dashboard/contracts/manage` | Contract manager | S · detail tabs | S · tabs | S · stacked tabs | BN · More · FS tabs | Send / sign | Long contract text | FS editor; sticky actions |
| `/dashboard/business/contracts/manage` | Contract manager (tenant) | Same | Same | Same | Same | Same | Same | Same |
| `/dashboard/business/projects` | Projects overview (tenant) | S · EB projects | S · EB | S · EB | BN · Work · EB cards | New project | EB + BN | Card grid; FS create (`?create=true`) |
| `/dashboard/projects` | Projects overview (client/admin) | S · hub | S · hub | S · stacked | BN · Work · cards | Open / submit project | Role differences | Role-aware CTA; shared cards |
| `/dashboard/business/projects/manage` | Projects manage (ProjectsPage) | S · table/board | S · table | S · T→C | BN · Work · cards + FS | Create project | Board vs table | T→C / stage accordion; FS create |
| `/dashboard/projects/manage` | Projects manage (non-business path) | Same | Same | Same | Same | Create project | Alias | Normalize for tenant |
| `/dashboard/business/onboarding` | Client onboarding | S · pipeline steps | S · steps | S · stacked | BN · More · stacked | Advance step | Multi-step forms | Vertical stepper; FS step |
| `/dashboard/business/pages` | Site pages | S · page list | S · list | S · T→C | BN · More · cards | New page | Editor chrome | List + FS editor |
| `/dashboard/business/contact-submissions` | Contact form submissions | S · table | S · table | S · T→C | BN · More · cards | Open submission | Message preview | Cards; FS detail |
| `/dashboard/submit` | Client document/project submit | S · form | S · form | S · form | BN · More · form | Submit project | Form length | Single-col; sticky submit |

### 1.7 Channels hub

| Route | Screen purpose | Desktop layout | Laptop layout | Tablet layout | Phone layout | Primary action | Main responsive risk | Required change |
|---|---|---|---|---|---|---|---|---|
| `/dashboard/comms` | Communication hub / inbox | S · EB multi-pane | S · 2-pane | S · list→detail | BN · Inbox · list + FS | Compose / reply | Inbox panes + EB | List→thread FS; composer sheet |
| `/dashboard/mail` | Mail (CommunicationHub) | S · EB mail | S · EB | S · list→detail | BN · Inbox · EB + FS | Compose | Same as comms | Shared inbox responsive pattern |
| `/dashboard/messages` | Team/direct messages | S · chat split | S · split | S · list→chat | BN · Inbox · list + FS chat | New message | Chat + BN | Full-height chat; composer above BN |
| `/dashboard/business/messages` | Tenant messages | Same | Same | Same | Same | New message | Role alias | Same pattern |
| `/dashboard/business/tickets` | Deep-Desk tickets | S · queue + detail | S · split | S · list→drawer | BN · Customers · cards + FS | New ticket / reply | Ticket metadata | Card queue; FS ticket |
| `/dashboard/tickets` | Deep-Desk (admin path) | Same | Same | Same | BN · More / Support | Same | Role path | Alias-aware nav |
| `/dashboard/business/whatsapp` | WhatsApp accounts | S · accounts + threads | S · split | S · list→detail | BN · Inbox · cards + FS | Connect / message | Provider UI | List→FS thread |
| `/dashboard/whatsapp` | WhatsApp alias | Same | Same | Same | Same | Same | Alias | Normalize |

### 1.8 Schedule hub

| Route | Screen purpose | Desktop layout | Laptop layout | Tablet layout | Phone layout | Primary action | Main responsive risk | Required change |
|---|---|---|---|---|---|---|---|---|
| `/dashboard/calendar` | Calendar | S · month/week grid | S · week | S · agenda preferred | BN · More · agenda | New event | Month grid overflow | Agenda default on phone; FS event |
| `/dashboard/business/calendar` | Tenant calendar | Same | Same | Same | Same | New event | Same | Same |
| `/dashboard/business/booking` | Booking links | S · links + settings | S · form | S · stacked | BN · More · stacked | Create booking link | Settings density | Card links; FS link editor |
| `/dashboard/business/teams` | MS Teams integration | S · settings + list | S · stacked | S · stacked | BN · More · stacked | Connect Teams | Integration chrome | Single column; FS connect |
| `/dashboard/business/team` | Team management page | S · member table | S · table | S · T→C | BN · More · cards | Invite member | Role columns | Card members; FS invite |
| `/dashboard/business/meetings` | Meetings list | S · list + join | S · list | S · T→C | BN · More · cards | Start / join meeting | Join CTA + meta | Card rows; sticky join |
| `/dashboard/conference` | Video conference tab | S · full conference | S · conference | S · conference | BN · FS conference (sidebar forced closed) | Join call | Media + chrome | Full-viewport; hide BN during live call when possible |
| `/dashboard/meetings` | Meetings alias (ConferenceTab) | Same as conference/meetings | Same | Same | Same | Join | Path overlap with business/meetings | Clarify alias vs tenant MeetingsPage |

### 1.9 Workspace hub

| Route | Screen purpose | Desktop layout | Laptop layout | Tablet layout | Phone layout | Primary action | Main responsive risk | Required change |
|---|---|---|---|---|---|---|---|---|
| `/dashboard/marketplace` | Integration marketplace | S · catalog grid | S · grid | S · 2-col | BN · More · 1-col cards | Install / connect | Card grid density | 1-col cards; FS integration detail |
| `/dashboard/automations` | Automations / workflows | S · workflow canvas | S · canvas | S · list of flows | BN · Work · list + FS | Create workflow | Canvas on phone | List-first; FS node editor |
| `/dashboard/business/workflows` | Workflow builder (tenant) | Same | Same | Same | Same | Create workflow | Same | Same |
| `/dashboard/help` | Platform guide (shared) | S · docs layout | S · docs | S · stacked TOC | BN · More · stacked | Search help | TOC + content | Collapsible TOC; sticky search |
| `/dashboard/settings` | Settings (client/admin) | S · sections | S · sections | S · stacked | BN · More · stacked | Save settings | Long forms | Section accordions; sticky save |
| `/dashboard/business/settings` | System settings (tenant) | Same | Same | Same | Same | Save / upgrade | Same | Same |
| `/dashboard/business/quotas` | Quota manager | S · quota cards/table | S · cards | S · stacked | BN · More · cards | Adjust quota | Plan comparison | Stack plans; FS adjust |
| `/dashboard/business/tasks` | Task scheduler (tenant) | S · schedule UI | S · schedule | S · stacked | BN · Work · stacked | Schedule task | Overlaps `/dashboard/tasks` | Clarify vs Tasks; FS schedule form |
| `/dashboard/zoho/crm` | Zoho CRM sync | S · sync status | S · status | S · stacked | BN · More · stacked | Sync / map fields | Mapping tables | Stack mappings; FS field map |

### 1.10 Bonnie AI

| Route | Screen purpose | Desktop layout | Laptop layout | Tablet layout | Phone layout | Primary action | Main responsive risk | Required change |
|---|---|---|---|---|---|---|---|---|
| `/dashboard/bonnie` | Bonnie AI console | S · full chat/console | S · console | S · stacked | BN · More · full chat (widget hidden) | Ask Bonnie | Widget + full view clash | Full-view only; hide floating widget |
| `/dashboard/business/bonnie` | Bonnie console (tenant) | Same | Same | Same | Same | Ask Bonnie | Same | Same |
| `/dashboard/bonnie/approvals` | Approvals / action center | S · approval queue | S · queue | S · T→C | BN · Work · cards | Approve / reject | Action buttons | Card approvals; sticky approve/reject |
| `/dashboard/business/bonnie/approvals` | Approvals alias (tenant) | Same | Same | Same | Same | Same | Same | Same |

### 1.11 Platform admin

| Route | Screen purpose | Desktop layout | Laptop layout | Tablet layout | Phone layout | Primary action | Main responsive risk | Required change |
|---|---|---|---|---|---|---|---|---|
| `/dashboard/admin/tenants` | Super-admin tenants | S · tenant table | S · table | S · T→C | BN · More · cards | Create / open tenant | Wide tenant meta | T→C; FS tenant detail |
| `/dashboard/admin/users` | Platform users | S · user table | S · table | S · T→C | BN · More · cards | Invite / edit user | Role columns | Card rows; FS user form |
| `/dashboard/admin/operations` | Ops & logs console | S · logs + filters | S · dense | S · stacked | BN · More · stacked | Filter / retry | Log line wrapping | Compact log cards; FS log detail |
| `/dashboard/admin/improvements` | Pre-customer review | S · improvement list | S · list | S · T→C | BN · More · cards | Triage item | Status workflow | Cards; FS triage |
| `/dashboard/admin/settings` | Global settings | S · settings sections | S · sections | S · stacked | BN · More · stacked | Save globals | Dangerous actions | Accordion sections; confirm sheets |
| `/dashboard/security` | Security dashboard | S · security panels | S · panels | S · stacked | BN · More · stacked | Review alerts | Alert density | Stack alerts; FS incident |
| `/dashboard/contact-submissions` | Platform contact intake | S · table | S · table | S · T→C | BN · More · cards | Open submission | Overlap with business submissions | Shared list pattern |

### 1.12 Client & miscellaneous authenticated routes

| Route | Screen purpose | Desktop layout | Laptop layout | Tablet layout | Phone layout | Primary action | Main responsive risk | Required change |
|---|---|---|---|---|---|---|---|---|
| `/dashboard/ai-studio` | AI Studio (client nav) | S · studio tools | S · tools | S · stacked | BN · More · stacked | Generate | Tool chrome | Single-col tools; FS result |
| `/dashboard/onboarding` | Onboarding pipelines | S · pipeline | S · pipeline | S · stacked | BN · More · stacked | Continue onboarding | Stepper width | Vertical steps |
| `/dashboard/gamification` | Gamification | S · badges/stats | S · stats | S · stacked | BN · More · stacked | View rewards | Decorative density | Simplify phone layout |
| `/dashboard/articles` | Article editor | S · editor | S · editor | S · stacked | BN · More · FS editor | Publish | Editor toolbars | FS editor; collapse toolbar |
| `/dashboard/portfolio-manager` | Portfolio showcase | S · gallery | S · gallery | S · 2-col | BN · More · 1-col | Manage items | Image grid | 1-col cards |

---

## 2. Major module required states

For each major module, implement (or verify) every state below. **Mobile nav path** is the primary phone entry via bottom nav → destination (or More → group). **Cross-module next action** is the most common successful handoff after the primary job.

| Module | List | Detail | Create | Edit | Empty | Loading | Error | Permission | Mobile nav path | Cross-module next action |
|---|---|---|---|---|---|---|---|---|---|---|
| **Home / Overview** | Priority cards | Widget drill-down | N/A (shortcuts) | Customize widgets (future) | “No activity yet” + CTA | Skeleton widgets | Retry load stats | Role-scoped home | **Home** | Open Customers / Work / Inbox |
| **CRM / Contacts / Leads / Clients** | Contact/lead table→cards | Contact FS/drawer | Add contact sheet | Edit contact sheet | “No contacts” + import/add | TableSkeleton | Retry + support | Tenant-scoped RLS | **Customers** → Contacts / Leads | Create deal / start outreach |
| **Accounts** | Account table→cards | Account detail | New account | Edit account | “No accounts” | TableSkeleton | Retry | CRM permission | **Customers** → Accounts | Open related contacts/deals |
| **Deals / Pipeline** | Board/table | Deal detail | New deal | Edit stage/value | “No deals” + create | Skeleton board | Retry | Sales permission | **Work** → Deals (via More/Sales) | Create quote / invoice |
| **Sales console / Follow-ups** | Queue list | Activity detail | Log activity | Edit activity | “Inbox zero” | TabSkeleton | Retry | Sales permission | **Work** / **Customers** | Call / message contact |
| **Lead Finder (campaigns)** | Campaign list | Campaign detail | New campaign | Edit campaign | “No campaigns” | TableSkeleton | Scrape/API error | Plan lock possible | **More** → Sales → Lead Finder | Push leads → Contacts |
| **Outreach / Sequences** | Sequence list | Sequence canvas/detail | New sequence | Edit steps | “No sequences” | Skeleton | Send/deliverability error | Marketing permission | **More** → Sales/Marketing | Launch campaign / SMS |
| **Tasks** | Task list/board | Task detail | New task (cmd palette / FAB) | Edit task | “No tasks” | TableSkeleton | Retry | Assignee scope | **Work** | Link to project / deal |
| **Projects** | Project cards/table | Project detail | Create project | Edit project | “No projects” | TabSkeleton | Retry | Owner/tenant scope | **Work** → Projects | Create invoice / contract |
| **Quotes** | Quote list | Quote detail | New quote | Edit line items | “No quotes” | TableSkeleton | Retry | Sales permission | **More** → Sales → Quotes | Convert → invoice/deal |
| **Invoices / Billing** | Invoice table→cards | Invoice detail | Create invoice | Edit / send | “No invoices” | TableSkeleton | Payment/API error | Billing permission | **More** → Money → Invoices | Record payment / expense |
| **Expenses** | Expense list | Expense detail | Add expense | Edit expense | “No expenses” | TableSkeleton | Retry | Finance permission | **More** → Money → Expenses | Attach to project |
| **Accounting / Banking / Bills / Period close** | Ledgers & queues | Txn/bill detail | New entry / bill | Reconcile / edit | Empty period states | TableSkeleton | Bank sync error | Accounting permission | **More** → Money → Accounting | Cash flow / tax estimator |
| **Cash flow / Forecast / Tax** | Series/list | Scenario detail | New scenario (if any) | Adjust inputs | “Not enough data” | Skeleton charts | Retry | Finance permission | **More** → Money | Open invoices/expenses |
| **Vendors** | Vendor list | Vendor detail | Add vendor | Edit vendor | “No vendors” | TableSkeleton | Retry | Finance permission | **More** → Money | Create bill |
| **Email campaigns / Forms / SMS** | Campaign/form lists | Campaign/form detail | Create | Edit / send | Empty catalog | Skeleton | Provider error | Marketing permission | **More** → Marketing | Open unified inbox replies |
| **Social (+ compose / command / networks)** | Posts/networks | Post detail | Compose | Edit scheduled | “Connect a network” | Skeleton | OAuth/API error | Integration permission | **More** → Marketing → Social | Open Social command / Inbox |
| **Comms / Mail / Unified inbox / Zoho Mail** | Thread list | Thread FS | Compose | Reply/forward | “Inbox zero” | TabSkeleton | Provider error | Mailbox permission | **Inbox** | Create ticket / CRM activity |
| **Messages (team)** | Conversation list | Chat FS | New DM | Edit message (if allowed) | “No conversations” | TabSkeleton | Retry | Tenant members | **Inbox** (or Messages slot) | Start meeting |
| **Tickets (Deep-Desk)** | Ticket queue | Ticket detail | New ticket | Update status | “No tickets” | TabSkeleton | Retry | Support permission | **Customers** → Tickets | Message customer |
| **WhatsApp** | Accounts / chats | Thread | New message | Edit templates | “Connect WhatsApp” | Skeleton | Provider error | Channel permission | **Inbox** → WhatsApp | Log CRM activity |
| **Calendar / Booking / Meetings / Conference** | Agenda/list | Event/meeting detail | New event / booking link | Edit event | “No events” | Skeleton | Meeting provider error | Schedule permission | **More** → Schedule | Message attendees / join call |
| **Documents / Vault / Pages** | File/page list | Preview FS | Upload / new page | Rename/edit | “No files” | Skeleton | Upload error | File permission | **More** → Files | Attach to project/contract |
| **Contracts** | Contract list | Contract detail | New contract | Edit / send | “No contracts” | Skeleton | Sign/send error | Contract permission | **More** → Files → Contracts | Open related project |
| **Reports / Analytics / Executive / Performance / Reporting** | Report list / KPI set | Report view | Save view (if any) | Edit filters | “No data in range” | Chart skeletons | Query error | Insights permission | **Work** → Analytics / Executive | Jump to underlying module |
| **Notifications** | Activity feed | Notification detail | N/A | Preferences | “You’re all caught up” | Skeleton | Retry | User scope | **More** → Notifications | Deep-link target module |
| **Workflows / Automations / Jobs / Webhooks** | Flow/job lists | Flow/job detail | Create flow/webhook | Edit / retry | “No automations” | Skeleton | Run failure | Automation permission | **Work** → Workflows | Open Approvals |
| **Bonnie / Approvals** | Approval queue / chat history | Approval detail / thread | Ask Bonnie | Edit draft action | “No pending approvals” | Skeleton | Agent/API error | Bonnie enabled | **More** → Bonnie / **Work** → Approvals | Navigate to target module via Bonnie |
| **Marketplace / Integrations / Zoho CRM** | Catalog / sync status | Integration detail | Connect | Configure | “No integrations” | Skeleton | OAuth error | Admin/tenant settings | **More** → Settings → Integrations | Return to using module |
| **Settings / Quotas / PWA / Help** | Settings sections | Section detail | N/A | Save prefs | N/A | Skeleton forms | Save error | Role-gated settings | **More** → Settings / Help / App | Return Home |
| **Platform admin (tenants, users, ops, security, improvements, global settings, contact intake)** | Admin tables | Record detail | Create tenant/user | Edit / triage | Empty admin lists | TableSkeleton | Ops error | **Platform admin only** | **More** → Admin group | Open tenant dashboard context |
| **AI Studio / Articles / Portfolio / Gamification / Onboarding (misc)** | Gallery/list/steps | Item detail | Create content | Edit | Empty creative states | Skeleton | Generation error | Feature flags / role | **More** → Resources | Share / publish / continue |

---

## 3. Implementation notes

1. **Single source of truth for shells:** Prefer `BusinessDashboard` + hubs for tenant admin; keep `Dashboard.tsx` aliases in sync via `normalizeBusinessRoute` / `normalizeTabForRole` and `renderSharedDashboardRoute`.
2. **Do not invent a second nav model:** Phone uses bottom nav (Home, Customers, Work, Inbox, More); tablet+ uses sidebar groups from `TENANT_ADMIN_NAV_ITEMS` (and role-specific admin/client nav).
3. **Edge-to-edge tabs** (`DASHBOARD_EDGE_TO_EDGE_TABS` and mail/messages): always reserve bottom safe area for BN on phone (`pb-[calc(5.25rem+env(safe-area-inset-bottom))]`).
4. **Permission / plan locks:** Reuse existing locked-feature and “Access restricted” patterns; surface upgrade/settings as the recovery CTA.
5. **Primary action placement:** Desktop — `PageHeader` right actions; Phone — sticky header action or FAB above BN; never under the bottom nav.
6. **Hub wrappers:** Routes in `ALL_HUB_ROUTES` render inside Sales/Money/Marketing/Insights/Documents/Channels/Schedule/Workspace hubs — responsive work must not break hub tab chrome.

---

## 4. Source map

| Source | What it contributes |
|---|---|
| `src/lib/dashboard/hubRoutes.tsx` | Hub membership for Sales → Workspace route sets |
| `src/constants.ts` | `TENANT_ADMIN_NAV_ITEMS`, `ADMIN_NAV_ITEMS`, `CLIENT_NAV_ITEMS` |
| `src/lib/dashboard/sharedDashboardRoutes.tsx` | Shared goals, planning, jobs, vendors, webhooks, notifications, help, invoices |
| `src/components/dashboard/business/BusinessDashboard.tsx` | Tenant admin route switch + edge-to-edge tabs |
| `src/components/Dashboard.tsx` | Platform admin / client / shared route switch |

*Generated for the AlphaClone authenticated dashboard responsive redesign. Update this matrix when adding authenticated `/dashboard` routes.*
