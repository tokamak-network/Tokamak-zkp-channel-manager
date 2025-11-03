# 환경 변수 설정 가이드

이 문서는 Tokamak ZK Rollup Manager UI에 필요한 모든 환경 변수를 설명합니다.

## 📋 환경 변수 목록

### 🔴 필수 (Required)

#### 1. Alchemy API Key
```env
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_api_key_here
```
- **용도**: Ethereum RPC 연결
- **발급**: https://www.alchemy.com/
- **설명**: Sepolia 및 Mainnet RPC URL 생성에 사용

---

### 🟡 권장 (Recommended)

#### 2. Contract Addresses
```env
# RollupBridge 메인 컨트랙트
NEXT_PUBLIC_ROLLUP_BRIDGE_ADDRESS=0x43D25e32b81523BBE9E2dDCFD9493ccD0dBB0c6e

# ZK Verifier 컨트랙트
NEXT_PUBLIC_VERIFIER_ADDRESS=0x708fbfE3acC1F65948304015f1789a05383a674b

# ZecFrost (Threshold Signature) 컨트랙트
NEXT_PUBLIC_ZECFROST_ADDRESS=0x242E4891d939ec102cA5bBC597ea6490DA0902CD
```
- **용도**: 스마트 컨트랙트 주소 설정
- **기본값**: `lib/contracts.ts`에 하드코딩된 주소 사용
- **설명**: 환경 변수로 설정하면 기본값을 오버라이드

#### 3. Custom RPC URLs
```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
```
- **용도**: 커스텀 RPC 엔드포인트 사용
- **기본값**: Alchemy API Key로 자동 생성
- **설명**: 다른 RPC 제공자 사용 시 설정

#### 4. WalletConnect Project ID
```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```
- **용도**: WalletConnect 지갑 연결
- **발급**: https://cloud.walletconnect.com/
- **현재 상태**: 'local-development'로 하드코딩됨
- **설명**: 프로덕션에서는 실제 Project ID 사용 권장

---

### 🔵 선택 (Optional - FROST 통합)

#### 5. FROST DKG Server
```env
# WebSocket URL
NEXT_PUBLIC_FROST_SERVER_URL=ws://localhost:9043/ws

# HTTP URL (상태 확인용)
NEXT_PUBLIC_FROST_SERVER_HTTP=http://localhost:9043
```
- **용도**: FROST threshold signature 서버 연결
- **기본값**: 로컬 개발 서버
- **프로덕션**: WSS (Secure WebSocket) 사용
  ```env
  NEXT_PUBLIC_FROST_SERVER_URL=wss://frost.yourdomain.com/ws
  NEXT_PUBLIC_FROST_SERVER_HTTP=https://frost.yourdomain.com
  ```

#### 6. FROST 인증 키
```env
DKG_ECDSA_PRIV_HEX=your_ecdsa_private_key_hex
```
- **용도**: FROST 서버 인증용 ECDSA 개인키
- **기본값**: 자동 생성 (권장)
- **설명**: 수동으로 설정하려는 경우에만 사용

---

### 🛠️ 개발 환경

#### 7. Node Environment
```env
NODE_ENV=development
```
- **용도**: 개발/프로덕션 모드 구분
- **값**: `development` | `production` | `test`

---

## 📝 .env.local 예시

로컬 개발 환경에서 사용할 `.env.local` 파일 예시:

```env
# ===========================================
# Tokamak ZK Rollup Manager - Local Development
# ===========================================

# 🔴 필수
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_api_key_here

# 🟡 권장 - Contract Addresses (기본값 사용 시 생략 가능)
NEXT_PUBLIC_ROLLUP_BRIDGE_ADDRESS=0x43D25e32b81523BBE9E2dDCFD9493ccD0dBB0c6e
NEXT_PUBLIC_VERIFIER_ADDRESS=0x708fbfE3acC1F65948304015f1789a05383a674b
NEXT_PUBLIC_ZECFROST_ADDRESS=0x242E4891d939ec102cA5bBC597ea6490DA0902CD

# 🟡 권장 - Custom RPC (Alchemy 사용 시 생략 가능)
# SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your_key
# MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your_key

# 🟡 권장 - WalletConnect
# NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# 🔵 선택 - FROST DKG Server (사용 시)
# NEXT_PUBLIC_FROST_SERVER_URL=ws://localhost:9043/ws
# NEXT_PUBLIC_FROST_SERVER_HTTP=http://localhost:9043

# 🛠️ 개발
NODE_ENV=development
```

---

## 🚀 환경별 설정

### 로컬 개발 (Local Development)

