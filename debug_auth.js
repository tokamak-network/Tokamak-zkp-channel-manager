#!/usr/bin/env node

// Debug authentication flow with the FROST DKG server
const WebSocket = require('ws');
const { keccak256 } = require('js-sha3');
const elliptic = require('elliptic');

const ec = new elliptic.ec('secp256k1');

// Your public key from session creation
const PUBLIC_KEY = '0378e763c6946e9e4e392a4508de623d78a7061beccb10fa1d5f5d70f8f91ceff8';

// Test private key (you'll need to provide this from your client)
// This should be the private key that corresponds to the public key above
const PRIVATE_KEY = 'REPLACE_WITH_YOUR_PRIVATE_KEY'; // Get this from your browser console

console.log('🔧 FROST DKG Authentication Debug Tool');
console.log('📝 Public Key:', PUBLIC_KEY);

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
            authenticateWithServer();
            break;
            
        case 'LoginOk':
            console.log('✅ Authentication successful!');
            console.log('👤 User ID:', message.payload.user_id);
            console.log('🔑 Access Token:', message.payload.access_token);
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

function authenticateWithServer() {
    if (PRIVATE_KEY === 'REPLACE_WITH_YOUR_PRIVATE_KEY') {
        console.error('❌ Please replace PRIVATE_KEY with your actual private key from the browser');
        ws.close();
        return;
    }
    
    console.log('🔐 Starting authentication...');
    
    // Parse UUID and get bytes (same logic as client)
    const uuidBytes = new Uint8Array(16);
    const uuid = authState.uuid.replace(/-/g, '');
    for (let i = 0; i < 16; i++) {
        uuidBytes[i] = parseInt(uuid.substring(i * 2, i * 2 + 2), 16);
    }
    
    console.log('🔍 UUID bytes (hex):', Array.from(uuidBytes).map(b => b.toString(16).padStart(2, '0')).join(''));
    
    // Compute Keccak256 digest
    const digest = keccak256(uuidBytes);
    console.log('🔍 Keccak256 digest:', '0x' + digest);
    
    // Sign with private key
    const keyPair = ec.keyFromPrivate(PRIVATE_KEY, 'hex');
    const digestBytes = Buffer.from(digest, 'hex');
    
    const signature = keyPair.sign(digestBytes);
    
    // Ensure canonical signature (low-s form)
    const n = ec.curve.n;
    let s = signature.s;
    if (s.gt(n.shln(1))) {
        s = n.sub(s);
        console.log('🔍 Signature normalized to canonical form');
    }
    
    // Convert to compact format
    const r = signature.r.toString(16).padStart(64, '0');
    const sHex = s.toString(16).padStart(64, '0');
    const signatureHex = r + sHex;
    
    console.log('🔍 Final signature:', signatureHex);
    
    // Verify locally
    const normalizedSig = { r: signature.r, s: s };
    const isValid = keyPair.verify(digestBytes, normalizedSig);
    console.log('✅ Local verification:', isValid ? 'VALID' : 'INVALID');
    
    // Send login message
    const loginMessage = {
        type: 'Login',
        payload: {
            challenge: authState.uuid,
            pubkey_hex: PUBLIC_KEY,
            signature_hex: signatureHex
        }
    };
    
    console.log('📤 Sending login message...');
    ws.send(JSON.stringify(loginMessage));
}