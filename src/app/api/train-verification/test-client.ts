/**
 * Test client for the train verification WebSocket API
 * 
 * Run with: npx ts-node src/app/api/train-verification/test-client.ts
 */

import WebSocket from 'ws';

const WS_URL = process.env.WS_URL || 'ws://localhost:3000/api/train-verification/ws';

console.log(`Connecting to ${WS_URL}...`);

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
    console.log('✅ Connected to WebSocket server');

    // Step 1: Send init message
    console.log('\n📤 Sending init message...');
    ws.send(JSON.stringify({
        type: 'init',
        clientId: 'test-client-001',
        trainId: '1', // Example train ID (IC 1 Helsinki-Oulu)
    }));
});

ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('\n📥 Received:', JSON.stringify(message, null, 2));

    // After receiving session confirmation, send a location update
    if (message.type === 'verification_status' && message.status === 'awaiting_location') {
        setTimeout(() => {
            console.log('\n📤 Sending location update...');
            ws.send(JSON.stringify({
                type: 'location_update',
                location: {
                    lat: 60.1699, // Helsinki coordinates (example)
                    lng: 24.9384,
                    accuracy: 10,
                    timestamp: Date.now(),
                },
            }));
        }, 1000);
    }

    // Send ping after verification starts
    if (message.type === 'verification_status' && message.status === 'verifying') {
        setTimeout(() => {
            console.log('\n📤 Sending ping...');
            ws.send(JSON.stringify({ type: 'ping' }));
        }, 1000);
    }
});

ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
});

ws.on('close', (code, reason) => {
    console.log(`\n🔌 Connection closed: ${code} - ${reason || 'No reason'}`);
});

// Keep the process running for 30 seconds
setTimeout(() => {
    console.log('\n⏰ Test timeout - closing connection');
    ws.close();
    process.exit(0);
}, 30000);

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log('\n\n👋 Closing connection...');
    ws.close();
    process.exit(0);
});
