# Plan: 멀티 에이전트 프로그램 고도화

> **Feature**: multi-agent-advancement
> **Created**: 2026-02-28
> **Status**: Draft
> **Level**: Dynamic

---

## 1. 개요 (Overview)

Agent-Realm을 현재의 "사용자 지시 기반 에이전트 대화 시스템"에서 **자율 협업이 가능한 멀티 에이전트 플랫폼**으로 고도화한다. 에이전트들이 스스로 작업을 분배하고, 과거 경험을 학습하며, 동적으로 도구를 확장할 수 있는 시스템을 구축한다.

### 현재 상태 분석

| 영역 | 현재 | 목표 |
|------|------|------|
| 협업 방식 | 사용자가 일일이 지시 | 오케스트레이터가 자동 분배/검증 |
| 컨텍스트 | 최근 20개 메시지만 유지 | 장기 메모리 + 에이전트별 지식 베이스 |
| 도구 | 하드코딩된 9개 도구 | 플러그인 기반 동적 도구 등록 |
| 작업 흐름 | 단일 작업 → 단일 응답 | 파이프라인 기반 멀티스텝 워크플로우 |
| 자체 평가 | Self-eval 2라운드 | 피어 리뷰 + 품질 게이트 |

---

## 2. 목표 (Objectives)

### 2.1 핵심 목표

1. **자율 협업 워크플로우 엔진**: PM 에이전트가 작업을 자동 분해 → 할당 → 검증하는 오케스트레이션 시스템
2. **에이전트 메모리 시스템**: 장기 메모리(벡터 DB), 단기 메모리(세션), 에피소드 메모리(과거 작업 결과)
3. **플러그인 기반 도구 확장**: 런타임에 도구를 등록/해제할 수 있는 플러그인 아키텍처
4. **워크플로우 시각화**: 작업 파이프라인, 에이전트 상호작용을 실시간으로 볼 수 있는 UI

### 2.2 비기능 목표

- 기존 기능 100% 하위 호환 유지
- 에이전트 추가/제거 시 시스템 안정성 유지
- API 응답 시간 현재 대비 120% 이내

---

## 3. 핵심 기능 (Key Features)

### F1. 오케스트레이션 엔진 (Orchestration Engine)

**목적**: 복잡한 작업을 자동으로 분해하고 적절한 에이전트에게 할당

```
사용자 요청
    ↓
[Orchestrator] 작업 분석 & 분해
    ↓
[Task Graph] DAG 기반 작업 의존성 관리
    ├─ Task A (Fullstack) ──┐
    ├─ Task B (Designer)  ──┤─→ [Review Gate] ─→ [통합]
    └─ Task C (Tester)    ──┘
```

**주요 컴포넌트**:
- **TaskPlanner**: 사용자 요청을 작업 그래프(DAG)로 분해
- **TaskScheduler**: 의존성 기반 작업 스케줄링 및 병렬 실행
- **QualityGate**: 작업 결과 자동 검증 (피어 리뷰, 테스트)
- **ConflictResolver**: 에이전트 간 충돌 해결 (파일 잠금, 의견 충돌)

**구현 위치**: `server/orchestrator/`

### F2. 에이전트 메모리 시스템 (Agent Memory)

**목적**: 에이전트가 과거 경험을 학습하고 활용

```
┌─ 단기 메모리 (Short-term) ───────────────┐
│  현재 세션의 대화 컨텍스트 (기존 유지)     │
└──────────────────────────────────────────┘
┌─ 장기 메모리 (Long-term) ────────────────┐
│  프로젝트 지식, 코드 패턴, 아키텍처 이해   │
│  → SQLite FTS5 기반 전문 검색              │
└──────────────────────────────────────────┘
┌─ 에피소드 메모리 (Episodic) ─────────────┐
│  과거 작업 결과, 성공/실패 패턴, 해결 방법 │
│  → 작업 완료 시 자동 기록                  │
└──────────────────────────────────────────┘
```

