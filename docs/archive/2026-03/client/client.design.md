# client Design Document

> **Summary**: Agent-Realm 프론트엔드 UI/UX 전반 개선 — 상태 분리, 리사이즈 패널, UX 일관성
>
> **Project**: agent-realm
> **Version**: 1.0.0
> **Author**: rlaeo
> **Date**: 2026-03-01
> **Status**: Draft
> **Planning Doc**: [client.plan.md](../01-plan/features/client.plan.md)

---

## 1. Overview

### 1.1 Design Goals

- Home.tsx(250줄)의 상태 관리 로직을 커스텀 훅으로 분리하여 유지보수성 확보
- 3패널 레이아웃에 드래그 리사이즈를 적용하여 사용자 맞춤 화면 구성 지원
- 에러/로딩/빈 상태 UI 패턴을 통일하여 일관된 UX 제공
- 미사용 UI 컴포넌트 정리를 통한 번들 크기 축소

### 1.2 Design Principles

- **최소 변경 원칙**: 기존 동작에 영향을 주지 않으면서 구조만 개선
- **점진적 리팩토링**: 한 번에 하나의 FR만 구현하고 검증
- **기존 패턴 존중**: 새로운 라이브러리/패턴 도입 최소화, 이미 설치된 의존성 활용

---

## 2. Architecture

### 2.1 현재 컴포넌트 구조

```
Home.tsx (250줄 — 모든 상태 + 뷰 분기)
├── LeftSidebar (agents, meetings, workflow 네비게이션)
├── CenterPanel (에이전트 채팅 뷰) — 786줄
├── DetailPanel (에이전트 상세/설정) — motion 애니메이션
├── MeetingCenterPanel (회의실 뷰)
├── WorkflowBoard (워크플로우 뷰)
├── AgentChatPanel (다이얼로그 모달)
└── CommandPalette (Ctrl+K)
```

### 2.2 개선 후 컴포넌트 구조

```
Home.tsx (~100줄 — 뷰 렌더링만)
├── hooks/useAppState.ts       ← 새로 생성 (뷰 전환, 패널 상태)
├── hooks/useAgentActions.ts   ← 새로 생성 (CRUD mutation)
├── hooks/useWebSocket.ts      ← 기존 유지
├── hooks/useSound.ts          ← 기존 유지
├── hooks/useTTS.ts            ← 기존 유지
│
├── LeftSidebar (변경 없음)
├── CenterPanel (변경 없음)
├── DetailPanel (변경 없음)
├── MeetingCenterPanel (변경 없음)
├── WorkflowBoard (변경 없음)
├── AgentChatPanel (변경 없음)
└── CommandPalette (변경 없음)
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| Home.tsx | useAppState, useAgentActions | 상태 관리 위임 |
| useAppState | — | 뷰 전환, 선택 상태, 패널 토글 |
| useAgentActions | react-query | 에이전트 CRUD, broadcast, discuss |
| ResizablePanelGroup | @radix-ui/react-resizable (이미 설치) | 패널 리사이즈 |

---

## 3. 상세 설계

### 3.1 FR-02: Home.tsx 상태 분리

#### useAppState.ts

```typescript
// client/src/hooks/useAppState.ts
interface AppState {
  selectedAgentId: string | null;
  rightPanelOpen: boolean;
  activeMeetingRoomId: string | null;
  activeWorkflowView: boolean;
  chatPanelOpen: boolean;
  commandPaletteOpen: boolean;
}

export function useAppState() {
  // 현재 Home.tsx의 6개 useState를 하나로 통합
  // 뷰 전환 시 상호 배타적 상태 자동 관리
  // 반환: state + 액션 함수들
  return {
    ...state,
    selectAgent: (id: string) => { /* 에이전트 선택 + 회의실/워크플로우 해제 */ },
    selectMeetingRoom: (roomId: string) => { /* 회의실 선택 + 에이전트/워크플로우 해제 */ },
    selectWorkflow: () => { /* 워크플로우 선택 + 나머지 해제 */ },
    toggleRightPanel: () => void,
    toggleChatPanel: () => void,
    toggleCommandPalette: () => void,
  };
}
```

#### useAgentActions.ts

```typescript
// client/src/hooks/useAgentActions.ts
export function useAgentActions() {
  // 현재 Home.tsx의 createMutation, deleteMutation, broadcastMutation, discussMutation 이동
  return {
    createAgent: (name: string, role: string) => void,
    deleteAgent: (id: string) => void,
    broadcast: (description: string) => void,
    discuss: (topic: string) => void,
    isCreating: boolean,
    isBroadcasting: boolean,
    isDiscussing: boolean,
  };
}
```

### 3.2 FR-01: 리사이즈 가능한 3패널 레이아웃

현재 `resizable.tsx` UI 컴포넌트가 이미 존재하고, `react-resizable-panels` 의존성이 설치되어 있음.

#### 변경 사항

```tsx
// Home.tsx — 현재
<div className="h-screen flex overflow-hidden">
  <LeftSidebar ... />          {/* w-[260px] 고정 */}
  <CenterPanel ... />          {/* flex-1 */}
  <DetailPanel ... />          {/* motion 애니메이션 */}
