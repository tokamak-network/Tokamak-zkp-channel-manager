#!/usr/bin/env node

// Test the authentication fix
const WebSocket = require('ws');

const PUBLIC_KEY = '0378e763c6946e9e4e392a4508de623d78a7061beccb10fa1d5f5d70f8f91ceff8';

console.log('🔧 Testing Authentication Fix');

// First, create session to register public key
function createSession() {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://127.0.0.1:9000/ws');
        
        ws.on('open', () => {
            console.log('✅ WebSocket connected for session creation');
            
            const message = {
                type: 'AnnounceDKGSession',
                payload: {
                    min_signers: 2,
                    max_signers: 3,
                    group_id: 'test_group_' + Date.now(),
                    participants: [1, 2, 3],
                    participants_pubs: [
                        [1, PUBLIC_KEY],
                        [2, '02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9'],
                        [3, '03dff1d77f2a671c5f36183726db2341be58feae1da2deced843240f7b502ba659']
                    ]
                }
            };
            
            ws.send(JSON.stringify(message));
        });
        
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                if (message.type === 'DKGSessionCreated') {
                    console.log('✅ Session created:', message.payload.session);
                    ws.close();
                    resolve(message.payload.session);
                } else if (message.type === 'Error') {
                    console.error('❌ Session creation error:', message.payload.message);
                    ws.close();
                    reject(new Error(message.payload.message));
                }
            } catch (err) {
                reject(err);
            }
        });
        
        ws.on('error', reject);
    });
}

// Test multiple authentications
async function testMultipleAuth() {
    try {
        // Create session first
        await createSession();
        console.log('🎯 Public key registered, now testing multiple authentications...');
        
        // Test auth 1
        await testSingleAuth(1);
        
        // Test auth 2 (should not crash server)
        await testSingleAuth(2);
        
        // Test auth 3
        await testSingleAuth(3);
        
        console.log('🎉 All authentication tests completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

function testSingleAuth(testNum) {
    return new Promise((resolve, reject) => {
        console.log(`\n=== Authentication Test #${testNum} ===`);
        
        const ws = new WebSocket('ws://127.0.0.1:9000/ws');
        
        ws.on('open', () => {
            console.log(`✅ Connected for auth test ${testNum}`);
            
            // Request challenge
            ws.send(JSON.stringify({ type: 'RequestChallenge' }));
        });
        
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                console.log(`📨 Test ${testNum} received:`, message.type);
                
                if (message.type === 'Challenge') {
                    // Send dummy auth (we just want to see if server handles it gracefully)
                    const loginMessage = {
                        type: 'Login',
                        payload: {
                            challenge: message.payload.challenge,
                            pubkey_hex: PUBLIC_KEY,
                            signature_hex: 'dummy_signature_to_test_error_handling'
                        }
                    };
                    
                    ws.send(JSON.stringify(loginMessage));
                    
                } else if (message.type === 'LoginOk') {
                    console.log(`✅ Test ${testNum}: Unexpected success!`);
                    ws.close();
                    resolve();
                    
                } else if (message.type === 'Error') {
                    console.log(`✅ Test ${testNum}: Got expected error: ${message.payload.message}`);
                    ws.close();
                    resolve(); // This is expected with dummy signature
                }
            } catch (err) {
                reject(err);
            }
        });
        
        ws.on('close', (code, reason) => {
            console.log(`🔌 Test ${testNum} connection closed:`, code === 1006 ? 'UNEXPECTED' : 'OK');
            
            if (code === 1006) {
                reject(new Error(`Server crashed during test ${testNum}`));
            } else {
                resolve();
            }
        });
        
        ws.on('error', reject);
        
        // Timeout after 5 seconds
        setTimeout(() => {
            ws.close();
            resolve();
        }, 5000);
    });
}

// Run the test
testMultipleAuth();