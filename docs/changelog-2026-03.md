# Agent Realm 변경 이력 — 2026년 3월

All notable changes from the March 2026 sessions are documented here.

---

## [2026-03-01] Session 2 — 설정 기능 수정 + 에이전트별 API 키 지원

> **Feature** — 각 에이전트마다 전용 API 키를 설정하여, 선택한 모델의 프로바이더에 맞는 키를 자동으로 사용하도록 구현.

### Added

#### 에이전트별 API 키 (Per-Agent API Key)
- **Schema** (`shared/schema.ts`)
  - `Agent` 인터페이스에 `apiKey: string | null` 필드 추가
  - `insertAgentSchema`에 `apiKey: z.string().nullable().default(null)` 추가

- **DB 마이그레이션** (`server/sqlite-storage.ts`)
  - `add_agent_apiKey` 마이그레이션: `ALTER TABLE agents ADD COLUMN apiKey TEXT`
  - `createAgent()`에 apiKey 컬럼 INSERT 포함

- **라우트 검증** (`server/routes.ts`)
  - `updateAgentSchema`에 `apiKey: z.string().nullable().optional()` 추가 (`.strict()` 통과)

- **AI 클라이언트** (`server/ai-client.ts`)
  - `ChatRequest` 인터페이스에 `apiKey?: string | null` 추가
  - `ToolResultContinuation` 인터페이스에 `apiKey?: string | null` 추가
  - 3개 클라이언트 팩토리에 `agentApiKey` 매개변수 추가:
    - `getAnthropicClient(agentApiKey?)` — 우선순위: 에이전트 키 > 글로벌 설정(`custom_api_key`) > 환경변수(`ANTHROPIC_API_KEY`)
    - `getOpenAIClient(agentApiKey?)` — 우선순위: 에이전트 키 > 글로벌 설정(`openai_api_key`)
    - `getGoogleClient(agentApiKey?)` — 우선순위: 에이전트 키 > 글로벌 설정(`google_api_key`)
  - 6개 provider 함수 모두 `req.apiKey` 전달:
    - `chatAnthropic`, `chatOpenAI`, `chatGoogle`
    - `continueAnthropic`, `continueOpenAI`, `continueGoogle`

- **에이전트 채팅** (`server/agents.ts`)
  - `chatWithAgent()`에서 `agent.apiKey`를 모든 AI 호출에 전달:
    - 초기 `chatCompletion()` 호출
    - 도구 사용 루프 내 `continueWithToolResults()` 호출
    - Self-evaluation 루프 내 `chatCompletion()` + `continueWithToolResults()` 호출 (총 4곳)

- **UI** (`client/src/components/DetailPanel.tsx`)
  - 설정 탭에 API 키 입력 필드 추가 (`type="password"`)
  - 선택한 모델에 따라 프로바이더 라벨 동적 표시 (Anthropic / OpenAI / Google Gemini)
  - 안내 문구: "에이전트 전용 키가 글로벌 설정보다 우선합니다"
  - `handleSaveSettings()`에 `apiKey` 포함
  - `useEffect` 의존성 배열에 `agent?.apiKey` 추가

### API 키 우선순위 체계
```
에이전트 전용 키 (agent.apiKey)
  ↓ (없으면)
글로벌 설정 키 (settings 테이블)
  ↓ (없으면)
환경변수 (process.env.ANTHROPIC_API_KEY 등)
  ↓ (없으면)
에러 throw
```

### 변경된 파일 (7개)
| 파일 | 변경 유형 |
|------|-----------|
| `shared/schema.ts` | Agent 타입 + Zod 스키마 확장 |
| `server/sqlite-storage.ts` | DB 마이그레이션 + createAgent 수정 |
| `server/routes.ts` | updateAgentSchema 확장 |
| `server/ai-client.ts` | ChatRequest/ToolResultContinuation 확장 + 팩토리 수정 |
| `server/agents.ts` | apiKey 전달 (4곳) |
| `client/src/components/DetailPanel.tsx` | API 키 입력 UI 추가 |

---