**주요 컴포넌트**:
- **MemoryStore**: 메모리 저장/검색 인터페이스
- **MemoryIndexer**: 작업 결과를 자동으로 인덱싱
- **ContextBuilder**: 에이전트 프롬프트에 관련 메모리를 동적 주입
- **MemoryPruner**: 오래된/불필요한 메모리 자동 정리

**구현 위치**: `server/memory/`

### F3. 플러그인 기반 도구 시스템 (Plugin Tools)

**목적**: 에이전트가 사용할 수 있는 도구를 런타임에 동적으로 확장

```
┌─ Core Tools (기본 제공) ─────────────────┐
│  list_files, read_file, write_file, ...  │
└──────────────────────────────────────────┘
┌─ Plugin Tools (동적 등록) ───────────────┐
│  web_search, db_query, api_call, ...     │
│  → plugins/ 디렉토리에 JS/TS 파일 추가   │
└──────────────────────────────────────────┘
┌─ Agent-specific Tools (역할별) ──────────┐
│  PM: project_plan, assign_work           │
│  Tester: run_tests, coverage_report      │
│  DevOps: deploy, check_ci               │
└──────────────────────────────────────────┘
```

**주요 컴포넌트**:
- **ToolRegistry**: 도구 등록/해제/조회
- **ToolLoader**: `plugins/` 디렉토리에서 도구 자동 로드
- **ToolValidator**: 도구 입출력 스키마 검증
- **RoleToolFilter**: 에이전트 역할별 도구 접근 제어

**구현 위치**: `server/tools/`

### F4. 워크플로우 시각화 UI

**목적**: 에이전트 간 상호작용과 작업 진행을 실시간으로 시각화

**주요 화면**:
- **Workflow Board**: 작업 그래프(DAG) 시각화 (노드/엣지)
- **Agent Activity Timeline**: 에이전트별 활동 타임라인
- **Memory Inspector**: 에이전트 메모리 검색 및 조회
- **Plugin Manager**: 등록된 도구 목록 및 관리

**구현 위치**: `client/src/components/workflow/`

---

## 4. 기술 스택 (Tech Stack)

### 추가 예정

| 영역 | 기술 | 사유 |
|------|------|------|
| 작업 그래프 | 자체 DAG 구현 | 외부 의존성 최소화, SQLite에 저장 |
| 전문 검색 | SQLite FTS5 | 기존 SQLite 활용, 추가 DB 불필요 |
| 워크플로우 UI | React Flow | DAG 시각화에 최적화된 라이브러리 |
| 상태 머신 | XState (경량) 또는 자체 구현 | 워크플로우 상태 관리 |

### 기존 유지

- React + Vite + TailwindCSS (프론트엔드)
- Express + WebSocket (백엔드)
- SQLite via better-sqlite3 (데이터베이스)
- Electron (데스크톱 패키징)
- Anthropic/OpenAI/Google AI SDK (AI 프로바이더)

---

## 5. 구현 우선순위 (Priority)

### Phase 1: 오케스트레이션 기반 (1차 핵심)
1. **TaskPlanner** — 작업 분해 및 DAG 생성
2. **TaskScheduler** — 의존성 기반 스케줄링
3. **QualityGate** — 작업 결과 자동 검증
4. DB 스키마 확장 (workflow, workflow_tasks 테이블)

### Phase 2: 메모리 시스템 (2차 핵심)
5. **MemoryStore** — SQLite FTS5 기반 장기 메모리
6. **EpisodicMemory** — 작업 결과 자동 기록
7. **ContextBuilder** — 프롬프트에 메모리 동적 주입
8. DB 스키마 확장 (agent_memories, memory_index 테이블)

### Phase 3: 도구 확장 (3차)
9. **ToolRegistry** — 플러그인 등록/관리
10. **ToolLoader** — 동적 도구 로딩
11. **RoleToolFilter** — 역할별 도구 접근 제어
12. 기존 도구를 플러그인 구조로 마이그레이션

