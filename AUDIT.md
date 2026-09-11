# AlphaClone Platform UI Visual Standardization Audit

This audit inventories all platform modules to identify instances of metric/stat cards, charts/funnels/progress bars, status/priority lists, and social/platform icons that require visual standardization.

---

## 1. Workspace Home
Renders when the user is at `/dashboard` or `/dashboard/business`.

- [ ] **Stat/Metric Cards**
  - [ ] 5 metric cards in `BusinessHomeDashboard.tsx` (Total Revenue, New Leads, Email Sent, Deals Closed, Tasks Completed) using local `StatCard` component.
  - [ ] Metric cards rendered via dynamically loaded `OverviewDashboard` (`ModuleDashboardView.tsx`) when viewed by specific tenant admin sub-routes.
- [ ] **Charts, Funnels, or Progress Bars**
  - [ ] Recharts `LineChart` in `BusinessHomeDashboard.tsx` for "Revenue Overview".
  - [ ] Custom CSS horizontal progress bars in `BusinessHomeDashboard.tsx` for "Sales Pipeline" (Deal progression counts).
  - [ ] CSS circular/horizontal progression bar for "Tasks Completed" progress.
- [ ] **Status/Priority Lists**
  - [ ] Tasks list with priority badges (`high`, `medium`, `low` with border styling) in `BusinessHomeDashboard.tsx`.
  - [ ] Recent activities feed with color-coded action types.
- [ ] **Social/Platform Icons**
  - [ ] "Social Media Overview" section rendering integration cards with platform-specific branding:
    - [ ] `Linkedin` icon
    - [ ] `Facebook` icon
    - [ ] `Instagram` icon
    - [ ] `Twitter` (X) icon
    - [ ] `Music2` (TikTok) icon

---

## 2. Sales Hub
Routes under `/dashboard/crm`, `/dashboard/deals`, `/dashboard/leads`, `/dashboard/contacts`, `/dashboard/tasks`.

- [ ] **Stat/Metric Cards**
  - [ ] `ModuleStatCards` in `CRMTab.tsx` (CRM workspace stats: Leads Pool, Contacted, Qualified, Closed Won).
  - [ ] `ModuleStatCards` in `DealsTab.tsx` (Deals pipeline stats: Open Pipeline, Won, Win Rate, Avg Deal).
  - [ ] `ModuleStatCards` in `ClientsPage.tsx` (Contacts, Leads, and Clients overview stats).
  - [ ] `ModuleStatCards` in `TasksTab.tsx` (Production tasks overview stats).
  - [ ] `ModuleStatCards` in `GoalsTab.tsx` (Goals & Targets stats).
  - [ ] `ModuleStatCards` in `SalesForecastTab.tsx` (Forecast stats).
- [ ] **Charts, Funnels, or Progress Bars**
  - [ ] Custom Recharts funnel visualization and `PipelineChart.tsx` under CRM workspace.
  - [ ] Recharts line/bar chart in `SalesForecastTab.tsx`.
  - [ ] Mini CSS progress bar pipeline representation in `DealsTab.tsx` (deals by stage and probability).
  - [ ] Recharts charts in `CRMReportsTab.tsx`.
- [ ] **Status/Priority Lists**
  - [ ] Deals kanban board and list view in `DealsTab.tsx` with status badges and probability accent classes.
  - [ ] Leads and Contacts tables in `ClientsPage.tsx` and `CRMTab.tsx` with status/source labels.
  - [ ] Tasks list table and details in `TasksTab.tsx` with priority badges (`high`, `medium`, `low`) and status badges.
- [ ] **Social/Platform Icons**
  - [ ] Platform indicators on leads and contacts for sources (e.g., LinkedIn outreach, email, web forms).

---

## 3. Marketing Hub
Routes under `/dashboard/business/campaigns`, `/dashboard/marketing/sequences`, `/dashboard/marketing/deliverability`, `/dashboard/business/forms`, `/dashboard/business/social`, `/dashboard/mail`, `/dashboard/business/sms`.

- [ ] **Stat/Metric Cards**
  - [ ] `ModuleStatCards` in `FormsHub.tsx` (Forms analytics stats).
  - [ ] `ModuleStatCards` in `UnifiedInboxTab.tsx` (Unified mail inbox stats).
  - [ ] `ModuleStatCards` in `MicrosoftMailView.tsx` (Outlook integration mail stats).
  - [ ] Metric cards in `SocialDashboard` (Content reach stats: Impressions, shares, replies).
