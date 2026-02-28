import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import WorkflowNode from "./WorkflowNode";
import WorkflowEdge from "./WorkflowEdge";
import WorkflowControls from "./WorkflowControls";
import type { Agent } from "@shared/schema";

interface WorkflowTask {
  id: string;
  workflowId: string;
  agentId: string | null;
  description: string;
  status: string;
  result: string | null;
  priority: string;
  suggestedRole: string | null;
  orderIndex: number;
}

interface TaskDependency {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
}

interface WorkflowDetail {
  workflow: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    createdAt: string;
  };
  tasks: WorkflowTask[];
  dependencies: TaskDependency[];
  progress: { total: number; completed: number; running: number; failed: number };
}

interface WorkflowSummary {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

interface WorkflowBoardProps {
  agents: Agent[];
}

export default function WorkflowBoard({ agents }: WorkflowBoardProps) {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [newRequest, setNewRequest] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: workflows = [] } = useQuery<WorkflowSummary[]>({
    queryKey: ["/api/workflows"],
    refetchInterval: 3000,
  });

  const { data: detail } = useQuery<WorkflowDetail>({
    queryKey: ["/api/workflows", selectedWorkflowId],
    enabled: !!selectedWorkflowId,
    refetchInterval: 2000,
  });

  const createMutation = useMutation({
    mutationFn: async (request: string) => {
      const res = await apiRequest("POST", "/api/workflows", { request });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      if (data?.workflowId) setSelectedWorkflowId(data.workflowId);
      setNewRequest("");
      setShowCreateForm(false);
    },
  });

  // Layout tasks in DAG levels
  function layoutTasks(tasks: WorkflowTask[], deps: TaskDependency[]) {
    const levels: Record<string, number> = {};
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    // Calculate levels via BFS
    const inDeps = new Map<string, string[]>();
    tasks.forEach(t => inDeps.set(t.id, []));
    deps.forEach(d => {
      const arr = inDeps.get(d.taskId);
      if (arr) arr.push(d.dependsOnTaskId);
    });

    // Iteratively assign levels
    let changed = true;
    tasks.forEach(t => { levels[t.id] = 0; });
    while (changed) {
      changed = false;
      for (const t of tasks) {
        const depIds = inDeps.get(t.id) || [];
        for (const depId of depIds) {
          const newLevel = (levels[depId] || 0) + 1;
          if (newLevel > levels[t.id]) {
            levels[t.id] = newLevel;
            changed = true;
          }
        }
      }
    }

    // Group by level
    const levelGroups: Record<number, WorkflowTask[]> = {};
    let maxLevel = 0;
    for (const t of tasks) {
      const lv = levels[t.id];
      if (!levelGroups[lv]) levelGroups[lv] = [];
      levelGroups[lv].push(t);
      if (lv > maxLevel) maxLevel = lv;
    }

    // Compute positions
    const nodeWidth = 160;
    const nodeHeight = 72;
    const hGap = 60;
    const vGap = 40;

    const positions: Record<string, { x: number; y: number }> = {};
    for (let lv = 0; lv <= maxLevel; lv++) {
      const group = levelGroups[lv] || [];
      const totalHeight = group.length * nodeHeight + (group.length - 1) * vGap;
      const startY = -totalHeight / 2 + nodeHeight / 2;
      group.forEach((t, idx) => {
        positions[t.id] = {
          x: lv * (nodeWidth + hGap) + nodeWidth / 2 + 20,
          y: startY + idx * (nodeHeight + vGap) + 200,
        };
      });
    }

    const svgWidth = (maxLevel + 1) * (nodeWidth + hGap) + 40;
    const maxNodesInLevel = Math.max(...Object.values(levelGroups).map(g => g.length), 1);
    const svgHeight = maxNodesInLevel * (nodeHeight + vGap) + 100;

    return { positions, svgWidth, svgHeight };
  }

