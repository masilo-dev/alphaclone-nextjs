import { expenseService } from './ExpenseService';
import { generateText } from '../unifiedAIService';


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
            const { text: jsonString } = await generateText(prompt, 500);
            if (!jsonString) throw new Error('AI returned no response for expense parsing.');
            const parsed = JSON.parse(jsonString.replace(/```json|```/g, '').trim());

            if (!parsed.description || !parsed.amount) {
                throw new Error('Could not extract required expense fields from raw data.');
            }

            return await expenseService.createExpense(
                params.tenantId,
                params.userId,
                {
                    description: parsed.description,
                    amount: parsed.amount,
                    category_id: undefined, // AI-parsed; no category ID lookup at this stage
                    date: parsed.date || new Date().toISOString().split('T')[0],
                    notes: `AI-parsed from: "${params.rawData.slice(0, 120)}"`,
                }
            );
        } catch (err) {
            console.error('[automatedExpenseService] Failed to automate expense:', err);
            throw err;
        }
    }
};
