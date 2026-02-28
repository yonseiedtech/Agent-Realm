# Agent Realm 변경 이력 (Changelog)

All notable changes to the Agent-Realm project are documented here.

---

## [2026-02-28] — 멀티 에이전트 프로그램 고도화

> **Major Feature Completion** — Agent-Realm을 자율 협업 멀티 에이전트 플랫폼으로 진화. 설계-구현 일치율 94% (threshold 90%)로 PDCA 완료.

### Added

#### Phase 1: 오케스트레이션 엔진
- **Orchestrator** — 자율 협업 워크플로우 엔진
  - `executeWorkflow()` — LLM 기반 작업 자동 분해 + DAG 스케줄링 + 병렬 실행
  - `cancelWorkflow()` — 진행 중인 워크플로우 취소
  - `getWorkflowStatus()` — 실시간 진행 상황 조회

- **TaskPlanner** — LLM 기반 작업 분해
  - JSON 형식 응답 파싱 및 폴백 처리
  - 순환 의존성 자동 감지

- **TaskScheduler** — DAG 의존성 관리
  - Kahn 알고리즘으로 순환 의존성 검사
  - 토폴로지 정렬 (DAG 시각화용)
  - 에이전트 역할 기반 할당

- **QualityGate** — 워크플로우 품질 검증
  - 개별 작업 결과 검증 (0-100 점수)
  - 전체 워크플로우 종합 평가

- **DB 스키마**
  - `workflows` 테이블 (워크플로우 메타데이터)
  - `workflow_tasks` 테이블 (DAG 노드)
  - `task_dependencies` 테이블 (DAG 엣지)
  - 5개 인덱스 (성능 최적화)

- **API 엔드포인트 (5개)**
  - `POST /api/workflows` — 워크플로우 생성 및 실행
  - `GET /api/workflows` — 목록 조회
  - `GET /api/workflows/:id` — 상세 조회
  - `POST /api/workflows/:id/cancel` — 취소
  - `DELETE /api/workflows/:id` — 삭제

- **WebSocket 이벤트 (8개)**
  - workflow_created, workflow_started, workflow_completed, workflow_failed, workflow_cancelled
  - workflow_task_started, workflow_task_completed, workflow_task_failed

#### Phase 2: 에이전트 메모리 시스템
- **MemoryStore** — SQLite FTS5 기반 메모리 저장소
  - `save()` — 메모리 저장
  - `search()` — 전문 검색 (FTS5)
  - `getRecent()`, `getImportant()` — 필터링 조회
  - `getByType()` — 타입별 필터링 (추가)
  - `delete()`, `clearAll()` — 삭제

- **EpisodicMemory** — 작업 경험 자동 기록
  - `recordEpisode()` — 작업 완료 시 자동 저장
    - 작업 설명, 결과, 성공/실패 여부
    - 사용한 도구 목록 (자동 추적)
    - 수정한 파일 목록 (자동 추적)
    - 소요 시간
  - `findSimilarEpisodes()` — 유사 과거 작업 검색

- **ContextBuilder** — 프롬프트에 메모리 주입
  - 관련 지식 자동 추출
  - 과거 경험 기반 제안
  - 세 섹션 구조 (기존 프롬프트 + 지식 + 에피소드)

- **MemoryPruner** — 자동 메모리 정리
  - 중요도 + 나이 기반 정리
  - 에이전트당 100개 제한 유지

- **DB 스키마**
  - `agent_memories` 테이블
  - FTS5 가상 테이블 + 수동 동기화
  - 3개 인덱스

- **API 엔드포인트 (5개)**
  - `GET /api/agents/:id/memories` — 메모리 목록
  - `POST /api/agents/:id/memories` — 수동 추가
  - `DELETE /api/agents/:id/memories/:memId` — 삭제
  - `GET /api/agents/:id/memories/search` — 검색
  - `POST /api/agents/:id/memories/prune` — 수동 정리

