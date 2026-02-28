# Design: 멀티 에이전트 프로그램 고도화

> **Feature**: multi-agent-advancement
> **Plan Reference**: `docs/01-plan/features/multi-agent-advancement.plan.md`
> **Created**: 2026-02-28
> **Status**: Draft

---

## 1. 아키텍처 개요

### 1.1 현재 → 목표 아키텍처

```
현재:
User ──→ REST API ──→ agents.ts ──→ AI Provider ──→ Response
                          ↕
                     SQLite Storage

목표:
User ──→ REST API ──→ Orchestrator ──→ TaskPlanner (LLM)
                          │                 ↓
                          │           Task DAG 생성
                          │                 ↓
                          ├──→ TaskScheduler ──→ Agent A ──→ AI + Tools
                          │                 ──→ Agent B ──→ AI + Tools
                          │                 ──→ Agent C ──→ AI + Tools
                          │                        ↓
                          ├──→ QualityGate ←── 결과 수집
                          │         ↓
                          ├──→ Memory System ←── 작업 경험 저장
                          │
                          └──→ WebSocket ──→ UI (실시간 DAG 시각화)
```

### 1.2 모듈 의존성

```
server/
├── orchestrator/          ← 신규 (F1)
│   ├── depends: ai-client, storage, tools, memory
│   └── used by: routes.ts
├── memory/                ← 신규 (F2)
│   ├── depends: storage (SQLite)
│   └── used by: orchestrator, agents.ts
├── tools/                 ← 신규 (F3)
│   ├── depends: workspace, storage
│   └── used by: agents.ts, orchestrator
├── agents.ts              ← 기존 수정
│   ├── depends: ai-client, storage, tools (신규), memory (신규)
│   └── 기존 getTools() → tools/ 모듈로 위임
├── ai-client.ts           ← 변경 없음
├── storage.ts / sqlite-storage.ts ← 확장 (새 테이블)
└── routes.ts              ← 확장 (새 엔드포인트)
```

---

## 2. Phase 1: 오케스트레이션 엔진 상세 설계

### 2.1 데이터 모델

#### shared/schema.ts 추가 타입

```typescript
// ============ Workflow ============
export interface Workflow {
  id: string;
  title: string;
  description: string | null;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  createdBy: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export const insertWorkflowSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().default(null),
  status: z.string().default("pending"),
  createdBy: z.string().nullable().default(null),
});
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;

// ============ WorkflowTask ============
export interface WorkflowTask {
  id: string;
  workflowId: string;
  agentId: string | null;
  description: string;
  status: "pending" | "queued" | "running" | "completed" | "failed" | "skipped";
  result: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  orderIndex: number;
  createdAt: Date;
  completedAt: Date | null;
}

export const insertWorkflowTaskSchema = z.object({
  workflowId: z.string(),
  agentId: z.string().nullable().default(null),
  description: z.string().min(1),
  status: z.string().default("pending"),
  result: z.string().nullable().default(null),
  priority: z.string().default("medium"),
  orderIndex: z.number().default(0),
});
export type InsertWorkflowTask = z.infer<typeof insertWorkflowTaskSchema>;

// ============ TaskDependency ============
export interface TaskDependency {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
}

export const insertTaskDependencySchema = z.object({
  taskId: z.string(),
  dependsOnTaskId: z.string(),
});
export type InsertTaskDependency = z.infer<typeof insertTaskDependencySchema>;
```

#### SQLite 마이그레이션 (sqlite-storage.ts)

```sql
-- workflows 테이블
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  createdBy TEXT,
  createdAt TEXT NOT NULL,
  completedAt TEXT
);

-- workflow_tasks 테이블
CREATE TABLE IF NOT EXISTS workflow_tasks (
  id TEXT PRIMARY KEY,
  workflowId TEXT NOT NULL,
  agentId TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  result TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  orderIndex INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  completedAt TEXT
);

-- task_dependencies 테이블
CREATE TABLE IF NOT EXISTS task_dependencies (
  id TEXT PRIMARY KEY,
  taskId TEXT NOT NULL,
  dependsOnTaskId TEXT NOT NULL
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_workflowId ON workflow_tasks(workflowId);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_agentId ON workflow_tasks(agentId);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_status ON workflow_tasks(status);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_taskId ON task_dependencies(taskId);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_dependsOn ON task_dependencies(dependsOnTaskId);
```

### 2.2 IStorage 인터페이스 확장

