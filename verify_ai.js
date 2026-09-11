// using native fetch


const BASE_URL = 'http://localhost:3000';

async function testEndpoint(name, url, method = 'POST', body = {}) {
    console.log(`Testing ${name}...`);
    try {
        const response = await fetch(`${BASE_URL}${url}`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (response.ok) {
            console.log(`✅ ${name} passed (Status: ${response.status})`);
            const data = await response.json();
            console.log('Response:', JSON.stringify(data).slice(0, 100) + '...');
        } else {
            console.error(`❌ ${name} failed (Status: ${response.status})`);
            const text = await response.text();
            console.error('Error:', text.slice(0, 200));
        }
    } catch (error) {
        console.error(`❌ ${name} error:`, error.message);
    }
    console.log('---');
}

async function run() {
    console.log('Starting AI API Verification...\n');

    // Test Generate
    await testEndpoint('Generate API', '/api/ai/generate', 'POST', {
        prompt: 'Say hello',
        model: 'gpt-3.5-turbo'
    });

    // Test Chat
    await testEndpoint('Chat API', '/api/ai/chat', 'POST', {
        message: 'Hello',
        history: []
    });

    // Test Complete
    await testEndpoint('Complete API', '/api/ai/complete', 'POST', {
        prompt: 'Once upon a time',
        model: 'gpt-3.5-turbo'
    });

    console.log('\nVerification Complete.');
}

run();