## [2026-03-01] Session 1 — UI/UX 개선 + 워크플로우 재실행 + AI 아바타 + 플로팅 위젯

> **Major UX Overhaul** — 로딩 UX, Toast 시스템, 워크플로우 재실행, AI 아바타 오류 수정, 플로팅 위젯 UI 리디자인을 포함한 대규모 UX 개선.

### Added

#### Step 1: 워크플로우 재실행 (백엔드)
- **Orchestrator** (`server/orchestrator/index.ts`)
  - `retryWorkflow(workflowId)` — 실패한 작업만 pending으로 리셋, completed 보존, `runWorkflowLoop()` 재실행
  - `retryTask(workflowId, taskId)` — 단일 실패 작업 재실행, 완료 후 워크플로우 상태 재평가

- **API 엔드포인트** (`server/routes.ts`)
  - `POST /api/workflows/:id/retry` — 전체 워크플로우 재실행
  - `POST /api/workflows/:id/tasks/:taskId/retry` — 개별 작업 재실행

#### Step 2: 로딩 UX 개선
- **ChatSkeleton** (`client/src/components/ui/ChatSkeleton.tsx`) — 신규 파일
  - 채팅 메시지 형태의 스켈레톤 (에이전트 메시지 2개 + 유저 메시지 1개)

- **CenterPanel** (`client/src/components/CenterPanel.tsx`)
  - `historyLoading` 시 Loader2 스피너 → `<ChatSkeleton />` 교체
  - `chatMutation.isPending` 시 "생각 중..." → 삼점 바운스 애니메이션 (framer-motion)
  - `chatMutation.onError`에 toast 연결

- **DetailPanel** (`client/src/components/DetailPanel.tsx`)
  - tasks/activities 쿼리에서 `isLoading` 추출
  - 로딩 시 Skeleton 카드 3개 표시
  - 설정 저장/아바타 생성 성공·실패 → toast 알림으로 교체

#### Step 3: Toast 시스템 활성화
- **use-toast.ts** (`client/src/hooks/use-toast.ts`)
  - `TOAST_REMOVE_DELAY`: 1,000,000ms → 5,000ms (5초 후 자동 제거)

#### Step 4: 워크플로우 UI 개선
- **WorkflowNode** (`client/src/components/workflow/WorkflowNode.tsx`) — 전면 재작성
  - `useState(hovered)` + 마우스 이벤트 → 테두리 강조
  - `running` 상태: SVG `<animate>` 요소로 글로우 펄스 효과
  - SVG `<title>` 요소로 네이티브 브라우저 툴팁 (설명 + 결과)
  - `failed` 노드에 ↻ 재실행 아이콘 (`onRetry` prop)

- **WorkflowBoard** (`client/src/components/workflow/WorkflowBoard.tsx`) — 전면 재작성
  - `createMutation.isPending`: 반투명 오버레이 + Loader2 스피너
  - `retryTaskMutation` 추가, WorkflowNode에 `onRetry` prop 전달
  - empty state 개선 (GitBranch 아이콘 + 부제목)
  - 에러/성공 시 toast 알림

- **WorkflowControls** (`client/src/components/workflow/WorkflowControls.tsx`) — 전면 재작성
  - `status === "failed"` 시 "↻ 재실행" 버튼 추가
  - `retryMutation` + toast 알림
  - 취소/삭제 시에도 toast 알림

### Changed

#### AI 아바타 생성 수정
- **image-gen.ts** (`server/image-gen.ts`) — 전면 재작성
  - 모델 변경: `gemini-2.5-flash-image` → `gemini-2.0-flash-exp`
  - 에러 처리 강화: API_KEY_INVALID, PERMISSION_DENIED, RESOURCE_EXHAUSTED, SAFETY, model not found 개별 파싱
  - null 반환 → 구체적 Error throw로 변경 (사용자에게 명확한 에러 메시지 전달)
  - 응답 레벨 안전 검사 추가: `candidate.finishReason === "SAFETY"`, `promptFeedback.blockReason`
  - 프롬프트 개선: 투명 배경(PNG alpha channel) + 풀바디 치비 캐릭터 요청

