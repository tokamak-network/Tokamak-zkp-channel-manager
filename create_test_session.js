#!/usr/bin/env node

// Create a test session and show the session ID for joining
const WebSocket = require('ws');

const PUBLIC_KEY = '0378e763c6946e9e4e392a4508de623d78a7061beccb10fa1d5f5d70f8f91ceff8';

console.log('🔧 Creating Test Session for Joining');

const ws = new WebSocket('ws://127.0.0.1:9000/ws');

ws.on('open', () => {
    console.log('✅ WebSocket connected');
    
    const message = {
        type: 'AnnounceDKGSession',
        payload: {
            min_signers: 2,
            max_signers: 3,
            group_id: 'test_join_group_' + Date.now(),
            participants: [1, 2, 3],
            participants_pubs: [
                [1, PUBLIC_KEY],
                [2, '02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9'],
                [3, '03dff1d77f2a671c5f36183726db2341be58feae1da2deced843240f7b502ba659']
            ]
        }
    };
    
    console.log('📤 Creating session...');
    ws.send(JSON.stringify(message));
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());
        console.log('📨 Received:', message);
        
        if (message.type === 'DKGSessionCreated') {
            console.log('\n🎯 SESSION CREATED SUCCESSFULLY!');
            console.log('📋 Session ID to join:', message.payload.session);
            console.log('\n💡 Now you can join this session in your UI with ID:');
            console.log('   ', message.payload.session);
            ws.close();
        } else if (message.type === 'Error') {
            console.error('❌ Session creation error:', message.payload.message);
            ws.close();
        }
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