```typescript
// storage.ts에 추가
export interface IStorage {
  // ... 기존 메서드 유지 ...

  // Workflow
  createWorkflow(data: InsertWorkflow): Promise<Workflow>;
  getWorkflow(id: string): Promise<Workflow | undefined>;
  getAllWorkflows(): Promise<Workflow[]>;
  updateWorkflow(id: string, data: Partial<InsertWorkflow>): Promise<Workflow | undefined>;
  deleteWorkflow(id: string): Promise<void>;

  // WorkflowTask
  createWorkflowTask(data: InsertWorkflowTask): Promise<WorkflowTask>;
  getWorkflowTask(id: string): Promise<WorkflowTask | undefined>;
  getWorkflowTasks(workflowId: string): Promise<WorkflowTask[]>;
  updateWorkflowTask(id: string, data: Partial<InsertWorkflowTask>): Promise<WorkflowTask | undefined>;

  // TaskDependency
  createTaskDependency(data: InsertTaskDependency): Promise<TaskDependency>;
  getTaskDependencies(taskId: string): Promise<TaskDependency[]>;
  getDependents(taskId: string): Promise<TaskDependency[]>;
}
```

### 2.3 오케스트레이터 모듈

#### server/orchestrator/index.ts

```typescript
import { TaskPlanner } from "./task-planner";
import { TaskScheduler } from "./task-scheduler";
import { QualityGate } from "./quality-gate";

export interface OrchestratorConfig {
  maxConcurrentTasks: number;   // 기본: 3
  maxWorkflowTimeout: number;   // 기본: 300000 (5분)
  enableQualityGate: boolean;   // 기본: true
}

export interface WorkflowResult {
  workflowId: string;
  status: "completed" | "failed" | "cancelled";
  tasks: Array<{
    id: string;
    agentId: string;
    description: string;
    status: string;
    result: string | null;
  }>;
  summary: string;
}

export class Orchestrator {
  private planner: TaskPlanner;
  private scheduler: TaskScheduler;
  private qualityGate: QualityGate;
  private config: OrchestratorConfig;
  private activeWorkflows: Map<string, AbortController>;

  constructor(config?: Partial<OrchestratorConfig>);

  /**
   * 사용자 요청을 받아 워크플로우를 생성하고 실행한다.
   * 1. TaskPlanner로 작업 분해
   * 2. TaskScheduler로 DAG 기반 스케줄링
   * 3. 각 태스크를 에이전트에게 할당/실행
   * 4. QualityGate로 결과 검증
   */
  async executeWorkflow(request: string, createdBy?: string): Promise<WorkflowResult>;

  /**
   * 기존 워크플로우를 시작한다 (수동 생성 후 실행).
   */
  async startWorkflow(workflowId: string): Promise<WorkflowResult>;

  /**
   * 실행 중인 워크플로우를 취소한다.
   */
  async cancelWorkflow(workflowId: string): Promise<void>;

  /**
   * 워크플로우 진행 상황을 조회한다.
   */
  async getWorkflowStatus(workflowId: string): Promise<{
    workflow: Workflow;
    tasks: WorkflowTask[];
    dependencies: TaskDependency[];
    progress: { total: number; completed: number; running: number; failed: number };
  }>;
}
```

#### server/orchestrator/task-planner.ts

```typescript
import { chatCompletion } from "../ai-client";

export interface PlannedTask {
  description: string;
  suggestedRole: string;        // 추천 에이전트 역할
  priority: "low" | "medium" | "high" | "urgent";
  dependsOn: number[];          // 인덱스 기반 의존성
  estimatedComplexity: "simple" | "moderate" | "complex";
}

export interface TaskPlan {
  title: string;
  tasks: PlannedTask[];
}

export class TaskPlanner {
  /**
   * LLM을 사용하여 사용자 요청을 작업 목록으로 분해한다.
   *
   * 시스템 프롬프트:
   * - 사용 가능한 에이전트 역할 목록 제공
   * - 작업 간 의존성을 정의하도록 지시
   * - JSON 형식으로 응답 요청
   *
   * @param request 사용자의 원본 요청
   * @param availableAgents 현재 등록된 에이전트 목록
   * @returns 분해된 작업 계획
   */
  async planTasks(request: string, availableAgents: Agent[]): Promise<TaskPlan>;

  /**
   * 작업 계획을 검증한다.
   * - 순환 의존성 감지
   * - 존재하지 않는 역할 체크
   * - 빈 작업 방지
   */
  validatePlan(plan: TaskPlan): { valid: boolean; errors: string[] };
}
```

**TaskPlanner LLM 프롬프트 설계**:

