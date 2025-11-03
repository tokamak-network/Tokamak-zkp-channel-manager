#!/usr/bin/env node

/**
 * 주소로부터 공개키 추출 (블록체인에서)
 * 
 * 주의: 해당 주소가 최소 1번 이상 트랜잭션을 보낸 적이 있어야 합니다.
 * 
 * 사용법:
 *   node scripts/get-public-key-from-address.js 0xADDRESS [--network sepolia]
 */

const https = require('https');

async function getPublicKeyFromAddress(address, network = 'sepolia') {
  const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  
  if (!alchemyKey) {
    throw new Error('NEXT_PUBLIC_ALCHEMY_API_KEY not found in environment variables');
  }
  
  const networkUrls = {
    mainnet: `eth-mainnet.g.alchemy.com`,
    sepolia: `eth-sepolia.g.alchemy.com`,
  };
  
  const hostname = networkUrls[network];
  if (!hostname) {
    throw new Error(`Unknown network: ${network}. Use 'mainnet' or 'sepolia'`);
  }
  
  console.log(`\n🔍 Searching for transactions from ${address} on ${network}...`);
  
  // 1. 최근 트랜잭션 가져오기
  const txListResponse = await makeRequest(hostname, alchemyKey, {
    jsonrpc: '2.0',
    id: 1,
    method: 'alchemy_getAssetTransfers',
    params: [{
      fromAddress: address,
      category: ['external', 'erc20', 'erc721', 'erc1155'],
      maxCount: '0x1',
      order: 'desc'
    }]
  });
  
  if (!txListResponse.result || !txListResponse.result.transfers || txListResponse.result.transfers.length === 0) {
    throw new Error(`No transactions found from address ${address}. The address must have sent at least one transaction.`);
  }
  
  const txHash = txListResponse.result.transfers[0].hash;
  console.log(`✅ Found transaction: ${txHash}`);
  
  // 2. 트랜잭션 상세 정보 가져오기
  const txResponse = await makeRequest(hostname, alchemyKey, {
    jsonrpc: '2.0',
    id: 2,
    method: 'eth_getTransactionByHash',
    params: [txHash]
  });
  
  if (!txResponse.result) {
    throw new Error('Failed to get transaction details');
  }
  
  const tx = txResponse.result;
  
  // 3. 서명에서 공개키 복구
  const EC = require('elliptic').ec;
  const ec = new EC('secp256k1');
  const { keccak256 } = require('js-sha3');
  
  // v, r, s 추출
  let v = parseInt(tx.v, 16);
  const r = tx.r.slice(2);
  const s = tx.s.slice(2);
  
  // EIP-155 처리
  if (v >= 37) {
    v = v % 2 === 0 ? 0 : 1;
  } else {
    v = v - 27;
  }
  
  // 트랜잭션 해시 생성 (서명 전)
  const txData = {
    nonce: tx.nonce,
    gasPrice: tx.gasPrice,
    gasLimit: tx.gas,
    to: tx.to || '0x',
    value: tx.value,
    data: tx.input,
  };
  
  console.log('⚠️  Note: Public key recovery from blockchain requires complex RLP encoding.');
  console.log('    For testing, please use the private key method instead.\n');
  
  return null;
}

function makeRequest(hostname, apiKey, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: hostname,
      path: `/v2/${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

// CLI 실행
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node get-public-key-from-address.js <address> [--network <network>]

Arguments:
  address        Ethereum address (0x...)

Options:
  --network      Network to search (mainnet or sepolia, default: sepolia)

Example:
  node get-public-key-from-address.js 0xf9fa94d45c49e879e46ea783fc133f41709f3bc7
  node get-public-key-from-address.js 0xf9fa94d45c49e879e46ea783fc133f41709f3bc7 --network mainnet

Note:
  - The address must have sent at least one transaction
  - Requires NEXT_PUBLIC_ALCHEMY_API_KEY in environment
  - For testing, it's easier to use the private key method
    `);
    process.exit(0);
  }
  
  const address = args[0];
  const networkIndex = args.indexOf('--network');
  const network = networkIndex !== -1 ? args[networkIndex + 1] : 'sepolia';
  
  getPublicKeyFromAddress(address, network)
    .then((result) => {
      if (result) {
        console.log('✅ Success!');
      } else {
        console.log('\n💡 Recommendation:');
        console.log('   Use: node scripts/get-public-key-from-private.js <private_key>');
        console.log('   Or generate new test accounts: node scripts/generate-test-accounts.js 3');
      }
    })
    .catch((error) => {
      console.error('\n❌ Error:', error.message);
      console.log('\n💡 Alternative methods:');
      console.log('   1. Use private key: node scripts/get-public-key-from-private.js <private_key>');
      console.log('   2. Generate test accounts: node scripts/generate-test-accounts.js 3');
      console.log('   3. Export private key from MetaMask and use method 1');
      process.exit(1);
    });
}

module.exports = { getPublicKeyFromAddress };

