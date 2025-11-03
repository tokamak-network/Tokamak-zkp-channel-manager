# FROST DKG 서버 통합 가이드

이 문서는 [threshold-signature-Frost](https://github.com/mabingol/threshold-signature-Frost) 저장소와 현재 UI의 통합 방법을 설명합니다.

## 📋 개요

FROST (Flexible Round-Optimized Schnorr Threshold) 서명은 다자간 threshold 서명을 생성하는 프로토콜입니다. 이 프로젝트는 Tokamak ZK Rollup의 채널 관리에서 다음 용도로 사용됩니다:

- **그룹 공개키 생성**: 채널 생성 시 필요한 `(pkx, pky)` 좌표
- **Threshold 서명**: 채널 상태 전환 시 다자간 서명
- **온체인 검증**: ZecFrost 컨트랙트를 통한 서명 검증

## 🏗️ 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                    Tokamak ZK Rollup UI                         │
│  (Next.js Frontend - 현재 프로젝트)                              │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ WebSocket Connection
             │ ws://frost-server:9043/ws
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FROST DKG Server (fserver)                   │
│  - Session Management                                           │
│  - DKG Coordination (Round 1, 2)                               │
│  - Signing Coordination                                         │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ Smart Contract Calls
             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Ethereum Smart Contracts                           │
│  - RollupBridge (0x43D2...0c6e)                                │
│  - ZecFrost (0x242E...02CD) ← FROST 서명 검증                  │
│  - Verifier (0x708f...674b)                                    │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 필요한 환경 변수

### .env.local에 추가

```env
# FROST DKG Server Configuration
NEXT_PUBLIC_FROST_SERVER_URL=ws://localhost:9043/ws
NEXT_PUBLIC_FROST_SERVER_HTTP=http://localhost:9043

# FROST 서버가 원격에 있는 경우
# NEXT_PUBLIC_FROST_SERVER_URL=wss://frost.yourdomain.com/ws
# NEXT_PUBLIC_FROST_SERVER_HTTP=https://frost.yourdomain.com

# ECDSA 인증을 위한 개인키 (선택 - 자동 생성 가능)
# DKG_ECDSA_PRIV_HEX=your_ecdsa_private_key_hex
```

## 📦 통합 시나리오

### 시나리오 1: 채널 생성 시 그룹 공개키 생성

**현재 UI 흐름**:
```typescript
// app/create-channel/page.tsx
1. 사용자가 참여자 주소 입력
2. 사용자가 그룹 공개키 (pkx, pky) 입력 또는 생성
3. openChannel() 트랜잭션 전송
```

**FROST 통합 후**:
```typescript
1. 사용자가 참여자 주소 입력
2. "DKG로 그룹 키 생성" 버튼 클릭
3. FROST 서버에 WebSocket 연결
4. DKG 프로세스 실행:
   - CreateSession
   - 참여자들 JoinSession
   - Round 1: Commitments
   - Round 2: Secret Shares
   - 그룹 공개키 (pkx, pky) 자동 생성
5. 생성된 키로 openChannel() 호출
```

### 시나리오 2: 증명 서명 (Proof Signing)

**현재 UI 흐름**:
```typescript
// app/sign-proof/page.tsx
1. 사용자가 서명 데이터 입력 (message, rx, ry, z)
2. signAggregatedProof() 트랜잭션 전송
```

**FROST 통합 후**:
```typescript
1. 리더가 증명 제출 (submitAggregatedProof)
2. "서명 세션 시작" 버튼 클릭
3. FROST 서버에 서명 세션 생성
4. 참여자들이 서명 세션 참여
5. Interactive Signing:
   - Round 1: Nonces
   - Round 2: Signature Shares
   - Aggregation: 최종 서명 생성
6. 생성된 서명으로 signAggregatedProof() 호출
```

## 🛠️ 구현 계획

### Phase 1: FROST 클라이언트 라이브러리 추가

```bash
# FROST 클라이언트를 위한 WebSocket 라이브러리
npm install ws
npm install @types/ws --save-dev

# 암호화 유틸리티
npm install elliptic
npm install @types/elliptic --save-dev
```

### Phase 2: FROST 클라이언트 컴포넌트 생성

```typescript
// lib/frost-client.ts
export class FrostClient {
  private ws: WebSocket;
  private sessionId?: string;
  
  constructor(serverUrl: string) {
    this.ws = new WebSocket(serverUrl);
  }
  
  async createSession(participants: string[]): Promise<string> {
    // CreateSession 메시지 전송
    // session_id 반환
  }
  
  async joinSession(sessionId: string): Promise<void> {
    // JoinSession 메시지 전송
  }
  
  async runDKG(): Promise<{ pkx: string; pky: string }> {
    // DKG Round 1, 2 실행
    // 그룹 공개키 반환
  }
  
  async runSigning(message: string): Promise<Signature> {
    // Interactive Signing 실행
    // 서명 반환
  }
}
```

### Phase 3: UI 컴포넌트 업데이트

```typescript
// components/FrostDKGModal.tsx
export function FrostDKGModal({ 
  participants, 
  onComplete 
}: { 
  participants: string[]; 
  onComplete: (pkx: string, pky: string) => void;
}) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'dkg' | 'complete'>('idle');
  
  const handleStartDKG = async () => {
    const client = new FrostClient(process.env.NEXT_PUBLIC_FROST_SERVER_URL!);
    const sessionId = await client.createSession(participants);
    const { pkx, pky } = await client.runDKG();
    onComplete(pkx, pky);
  };
  
  return (
    <Dialog>
      {/* DKG 프로세스 UI */}
    </Dialog>
  );
}
```

## 🔐 보안 고려사항

### 1. 인증
- FROST 서버는 ECDSA 서명으로 클라이언트 인증
- 각 사용자는 고유한 ECDSA 키페어 필요
- 키는 브라우저 로컬 스토리지 또는 지갑에서 파생

### 2. 통신 보안
- 프로덕션에서는 **WSS** (WebSocket Secure) 사용 필수
- TLS 인증서 설정 필요

### 3. 키 관리
- DKG로 생성된 비밀 공유는 **절대 서버에 저장하지 않음**
- 클라이언트 측에서만 임시 보관
- 사용 후 즉시 삭제 권장

## 📝 FROST 서버 설정

### 로컬 개발 환경

```bash
# FROST 저장소 클론
git clone https://github.com/mabingol/threshold-signature-Frost.git
cd threshold-signature-Frost

# 서버 실행
cargo run -p fserver -- server --bind 127.0.0.1:9043

# 또는 Docker 사용
docker build -t frost-server .
docker run -p 9043:9043 frost-server
```

### 프로덕션 환경

```bash
# Nginx 리버스 프록시 설정 (WSS)
server {
    listen 443 ssl;
    server_name frost.yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location /ws {
        proxy_pass http://localhost:9043;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 🧪 테스트 시나리오

### 1. DKG 테스트 (2-of-3)

```bash
# Terminal 1: FROST 서버 시작
cargo run -p fserver -- server --bind 127.0.0.1:9043

# Terminal 2: 사용자 키 생성
node scripts/make_users.js users 3

# Terminal 3-5: DKG 클라이언트 실행
make all out=run_dkg t=2 n=3 gid=testgroup topic=test1 bind=127.0.0.1:9043
```

### 2. UI에서 DKG 테스트

```typescript
// 브라우저 콘솔에서
const client = new FrostClient('ws://localhost:9043/ws');
const sessionId = await client.createSession(['0x...', '0x...', '0x...']);
const { pkx, pky } = await client.runDKG();
console.log('Group Public Key:', pkx, pky);
```

## 📊 데이터 흐름

### DKG 프로세스

```
1. Creator → fserver: CreateSession
   {
     "participants": ["addr1", "addr2", "addr3"],
     "threshold": 2,
     "topic": "channel-123-dkg"
   }

2. fserver → Creator: SessionCreated
   {
     "session_id": "abc123..."
   }

3. Participants → fserver: JoinSession
   {
     "session_id": "abc123..."
   }

4. fserver → All: StartRound1

5. Participants → fserver: Round1Package
   {
     "commitments": [...],
     "proof": {...}
   }

6. fserver → All: Round1Complete + Broadcast packages

7. Participants → fserver: Round2Package (encrypted shares)

8. fserver → Recipients: Forward encrypted shares

9. Participants: Compute secret share + group public key
   Output: { pkx, pky, share }
```

### Signing 프로세스

```
1. Creator → fserver: CreateSigningSession
   {
     "message": "0x...",
     "participants": ["addr1", "addr2"],
     "session_id": "signing-xyz"
   }

2. Participants → fserver: JoinSigningSession

3. fserver → All: StartSigningRound1

4. Participants → fserver: NonceCommitments

5. fserver → All: Round1Complete + Broadcast commitments

6. Participants → fserver: SignatureShares

7. fserver: Aggregate shares → Final signature

8. fserver → All: SignatureComplete
   {
     "signature": {
       "rx": "0x...",
       "ry": "0x...",
       "z": "0x..."
     }
   }
```

## 🔗 관련 컨트랙트 함수

### RollupBridge.sol

```solidity
// 채널 생성 시 그룹 공개키 사용
function openChannel(
    ChannelParams memory params  // params.pkx, params.pky
) external returns (uint256 channelId);

// 증명 서명
function signAggregatedProof(
    uint256 channelId,
    Signature memory signature  // signature.rx, signature.ry, signature.z
) external;
```

### ZecFrost.sol

```solidity
// FROST 서명 검증
function verifySignature(
    bytes32 message,
    uint256 rx,
    uint256 ry,
    uint256 z,
    uint256 pkx,
    uint256 pky
) public view returns (bool);
```

## 📚 참고 자료

- [FROST 논문](https://eprint.iacr.org/2020/852.pdf)
- [threshold-signature-Frost 저장소](https://github.com/mabingol/threshold-signature-Frost)
- [Tokamak Network 문서](https://docs.tokamak.network)

## ⚠️ 주의사항

1. **Threshold 설정**: 채널 생성 시 `t-of-n` threshold를 신중하게 설정
2. **참여자 수**: 최소 3명, 최대 50명 (컨트랙트 제한)
3. **타임아웃**: DKG/Signing 세션은 일정 시간 후 만료
4. **네트워크**: 모든 참여자가 FROST 서버에 접근 가능해야 함
5. **키 백업**: DKG로 생성된 share는 복구 불가능 (백업 권장)

## 🚀 다음 단계

1. ✅ FROST 서버 로컬 실행
2. ⬜ WebSocket 클라이언트 라이브러리 구현
3. ⬜ UI 컴포넌트 통합
4. ⬜ 테스트 시나리오 실행
5. ⬜ 프로덕션 배포