```
당신은 프로젝트 매니저입니다. 사용자의 요청을 분석하여 구체적인 작업 목록으로 분해하세요.

현재 사용 가능한 에이전트:
{{agentList}}

다음 JSON 형식으로 응답하세요:
{
  "title": "워크플로우 제목",
  "tasks": [
    {
      "description": "구체적인 작업 설명",
      "suggestedRole": "fullstack|designer|tester|devops|pm|general",
      "priority": "low|medium|high|urgent",
      "dependsOn": [],
      "estimatedComplexity": "simple|moderate|complex"
    }
  ]
}

규칙:
1. 각 작업은 단일 에이전트가 수행할 수 있는 단위로 분해
2. 의존성은 반드시 선행 작업의 인덱스(0부터)로 표현
3. 병렬 실행 가능한 작업은 동일한 의존성 레벨로 설정
4. 최소 1개, 최대 8개의 작업으로 분해
```

#### server/orchestrator/task-scheduler.ts

```typescript
export interface ScheduledTask {
  workflowTaskId: string;
  agentId: string;
  description: string;
  status: "waiting" | "ready" | "running" | "completed" | "failed";
}

export class TaskScheduler {
  /**
   * 작업 목록에서 현재 실행 가능한 작업을 반환한다.
   * (모든 의존성이 completed인 작업)
   */
  getReadyTasks(
    tasks: WorkflowTask[],
    dependencies: TaskDependency[]
  ): WorkflowTask[];

  /**
   * 작업에 가장 적합한 에이전트를 선택한다.
   * 1. suggestedRole과 일치하는 idle 에이전트 우선
   * 2. 없으면 general 역할의 idle 에이전트
   * 3. 모든 에이전트가 busy면 가장 빨리 끝날 에이전트 대기
   */
  async assignAgent(
    task: WorkflowTask,
    suggestedRole: string,
    agents: Agent[]
  ): Promise<string>;

  /**
   * DAG에 순환 의존성이 있는지 검사한다.
   * Kahn's algorithm 사용.
   */
  detectCycle(
    tasks: WorkflowTask[],
    dependencies: TaskDependency[]
  ): boolean;

  /**
   * 워크플로우의 크리티컬 패스를 계산한다.
   * (가장 긴 의존성 체인)
   */
  getCriticalPath(
    tasks: WorkflowTask[],
    dependencies: TaskDependency[]
  ): string[];
}
```

#### server/orchestrator/quality-gate.ts

```typescript
export interface QualityCheckResult {
  passed: boolean;
  score: number;        // 0-100
  feedback: string;
  suggestions: string[];
}

export class QualityGate {
  /**
   * 개별 작업 결과를 LLM으로 검증한다.
   * - 작업 설명과 결과의 일치도
   * - 코드 품질 (파일 수정인 경우)
   * - 완성도 평가
   */
  async checkTaskResult(
    task: WorkflowTask,
    result: string
  ): Promise<QualityCheckResult>;

  /**
   * 워크플로우 전체 결과를 종합 검증한다.
   * - 원본 요청과의 일치도
   * - 모든 작업 결과의 일관성
   * - 누락된 항목 확인
   */
  async checkWorkflowResult(
    workflow: Workflow,
    tasks: WorkflowTask[],
    originalRequest: string
  ): Promise<QualityCheckResult>;
}
```

### 2.4 오케스트레이터 실행 흐름 (시퀀스)

```
executeWorkflow("로그인 페이지 만들어줘")
│
├─ 1. TaskPlanner.planTasks()
│     ├─ LLM 호출: 요청 분석
│     └─ 결과:
│         Task 0: "로그인 UI 컴포넌트 작성" (designer, dependsOn: [])
│         Task 1: "로그인 API 엔드포인트 작성" (fullstack, dependsOn: [])
│         Task 2: "UI-API 연동 및 통합" (fullstack, dependsOn: [0, 1])
│         Task 3: "통합 테스트 및 검증" (tester, dependsOn: [2])
│
├─ 2. DB에 Workflow + WorkflowTasks + Dependencies 저장
│     └─ WebSocket broadcast: workflow_created
│
├─ 3. TaskScheduler.getReadyTasks()
│     └─ Task 0, Task 1 (의존성 없음 → 병렬 실행)
│
├─ 4. 병렬 실행
│     ├─ Task 0 → Designer 에이전트 → chatWithAgent()
│     │     └─ WebSocket: task_started, task_completed
│     └─ Task 1 → Fullstack 에이전트 → chatWithAgent()
│           └─ WebSocket: task_started, task_completed
│
├─ 5. Task 0, 1 완료 → getReadyTasks() → Task 2 ready
│     └─ Task 2 → Fullstack 에이전트 → chatWithAgent()
│
├─ 6. Task 2 완료 → Task 3 ready
│     └─ Task 3 → Tester 에이전트 → chatWithAgent()
│
├─ 7. QualityGate.checkWorkflowResult()
│     └─ 전체 결과 검증
│
└─ 8. WorkflowResult 반환 + WebSocket: workflow_completed
```

### 2.5 API 엔드포인트 (routes.ts 확장)

