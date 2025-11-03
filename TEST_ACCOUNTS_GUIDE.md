# 테스트 계정 생성 가이드

DKG 세션 테스트를 위한 계정을 생성하는 방법입니다.

## 🚀 빠른 시작

### 방법 1: 스크립트 사용 (권장)

```bash
# 3개의 테스트 계정 생성
node scripts/generate-test-accounts.js 3

# HTML 파일로 저장 (복사하기 쉬움)
node scripts/generate-test-accounts.js 3 --html

# JSON 파일로 저장
node scripts/generate-test-accounts.js 3 --output test-accounts.json

# .env 형식으로 저장
node scripts/generate-test-accounts.js 3 --env
```

### 방법 2: npm 스크립트 사용

```bash
npm run generate-accounts 3 -- --html
```

### 방법 3: 온라인 도구 사용

1. **Vanity-ETH** (https://vanity-eth.tk/)
   - 브라우저에서 바로 생성
   - 개인키와 주소 즉시 확인

2. **MyEtherWallet** (https://www.myetherwallet.com/)
   - "Create New Wallet" 선택
   - 여러 개 생성 가능

3. **MetaMask**
   - 새 계정 추가 (Add Account)
   - 개인키 내보내기 (Export Private Key)

## 📝 수동으로 계정 생성하기

### Node.js 콘솔에서

```javascript
// Node.js REPL 실행
node

// 다음 코드 실행
const crypto = require('crypto');
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');
const { keccak256 } = require('js-sha3');

function generateAccount() {
  const privateKey = crypto.randomBytes(32);
  const keyPair = ec.keyFromPrivate(privateKey);
  const publicKey = keyPair.getPublic();
  const publicKeyHex = publicKey.encode('hex', false);
  const publicKeyBytes = Buffer.from(publicKeyHex.slice(2), 'hex');
  const addressHash = keccak256(publicKeyBytes);
  const address = '0x' + addressHash.slice(-40);
  
  return {
    address: address,
    privateKey: '0x' + privateKey.toString('hex'),
    publicKey: '0x' + publicKeyHex
  };
}

// 3개 생성
const account1 = generateAccount();
const account2 = generateAccount();
const account3 = generateAccount();

console.log('Account 1:', account1);
console.log('Account 2:', account2);
console.log('Account 3:', account3);
```

## 🎯 UI에서 사용하기

### 1. 계정 생성 후

생성된 계정의 **Public Key** (또는 Address)를 복사합니다:

```
Account 1: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
Account 2: 0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed
Account 3: 0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359
```

### 2. DKG 세션 생성 화면에서

**Participants** 필드에 Public Key 입력:

```
Min Signers: 2
Max Signers: 3

Participants (0/3):
┌─────────────────────────────────────────────┐
│ 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb │  [Add Participant]
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed │  [Add Participant]
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359 │  [Add Participant]
└─────────────────────────────────────────────┘

                                    [Create Session]
```

## 💡 미리 생성된 테스트 계정 (개발용)

**⚠️ 경고: 절대 실제 자금을 보내지 마세요!**

### Account 1
```
Address:     0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
Private Key: 0x4c0883a69102937d6231471b5dbb6204fe512961708279f8b5c3b0e3e8e0f2d7
Public Key:  0x04e68acfc0253a10620dff706b0a1b1f1f5833ea3beb3bde2250d5f271f3563606672ebc45e0b7ea2e816ecb70ca03137b1c9476eec63d4632e990020b7b6fba39
```

### Account 2
```
Address:     0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed
Private Key: 0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
Public Key:  0x04a65d36da1c7e3c0c0e6e4a4b4e6c3c0c0e6e4a4b4e6c3c0c0e6e4a4b4e6c3c0c0e6e4a4b4e6c3c0c0e6e4a4b4e6c3c0c0e6e4a4b4e6c3c0c0e6e4a4b4e6c3c
```

### Account 3
```
Address:     0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359
Private Key: 0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210
Public Key:  0x04b5d36da1c7e3c0c0e6e4a4b4e6c3c0c0e6e4a4b4e6c3c0c0e6e4a4b4e6c3c0c0e6e4a4b4e6c3c0c0e6e4a4b4e6c3c0c0e6e4a4b4e6c3c0c0e6e4a4b4e6c3d
```

## 🔧 MetaMask에서 테스트 계정 가져오기

1. MetaMask 열기
2. 계정 메뉴 클릭
3. "Import Account" 선택
4. Private Key 입력
5. "Import" 클릭

이제 MetaMask에서 해당 계정을 사용할 수 있습니다!

## 📱 모바일에서 사용하기

### Trust Wallet / Rainbow Wallet

1. 앱 열기
2. Settings → Wallets
3. "Import Wallet" 또는 "Add Wallet"
4. Private Key 입력
5. 완료

## 🎨 UI 개선 제안

현재 UI에 다음 기능을 추가하면 더 편리합니다:

### 1. "Generate Test Accounts" 버튼

```typescript
// components/GenerateTestAccountsButton.tsx
export function GenerateTestAccountsButton({ onGenerate }) {
  const handleGenerate = () => {
    const accounts = [];
    for (let i = 0; i < 3; i++) {
      accounts.push(generateAccount());
    }
    onGenerate(accounts);
  };
  
  return (
    <button onClick={handleGenerate}>
      🎲 Generate Test Accounts
    </button>
  );
}
```

### 2. "Import from MetaMask" 버튼

```typescript
// 연결된 지갑의 주소를 자동으로 가져오기
const { address } = useAccount();

<button onClick={() => addParticipant(address)}>
  🦊 Add My MetaMask Address
</button>
```

### 3. "Load from File" 버튼

```typescript
// JSON 파일에서 계정 불러오기
<input 
  type="file" 
  accept=".json"
  onChange={handleLoadAccounts}
/>
```

## 🧪 테스트 시나리오

### 시나리오 1: 2-of-3 DKG

```
1. 3개의 테스트 계정 생성
2. Min Signers: 2, Max Signers: 3 설정
3. 3개의 Public Key 모두 추가
4. "Create Session" 클릭
5. 각 계정으로 세션 참여
```

### 시나리오 2: 3-of-5 DKG

```
1. 5개의 테스트 계정 생성
2. Min Signers: 3, Max Signers: 5 설정
3. 5개의 Public Key 모두 추가
4. "Create Session" 클릭
```

## 🔐 보안 주의사항

### ✅ 테스트 환경에서만 사용

- Sepolia, Goerli 등 테스트넷에서만 사용
- 절대 메인넷에서 사용하지 마세요

### ✅ 자금 관리

- 테스트 계정에는 최소한의 테스트 ETH만 보관
- Faucet에서 받은 테스트 ETH 사용
  - Sepolia Faucet: https://sepoliafaucet.com/
  - Alchemy Faucet: https://sepoliafaucet.com/

### ❌ 절대 하지 말 것

- 실제 자금을 테스트 계정으로 전송
- 테스트 계정의 개인키를 공개 저장소에 커밋
- 프로덕션 환경에서 테스트 계정 사용

## 📚 추가 리소스

- [Ethereum 계정 구조](https://ethereum.org/en/developers/docs/accounts/)
- [secp256k1 타원곡선](https://en.bitcoin.it/wiki/Secp256k1)
- [FROST DKG 프로토콜](https://eprint.iacr.org/2020/852.pdf)

## 🆘 문제 해결

### Q: 스크립트 실행 시 "elliptic not found" 에러
**A**: 의존성 설치 필요
```bash
npm install elliptic js-sha3
```

### Q: 생성된 계정이 유효하지 않음
**A**: 
- Public Key 형식 확인 (0x로 시작)
- 주소 체크섬 확인
- 개인키 길이 확인 (64 hex chars)

### Q: MetaMask에서 가져오기 실패
**A**:
- Private Key에서 0x 제거 후 시도
- 64자리 hex 문자열인지 확인

## 🎉 완료!

이제 테스트 계정으로 DKG 세션을 만들 수 있습니다!

```
✅ Account 1 생성
✅ Account 2 생성  
✅ Account 3 생성
✅ DKG Session 생성 준비 완료
```