1. `.env.local` 파일 생성:
   ```bash
   cp .env.example .env.local
   ```

2. 필수 값 입력:
   - `NEXT_PUBLIC_ALCHEMY_API_KEY` 설정

3. 개발 서버 실행:
   ```bash
   npm run dev
   ```

### Vercel 배포 (Production)

1. Vercel 대시보드에서 환경 변수 설정:
   - Settings → Environment Variables

2. 필수 변수 추가:
   ```
   NEXT_PUBLIC_ALCHEMY_API_KEY
   ```

3. 선택 변수 추가 (필요시):
   ```
   NEXT_PUBLIC_ROLLUP_BRIDGE_ADDRESS
   NEXT_PUBLIC_VERIFIER_ADDRESS
   NEXT_PUBLIC_ZECFROST_ADDRESS
   NEXT_PUBLIC_FROST_SERVER_URL
   NEXT_PUBLIC_FROST_SERVER_HTTP
   ```

4. 배포:
   ```bash
   npm run build
   ```

### Docker 배포

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# 환경 변수는 런타임에 주입
ARG NEXT_PUBLIC_ALCHEMY_API_KEY
ARG NEXT_PUBLIC_ROLLUP_BRIDGE_ADDRESS
# ... 기타 변수

ENV NEXT_PUBLIC_ALCHEMY_API_KEY=$NEXT_PUBLIC_ALCHEMY_API_KEY
ENV NEXT_PUBLIC_ROLLUP_BRIDGE_ADDRESS=$NEXT_PUBLIC_ROLLUP_BRIDGE_ADDRESS

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

실행:
```bash
docker build -t tokamak-ui \
  --build-arg NEXT_PUBLIC_ALCHEMY_API_KEY=your_key \
  .

docker run -p 3000:3000 tokamak-ui
```

---

## 🔐 보안 주의사항

### ✅ 안전한 관리

1. **절대 커밋하지 말 것**:
   - `.env.local` 파일
   - `.env` 파일
   - 개인키, API 키가 포함된 파일

2. **`.gitignore` 확인**:
   ```gitignore
   # 이미 설정되어 있음
   .env*.local
   .env
   ```

3. **환경별 분리**:
   - 개발: `.env.local`
   - 스테이징: Vercel 환경 변수
   - 프로덕션: Vercel 환경 변수 (별도 설정)

### ⚠️ 주의사항

1. **NEXT_PUBLIC_* 변수**:
   - 브라우저에 노출됨
   - 민감한 정보 저장 금지
   - API 키는 읽기 전용으로 제한

2. **개인키 관리**:
   - `DKG_ECDSA_PRIV_HEX`는 서버 측에서만 사용
   - 클라이언트에 노출하지 않음

3. **RPC URL**:
   - Rate limit 고려
   - 프로덕션에서는 유료 플랜 권장

---

## 🧪 환경 변수 검증

### 개발 서버 시작 시 자동 검증

```typescript
// lib/env-check.ts (생성 예정)
export function validateEnv() {
  const required = [
    'NEXT_PUBLIC_ALCHEMY_API_KEY',
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.join('\n')}`
    );
  }
  
  console.log('✅ All required environment variables are set');
}
```

### 수동 검증

```bash
# .env.local 파일 확인
cat .env.local

# 환경 변수 출력 (Next.js)
npm run dev
# 콘솔에서 확인:
# console.log(process.env.NEXT_PUBLIC_ALCHEMY_API_KEY)
```

---

## 📚 관련 문서

- [FROST 통합 가이드](./FROST_INTEGRATION.md)
- [Figma MCP 가이드](./FIGMA_MCP_GUIDE.md)
- [README](./README.md)

---

## 🆘 문제 해결

### Q: "Missing required environment variables" 에러
**A**: `.env.local` 파일에 필수 변수가 설정되어 있는지 확인

### Q: 컨트랙트 주소가 잘못됨
**A**: 
1. `.env.local`에 올바른 주소 설정
2. 또는 `lib/contracts.ts`의 기본값 수정

### Q: FROST 서버에 연결 안 됨
**A**:
1. FROST 서버가 실행 중인지 확인
2. `NEXT_PUBLIC_FROST_SERVER_URL` 확인
3. 방화벽/CORS 설정 확인

### Q: Vercel 배포 후 환경 변수가 적용 안 됨
**A**:
1. Vercel 대시보드에서 환경 변수 확인
2. 재배포 (Redeploy) 실행
3. `NEXT_PUBLIC_*` 접두사 확인

---

## 📞 지원

문제가 계속되면:
- GitHub Issues 생성
- Tokamak Network Discord 참여
- 문서 확인: https://docs.tokamak.network