```typescript
// POST /api/workflows — 워크플로우 생성 및 즉시 실행
app.post("/api/workflows", async (req, res) => {
  // body: { request: string, autoStart?: boolean }
  // autoStart 기본값: true
  // → orchestrator.executeWorkflow(request) 비동기 시작
  // → 즉시 { workflowId, status: "running" } 반환
});

// GET /api/workflows — 워크플로우 목록
app.get("/api/workflows", async (req, res) => {
  // → workflows 목록 (최신순, limit 50)
});

// GET /api/workflows/:id — 워크플로우 상세
app.get("/api/workflows/:id", async (req, res) => {
  // → workflow + tasks + dependencies + progress
});

// POST /api/workflows/:id/cancel — 워크플로우 취소
app.post("/api/workflows/:id/cancel", async (req, res) => {
  // → orchestrator.cancelWorkflow(id)
});

// DELETE /api/workflows/:id — 워크플로우 삭제
app.delete("/api/workflows/:id", async (req, res) => {
  // → DB에서 workflow + tasks + dependencies 삭제
});
```

### 2.6 WebSocket 이벤트 추가

```typescript
// 새로운 이벤트 타입 (AgentEvent.type에 추가)
type EventType =
  | "status_change" | "activity" | "agent_message" | "task_update"
  | "agent_created" | "agent_deleted" | "meeting_update"
  // 신규:
  | "workflow_created"      // 워크플로우 생성
  | "workflow_started"      // 워크플로우 실행 시작
  | "workflow_completed"    // 워크플로우 완료
  | "workflow_failed"       // 워크플로우 실패
  | "workflow_cancelled"    // 워크플로우 취소
  | "workflow_task_started" // 개별 태스크 실행 시작
  | "workflow_task_completed" // 개별 태스크 완료
  | "workflow_task_failed"  // 개별 태스크 실패
  ;
```

---

## 3. Phase 2: 에이전트 메모리 시스템 상세 설계

### 3.1 데이터 모델

#### shared/schema.ts 추가 타입

```typescript
// ============ AgentMemory ============
export interface AgentMemory {
  id: string;
  agentId: string;
  type: "knowledge" | "episode" | "preference";
  content: string;
  metadata: string | null;     // JSON
  importance: number;          // 0.0 ~ 1.0
  accessCount: number;
  lastAccessedAt: Date | null;
  createdAt: Date;
}

export const insertAgentMemorySchema = z.object({
  agentId: z.string(),
  type: z.enum(["knowledge", "episode", "preference"]),
  content: z.string().min(1),
  metadata: z.string().nullable().default(null),
  importance: z.number().min(0).max(1).default(0.5),
});
export type InsertAgentMemory = z.infer<typeof insertAgentMemorySchema>;
```

#### SQLite 마이그레이션

```sql
CREATE TABLE IF NOT EXISTS agent_memories (
  id TEXT PRIMARY KEY,
  agentId TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'knowledge',
  content TEXT NOT NULL,
  metadata TEXT,
  importance REAL NOT NULL DEFAULT 0.5,
  accessCount INTEGER NOT NULL DEFAULT 0,
  lastAccessedAt TEXT,
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_memories_agentId ON agent_memories(agentId);
CREATE INDEX IF NOT EXISTS idx_agent_memories_type ON agent_memories(type);
CREATE INDEX IF NOT EXISTS idx_agent_memories_importance ON agent_memories(importance);

-- FTS5 전문 검색 (content 기반)
CREATE VIRTUAL TABLE IF NOT EXISTS agent_memories_fts USING fts5(
  content,
  content=agent_memories,
  content_rowid=rowid,
  tokenize='unicode61'
);

-- FTS 트리거 (동기화)
CREATE TRIGGER IF NOT EXISTS agent_memories_ai AFTER INSERT ON agent_memories BEGIN
  INSERT INTO agent_memories_fts(rowid, content) VALUES (new.rowid, new.content);
END;
CREATE TRIGGER IF NOT EXISTS agent_memories_ad AFTER DELETE ON agent_memories BEGIN
  INSERT INTO agent_memories_fts(agent_memories_fts, rowid, content)
    VALUES('delete', old.rowid, old.content);
END;
CREATE TRIGGER IF NOT EXISTS agent_memories_au AFTER UPDATE ON agent_memories BEGIN
  INSERT INTO agent_memories_fts(agent_memories_fts, rowid, content)
    VALUES('delete', old.rowid, old.content);
  INSERT INTO agent_memories_fts(rowid, content) VALUES (new.rowid, new.content);
END;
```

### 3.2 메모리 모듈

#### server/memory/index.ts

```typescript
export { MemoryStore } from "./memory-store";
export { EpisodicMemory } from "./episodic-memory";
export { ContextBuilder } from "./context-builder";
export { MemoryPruner } from "./memory-pruner";
```

