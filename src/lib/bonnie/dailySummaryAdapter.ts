import { dailyBusinessSummaryService, type DailyBusinessSummary } from '@/services/dailyBusinessSummaryService';

export class BonnieDailySummaryAdapter {
    /**
     * Retrieves the exact same reconciled end-of-day business summary for Bonnie AI context.
     * Ensures rule compliance: "Bonnie must use the exact same data source as the email generator."
     */
    async getDailySummaryForBonnie(tenantId: string, dateStr?: string): Promise<{
        textSummary: string;
        rawSummary: DailyBusinessSummary;
    }> {
        const summary = await dailyBusinessSummaryService.getDailySummary(tenantId, dateStr);

        let text = `Daily Business Summary for ${summary.tenantName} (${summary.date}):\n`;
        text += `- Actions Completed Today: ${summary.atAGlance.actionsCompleted}\n`;
        text += `- New Leads: ${summary.sales.leadsAdded}\n`;
        text += `- Proposals Sent: ${summary.sales.proposalsSent} (Accepted: ${summary.sales.proposalsAccepted.length})\n`;
        text += `- Invoices Issued: ${summary.invoicesAndMoney.created.length}\n`;
        text += `- Payments Received: ${summary.invoicesAndMoney.paymentsReceived.length}\n`;
        text += `- Operational Failures: ${summary.failures.length}\n`;
        text += `- Overdue / SLA Breached Emails: ${summary.emailSlaBreached.length}\n`;
        text += `- Outstanding Actions Needing Attention: ${summary.needsYourAttention.length}\n`;

        if (summary.needsYourAttention.length > 0) {
            text += `\nTop Needs Attention Items:\n`;
            summary.needsYourAttention.forEach((item, idx) => {
                text += `${idx + 1}. [${item.urgency.toUpperCase()}] ${item.title} -> ${item.actionRequired}\n`;
            });
        }

        return {
            textSummary: text,
            rawSummary: summary
        };
    }
}

export const bonnieDailySummaryAdapter = new BonnieDailySummaryAdapter();