- [ ] **Charts, Funnels, or Progress Bars**
  - [ ] Recharts `DashboardLineChart` or `DashboardBarChart` under `SocialDashboard` (reach trends, posts per platform breakdown).
  - [ ] Deliverability health meters and progression bars in `DeliverabilityPanel.tsx`.
  - [ ] SMS outreach delivery metrics and progression indicators in `SMSCampaignTab.tsx`.
- [ ] **Status/Priority Lists**
  - [ ] Campaigns status list in `ZohoCampaignsHub.tsx` (draft, sent, scheduled).
  - [ ] Marketing sequences step builder listing states in `SequenceBuilder.tsx`.
  - [ ] Forms list and submission list with completion status in `FormsHub.tsx`.
- [ ] **Social/Platform Icons**
  - [ ] Channel integration connectors and post composers utilizing platform-specific social icons:
    - [ ] `Linkedin` icon
    - [ ] `Facebook` icon
    - [ ] `Instagram` icon
    - [ ] `Twitter` / `X` icon
    - [ ] `Mail` icon (email integrations)

---

## 4. Money Hub
Routes under `/dashboard/accounting`, `/dashboard/accounting/banking`, `/dashboard/accounting/bills`, `/dashboard/business/billing`, `/dashboard/business/billing/manage`, `/dashboard/business/expenses`, `/dashboard/business/quotes`, `/dashboard/business/cash-flow`, `/dashboard/business/tax-estimator`.

- [ ] **Stat/Metric Cards**
  - [ ] `ModuleStatCards` in `BankingCenterPage.tsx` (Bank balance stats).
  - [ ] `ModuleStatCards` in `QuotesTab.tsx` (Quotes & Proposals stats).
  - [ ] Metric cards in `InvoicingDashboard` (Revenue collection vs actual collected).
  - [ ] Metric cards in `AccountingDashboard.tsx` (Cash vs Accrual, MTD Net Margin, MTD Revenue).
  - [ ] `ModuleStatCards` in `CashFlowForecastTab.tsx` (Cash runway, net burns).
  - [ ] `ModuleStatCards` in `TaxEstimatorTab.tsx` (Estimated taxes, deductions).
- [ ] **Charts, Funnels, or Progress Bars**
  - [ ] Recharts `RevenueChart` / line/bar graphs in `AccountingDashboard.tsx` and `InvoicingDashboard`.
  - [ ] Progress bars for cash goals and budget progression in `ExpenseTrackerTab.tsx`.
  - [ ] Forecast curve in `CashFlowForecastTab.tsx`.
- [ ] **Status/Priority Lists**
  - [ ] Invoices list with status badges (`Paid`, `Unpaid`, `Overdue`, `Draft`) in `EnhancedBillingPage.tsx`.
  - [ ] Expenses list with approval status badges (`Approved`, `Pending`, `Rejected`) in `ExpenseTrackerTab.tsx`.
  - [ ] Quotes list with status badges (`Accepted`, `Draft`, `Sent`, `Expired`, `Rejected`) in `QuotesTab.tsx`.
  - [ ] Bills list with payable status in `BillsPayablePage.tsx`.
- [ ] **Social/Platform Icons**
  - [ ] Payment gateway logos (Stripe, Paypal) and banking sync identifiers.

---

## 5. Insights Hub
Routes under `/dashboard/executive`, `/dashboard/analytics`, `/dashboard/performance`, `/dashboard/business/reports`.

- [ ] **Stat/Metric Cards**
  - [ ] `<MetricCard>` in `ExecutiveDashboard.tsx` (Client Retention, ARR/MRR, Margin, NPS).
  - [ ] Local `<MetricCard>` in `ReportsPage.tsx` (Report summary parameters).
  - [ ] Metric cards in `BusinessPerformanceDashboard.tsx` (Platform health, API latencies, worker performance).
- [ ] **Charts, Funnels, or Progress Bars**
  - [ ] Complex multi-series line and bar charts in `ExecutiveDashboard.tsx` and `AnalyticsTab.tsx`.
  - [ ] Performance and conversion breakdown charts in `BusinessPerformanceDashboard.tsx`.
  - [ ] Report comparison charts in `ReportsPage.tsx`.