### Phase 4: UI 시각화 (4차)
13. **Workflow Board** — DAG 시각화
14. **Agent Timeline** — 활동 타임라인
15. **Memory Inspector** — 메모리 조회 UI
16. **Plugin Manager UI** — 도구 관리 화면

---

## 6. 데이터 모델 변경 (Schema Changes)

### 새로운 테이블

```sql
-- 워크플로우 (작업 파이프라인)
CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',  -- pending, running, completed, failed
  createdBy TEXT,                  -- 요청한 사용자 또는 에이전트 ID
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  completedAt DATETIME
);

-- 워크플로우 태스크 (DAG 노드)
CREATE TABLE workflow_tasks (
  id TEXT PRIMARY KEY,
  workflowId TEXT NOT NULL REFERENCES workflows(id),
  agentId TEXT REFERENCES agents(id),
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending',  -- pending, running, completed, failed, skipped
  result TEXT,
  priority TEXT DEFAULT 'medium',
  orderIndex INTEGER DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  completedAt DATETIME
);

-- 태스크 의존성 (DAG 엣지)
CREATE TABLE task_dependencies (
  id TEXT PRIMARY KEY,
  taskId TEXT NOT NULL REFERENCES workflow_tasks(id),
  dependsOnTaskId TEXT NOT NULL REFERENCES workflow_tasks(id)
);

-- 에이전트 장기 메모리
CREATE TABLE agent_memories (
  id TEXT PRIMARY KEY,
  agentId TEXT NOT NULL REFERENCES agents(id),
  type TEXT NOT NULL,           -- 'knowledge', 'episode', 'preference'
  content TEXT NOT NULL,
  metadata TEXT,                -- JSON 메타데이터
  importance REAL DEFAULT 0.5,  -- 중요도 (0-1)
  accessCount INTEGER DEFAULT 0,
  lastAccessedAt DATETIME,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- FTS5 인덱스 (전문 검색)
CREATE VIRTUAL TABLE agent_memories_fts USING fts5(
  content,
  content=agent_memories,
  content_rowid=rowid
);

-- 플러그인 도구 등록
CREATE TABLE tool_plugins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  inputSchema TEXT NOT NULL,    -- JSON Schema
  handlerPath TEXT NOT NULL,    -- 핸들러 파일 경로
  enabledRoles TEXT,            -- 사용 가능 역할 (JSON 배열, null=전체)
  isEnabled INTEGER DEFAULT 1,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 기존 테이블 변경

```sql
-- agents 테이블에 추가
ALTER TABLE agents ADD COLUMN memoryEnabled INTEGER DEFAULT 1;
ALTER TABLE agents ADD COLUMN toolPlugins TEXT;  -- 활성화된 플러그인 ID 목록 (JSON)

-- tasks 테이블에 추가
ALTER TABLE tasks ADD COLUMN workflowId TEXT REFERENCES workflows(id);
ALTER TABLE tasks ADD COLUMN dependencies TEXT;  -- 의존 태스크 ID 배열 (JSON)
```

---

## 7. API 변경 (API Changes)

### 새로운 엔드포인트

```
# 워크플로우
POST   /api/workflows                    # 워크플로우 생성 (자동 작업 분해)
GET    /api/workflows                    # 워크플로우 목록
GET    /api/workflows/:id                # 워크플로우 상세 (DAG 포함)
POST   /api/workflows/:id/start          # 워크플로우 실행 시작
POST   /api/workflows/:id/cancel         # 워크플로우 취소
DELETE /api/workflows/:id                # 워크플로우 삭제

# 메모리
GET    /api/agents/:id/memories          # 에이전트 메모리 조회
POST   /api/agents/:id/memories          # 메모리 수동 추가
DELETE /api/agents/:id/memories/:memId   # 메모리 삭제
GET    /api/agents/:id/memories/search   # 메모리 검색 (FTS5)

