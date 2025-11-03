# Figma MCP 사용 가이드

이 프로젝트는 [Framelink MCP for Figma](https://github.com/GLips/Figma-Context-MCP)를 통합하여 Cursor에서 Figma 디자인 데이터에 직접 접근할 수 있습니다.

## 🎯 설정 완료

MCP 서버가 이미 설정되어 있습니다:

- 위치: `.cursor/.cursor-mcp.json`
- Figma API 키가 설정되어 있음

## 🚀 사용 방법

### 1. Cursor 재시작

MCP 설정을 적용하려면 Cursor를 재시작하세요.

### 2. Figma 링크 사용하기

Cursor의 채팅 또는 Agent 모드에서:

```
이 Figma 디자인을 구현해줘:
https://www.figma.com/file/YOUR-FILE-ID/...
```

또는 특정 프레임/그룹:

```
이 프레임을 React 컴포넌트로 만들어줘:
https://www.figma.com/file/YOUR-FILE-ID/...?node-id=123:456
```

### 3. 예시 프롬프트

#### 디자인 구현

```
Figma 링크: [링크]
이 디자인을 Tailwind CSS를 사용해서 Next.js 컴포넌트로 구현해줘
```

#### 스타일 추출

```
이 Figma 프레임의 색상 팔레트와 타이포그래피 스타일을 추출해서
tailwind.config.js에 추가해줘
```

#### 레이아웃 분석

```
이 Figma 디자인의 레이아웃 구조를 분석하고
적절한 컴포넌트 계층 구조를 제안해줘
```

## 💡 장점

1. **정확한 구현**: 스크린샷보다 훨씬 정확한 디자인 구현
2. **자동 스타일 추출**: 색상, 폰트, 간격 등을 자동으로 추출
3. **빠른 프로토타이핑**: Figma에서 코드로 빠르게 변환
4. **일관성**: 디자인 시스템을 코드에 정확히 반영

## 🔧 MCP 서버 정보

- **패키지**: `figma-developer-mcp`
- **실행 방식**: `npx`를 통한 자동 설치 및 실행
- **통신**: stdio를 통한 표준 입출력

## 📝 주의사항

1. **Figma 파일 권한**: 접근하려는 Figma 파일에 대한 권한이 있어야 합니다
2. **API 키 보안**: API 키가 설정 파일에 있으므로 `.cursor` 폴더를 `.gitignore`에 추가하세요
3. **네트워크**: MCP 서버가 Figma API에 접근하기 위해 인터넷 연결이 필요합니다

## 🔐 보안

`.gitignore`에 다음을 추가하세요:

```gitignore
# Cursor MCP 설정 (API 키 포함)
.cursor/
```

## 🆘 문제 해결

### MCP 서버가 연결되지 않는 경우

1. Cursor를 완전히 재시작
2. 터미널에서 수동으로 테스트:
   ```bash
   npx -y figma-developer-mcp --figma-api-key=YOUR_KEY --stdio
   ```

### Figma 파일에 접근할 수 없는 경우

1. Figma API 키 권한 확인
2. 파일 공유 설정 확인
3. 파일 URL이 올바른지 확인

## 📚 더 알아보기

- [Framelink MCP 공식 문서](https://www.framelink.ai/)
- [Figma API 문서](https://www.figma.com/developers/api)
- [MCP 프로토콜 문서](https://modelcontextprotocol.io/)

## 🎨 활용 예시

### UI 컴포넌트 생성

Figma에서 디자인한 버튼, 카드, 모달 등을 즉시 코드로 변환

### 디자인 시스템 구축

Figma의 디자인 토큰을 Tailwind 설정으로 자동 변환

### 반응형 레이아웃

Figma의 Auto Layout을 Flexbox/Grid로 정확히 변환

### 다크모드 구현

Figma의 다크모드 변형을 CSS 변수로 추출


