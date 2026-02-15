const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load .env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    console.log('📝 Loading .env from:', envPath);
    dotenv.config();
} else {
    console.warn('⚠️ No .env file found at:', envPath);
}

const KEYS = {
    ANTHROPIC: process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY,
    OPENAI: process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY,
    GEMINI: process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || process.env.GOOGLE_API_KEY
};

async function testAnthropic() {
    if (!KEYS.ANTHROPIC) {
        console.log('⚪ Anthropic: Not configured (missing ANTHROPIC_API_KEY)');
        return;
    }

    console.log('🔍 Testing Anthropic...');
    try {
        const anthropic = new Anthropic({ apiKey: KEYS.ANTHROPIC });
        const message = await anthropic.messages.create({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Say "Anthropic OK"' }],
        });
        console.log('✅ Anthropic: Success!', message.content[0].text);
    } catch (error) {
        console.error('❌ Anthropic: Failed!', error.message);
    }
}

async function testOpenAI() {
    if (!KEYS.OPENAI) {
        console.log('⚪ OpenAI: Not configured (missing OPENAI_API_KEY)');
        return;
    }

    console.log('🔍 Testing OpenAI...');
    try {
        const openai = new OpenAI({ apiKey: KEYS.OPENAI });
        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: 'Say "OpenAI OK"' }],
            max_tokens: 10,
        });
        console.log('✅ OpenAI: Success!', completion.choices[0].message.content);
    } catch (error) {
        console.error('❌ OpenAI: Failed!', error.message);
    }
}

async function testGemini() {
    if (!KEYS.GEMINI) {
        console.log('⚪ Gemini: Not configured (missing VITE_GEMINI_API_KEY or GOOGLE_AI_KEY)');
        return;
    }

    console.log('🔍 Testing Gemini...');
    try {
        const genAI = new GoogleGenerativeAI(KEYS.GEMINI);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent('Say "Gemini OK"');
        console.log('✅ Gemini: Success!', result.response.text());
    } catch (error) {
        console.error('❌ Gemini: Failed!', error.message);
    }
}

async function runTests() {
    console.log('\n--- AI SERVICE DIAGNOSTICS ---\n');
    console.log('Configuration Status:');
    console.log('- Anthropic Key:', KEYS.ANTHROPIC ? 'PRESENT' : 'MISSING');
    console.log('- OpenAI Key:', KEYS.OPENAI ? 'PRESENT' : 'MISSING');
    console.log('- Gemini/Google Key:', KEYS.GEMINI ? 'PRESENT' : 'MISSING');
    console.log('\nStarting Tests...\n');

    await testAnthropic();
    await testOpenAI();
    await testGemini();

    console.log('\n--- DIAGNOSTICS COMPLETE ---\n');
}

runTests().catch(console.error);
