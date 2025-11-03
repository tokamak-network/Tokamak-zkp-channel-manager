#!/usr/bin/env node

/**
 * 개인키로부터 공개키 생성 (Compressed & Uncompressed)
 * 
 * 사용법:
 *   node scripts/get-public-key-from-private.js 0xYOUR_PRIVATE_KEY
 */

const EC = require('elliptic').ec;
const ec = new EC('secp256k1');
const { keccak256 } = require('js-sha3');

function getPublicKeyFromPrivate(privateKeyHex) {
  // '0x' 제거
  const privateKey = privateKeyHex.replace('0x', '');
  
  // 키페어 생성
  const keyPair = ec.keyFromPrivate(privateKey, 'hex');
  const publicKey = keyPair.getPublic();
  
  // 압축되지 않은 공개키
  const publicKeyFull = publicKey.encode('hex', false);
  
  // 압축된 공개키
  const publicKeyCompressed = publicKey.encode('hex', true);
  
  // 주소 생성
  const publicKeyBytes = Buffer.from(publicKeyFull.slice(2), 'hex');
  const addressHash = keccak256(publicKeyBytes);
  const address = '0x' + addressHash.slice(-40);
  
  return {
    address: address,
    publicKeyFull: '0x' + publicKeyFull,
    publicKeyCompressed: '0x' + publicKeyCompressed,
    publicKeyX: '0x' + publicKey.getX().toString('hex').padStart(64, '0'),
    publicKeyY: '0x' + publicKey.getY().toString('hex').padStart(64, '0'),
  };
}

// CLI 실행
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node get-public-key-from-private.js <private_key>

Arguments:
  private_key    Private key in hex format (with or without 0x prefix)

Example:
  node get-public-key-from-private.js 0xcd28381a71da8e10b36c4cee0a66c36d85bd0b104eb348e2ebe198b25af78c38
    `);
    process.exit(0);
  }
  
  const privateKeyHex = args[0];
  
  try {
    const result = getPublicKeyFromPrivate(privateKeyHex);
    
    console.log('\n' + '='.repeat(80));
    console.log('🔑 Public Key Information');
    console.log('='.repeat(80) + '\n');
    
    console.log(`Address:                ${result.address}`);
    console.log(`Public Key (Full):      ${result.publicKeyFull}`);
    console.log(`Public Key (Compressed): ${result.publicKeyCompressed}`);
    console.log(`Public Key X:           ${result.publicKeyX}`);
    console.log(`Public Key Y:           ${result.publicKeyY}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Use the Compressed Public Key for DKG sessions');
    console.log('='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nPlease provide a valid private key in hex format.');
    process.exit(1);
  }
}

module.exports = { getPublicKeyFromPrivate };