- [ ] **Status/Priority Lists**
  - [ ] KPI performance lists and targets checkmarks.
- [ ] **Social/Platform Icons**
  - [ ] None.

---

## 6. Documents Hub
Routes under `/dashboard/business/documents`, `/dashboard/business/vault`, `/dashboard/business/contracts`, `/dashboard/business/projects`, `/dashboard/business/onboarding`.

- [ ] **Stat/Metric Cards**
  - [ ] `ModuleStatCards` in `DocumentVaultTab.tsx` (Storage stats, total folders, total files, security audits).
  - [ ] `ModuleStatCards` in `ClientOnboardingTab.tsx` (Onboarding counts, pending, active, completed).
  - [ ] Metric cards in `ContractsDashboard` (Contract execution stats).
  - [ ] Metric cards in `ProjectsDashboard` (Operational velocity, weekly task completion).
- [ ] **Charts, Funnels, or Progress Bars**
  - [ ] File type donut chart and storage limit progress bars in `DocumentVaultTab.tsx`.
  - [ ] Onboarding progress step indicator bars in `ClientOnboardingTab.tsx`.
  - [ ] Project gantt/timeline charts in `ProjectsPage.tsx`.
- [ ] **Status/Priority Lists**
  - [ ] Active project lists with priority level, status, and health badges in `ProjectsPage.tsx` and `ProjectsTab.tsx`.
  - [ ] Contracts list with execution and signature states in `ContractDashboard.tsx`.
  - [ ] Client onboarding checklist items with status checkboxes.
- [ ] **Social/Platform Icons**
  - [ ] File type icons (PDF, Word, Excel, ZIP) and document sync markers.

---

## 7. Channels
Routes under `/dashboard/business/tickets`, `/dashboard/business/messages`, `/dashboard/business/whatsapp`, `/dashboard/business/facebook`, `/dashboard/business/instagram`, `/dashboard/business/linkedin`, `/dashboard/business/x`, `/dashboard/zoho/crm`, `/dashboard/zoho/mail`, `/dashboard/business/unified-inbox`.

- [ ] **Stat/Metric Cards**
  - [ ] `ModuleStatCards` in `DeepDeskView.tsx` (Ticket stats: Open, Unassigned, Escalated, SLA breaches).
  - [ ] `ModuleStatCards` in `UnifiedInboxView.tsx` (Mail sync metrics, unread, resolved).
- [ ] **Charts, Funnels, or Progress Bars**
  - [ ] SLA breach timer progression bars in ticket detail panels.
- [ ] **Status/Priority Lists**
  - [ ] Support tickets lists with priority levels (`High`, `Medium`, `Low` with custom status colors) and status badges (`Open`, `In Progress`, `Resolved`, `Closed`).
  - [ ] Inbox threads and conversation lists with status pills.
- [ ] **Social/Platform Icons**
  - [ ] Messaging channel platform indicators: WhatsApp, Facebook Messenger, Instagram DM, LinkedIn Message, Twitter Direct, Microsoft Mail, Zoho.

---

## 8. Automation
Routes under `/dashboard/business/workflows` and `/dashboard/automations`.

- [ ] **Stat/Metric Cards**
  - [ ] `ModuleStatCards` in `WorkflowDashboard.tsx` (Total runs, success rates, active flows, execution time).
- [ ] **Charts, Funnels, or Progress Bars**
  - [ ] Success/Failure rate charts and run timeline charts.
- [ ] **Status/Priority Lists**
  - [ ] Workflow execution logs list with run status indicators (success, failed, retrying, skipped).
- [ ] **Social/Platform Icons**
  - [ ] Integrations trigger icons (Zapier, Webhook, Email, Stripe, Slack, etc.).

---

## 9. Reports
Routes under `/dashboard/business/reports` and `/dashboard/crm/reports`.

- [ ] **Stat/Metric Cards**
  - [ ] Custom report parameter metrics cards.
- [ ] **Charts, Funnels, or Progress Bars**
  - [ ] Interactive report charts (bar/line/pie).
- [ ] **Status/Priority Lists**
  - [ ] Generated reports list with status badges (running, completed, failed).
- [ ] **Social/Platform Icons**
  - [ ] Export format icons (PDF, CSV, Excel).
