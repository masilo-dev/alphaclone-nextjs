/**
 * Human-readable labels — single source for plain-language business copy.
 * Maps jargon → language a solo founder understands.
 */

export const HUMAN_LABELS = {
  // Sales & CRM
  pipelineIntegrity: 'Deals that might stall',
  leadQualificationMatrix: 'People ready to buy',
  lifecycleProgression: 'Where each customer is in the journey',
  salesForecast: 'Expected sales this month',
  dealPipeline: 'Active deals',
  churnPropensity: 'Customers at risk of leaving',

  // Money
  overdueAR: 'Money waiting to be collected',
  accountsReceivable: 'Money customers owe you',
  accountsPayable: 'Bills you need to pay',
  revenueEfficiencyRatio: 'How well you convert work to income',
  periodClose: 'Month-end wrap-up',
  chartOfAccounts: 'Account categories (advanced)',
  trialBalance: 'Account balances check (advanced)',
  generalLedger: 'Full money record (advanced)',

  // Marketing
  automationConfidenceIndex: 'How reliable your automations are',
  deliverability: 'Email delivery health',
  campaignPerformance: 'How your campaigns are doing',

  // Operations
  pipelineIntegrityScore: 'Overall business flow health',
  taskBacklog: 'Tasks you should finish today',
  pendingApprovals: 'Bonnie actions waiting for your OK',
  actionQueue: 'Needs your attention today',

  // Hub names
  salesHub: 'Sales',
  marketingHub: 'Marketing',
  moneyHub: 'Money',
  insightsHub: 'Insights',
  documentsHub: 'Files',
  channelsHub: 'Communication',
  scheduleHub: 'Schedule',

  // Dashboard sections
  needsAttention: 'Needs your attention',
  whatBonnieDid: "Bonnie's recent work",
  todaysWork: "Today's work",
  moneySnapshot: 'Money overview',
  businessHealth: 'Business health',
  recentWins: 'Recent wins',

  // Document quality
  documentQualityScore: 'Ready to send score',
  missingPaymentDetails: 'Payment details missing',
  missingLogo: 'Company logo missing',

  // Communication
  needsResponse: 'Customers waiting for reply',
  unansweredMessages: 'Messages needing a reply',
  draftReady: 'Drafts ready to send',
} as const;

export type HumanLabelKey = keyof typeof HUMAN_LABELS;

/** Resolve a jargon key or return the input if no mapping exists. */
export function humanLabel(key: HumanLabelKey | string): string {
  if (key in HUMAN_LABELS) {
    return HUMAN_LABELS[key as HumanLabelKey];
  }
  return key;
}

/** Replace known jargon strings in display text. */
export function translateJargon(text: string): string {
  let result = text;
  for (const [key, label] of Object.entries(HUMAN_LABELS)) {
    const pattern = new RegExp(key.replace(/([A-Z])/g, ' $1').trim(), 'gi');
    if (pattern.test(result)) {
      result = result.replace(pattern, label);
    }
  }
  return result;
}

/** Metric label overrides for dashboard stat cards. */
export const METRIC_LABEL_OVERRIDES: Record<string, string> = {
  'Overdue AR': HUMAN_LABELS.overdueAR,
  'Accounts Receivable': HUMAN_LABELS.accountsReceivable,
  'Accounts Payable': HUMAN_LABELS.accountsPayable,
  'Pipeline Value': 'Total deal value',
  'Win Rate': 'Deals you close',
  'Open Tasks': HUMAN_LABELS.taskBacklog,
  'Pending Approvals': HUMAN_LABELS.pendingApprovals,
  'Deliverability Score': HUMAN_LABELS.deliverability,
  'Revenue MTD': 'Money earned this month',
  'Outstanding Invoices': HUMAN_LABELS.overdueAR,
  'Active Deals': HUMAN_LABELS.dealPipeline,
  'Churn Risk': HUMAN_LABELS.churnPropensity,
};

export function metricLabel(original: string): string {
  return METRIC_LABEL_OVERRIDES[original] ?? original;
}