#### 플로팅 위젯 UI 리디자인
- **Widget.tsx** (`client/src/pages/Widget.tsx`) — 전면 재작성 (2회)
  - 글래스모픽 박스 UI → 투명 배경 + 캐릭터 스프라이트만 표시
  - 원형 크롭 → 풀바디 이미지 (`objectFit: "contain"`)
  - 마우스 휠 스케일링 (MIN_SCALE=0.6 ~ MAX_SCALE=1.6, STEP=0.1)
  - 모든 요소(charW, charH, fontSize, status dot) 비례 스케일링
  - Electron IPC로 스케일 값 영속 저장

- **main.cjs** (`electron/main.cjs`)
  - `let widgetScale = 1.0;` 변수 추가
  - 위젯 윈도우 높이: 80 → 100
  - IPC 핸들러 추가: `set-widget-scale`, `get-widget-scale`

- **preload.cjs** (`electron/preload.cjs`)
  - `setWidgetScale(scale)`, `getWidgetScale()` API 추가

- **electron.d.ts** (`client/src/types/electron.d.ts`)
  - `setWidgetScale`, `getWidgetScale` 타입 선언 추가

### 변경된 파일 (총 15개)
| 파일 | 변경 유형 |
|------|-----------|
| `server/orchestrator/index.ts` | retryWorkflow, retryTask 추가 |
| `server/routes.ts` | retry API 2개 + apiKey 검증 추가 |
| `server/image-gen.ts` | 전면 재작성 (모델, 에러 처리, 프롬프트) |
| `client/src/hooks/use-toast.ts` | TOAST_REMOVE_DELAY 변경 |
| `client/src/components/ui/ChatSkeleton.tsx` | **신규** |
| `client/src/components/CenterPanel.tsx` | 스켈레톤 + 바운스 + toast |
| `client/src/components/DetailPanel.tsx` | 스켈레톤 + toast + API 키 UI |
| `client/src/components/workflow/WorkflowNode.tsx` | 전면 재작성 |
| `client/src/components/workflow/WorkflowBoard.tsx` | 전면 재작성 |
| `client/src/components/workflow/WorkflowControls.tsx` | 전면 재작성 |
| `client/src/pages/Widget.tsx` | 전면 재작성 (2회) |
| `electron/main.cjs` | 위젯 스케일 IPC 추가 |
| `electron/preload.cjs` | 위젯 스케일 API 추가 |
| `client/src/types/electron.d.ts` | 위젯 스케일 타입 추가 |
| `shared/schema.ts` | Agent apiKey 필드 추가 |

### Fixed
- AI 아바타 500 에러 — Gemini API 모델명 오류 + 에러 응답 미처리
- Toast 실질적 미사용 — 자동 제거 딜레이가 ~17분이어서 사용자가 인지 불가
- 워크플로우 실패 시 영구 실패 상태 — 재실행 수단 없음

### Performance
- 위젯 스케일 변경 시 불필요한 리렌더링 방지 (prevCount/prevScale ref 비교)
- 투명 배경 위젯은 GPU 컴포지팅으로 렌더링 (Electron `transparent: true`)

### Notes
- 빌드 성공: `npm run build` + `npm run electron:build`
- EXE 경로: `release/win-unpacked/Agent Realm.exe`
- 신규 의존성: 0개

---

## 아키텍처 요약

### AI 프로바이더 멀티 지원
```
모델 접두사 → 프로바이더 결정
  gpt-*, o1*, o3*, o4* → OpenAI
  gemini-*             → Google Gemini
  그 외               → Anthropic (Claude)
```

### API 키 우선순위
```
Agent.apiKey (에이전트별)
  → Settings 테이블 (글로벌)
    → process.env (환경변수)
      → Error throw
```

### 플로팅 위젯 스케일링
```
마우스 휠 → setScale() → Electron IPC → widgetScale 저장
  → calcSize() → resizeWidget() → 윈도우 크기 조정
```