# 플러그인
GET    /api/plugins                      # 등록된 플러그인 목록
POST   /api/plugins                      # 플러그인 등록
DELETE /api/plugins/:id                  # 플러그인 삭제
PATCH  /api/plugins/:id                  # 플러그인 활성화/비활성화
```

---

## 8. 파일 구조 변경 (Directory Changes)

```
server/
├── orchestrator/
│   ├── index.ts              # 오케스트레이터 메인
│   ├── task-planner.ts       # 작업 분해 (LLM 기반)
│   ├── task-scheduler.ts     # DAG 기반 스케줄러
│   ├── quality-gate.ts       # 결과 검증
│   └── conflict-resolver.ts  # 충돌 해결
├── memory/
│   ├── index.ts              # 메모리 시스템 메인
│   ├── memory-store.ts       # SQLite FTS5 기반 저장소
│   ├── episodic-memory.ts    # 에피소드 메모리
│   ├── context-builder.ts    # 프롬프트 메모리 주입
│   └── memory-pruner.ts      # 메모리 정리
├── tools/
│   ├── index.ts              # 도구 레지스트리
│   ├── tool-registry.ts      # 등록/관리
│   ├── tool-loader.ts        # 동적 로딩
│   ├── tool-validator.ts     # 스키마 검증
│   ├── core/                 # 기존 코어 도구 (마이그레이션)
│   │   ├── file-tools.ts
│   │   ├── git-tools.ts
│   │   ├── command-tools.ts
│   │   └── agent-tools.ts
│   └── plugins/              # 사용자 플러그인
│       └── example-plugin.ts
├── agents.ts                 # 기존 유지 (오케스트레이터 연동)
├── ...
client/src/
├── components/
│   ├── workflow/
│   │   ├── WorkflowBoard.tsx    # DAG 시각화
│   │   ├── WorkflowNode.tsx     # 작업 노드
│   │   ├── WorkflowEdge.tsx     # 의존성 엣지
│   │   └── WorkflowControls.tsx # 제어 패널
│   ├── memory/
│   │   ├── MemoryInspector.tsx  # 메모리 조회
│   │   └── MemorySearch.tsx     # 메모리 검색
│   ├── plugins/
│   │   └── PluginManager.tsx    # 플러그인 관리
│   └── ...
```

---

## 9. 리스크 및 완화 (Risks & Mitigation)

| 리스크 | 영향 | 완화 방안 |
|--------|------|-----------|
| 오케스트레이션 무한 루프 | 시스템 정지 | 최대 반복 횟수 제한 (5회), 타임아웃 설정 |
| 메모리 DB 크기 증가 | 성능 저하 | MemoryPruner로 자동 정리, 중요도 기반 보존 |
| 플러그인 보안 | 악성 코드 실행 | 샌드박스 실행, 허용 API 화이트리스트 |
| AI API 비용 증가 | 비용 초과 | 오케스트레이터가 최소 에이전트만 호출, 캐싱 활용 |
| 기존 기능 하위 호환 | 사용자 불만 | 점진적 마이그레이션, Feature flag 사용 |

---

## 10. 성공 기준 (Success Criteria)

- [ ] 사용자가 복합 요청 시 오케스트레이터가 자동으로 작업 분해/할당
- [ ] 에이전트가 과거 작업 경험을 기반으로 더 나은 응답 제공
- [ ] plugins/ 디렉토리에 파일 추가만으로 새 도구 사용 가능
- [ ] 워크플로우 진행 상황을 UI에서 실시간 확인 가능
- [ ] 기존 1:1 채팅, 회의실 기능 정상 동작

---

## 11. 참고 자료

- 현재 에이전트 시스템: `server/agents.ts` (697 lines)
- AI 클라이언트: `server/ai-client.ts` (491 lines)
- 스키마: `shared/schema.ts` (198 lines)
- 회의실 시스템: `server/meetings.ts` (355 lines)
- 작업 공간: `server/workspace.ts` (157 lines)