</div>

// Home.tsx — 개선 후
<div className="h-screen flex overflow-hidden">
  <ResizablePanelGroup direction="horizontal">
    <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
      <LeftSidebar ... />
    </ResizablePanel>
    <ResizableHandle />
    <ResizablePanel defaultSize={55}>
      <CenterPanel ... />
    </ResizablePanel>
    <ResizableHandle />
    <ResizablePanel defaultSize={25} minSize={20} maxSize={40}
                    collapsible collapsedSize={0}>
      <DetailPanel ... />
    </ResizablePanel>
  </ResizablePanelGroup>
</div>
```

#### LeftSidebar 변경

- `w-[260px]` 고정 폭 제거 → `w-full h-full` (부모 패널 크기에 맞춤)

#### DetailPanel 변경

- `framer-motion` AnimatePresence 제거 → ResizablePanel `collapsible` 속성으로 대체
- 패널 접힘/펼침은 ResizablePanel의 collapse/expand API 사용

### 3.3 FR-03: 빈 상태(Empty State) UI 통일

현재 상태:
- CenterPanel: `MessageSquare` 아이콘 + 텍스트 (OK)
- LeftSidebar 에이전트 없음: 텍스트만 ("에이전트가 없습니다")
- DetailPanel: 없음 (에이전트 미선택 시 패널 자체가 숨김)

개선 방안:
- 기존 CenterPanel 빈 상태 유지 (이미 잘 구현됨)
- 추가 변경 불필요 — 현재 패턴이 충분

### 3.4 FR-04: WebSocket 연결 상태 표시 개선

현재: `useWebSocket.ts`에서 `connected` boolean만 반환, 재연결 시 3초 후 자동 재시도하지만 사용자에게 알림 없음

개선:
```typescript
// useWebSocket.ts 수정
export function useWebSocket(onMessage?) {
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  const connect = useCallback(() => {
    setReconnecting(!wsRef.current ? false : true);
    const ws = new WebSocket(...);
    ws.onopen = () => { setConnected(true); setReconnecting(false); };
    ws.onclose = () => {
      setConnected(false);
      setReconnecting(true);
      setTimeout(connect, 3000);
    };
    ...
  }, [onMessage]);

  return { connected, reconnecting };
}
```

LeftSidebar 헤더에 재연결 표시:
```tsx
{reconnecting && (
  <span className="text-[10px]" style={{ color: "var(--dc-yellow)" }}>
    <Loader2 className="w-3 h-3 animate-spin inline" /> 재연결 중...
  </span>
)}
```

### 3.5 FR-05: 로딩/에러 패턴 일관성

현재 패턴 분석:
- CenterPanel: `ChatSkeleton` + 삼점 바운스 + toast (잘 구현됨)
- DetailPanel: Skeleton 카드 3개 + toast (잘 구현됨)
- WorkflowBoard: Loader2 스피너 + toast (잘 구현됨)

결론: 이미 대부분 일관되게 구현되어 있음. 추가 작업 최소화.

### 3.6 FR-06: 미사용 UI 컴포넌트 정리

`client/src/components/ui/`에 60+ 파일이 존재. 실제 import 여부 확인 후 미사용 파일 삭제.

확인 방법:
```bash
# 각 UI 컴포넌트에 대해 import 참조 검색
grep -r "from.*ui/accordion" client/src/ --include="*.tsx" --include="*.ts"
```

**삭제 후보** (실제 import 검색 필요):
- accordion, alert, aspect-ratio, breadcrumb, calendar, carousel, chart
- checkbox, collapsible, context-menu, drawer, form, hover-card
- input-otp, menubar, navigation-menu, pagination, popover, progress
- radio-group, sheet, sidebar, slider (DetailPanel에서 사용 확인 필요)
- table, toggle, toggle-group

---

## 5. UI/UX Design

### 5.1 Screen Layout (개선 후)

```
┌──────────────────────────────────────────────────────────────┐
│ LeftSidebar (15~30%)  │ CenterPanel (자동)  │ DetailPanel     │
│ ┌──────────────┐  ↔   │ ┌──────────────┐    │ (20~40%,        │
│ │ Agent Realm  │      │ │ 에이전트 뷰  │    │  collapsible)   │
│ │ 에이전트 목록│      │ │ 3D 캐릭터    │  ↔ │ ┌─────────────┐│
│ │ 워크플로우   │      │ │ 채팅 영역    │    │ │ 설정/작업    ││
│ │ 회의실       │      │ │ 입력창       │    │ │ 활동 로그    ││
│ └──────────────┘      │ └──────────────┘    │ └─────────────┘│
│ [액션 버튼]           │                     │                │
└──────────────────────────────────────────────────────────────┘
         ↔ = 드래그 리사이즈 핸들
