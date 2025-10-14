#!/usr/bin/env node

// Debug session creation to ensure roster is populated correctly
const WebSocket = require('ws');

const PUBLIC_KEY = '0378e763c6946e9e4e392a4508de623d78a7061beccb10fa1d5f5d70f8f91ceff8';

console.log('🔧 FROST DKG Session Creation Debug Tool');
console.log('📝 Testing with Public Key:', PUBLIC_KEY);

const ws = new WebSocket('ws://127.0.0.1:9000/ws');

ws.on('open', () => {
    console.log('✅ WebSocket connected');
    createTestSession();
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());
        console.log('📨 Received:', JSON.stringify(message, null, 2));
        handleMessage(message);
    } catch (err) {
        console.error('❌ Failed to parse message:', err);
    }
});

ws.on('close', (code, reason) => {
    console.log('🔌 Connection closed:', code, reason.toString());
});

ws.on('error', (err) => {
    console.error('❌ WebSocket error:', err);
});

function createTestSession() {
    console.log('📤 Creating test session...');
    
    const message = {
        type: 'AnnounceSession',
        payload: {
            min_signers: 2,
            max_signers: 3,
            group_id: 'test_group_' + Date.now(),
            participants: [1, 2, 3], // UIDs
            participants_pubs: [
                [1, PUBLIC_KEY],    // Your public key with UID 1
                [2, '02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9'],  // Dummy key 2
                [3, '03dff1d77f2a671c5f36183726db2341be58feae1da2deced843240f7b502ba659']   // Dummy key 3
            ]
        }
    };
    
    console.log('📤 Session message:', JSON.stringify(message, null, 2));
    ws.send(JSON.stringify(message));
}

function handleMessage(message) {
    switch (message.type) {
        case 'SessionCreated':
            console.log('✅ Session created successfully!');
            console.log('📋 Session ID:', message.payload.session);
            console.log('🎯 Your public key should now be registered in server roster');
            ws.close();
            break;
            
        case 'Error':
            console.error('❌ Session creation error:', message.payload.message);
            ws.close();
            break;
            
        default:
            console.log('📨 Other message:', message);
    }
}