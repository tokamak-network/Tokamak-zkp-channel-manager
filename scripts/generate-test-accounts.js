#!/usr/bin/env node

/**
 * 테스트용 Ethereum 계정 생성 스크립트
 * 
 * 사용법:
 *   node scripts/generate-test-accounts.js 3
 *   node scripts/generate-test-accounts.js 5 --output test-accounts.json
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// secp256k1 타원곡선 파라미터
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

// Keccak-256 해시 함수
const { keccak256 } = require('js-sha3');

/**
 * 랜덤 개인키로 Ethereum 계정 생성
 */
function generateAccount() {
  // 랜덤 개인키 생성 (32 bytes)
  const privateKey = crypto.randomBytes(32);
  const privateKeyHex = privateKey.toString('hex');
  
  // 공개키 생성
  const keyPair = ec.keyFromPrivate(privateKey);
  const publicKey = keyPair.getPublic();
  
  // 압축되지 않은 공개키 (04 + x + y)
  const publicKeyHex = publicKey.encode('hex', false);
  
  // 압축된 공개키 (02/03 + x)
  const publicKeyCompressed = publicKey.encode('hex', true);
  
  // Ethereum 주소 생성 (공개키의 Keccak-256 해시의 마지막 20바이트)
  const publicKeyBytes = Buffer.from(publicKeyHex.slice(2), 'hex'); // '04' 제거
  const addressHash = keccak256(publicKeyBytes);
  const address = '0x' + addressHash.slice(-40);
  
  return {
    address: address,
    privateKey: '0x' + privateKeyHex,
    publicKey: '0x' + publicKeyHex,
    publicKeyCompressed: '0x' + publicKeyCompressed,
    publicKeyX: '0x' + publicKey.getX().toString('hex').padStart(64, '0'),
    publicKeyY: '0x' + publicKey.getY().toString('hex').padStart(64, '0'),
  };
}

/**
 * 여러 계정 생성
 */
function generateAccounts(count) {
  const accounts = [];
  
  for (let i = 0; i < count; i++) {
    const account = generateAccount();
    accounts.push({
      id: i + 1,
      name: `Test Account ${i + 1}`,
      ...account,
    });
  }
  
  return accounts;
}

/**
 * 계정 정보를 보기 좋게 출력
 */
function printAccounts(accounts) {
  console.log('\n' + '='.repeat(80));
  console.log('🔑 Generated Test Accounts');
  console.log('='.repeat(80) + '\n');
  
  accounts.forEach((account, index) => {
    console.log(`Account ${index + 1}: ${account.name}`);
    console.log('─'.repeat(80));
    console.log(`Address:              ${account.address}`);
    console.log(`Private Key:          ${account.privateKey}`);
    console.log(`Public Key (Full):    ${account.publicKey}`);
    console.log(`Public Key (Compress): ${account.publicKeyCompressed}`);
    console.log(`Public Key X:         ${account.publicKeyX}`);
    console.log(`Public Key Y:         ${account.publicKeyY}`);
    console.log('');
  });
  
  console.log('='.repeat(80));
  console.log('⚠️  WARNING: These are test accounts. Never use them with real funds!');
  console.log('='.repeat(80) + '\n');
}

/**
 * 계정 정보를 파일로 저장
 */
function saveAccounts(accounts, outputPath) {
  const data = {
    generated: new Date().toISOString(),
    count: accounts.length,
    accounts: accounts,
    warning: 'These are test accounts. Never use them with real funds!',
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`✅ Accounts saved to: ${outputPath}\n`);
}

/**
 * .env.local 형식으로 저장
 */
function saveAsEnv(accounts, outputPath) {
  let envContent = '# Test Accounts for DKG\n';
  envContent += '# ⚠️  WARNING: Never use these accounts with real funds!\n\n';
  
  accounts.forEach((account, index) => {
    envContent += `# Test Account ${index + 1}\n`;
    envContent += `TEST_ACCOUNT_${index + 1}_ADDRESS=${account.address}\n`;
    envContent += `TEST_ACCOUNT_${index + 1}_PRIVATE_KEY=${account.privateKey}\n`;
    envContent += `TEST_ACCOUNT_${index + 1}_PUBLIC_KEY=${account.publicKey}\n`;
    envContent += `TEST_ACCOUNT_${index + 1}_PUBLIC_KEY_COMPRESSED=${account.publicKeyCompressed}\n\n`;
  });
  
  fs.writeFileSync(outputPath, envContent);
  console.log(`✅ Environment variables saved to: ${outputPath}\n`);
}

