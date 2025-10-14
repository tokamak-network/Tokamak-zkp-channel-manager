#!/usr/bin/env node

// Simple connection test
const WebSocket = require('ws');

console.log('🔧 Simple WebSocket Connection Test');

const ws = new WebSocket('ws://127.0.0.1:9000/ws');

ws.on('open', () => {
    console.log('✅ WebSocket connected successfully');
    
    // Send a simple ping message
    const message = { type: 'RequestChallenge' };
    console.log('📤 Sending RequestChallenge...');
    ws.send(JSON.stringify(message));
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());
        console.log('📨 Received:', message);
        
        if (message.type === 'Challenge') {
            console.log('✅ Challenge received successfully!');
            console.log('🎯 UUID:', message.payload.challenge);
        }
        
        ws.close();
    } catch (err) {
        console.error('❌ Failed to parse message:', err);
    }
});

ws.on('close', (code, reason) => {
    console.log('🔌 Connection closed:', code, reason.toString());
    console.log('Exit status:', code === 1000 ? 'Normal' : 'Unexpected');
});

ws.on('error', (err) => {
    console.error('❌ WebSocket error:', err);
});

setTimeout(() => {
    console.log('⏰ Timeout - closing connection');
    ws.close();
}, 5000);