#### server/memory/memory-store.ts

```typescript
export class MemoryStore {
  /**
   * 메모리를 저장한다.
   */
  async save(data: InsertAgentMemory): Promise<AgentMemory>;

  /**
   * FTS5를 사용하여 메모리를 검색한다.
   * @param agentId 에이전트 ID
   * @param query 검색 쿼리
   * @param limit 최대 결과 수 (기본: 5)
   * @returns 관련도 순으로 정렬된 메모리 목록
   */
  async search(agentId: string, query: string, limit?: number): Promise<AgentMemory[]>;

  /**
   * 에이전트의 최근 메모리를 조회한다.
   */
  async getRecent(agentId: string, limit?: number): Promise<AgentMemory[]>;

  /**
   * 에이전트의 중요한 메모리를 조회한다 (importance 기준).
   */
  async getImportant(agentId: string, limit?: number): Promise<AgentMemory[]>;

  /**
   * 메모리를 삭제한다.
   */
  async delete(memoryId: string): Promise<void>;

  /**
   * 에이전트의 모든 메모리를 삭제한다.
   */
  async clearAll(agentId: string): Promise<void>;

  /**
   * 메모리 접근 횟수를 증가시키고 lastAccessedAt을 갱신한다.
   */
  async touch(memoryId: string): Promise<void>;
}
```

#### server/memory/episodic-memory.ts

```typescript
export interface Episode {
  taskDescription: string;
  taskResult: string;
  success: boolean;
  toolsUsed: string[];
  filesModified: string[];
  duration: number;       // ms
  timestamp: Date;
}

export class EpisodicMemory {
  /**
   * 작업 완료 시 자동으로 에피소드를 기록한다.
   * chatWithAgent()의 결과를 분석하여 요약 저장.
   *
   * 기록 항목:
   * - 작업 설명 (요약)
   * - 성공/실패 여부
   * - 사용한 도구 목록
   * - 수정한 파일 목록
   * - 소요 시간
   */
  async recordEpisode(agentId: string, episode: Episode): Promise<AgentMemory>;

  /**
   * 유사한 과거 에피소드를 검색한다.
   * 새 작업에 대해 과거에 비슷한 작업을 어떻게 처리했는지 참고용.
   */
  async findSimilarEpisodes(
    agentId: string,
    taskDescription: string,
    limit?: number
  ): Promise<AgentMemory[]>;
}
```

#### server/memory/context-builder.ts

```typescript
export class ContextBuilder {
  /**
   * 에이전트의 시스템 프롬프트에 관련 메모리를 주입한다.
   *
   * 1. 현재 대화 내용에서 키워드 추출
   * 2. MemoryStore.search()로 관련 메모리 검색
   * 3. EpisodicMemory.findSimilarEpisodes()로 과거 경험 검색
   * 4. 시스템 프롬프트에 '참고 정보' 섹션 추가
   *
   * @param agentId 에이전트 ID
   * @param basePrompt 기존 시스템 프롬프트
   * @param currentMessage 현재 사용자 메시지
   * @returns 메모리가 주입된 시스템 프롬프트
   */
  async buildContext(
    agentId: string,
    basePrompt: string,
    currentMessage: string
  ): Promise<string>;
}
```

**주입 형식 예시**:

```
{{기존 시스템 프롬프트}}

─── 참고 정보 (장기 메모리) ───
- 이 프로젝트는 React + Express + SQLite 구조입니다 [중요도: 0.9]
- API 라우트는 server/routes.ts에 정의되어 있습니다 [중요도: 0.8]

─── 관련 과거 경험 ───
- 유사 작업 "로그인 API 구현": 성공, AuthMiddleware 패턴 사용 [2026-02-20]
- 유사 작업 "DB 스키마 추가": 성공, migration 함수 사용 [2026-02-25]
```

#### server/memory/memory-pruner.ts

```typescript
export interface PruneConfig {
  maxMemoriesPerAgent: number;   // 기본: 100
  minImportance: number;         // 기본: 0.1
  maxAgeDays: number;            // 기본: 90
  accessCountThreshold: number;  // 기본: 0 (1번도 접근 안 된 메모리)
}

export class MemoryPruner {
  /**
   * 오래되고 중요도가 낮은 메모리를 자동 정리한다.
   *
   * 정리 기준 (OR):
   * 1. 에이전트당 maxMemories 초과 시 importance가 낮은 것부터 삭제
   * 2. importance < minImportance AND 생성일 > maxAgeDays
   * 3. accessCount == 0 AND 생성일 > 30일
   */
  async prune(agentId?: string): Promise<{ deleted: number }>;

  /**
   * 전체 에이전트에 대해 정리를 실행한다.
   * 서버 시작 시 및 일정 주기(매 24시간)마다 호출.
   */
  async pruneAll(): Promise<{ totalDeleted: number }>;
}
```

