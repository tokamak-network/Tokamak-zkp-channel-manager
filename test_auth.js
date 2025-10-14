#!/usr/bin/env node

// Test authentication with the exact parameters from browser logs
const WebSocket = require('ws');
const { keccak256 } = require('js-sha3');
const elliptic = require('elliptic');

const ec = new elliptic.ec('secp256k1');

// From your browser logs
const PUBLIC_KEY = '0378e763c6946e9e4e392a4508de623d78a7061beccb10fa1d5f5d70f8f91ceff8';
const PRIVATE_KEY_PREFIX = '75e41f29650ac0cd'; // You need to provide the full key

console.log('🔧 FROST DKG Authentication Test');
console.log('📝 Public Key:', PUBLIC_KEY);
console.log('📝 Private Key Prefix:', PRIVATE_KEY_PREFIX + '...');

// For now, let's test with a different approach
// Let's recreate the exact same auth flow and see what the server logs show

const ws = new WebSocket('ws://127.0.0.1:9000/ws');

let authState = {
    challenge: null,
    uuid: null
};

ws.on('open', () => {
    console.log('✅ WebSocket connected');
    requestChallenge();
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());
        console.log('📨 Received:', message);
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

function requestChallenge() {
    console.log('📤 Requesting challenge...');
    const message = { type: 'RequestChallenge' };
    ws.send(JSON.stringify(message));
}

function handleMessage(message) {
    switch (message.type) {
        case 'Challenge':
            authState.challenge = message.payload.challenge;
            authState.uuid = message.payload.challenge;
            console.log('🎯 Challenge received:', authState.uuid);
            
            // Test with a known working signature format
            testAuthenticationWithDummySignature();
            break;
            
        case 'LoginOk':
            console.log('✅ Authentication successful!');
            console.log('👤 User ID:', message.payload.user_id);
            ws.close();
            break;
            
        case 'Error':
            console.error('❌ Server error:', message.payload.message);
            ws.close();
            break;
            
        default:
            console.log('📨 Other message:', message);
    }
}

function testAuthenticationWithDummySignature() {
    console.log('🔐 Testing authentication with dummy signature...');
    
    // Send authentication with a dummy signature to see what server logs show
    const loginMessage = {
        type: 'Login',
        payload: {
            challenge: authState.uuid,
            pubkey_hex: PUBLIC_KEY,
            signature_hex: '0'.repeat(128) // Dummy signature to test error path
        }
    };
    
    console.log('📤 Sending login with dummy signature...');
    ws.send(JSON.stringify(loginMessage));
}