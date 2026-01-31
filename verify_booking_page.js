
const testUrl = 'http://localhost:3000/book/test-tenant-verify/test-service';

async function verifyPage() {
    try {
        console.log(`Checking URL: ${testUrl}`);
        const res = await fetch(testUrl);
        console.log(`Status: ${res.status}`);
        if (res.status === 200) {
            console.log('SUCCESS: Page is reachable.');
            const text = await res.text();
            if (text.includes('Test Service')) {
                console.log('SUCCESS: Page content contains "Test Service".');
            } else {
                console.log('WARNING: Page reachable but "Test Service" text not found in response (might be client-side rendered mostly).');
            }
        } else {
            console.error('FAILURE: Page returned non-200 status.');
        }
    } catch (err) {
        console.error('FAILURE: Connection refused or network error.', err);
    }
}

verifyPage();
