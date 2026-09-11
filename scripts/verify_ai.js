
async function checkRoute(path) {
    try {
        const res = await fetch(`http://localhost:3000${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: 'test' })
        });
        console.log(`${path}: ${res.status}`);
    } catch (e) {
        console.log(`${path}: Error - ${e.message}`);
    }
}

async function main() {
    console.log('Checking AI routes...');
    await checkRoute('/api/ai/generate');
    await checkRoute('/api/ai/chat');
    await checkRoute('/api/ai/leads');
    await checkRoute('/api/ai/stream');
    await checkRoute('/api/test'); // Check test route
}

main();