/**
 * 간단한 HTML 페이지로 저장 (복사하기 쉽게)
 */
function saveAsHtml(accounts, outputPath) {
  const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Accounts</title>
    <style>
        body {
            font-family: 'Courier New', monospace;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #1a1a1a;
            color: #e0e0e0;
        }
        h1 {
            color: #4a9eff;
            border-bottom: 2px solid #4a9eff;
            padding-bottom: 10px;
        }
        .account {
            background: #2a2a2a;
            border: 1px solid #3a3a3a;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        .account h2 {
            color: #6ab7ff;
            margin-top: 0;
        }
        .field {
            margin: 10px 0;
        }
        .label {
            color: #888;
            font-weight: bold;
            display: inline-block;
            width: 120px;
        }
        .value {
            color: #4a9eff;
            word-break: break-all;
            font-size: 14px;
        }
        button {
            background: #4a9eff;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 4px;
            cursor: pointer;
            margin-left: 10px;
        }
        button:hover {
            background: #3a8eef;
        }
        .warning {
            background: #ff4444;
            color: white;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <h1>🔑 Test Accounts for DKG</h1>
    <div class="warning">
        ⚠️ WARNING: These are test accounts. Never use them with real funds!
    </div>
    
    ${accounts.map((account, index) => `
    <div class="account">
        <h2>Account ${index + 1}: ${account.name}</h2>
        <div class="field">
            <span class="label">Address:</span>
            <span class="value" id="addr-${index}">${account.address}</span>
            <button onclick="copy('addr-${index}')">Copy</button>
        </div>
        <div class="field">
            <span class="label">Private Key:</span>
            <span class="value" id="priv-${index}">${account.privateKey}</span>
            <button onclick="copy('priv-${index}')">Copy</button>
        </div>
        <div class="field">
            <span class="label">Public Key (Full):</span>
            <span class="value" id="pub-${index}">${account.publicKey}</span>
            <button onclick="copy('pub-${index}')">Copy</button>
        </div>
        <div class="field">
            <span class="label">Public Key (Compressed):</span>
            <span class="value" id="pub-comp-${index}">${account.publicKeyCompressed}</span>
            <button onclick="copy('pub-comp-${index}')">Copy</button>
        </div>
    </div>
    `).join('')}
    
    <script>
        function copy(id) {
            const text = document.getElementById(id).textContent;
            navigator.clipboard.writeText(text).then(() => {
                alert('Copied to clipboard!');
            });
        }
    </script>
</body>
</html>
  `;
  
  fs.writeFileSync(outputPath, html);
  console.log(`✅ HTML page saved to: ${outputPath}`);
  console.log(`   Open in browser: file://${path.resolve(outputPath)}\n`);
}

// CLI 실행
function main() {
  const args = process.argv.slice(2);
  
  // 도움말
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node generate-test-accounts.js [count] [options]

Arguments:
  count              Number of accounts to generate (default: 3)

Options:
  --output, -o       Output JSON file path
  --env              Save as .env format
  --html             Save as HTML page
  --help, -h         Show this help message

Examples:
  node generate-test-accounts.js 3
  node generate-test-accounts.js 5 --output accounts.json
  node generate-test-accounts.js 3 --env
  node generate-test-accounts.js 3 --html
    `);
    return;
  }
  
  // 계정 개수
  const count = parseInt(args[0]) || 3;
  
  if (count < 1 || count > 100) {
    console.error('❌ Error: Count must be between 1 and 100');
    process.exit(1);
  }
  
  // 계정 생성
  console.log(`\n🔄 Generating ${count} test accounts...\n`);
  const accounts = generateAccounts(count);
  
  // 콘솔 출력
  printAccounts(accounts);
  
  // 파일 저장
  const outputIndex = args.indexOf('--output') !== -1 ? args.indexOf('--output') : args.indexOf('-o');
  if (outputIndex !== -1 && args[outputIndex + 1]) {
    saveAccounts(accounts, args[outputIndex + 1]);
  }
  
  // .env 형식 저장
  if (args.includes('--env')) {
    saveAsEnv(accounts, 'test-accounts.env');
  }
  
  // HTML 형식 저장
  if (args.includes('--html')) {
    saveAsHtml(accounts, 'test-accounts.html');
  }
  
  // 기본 JSON 저장
  if (outputIndex === -1 && !args.includes('--env') && !args.includes('--html')) {
    const defaultPath = path.join(__dirname, '..', 'test-accounts.json');
    saveAccounts(accounts, defaultPath);
  }
}

// 스크립트 실행
if (require.main === module) {
  main();
}

module.exports = { generateAccount, generateAccounts };