### 3.3 agents.ts 수정 포인트

```typescript
// chatWithAgent() 수정 사항:

// 1. 시스템 프롬프트 구성 시 ContextBuilder 사용
const contextBuilder = new ContextBuilder();
const systemPrompt = await contextBuilder.buildContext(
  agentId,
  basePrompt + projectContext + agentListStr,
  userMessage
);

// 2. 작업 완료 시 EpisodicMemory에 기록
const episodicMemory = new EpisodicMemory();
await episodicMemory.recordEpisode(agentId, {
  taskDescription: userMessage,
  taskResult: fullResponse,
  success: true,
  toolsUsed: [...],    // 실행 중 사용한 도구 추적
  filesModified: [...], // 수정한 파일 추적
  duration: Date.now() - startTime,
  timestamp: new Date(),
});
```

### 3.4 API 엔드포인트

```typescript
// GET /api/agents/:id/memories — 메모리 목록
// query: type?, limit?, offset?

// POST /api/agents/:id/memories — 메모리 수동 추가
// body: { type, content, importance? }

// DELETE /api/agents/:id/memories/:memId — 메모리 삭제

// GET /api/agents/:id/memories/search — 메모리 검색
// query: q (검색어), limit?
```

---

## 4. Phase 3: 플러그인 도구 시스템 상세 설계

### 4.1 데이터 모델

#### shared/schema.ts 추가 타입

```typescript
// ============ ToolPlugin ============
export interface ToolPlugin {
  id: string;
  name: string;
  description: string | null;
  inputSchema: string;        // JSON Schema (문자열)
  handlerPath: string;
  enabledRoles: string | null; // JSON 배열 또는 null (전체)
  isEnabled: boolean;
  createdAt: Date;
}

export const insertToolPluginSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().default(null),
  inputSchema: z.string(),
  handlerPath: z.string(),
  enabledRoles: z.string().nullable().default(null),
  isEnabled: z.boolean().default(true),
});
export type InsertToolPlugin = z.infer<typeof insertToolPluginSchema>;
```

### 4.2 도구 모듈

#### server/tools/tool-registry.ts

```typescript
import type { ToolDefinition } from "../ai-client";

export interface ToolHandler {
  (agentId: string, input: any): Promise<string>;
}

export interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
  roles: string[] | null;  // null = 모든 역할
  source: "core" | "plugin";
}

export class ToolRegistry {
  private tools: Map<string, RegisteredTool>;

  /**
   * 코어 도구를 등록한다 (서버 시작 시).
   */
  registerCore(name: string, def: ToolDefinition, handler: ToolHandler): void;

  /**
   * 플러그인 도구를 등록한다.
   */
  registerPlugin(
    name: string,
    def: ToolDefinition,
    handler: ToolHandler,
    roles?: string[]
  ): void;

  /**
   * 도구를 해제한다.
   */
  unregister(name: string): void;

  /**
   * 에이전트 역할에 맞는 도구 목록을 반환한다.
   */
  getToolsForRole(role: string): ToolDefinition[];

  /**
   * 도구 핸들러를 실행한다.
   */
  async execute(
    toolName: string,
    agentId: string,
    input: any
  ): Promise<string>;

  /**
   * 등록된 모든 도구 목록을 반환한다.
   */
  getAllTools(): RegisteredTool[];
}
```

#### server/tools/tool-loader.ts

```typescript
export class ToolLoader {
  /**
   * plugins/ 디렉토리에서 도구를 자동 로드한다.
   *
   * 플러그인 파일 형식:
   * export default {
   *   name: "web_search",
   *   description: "웹 검색을 수행합니다",
   *   inputSchema: { ... },
   *   roles: ["fullstack", "general"],   // 선택
   *   handler: async (agentId, input) => { ... }
   * }
   */
  async loadPlugins(pluginDir: string): Promise<number>;

  /**
   * 단일 플러그인 파일을 로드한다.
   */
  async loadPlugin(filePath: string): Promise<RegisteredTool>;

  /**
   * 플러그인 디렉토리를 감시하여 변경 시 자동 리로드.
   * (선택적 기능 - 초기에는 미구현)
   */
  watch(pluginDir: string): void;
}
```

**플러그인 작성 예시** (`server/tools/plugins/web-search.ts`):

```typescript
export default {
  name: "web_search",
  description: "인터넷에서 정보를 검색합니다",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "검색 쿼리" },
      maxResults: { type: "number", description: "최대 결과 수 (기본: 5)" },
    },
    required: ["query"],
  },
  roles: null, // 모든 역할 사용 가능
  handler: async (agentId: string, input: any): Promise<string> => {
    // 구현
    return "검색 결과...";
  },
};
```

