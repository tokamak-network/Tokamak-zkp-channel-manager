#!/usr/bin/env node

// Test double authentication to reproduce the bug
const WebSocket = require('ws');
const { keccak256 } = require('js-sha3');
const elliptic = require('elliptic');

const ec = new elliptic.ec('secp256k1');

const PUBLIC_KEY = '0378e763c6946e9e4e392a4508de623d78a7061beccb10fa1d5f5d70f8f91ceff8';
const PRIVATE_KEY = '75e41f29650ac0cd4c7bf0c8a48ab9b9e6a8456b2a5b7c3d8f9e0a1b2c3d4e5f'; // Example - replace with actual

console.log('🔧 Testing Double Authentication Bug');

let authCount = 0;

function testAuthentication() {
    authCount++;
    console.log(`\n=== Authentication Test #${authCount} ===`);
    
    const ws = new WebSocket('ws://127.0.0.1:9000/ws');
    
    let authState = { challenge: null, uuid: null };
    
    ws.on('open', () => {
        console.log(`✅ WebSocket ${authCount} connected`);
        
        // Request challenge
        const message = { type: 'RequestChallenge' };
        ws.send(JSON.stringify(message));
    });
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log(`📨 Test ${authCount} received:`, message.type);
            
            switch (message.type) {
                case 'Challenge':
                    authState.challenge = message.payload.challenge;
                    authState.uuid = message.payload.challenge;
                    console.log(`🎯 Challenge ${authCount}:`, authState.uuid);
                    
                    // Authenticate
                    authenticateWithChallenge(ws, authState);
                    break;
                    
                case 'LoginOk':
                    console.log(`✅ Authentication ${authCount} successful!`);
                    console.log(`👤 User ID: ${message.payload.user_id}`);
                    
                    // Keep connection open to simulate staying logged in
                    setTimeout(() => {
                        console.log(`🔌 Closing connection ${authCount}`);
                        ws.close();
                        
                        // Start next auth test after a delay
                        if (authCount < 3) {
                            setTimeout(() => testAuthentication(), 1000);
                        }
                    }, 2000);
                    break;
                    
                case 'Error':
                    console.error(`❌ Test ${authCount} error:`, message.payload.message);
                    ws.close();
                    
                    // Try again anyway to see what happens
                    if (authCount < 3) {
                        setTimeout(() => testAuthentication(), 1000);
                    }
                    break;
                    
                default:
                    console.log(`📨 Test ${authCount} other:`, message);
            }
        } catch (err) {
            console.error(`❌ Test ${authCount} parse error:`, err);
        }
    });
    
    ws.on('close', (code, reason) => {
        console.log(`🔌 Connection ${authCount} closed:`, code, reason.toString());
        
        // If unexpected close and we haven't tried 3 times, try again
        if (code !== 1000 && authCount < 3) {
            setTimeout(() => testAuthentication(), 2000);
        }
    });
    
    ws.on('error', (err) => {
        console.error(`❌ WebSocket ${authCount} error:`, err);
    });
}

function authenticateWithChallenge(ws, authState) {
    console.log(`🔐 Starting authentication ${authCount}...`);
    
    // Parse UUID and get bytes
    const uuidBytes = new Uint8Array(16);
    const uuid = authState.uuid.replace(/-/g, '');
    for (let i = 0; i < 16; i++) {
        uuidBytes[i] = parseInt(uuid.substring(i * 2, i * 2 + 2), 16);
    }
    
    // Compute Keccak256 digest
    const digest = keccak256(uuidBytes);
    
    // Sign with private key  
    const keyPair = ec.keyFromPrivate(PRIVATE_KEY, 'hex');
    const digestBytes = Buffer.from(digest, 'hex');
    
    const signature = keyPair.sign(digestBytes);
    
    // Ensure canonical signature
    const n = ec.curve.n;
    let s = signature.s;
    if (s.gt(n.shln(1))) {
        s = n.sub(s);
    }
    
    // Convert to compact format
    const r = signature.r.toString(16).padStart(64, '0');
    const sHex = s.toString(16).padStart(64, '0');
    const signatureHex = r + sHex;
    
    // Send login message
    const loginMessage = {
        type: 'Login',
        payload: {
            challenge: authState.uuid,
            pubkey_hex: PUBLIC_KEY,
            signature_hex: signatureHex
        }
    };
    
    console.log(`📤 Sending auth ${authCount}...`);
    ws.send(JSON.stringify(loginMessage));
}

// Start the test
testAuthentication();