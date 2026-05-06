import { ExpenseService } from './ExpenseService';
import { unifiedAIService } from '../unifiedAIService';

export const automatedExpenseService = {
    /**
     * AI-Powered Expense Entry
     * Parses raw description or receipt text into a structured expense.
     */
    async automateExpense(params: {
        tenantId: string;
        userId: string;
        rawData: string;
    }) {
        const prompt = `You are a financial accounting assistant.
        Extract the following fields from the provided receipt text or purchase description:
        - description (vendor/item)
        - amount (number)
        - category (Office Supplies | Travel | Software | Marketing | Meals | Utilities | Other)
        - date (YYYY-MM-DD, default to today if not clear)

        RAW DATA: "${params.rawData}"

        Return ONLY a JSON object with these fields.`;

        try {
            const { text: jsonString } = await unifiedAIService.generateText(prompt, 500);
            const parsed = JSON.parse(jsonString.replace(/```json|```/g, '').trim());

            if (!parsed.description || !parsed.amount) {
                throw new Error('Could not extract required expense fields from raw data.');
            }

            const expenseService = new ExpenseService();
            return await expenseService.createExpense({
                tenant_id: params.tenantId,
                description: parsed.description,
                amount: parsed.amount,
                category: parsed.category || 'Other',
                date: parsed.date || new Date().toISOString().split('T')[0],
                status: 'pending'
            });
        } catch (err) {
            console.error('[automatedExpenseService] Failed to automate expense:', err);
            throw err;
        }
    }
};