### 4.3 기존 도구 마이그레이션

```
현재 agents.ts의 getTools() + handleToolCall()
    ↓
server/tools/core/ 디렉토리로 분리

core/file-tools.ts    → list_files, read_file, write_file, edit_file, search_files
core/agent-tools.ts   → send_message_to_agent, create_task
core/command-tools.ts  → run_command
core/git-tools.ts      → git_operations
```

**agents.ts 수정**:
```typescript
// 기존:
function getTools(): ToolDefinition[] { ... }
async function handleToolCall(...) { ... }

// 변경 후:
import { toolRegistry } from "./tools";

// getTools() 대신:
const tools = toolRegistry.getToolsForRole(agent.role);

// handleToolCall() 대신:
const result = await toolRegistry.execute(toolName, agentId, input);
```

---

## 5. Phase 4: 워크플로우 시각화 UI 상세 설계

### 5.1 새 탭 구조

```
기존 Home.tsx 탭:
[에이전트] [회의실]

변경 후:
[에이전트] [워크플로우] [회의실]
```

### 5.2 컴포넌트 설계

#### WorkflowBoard.tsx (메인)

```
┌─────────────────────────────────────────────────────────┐
│  [+ 새 워크플로우]   [워크플로우 목록 ▼]                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐        │
│  │ Task A   │────→│ Task C   │────→│ Task D   │        │
│  │ designer │     │ fullstack│     │ tester   │        │
│  │ ✅ done  │     │ 🔄 진행중 │     │ ⏳ 대기  │        │
│  └──────────┘     └──────────┘     └──────────┘        │
│                         ↑                               │
│  ┌──────────┐           │                               │
│  │ Task B   │───────────┘                               │
│  │ fullstack│                                           │
│  │ ✅ done  │                                           │
│  └──────────┘                                           │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  진행률: ████████░░ 50%  (2/4 완료)  ⏱ 1분 23초         │
└─────────────────────────────────────────────────────────┘
```

#### 컴포넌트 트리

```typescript
// client/src/components/workflow/WorkflowBoard.tsx
// - 워크플로우 목록 + 선택된 워크플로우의 DAG 표시
// - 새 워크플로우 생성 다이얼로그
// - 진행률 바

// client/src/components/workflow/WorkflowNode.tsx
// - 개별 태스크 노드 (아이콘, 상태, 에이전트, 설명)
// - 상태별 색상: pending=gray, running=blue, completed=green, failed=red

// client/src/components/workflow/WorkflowEdge.tsx
// - 태스크 간 의존성 선 (화살표)
// - 완료된 의존성은 녹색, 대기 중은 회색

// client/src/components/workflow/WorkflowControls.tsx
// - 시작/취소/삭제 버튼
// - 진행률 표시
// - 소요 시간 타이머
```

### 5.3 DAG 렌더링 방식

**경량 자체 구현** (React Flow 대신):
- SVG 기반 노드/엣지 렌더링
- 토폴로지 정렬로 레벨 결정 (level 0: 의존성 없음, level 1: level 0에 의존, ...)
- 같은 레벨의 노드는 수평 배치, 레벨 간은 수직 배치
- 외부 의존성 없이 기존 Tailwind + SVG로 구현

**이유**: React Flow는 ~200KB 번들 크기. 워크플로우 DAG는 최대 8개 노드로 단순하므로 자체 구현이 적합.

### 5.4 WebSocket 실시간 연동

```typescript
// useWebSocket 훅에 새 이벤트 핸들러 추가
case "workflow_created":
case "workflow_started":
case "workflow_completed":
case "workflow_failed":
case "workflow_cancelled":
  // queryClient.invalidateQueries(["workflows"]) 호출
  break;

case "workflow_task_started":
case "workflow_task_completed":
case "workflow_task_failed":
  // 해당 워크플로우의 태스크 상태 업데이트
  // queryClient.setQueryData(["workflow", workflowId], ...)
  break;
```

### 5.5 메모리 인스펙터 (간단)

```
┌──────────────────────────────────────┐
│  메모리 인스펙터 — Agent: 풀스택개발자  │
├──────────────────────────────────────┤
│  🔍 [검색어 입력...]                  │
│                                      │
│  📚 지식 (3)                          │
│  ├─ 이 프로젝트는 React+Express...    │
│  ├─ API 라우트는 routes.ts에...       │
│  └─ DB는 SQLite를 사용...             │
│                                      │
│  📝 에피소드 (2)                      │
│  ├─ [성공] 로그인 API 구현 (02-20)    │
│  └─ [성공] DB 스키마 추가 (02-25)     │
│                                      │
│  ⭐ 선호 (1)                          │
│  └─ 한국어로 응답                     │
└──────────────────────────────────────┘
```

