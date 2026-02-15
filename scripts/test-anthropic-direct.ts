
import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env from root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const apiKey = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;

if (!apiKey) {
    console.error("❌ No Anthropic API Key found in .env");
    process.exit(1);
}

console.log(`✅ Found API Key: ${apiKey.substring(0, 8)}...`);

const anthropic = new Anthropic({
    apiKey: apiKey,
});

async function testAnthropic() {
    const modelsToCheck = [
        'claude-3-5-sonnet-20241022',
        'claude-3-opus-20240229',
        'claude-3-haiku-20240307'
    ];

    for (const model of modelsToCheck) {
        console.log(`\nTesting model: ${model}...`);
        try {
            const message = await anthropic.messages.create({
                model: model,
                max_tokens: 100,
                messages: [
                    { role: "user", content: "Hello, just say 'Working'." }
                ]
            });
            console.log(`✅ ${model} Success: ${message.content[0].type === 'text' ? message.content[0].text : 'Non-text response'}`);
        } catch (error: any) {
            console.error(`❌ ${model} Failed:`, error.message);
            if (error.status === 404) {
                console.error("   (Model not found or not available to this key)");
            } else if (error.status === 401) {
                console.error("   (Unauthorized - Invalid Key)");
            }
        }
    }
}

testAnthropic();