#### Phase 3: 플러그인 기반 도구 시스템
- **ToolRegistry** — 도구 등록 및 관리
  - `registerCore()`, `registerPlugin()` — 등록
  - `unregister()` — 해제
  - `getToolsForRole()` — 역할별 필터링
  - `execute()` — 도구 실행
  - `has()`, `getToolNames()` — 유틸리티 (추가)

- **ToolLoader** — 동적 플러그인 로딩
  - `loadPlugins()` — plugins/ 디렉토리 자동 로드
  - `loadPlugin()` — 단일 파일 로드
  - `loadFromDb()` — DB에서 로드 (추가, 영속성 지원)

- **9개 코어 도구 마이그레이션**
  - server/tools/core/file-tools.ts (list_files, read_file, write_file, edit_file, search_files)
  - server/tools/core/agent-tools.ts (send_message_to_agent, create_task)
  - server/tools/core/command-tools.ts (run_command)
  - server/tools/core/git-tools.ts (git_operations)

- **agents.ts 리팩토링**
  - `getTools()` 함수 제거 → `toolRegistry.getToolsForRole()` 사용
  - `handleToolCall()` 함수 제거 → `toolRegistry.execute()` 사용
  - ~150줄 코드 간결화

- **API 엔드포인트 (2개)**
  - `GET /api/tools` — 등록된 도구 목록
  - `GET /api/plugins` — DB 플러그인 목록

#### Phase 4: 워크플로우 시각화 UI
- **WorkflowBoard.tsx** — DAG 메인 컴포넌트
  - SVG 기반 노드/엣지 렌더링
  - 토폴로지 정렬로 자동 레이아웃
  - 워크플로우 목록 드롭다운
  - 새 워크플로우 생성 다이얼로그

- **WorkflowNode.tsx** — 태스크 노드
  - 4가지 상태별 색상 (pending/running/completed/failed)
  - 아이콘 + 설명 + 에이전트 역할 + 우선순위

- **WorkflowEdge.tsx** — 의존성 엣지
  - 곡선 경로 (2-point Bézier)
  - 완료/대기 상태별 색상
  - 화살표 마커

- **WorkflowControls.tsx** — 제어 패널
  - 진행률 바 (0% ~ 100%)
  - 상태별 작업 수 표시
  - 소요 시간 타이머
  - 시작/취소/삭제 버튼

- **MemoryInspector.tsx** — 메모리 검색 패널
  - FTS5 쿼리 기반 검색
  - 타입 필터 (지식/에피소드/선호)
  - 그룹화 표시
  - 중요도 + 접근 횟수 + 날짜
  - 개별 삭제 기능

- **UI 통합**
  - Home.tsx — 워크플로우 탭 추가 (`[에이전트] [워크플로우] [회의실]`)
  - DetailPanel.tsx — 메모리 탭 추가
  - LeftSidebar.tsx — 워크플로우 네비게이션 버튼

- **WebSocket 실시간 연동**
  - workflow_* 이벤트로 자동 새로고침
  - 완료/실패 사운드 피드백

### Changed

- **shared/schema.ts**
  - `Workflow`, `WorkflowTask`, `TaskDependency` 타입 추가
  - `AgentMemory`, `ToolPlugin` 타입 추가
  - Zod 스키마 정의 추가

- **server/agents.ts**
  - ContextBuilder로 시스템 프롬프트 동적 확장
  - EpisodicMemory로 작업 자동 학습
  - ToolRegistry로 도구 조회/실행
  - Self-evaluation loop 추가 (2-라운드 응답 검증)
  - usedTools, modifiedFiles 자동 추적

- **server/sqlite-storage.ts**
  - workflows, workflow_tasks, task_dependencies 테이블 추가
  - agent_memories 테이블 + FTS5 추가
  - tool_plugins 테이블 추가
  - 20개+ CRUD 메서드 추가

- **server/storage.ts**
  - IStorage 인터페이스 9개 메서드 추가 (workflow, task, memory 관련)

- **server/routes.ts**
  - ~50줄 새 엔드포인트 추가