```

### 5.2 Component List

| Component | Location | Responsibility | 변경 |
|-----------|----------|----------------|------|
| Home.tsx | pages/ | 레이아웃 + 뷰 분기 | 축소 (250→~100줄) |
| useAppState | hooks/ | 뷰 전환 상태 관리 | **신규** |
| useAgentActions | hooks/ | 에이전트 CRUD mutation | **신규** |
| useWebSocket | hooks/ | WebSocket + 재연결 표시 | **수정** |
| LeftSidebar | components/ | 좌측 사이드바 | 고정폭 제거 |
| CenterPanel | components/ | 채팅 메인 뷰 | 변경 없음 |
| DetailPanel | components/ | 상세 패널 | AnimatePresence 제거 |

---

## 6. Error Handling

### 6.1 기존 패턴 (유지)

| 상황 | 처리 | 위치 |
|------|------|------|
| API 호출 실패 | toast(destructive) | CenterPanel, DetailPanel |
| WebSocket 끊김 | 3초 후 자동 재연결 | useWebSocket |
| 채팅 전송 실패 | toast 알림 | CenterPanel |

### 6.2 추가 사항

| 상황 | 처리 | 위치 |
|------|------|------|
| WebSocket 재연결 중 | Loader2 스피너 + "재연결 중" 텍스트 | LeftSidebar 헤더 |

---

## 7. Security Considerations

- [x] 기존 보안 모델 유지 (프론트엔드 전용 변경)
- [x] API 키 UI는 `type="password"` 유지 (DetailPanel)
- [x] XSS: 사용자 입력은 React의 자동 이스케이프 처리
- N/A: 백엔드 변경 없음

---

## 8. Test Plan

### 8.1 Test Scope

| Type | Target | Tool |
|------|--------|------|
| 수동 테스트 | 전체 UI 동작 | Electron 앱 실행 |
| 빌드 검증 | TypeScript + Vite 빌드 | `npm run build` |
| EXE 검증 | Electron 패키징 | `npm run electron:build` |

### 8.2 Test Cases

- [ ] 리사이즈 핸들로 3패널 크기 조절 가능
- [ ] 패널 리사이즈 시 컨텐츠 정상 렌더링
- [ ] 에이전트 선택/회의실/워크플로우 전환 정상 동작
- [ ] 에이전트 생성/삭제/채팅 기능 정상 동작
- [ ] WebSocket 끊김 → 재연결 표시 → 복구
- [ ] Ctrl+K 커맨드 팔레트 정상 동작
- [ ] EXE 빌드 후 정상 실행

---

## 11. Implementation Guide

### 11.1 File Structure (변경 사항)

```
client/src/
├── hooks/
│   ├── useAppState.ts        ← 신규
│   ├── useAgentActions.ts    ← 신규
│   ├── useWebSocket.ts       ← 수정 (reconnecting 추가)
│   ├── useSound.ts           ← 유지
│   ├── useTTS.ts             ← 유지
│   └── use-toast.ts          ← 유지
├── pages/
│   └── Home.tsx              ← 리팩토링 (축소)
├── components/
│   ├── LeftSidebar.tsx       ← 수정 (고정폭 제거, 재연결 표시)
│   ├── DetailPanel.tsx       ← 수정 (AnimatePresence 제거)
│   └── ui/                   ← 미사용 파일 삭제
└── (기타 변경 없음)
```

### 11.2 Implementation Order

1. [ ] **Step 1**: `useAppState.ts` + `useAgentActions.ts` 생성, Home.tsx 리팩토링 (FR-02)
2. [ ] **Step 2**: ResizablePanelGroup 적용 — Home.tsx 레이아웃 + LeftSidebar/DetailPanel 수정 (FR-01)
3. [ ] **Step 3**: useWebSocket 수정 + LeftSidebar 재연결 표시 (FR-04)
4. [ ] **Step 4**: 미사용 UI 컴포넌트 검색 및 삭제 (FR-06)
5. [ ] **Step 5**: 빌드 검증 + EXE 빌드 테스트

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-03-01 | Initial draft | rlaeo |
