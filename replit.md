# AI 에이전트 팀 - 2D 캐릭터 기반 AI 개발 협업 시스템

## 프로젝트 개요
다중 AI 에이전트(2D 캐릭터)가 Claude AI를 기반으로 하나의 프로젝트를 협업하여 개선하는 웹 애플리케이션.
에이전트들이 서로 소통하며 파일을 분석/수정하고, 회의실에서 토론하며, Telegram을 통해 원격 제어 가능.
PWA 지원으로 Windows 11 바탕화면 위젯처럼 사용 가능.

## 기술 스택
- **프론트엔드**: React 18, Tailwind CSS, Shadcn UI, TanStack Query v5
- **백엔드**: Express.js, WebSocket (ws)
- **AI**: Anthropic Claude API (Replit AI Integrations)
- **데이터베이스**: PostgreSQL (Drizzle ORM)
- **기타**: Telegram Bot API (선택적), PWA (manifest + service worker)

## 프로젝트 구조
```
client/src/
  pages/Home.tsx              - 메인 대시보드 페이지
  components/
    Scene3D.tsx               - 2D CSS 캐릭터 카드 시각화
    AgentPanel.tsx            - 에이전트 상세 패널 (채팅/설정 탭)
    AgentChatPanel.tsx        - 에이전트 간 대화 뷰어
    ActivityFeed.tsx          - 실시간 활동 피드
    MeetingRoom.tsx           - 회의실 UI (생성/초대/토론)
    SettingsDialog.tsx        - 글로벌 설정 다이얼로그
  hooks/
    useWebSocket.ts           - WebSocket 연결 훅
  lib/
    queryClient.ts            - TanStack Query 설정

client/public/
  manifest.json               - PWA 매니페스트
  sw.js                       - 서비스 워커

server/
  index.ts                    - Express 서버 진입점
  routes.ts                   - API 라우트 & WebSocket
  storage.ts                  - 데이터베이스 CRUD (IStorage 인터페이스)
  db.ts                       - PostgreSQL 연결
  agents.ts                   - AI 에이전트 매니저 (Claude 통합, DB 영속 대화)
  meetings.ts                 - 회의실 시스템 (생성/초대/토론)
  workspace.ts                - 파일 시스템 작업 & 파일 잠금
  telegram.ts                 - Telegram 봇 통합

shared/
  schema.ts                   - Drizzle ORM 스키마
```

## DB 스키마
- `users` - 사용자 인증
- `agents` - AI 에이전트 (이름, 역할, 상태, 모델 설정, 시스템 프롬프트 등)
- `tasks` - 에이전트 작업
- `agentMessages` - 에이전트 간 메시지
- `activityLogs` - 활동 로그
- `chatHistory` - 에이전트별 대화 기록 (영속 저장)
- `settings` - 글로벌 키-값 설정
- `meetingRooms` - 회의실 (이름, 주제, 상태)
- `meetingParticipants` - 회의 참가자
- `meetingMessages` - 회의 발언 기록

## 주요 기능
1. **2D 캐릭터 시각화**: CSS 애니메이션 캐릭터 카드 (동물 이모지)
2. **Claude AI 에이전트**: 각 캐릭터가 독립적 AI로 파일 읽기/쓰기/분석
3. **에이전트 간 소통**: 에이전트들이 서로 메시지를 주고받으며 협업
4. **에이전트 설정**: 커스텀 시스템 프롬프트, 모델 선택, 최대 토큰, Temperature 조절
5. **대화 기록 영속 저장**: 서버 재시작 후에도 대화 기록 유지 (DB 저장)
6. **이미지 붙여넣기**: Ctrl+V로 클립보드 이미지 첨부 가능
7. **회의실**: 에이전트 초대/퇴장, 주제별 토론 진행, 실시간 발언
8. **실시간 업데이트**: WebSocket으로 상태 변화 실시간 반영
9. **Telegram 원격 제어**: /status, /task, /add, /remove 명령어
10. **PWA 지원**: 독립 실행 모드, 바탕화면 위젯

## API 엔드포인트
- `GET/POST /api/agents` - 에이전트 CRUD
- `PATCH /api/agents/:id` - 에이전트 업데이트 (설정 포함)
- `POST /api/agents/:id/chat` - 에이전트 채팅
- `GET /api/agents/:id/history` - 대화 기록 조회
- `DELETE /api/agents/:id/history` - 대화 기록 초기화
- `GET/PUT /api/settings` - 글로벌 설정
- `POST /api/upload` - 이미지 업로드 (base64)
- `POST /api/meetings` - 회의실 생성
- `GET /api/meetings` - 회의실 목록
- `GET /api/meetings/:id` - 회의실 상세
- `POST /api/meetings/:id/invite` - 에이전트 초대
- `DELETE /api/meetings/:id/participants/:agentId` - 에이전트 퇴장
- `POST /api/meetings/:id/discuss` - 토론 시작
- `POST /api/meetings/:id/close` - 회의 종료

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
