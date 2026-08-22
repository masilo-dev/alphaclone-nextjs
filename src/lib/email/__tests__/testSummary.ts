import { dailyBusinessSummaryService } from '@/services/dailyBusinessSummaryService';
import { formatDailyBusinessSummaryHtml, formatDailyBusinessSummaryText } from '@/lib/email/runDailyBusinessSummaryEmails';

async function test() {
    console.log('Testing daily business summary service...');
    try {
        const dummySummary = await dailyBusinessSummaryService.getDailySummary('00000000-0000-0000-0000-000000000000');
        console.log('Summary generated successfully:', {
            tenantName: dummySummary.tenantName,
            atAGlance: dummySummary.atAGlance,
            needsYourAttentionCount: dummySummary.needsYourAttention.length,
            isQuietDay: dummySummary.isQuietDay
        });

        const html = formatDailyBusinessSummaryHtml(dummySummary, 'https://alphaclonesystems.com');
        const text = formatDailyBusinessSummaryText(dummySummary, 'https://alphaclonesystems.com');
        console.log('HTML rendered length:', html.length);
        console.log('Text rendered length:', text.length);
        console.log('TEST SUCCESS!');
    } catch (err) {
        console.error('Test failed:', err);
    }
}

test();