  const agentMap = new Map(agents.map(a => [a.id, a]));

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--dc-bg-primary)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--dc-border-subtle)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--dc-text-primary)" }}>
          워크플로우
        </h2>
        <select
          className="text-xs px-2 py-1 rounded"
          style={{ background: "var(--dc-bg-tertiary)", color: "var(--dc-text-secondary)", border: "1px solid var(--dc-border-subtle)" }}
          value={selectedWorkflowId || ""}
          onChange={(e) => setSelectedWorkflowId(e.target.value || null)}
        >
          <option value="">워크플로우 선택...</option>
          {workflows.map(w => (
            <option key={w.id} value={w.id}>
              {w.title} ({w.status})
            </option>
          ))}
        </select>
        <button
          onClick={() => setShowCreateForm(true)}
          className="ml-auto text-xs px-3 py-1.5 rounded font-medium"
          style={{ background: "var(--dc-accent)", color: "white" }}
        >
          + 새 워크플로우
        </button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--dc-border-subtle)", background: "var(--dc-bg-secondary)" }}>
          <div className="flex gap-2">
            <input
              type="text"
              value={newRequest}
              onChange={(e) => setNewRequest(e.target.value)}
              placeholder="에이전트들에게 시킬 작업을 입력하세요..."
              className="flex-1 text-sm px-3 py-2 rounded"
              style={{ background: "var(--dc-bg-primary)", color: "var(--dc-text-primary)", border: "1px solid var(--dc-border-subtle)" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newRequest.trim()) {
                  createMutation.mutate(newRequest.trim());
                }
              }}
            />
            <button
              onClick={() => newRequest.trim() && createMutation.mutate(newRequest.trim())}
              disabled={createMutation.isPending || !newRequest.trim()}
              className="text-xs px-3 py-2 rounded font-medium disabled:opacity-50"
              style={{ background: "var(--dc-accent)", color: "white" }}
            >
              {createMutation.isPending ? "생성 중..." : "실행"}
            </button>
            <button
              onClick={() => { setShowCreateForm(false); setNewRequest(""); }}
              className="text-xs px-2 py-2 rounded"
              style={{ color: "var(--dc-text-muted)" }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* DAG visualization */}
      <div className="flex-1 overflow-auto p-4">
        {detail ? (
          (() => {
            const { positions, svgWidth, svgHeight } = layoutTasks(detail.tasks, detail.dependencies);
            return (
              <svg width={Math.max(svgWidth, 400)} height={Math.max(svgHeight, 300)} viewBox={`0 0 ${Math.max(svgWidth, 400)} ${Math.max(svgHeight, 300)}`}>
                {/* Edges */}
                {detail.dependencies.map(dep => {
                  const from = positions[dep.dependsOnTaskId];
                  const to = positions[dep.taskId];
                  if (!from || !to) return null;
                  const fromTask = detail.tasks.find(t => t.id === dep.dependsOnTaskId);
                  return (
                    <WorkflowEdge
                      key={dep.id}
                      fromX={from.x + 80}
                      fromY={from.y}
                      toX={to.x - 80}
                      toY={to.y}
                      completed={fromTask?.status === "completed"}
                    />
                  );
                })}
                {/* Nodes */}
                {detail.tasks.map(task => {
                  const pos = positions[task.id];
                  if (!pos) return null;
                  const agent = task.agentId ? agentMap.get(task.agentId) : undefined;
                  return (
                    <WorkflowNode
                      key={task.id}
                      id={task.id}
                      description={task.description}
                      agentId={task.agentId}
                      agentName={agent?.name}
                      agentRole={agent?.role || task.suggestedRole || undefined}
                      status={task.status}
                      x={pos.x}
                      y={pos.y}
                    />
                  );
                })}
              </svg>
            );
          })()
        ) : (
          <div className="flex items-center justify-center h-full text-sm" style={{ color: "var(--dc-text-muted)" }}>
            {workflows.length === 0
              ? "워크플로우가 없습니다. [+ 새 워크플로우]로 시작하세요."
              : "워크플로우를 선택하세요."}
          </div>
        )}
      </div>

      {/* Controls */}
      {detail && (
        <WorkflowControls
          workflowId={selectedWorkflowId}
          status={detail.workflow.status}
          progress={detail.progress}
        />
      )}
    </div>
  );
}
