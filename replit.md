# AI 에이전트 팀 - 3D 캐릭터 기반 AI 개발 협업 시스템

## 프로젝트 개요
다중 3D 캐릭터 AI 에이전트가 Claude AI를 기반으로 하나의 프로젝트를 협업하여 개선하는 웹 애플리케이션.
에이전트들이 서로 소통하며 파일을 분석/수정하고, Telegram을 통해 원격 제어 가능.

## 기술 스택
- **프론트엔드**: React 18, Three.js (@react-three/fiber, @react-three/drei), Tailwind CSS, Shadcn UI
- **백엔드**: Express.js, WebSocket (ws)
- **AI**: Anthropic Claude API (Replit AI Integrations)
- **데이터베이스**: PostgreSQL (Drizzle ORM)
- **기타**: Telegram Bot API (선택적)

## 프로젝트 구조
```
client/src/
  pages/Home.tsx          - 메인 대시보드 페이지
  components/
    Scene3D.tsx           - Three.js 3D 씬
    AgentCharacter.tsx    - 3D 캐릭터 모델 (동물형)
    AgentPanel.tsx        - 에이전트 상세 패널 & 채팅
    AgentChatPanel.tsx    - 에이전트 간 대화 뷰어
    ActivityFeed.tsx      - 실시간 활동 피드
  hooks/
    useWebSocket.ts       - WebSocket 연결 훅

server/
  index.ts                - Express 서버 진입점
  routes.ts               - API 라우트 & WebSocket
  storage.ts              - 데이터베이스 CRUD
  db.ts                   - PostgreSQL 연결
  agents.ts               - AI 에이전트 매니저 (Claude 통합)
  workspace.ts            - 파일 시스템 작업 & 파일 잠금
  telegram.ts             - Telegram 봇 통합

shared/
  schema.ts               - Drizzle ORM 스키마 (agents, tasks, agentMessages, activityLogs)
```

## 주요 기능
1. **3D 캐릭터 시각화**: 화면 하단에 동물형 3D 캐릭터들이 노트북과 함께 배치
2. **Claude AI 에이전트**: 각 캐릭터가 독립적 AI로 파일 읽기/쓰기/분석
3. **에이전트 간 소통**: 에이전트들이 서로 메시지를 주고받으며 협업
4. **에이전트 관리**: 추가/제거, 역할 할당 (프론트엔드/백엔드/테스팅/일반)
5. **실시간 업데이트**: WebSocket으로 상태 변화 실시간 반영
6. **Telegram 원격 제어**: /status, /task, /add, /remove 명령어

## 환경 변수
- `DATABASE_URL` - PostgreSQL 연결 (자동 설정)
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY` - Claude API (Replit Integration)
- `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` - API 기본 URL
- `TELEGRAM_BOT_TOKEN` - Telegram 봇 토큰 (선택적)

## 컬러 스킴
- Primary: #5865F2 (보라)
- Secondary: #57F287 (민트 그린)
- Background: #2C2F33 (다크 슬레이트)
- UI Elements: #40444B (차콜)
- Accent: #FEE75C (노랑)
- Text: #FFFFFF (흰색)

## 폰트
Space Grotesk / Inter / Roboto (sans-serif), JetBrains Mono (mono)