에이전트 상세 패널(DetailPanel)에 탭으로 추가:
- `[정보]` `[활동]` `[메모리]`

---

## 6. 구현 순서 체크리스트

### Phase 1: 오케스트레이션 엔진
- [ ] `shared/schema.ts` — Workflow, WorkflowTask, TaskDependency 타입 추가
- [ ] `server/sqlite-storage.ts` — 새 테이블 마이그레이션 + CRUD 메서드
- [ ] `server/storage.ts` — IStorage 인터페이스 확장
- [ ] `server/orchestrator/task-planner.ts` — LLM 기반 작업 분해
- [ ] `server/orchestrator/task-scheduler.ts` — DAG 스케줄링
- [ ] `server/orchestrator/quality-gate.ts` — 결과 검증
- [ ] `server/orchestrator/index.ts` — Orchestrator 메인 클래스
- [ ] `server/routes.ts` — 워크플로우 API 엔드포인트 추가
- [ ] WebSocket 이벤트 추가

### Phase 2: 에이전트 메모리
- [ ] `shared/schema.ts` — AgentMemory 타입 추가
- [ ] `server/sqlite-storage.ts` — agent_memories 테이블 + FTS5 + CRUD
- [ ] `server/memory/memory-store.ts` — 저장/검색
- [ ] `server/memory/episodic-memory.ts` — 에피소드 기록
- [ ] `server/memory/context-builder.ts` — 프롬프트 주입
- [ ] `server/memory/memory-pruner.ts` — 자동 정리
- [ ] `server/agents.ts` — ContextBuilder/EpisodicMemory 연동

### Phase 3: 플러그인 도구
- [ ] `shared/schema.ts` — ToolPlugin 타입 추가
- [ ] `server/sqlite-storage.ts` — tool_plugins 테이블
- [ ] `server/tools/tool-registry.ts` — 도구 등록/관리
- [ ] `server/tools/tool-loader.ts` — 동적 로딩
- [ ] `server/tools/core/file-tools.ts` — 기존 파일 도구 마이그레이션
- [ ] `server/tools/core/agent-tools.ts` — 기존 에이전트 도구 마이그레이션
- [ ] `server/tools/core/command-tools.ts` — 기존 명령 도구 마이그레이션
- [ ] `server/tools/core/git-tools.ts` — 기존 git 도구 마이그레이션
- [ ] `server/agents.ts` — ToolRegistry 연동 (getTools/handleToolCall 교체)
- [ ] `server/routes.ts` — 플러그인 API 엔드포인트

### Phase 4: UI 시각화
- [ ] `client/src/components/workflow/WorkflowBoard.tsx` — DAG 메인
- [ ] `client/src/components/workflow/WorkflowNode.tsx` — 태스크 노드
- [ ] `client/src/components/workflow/WorkflowEdge.tsx` — 의존성 엣지
- [ ] `client/src/components/workflow/WorkflowControls.tsx` — 제어 패널
- [ ] `client/src/components/memory/MemoryInspector.tsx` — 메모리 조회
- [ ] Home.tsx — 워크플로우 탭 추가
- [ ] DetailPanel — 메모리 탭 추가
- [ ] useWebSocket — 워크플로우 이벤트 처리

---

## 7. 기존 코드 변경 영향 분석

| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `shared/schema.ts` | **확장** | 4개 새 타입 추가 (기존 타입 변경 없음) |
| `server/storage.ts` | **확장** | IStorage에 메서드 추가 (기존 메서드 변경 없음) |
| `server/sqlite-storage.ts` | **확장** | 새 테이블 + 새 메서드 (migration 패턴 사용) |
| `server/agents.ts` | **수정** | getTools()→ToolRegistry, 메모리 연동 추가 |
| `server/routes.ts` | **확장** | 새 엔드포인트 추가 (기존 변경 없음) |
| `server/ai-client.ts` | **변경 없음** | — |
| `server/meetings.ts` | **변경 없음** | — |
| `server/workspace.ts` | **변경 없음** | — |
| `client/src/pages/Home.tsx` | **수정** | 워크플로우 탭 추가 |

**하위 호환성**: 기존 API 엔드포인트와 데이터 모델은 변경하지 않음. 새로운 기능은 모두 새 엔드포인트/테이블로 추가.

---

## 8. 의존성 설치 계획

```bash
# 추가 패키지 없음 (기존 스택 활용)
# - SQLite FTS5는 better-sqlite3에 내장
# - DAG 시각화는 SVG 자체 구현
# - 상태 관리는 기존 React Query 사용
```

**0 새 의존성** — 기존 스택만으로 모든 기능 구현 가능.
