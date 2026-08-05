/**
 * Client Churn Risk & Retention Health Service
 * Evaluates client health scores (0-100%) based on interaction recency, invoice payment history, and contract expiration dates.
 */

export type RiskLevel = 'Healthy' | 'Moderate Risk' | 'High Churn Risk';

export interface ClientHealthRecord {
  id: string;
  name: string;
  company: string;
  healthScore: number;
  riskLevel: RiskLevel;
  lastActiveDaysAgo: number;
  unpaidInvoiceRatio: number;
  contractExpiringDays: number;
  recommendedAction: string;
}

export const churnRadarService = {
  getMockClientHealthRecords(): ClientHealthRecord[] {
    return [
      {
        id: 'c1',
        name: 'Alex Turner',
        company: 'Vanguard Retail Corp',
        healthScore: 28,
        riskLevel: 'High Churn Risk',
        lastActiveDaysAgo: 45,
        unpaidInvoiceRatio: 0.65,
        contractExpiringDays: 14,
        recommendedAction: 'Schedule Urgent Executive Health Check Call & Offer 10% Renewal Incentive',
      },
      {
        id: 'c2',
        name: 'Sarah Connor',
        company: 'Cyberdyne Systems',
        healthScore: 54,
        riskLevel: 'Moderate Risk',
        lastActiveDaysAgo: 18,
        unpaidInvoiceRatio: 0.25,
        contractExpiringDays: 45,
        recommendedAction: 'Send Invoice Payment Reminder & Share Product Roadmap Update',
      },
      {
        id: 'c3',
        name: 'Marcus Vance',
        company: 'Nexus Tech Global',
        healthScore: 92,
        riskLevel: 'Healthy',
        lastActiveDaysAgo: 2,
        unpaidInvoiceRatio: 0.0,
        contractExpiringDays: 180,
        recommendedAction: 'Pitch Upsell Opportunity for Enterprise AI Module Extension',
      },
      {
        id: 'c4',
        name: 'Elena Rostova',
        company: 'Aero Dynamics LLC',
        healthScore: 35,
        riskLevel: 'High Churn Risk',
        lastActiveDaysAgo: 32,
        unpaidInvoiceRatio: 0.40,
        contractExpiringDays: 22,
        recommendedAction: 'Initiate Account Executive Outreach via WhatsApp & Email Drip',
      },
    ];
  },

  calculateScore(lastActiveDaysAgo: number, unpaidInvoiceRatio: number, contractExpiringDays: number): { score: number; risk: RiskLevel } {
    let score = 100;
    if (lastActiveDaysAgo > 30) score -= 30;
    else if (lastActiveDaysAgo > 14) score -= 15;

    score -= Math.round(unpaidInvoiceRatio * 40);

    if (contractExpiringDays < 30) score -= 25;

    score = Math.max(0, Math.min(100, score));

    let risk: RiskLevel = 'Healthy';
    if (score < 40) risk = 'High Churn Risk';
    else if (score < 70) risk = 'Moderate Risk';

    return { score, risk };
  },
};