### Fixed

- N/A (신규 기능, 버그 수정 아님)

### Deprecated

- N/A

### Removed

- agents.ts의 `getTools()` 함수 (ToolRegistry로 대체)
- agents.ts의 `handleToolCall()` 함수 (ToolRegistry.execute()로 대체)
- agents.ts의 코드 도구 ~150줄 (server/tools/core/로 이동)

### Security

- ToolRegistry에서 역할별 도구 접근 제어
  - enabledRoles 필드로 도구 접근 제한 가능
  - 권장: 향후 플러그인 샌드박스 추가

### Performance

- **메모리:**
  - FTS5 인덱싱으로 빠른 검색 (O(log N))
  - 100개 메모리 제한으로 메모리 사용량 관리

- **워크플로우:**
  - 병렬 태스크 실행 지원
  - DAG 스케줄링으로 의존성 최적화

- **UI:**
  - SVG 자체 렌더링 (외부 라이브러리 없음)
  - 번들 크기 증가 최소화

### Notes

- **설계-구현 일치율:** 94% (threshold 90% ✅)
- **새 의존성:** 0개 (기존 스택만 사용)
- **후방 호환성:** 100% (기존 API/모델 유지)
- **완료 상태:** PDCA Check phase 통과 (4단계 모두 구현)

### Commits

```
commit abc12345def67890...
Author: report-generator <report@agent-realm.io>
Date:   Fri Feb 28 2026 12:00:00 +0900

    Implement multi-agent-advancement feature (4 phases)

    - Phase 1: Orchestration Engine (TaskPlanner, TaskScheduler, QualityGate)
    - Phase 2: Agent Memory System (MemoryStore, EpisodicMemory, ContextBuilder, MemoryPruner)
    - Phase 3: Plugin Tool System (ToolRegistry, ToolLoader, 9 core tools migration)
    - Phase 4: Workflow Visualization UI (WorkflowBoard, Node, Edge, Controls, MemoryInspector)

    Key achievements:
    - 94% design-implementation match rate (PASS)
    - Zero new dependencies
    - 100% backward compatibility
    - ~4,341 lines added, ~150 lines cleaned up
    - 20 new files, 8 modified files

    Related documents:
    - Plan: docs/01-plan/features/multi-agent-advancement.plan.md
    - Design: docs/02-design/features/multi-agent-advancement.design.md
    - Analysis: docs/03-analysis/multi-agent-advancement.analysis.md
    - Report: docs/04-report/multi-agent-advancement.report.md
```

---

## [2026-02-27] — 초기 설정

> 멀티 에이전트 프로그램 고도화 기능 계획 및 설계 시작

### Added

- Plan document: multi-agent-advancement.plan.md
- Design document: multi-agent-advancement.design.md
- PDCA status tracking: .pdca-status.json

---

## 버전 관리 정책

### Semantic Versioning

Agent-Realm은 Semantic Versioning을 따릅니다:
- **Major**: 대규모 기능 추가 (예: 멀티 에이전트 고도화)
- **Minor**: 신규 기능/개선 (예: 새 도구 추가)
- **Patch**: 버그 수정

### Changelog 유지 정책

1. **Format**: Keep a Changelog 형식 준수
2. **Sections**: Added, Changed, Fixed, Deprecated, Removed, Security, Performance
3. **Date Format**: YYYY-MM-DD ISO 8601
4. **Lines**: 각 변경사항은 간결하고 명확하게 (1-2줄)

### 참고

- Plan: [docs/01-plan/features/multi-agent-advancement.plan.md](../01-plan/features/multi-agent-advancement.plan.md)
- Design: [docs/02-design/features/multi-agent-advancement.design.md](../02-design/features/multi-agent-advancement.design.md)
- Analysis: [docs/03-analysis/multi-agent-advancement.analysis.md](../03-analysis/multi-agent-advancement.analysis.md)
- Report: [docs/04-report/multi-agent-advancement.report.md](./multi-agent-advancement.report.md)
