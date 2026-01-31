
const fetch = require('node-fetch'); // Assuming node-fetch or global fetch in Node 18+

// If node < 18, we might need to rely on the fact Next.js project usually has node > 18.
// We'll trust global fetch or mock it if needed but Node 20+ has fetch.

async function testBooking() {
    const url = 'http://localhost:3000/api/booking/create';

    // We need the booking_type_id. I will replace it with the one I get from SQL output if needed, 
    // but for now I'll use a placeholder and hope Step 222 gives it to me so I can edit this file?
    // No, I can't edit in same turn.
    // I need the ID.
    // I'll make this script accept the ID as an arg.

    const bookingTypeId = process.argv[2];
    if (!bookingTypeId) {
        console.error('Usage: node verify_booking_api.js <booking_type_id>');
        process.exit(1);
    }

    const payload = {
        tenant_id: '6d1a7baa-c26d-48b8-9e9f-1df07c3189d4', // Test Tenant
        booking_type_id: bookingTypeId,
        booking_type_name: 'Test Service Verification',
        client_name: 'Verification Bot',
        client_email: 'test-verification@example.com',
        client_phone: '1234567890',
        client_notes: 'Checking API logic',
        start_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        end_time: new Date(Date.now() + 86400000 + 1800000).toISOString(), // +30 mins
        time_zone: 'UTC'
    };

    try {
        console.log('Sending payload:', JSON.stringify(payload, null, 2));
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.text();
            console.error('API Error:', res.status, err);
        } else {
            const data = await res.json();
            console.log('Success:', data);
        }
    } catch (e) {
        console.error('Network Error:', e);
    }
}

testBooking();
