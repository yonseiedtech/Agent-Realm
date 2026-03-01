import { storage } from "../storage";
import { chatWithAgent } from "../agents";
import { emitEvent } from "../agents";
import { TaskPlanner, type TaskPlan } from "./task-planner";
import { TaskScheduler } from "./task-scheduler";
import { QualityGate, type QualityCheckResult } from "./quality-gate";
import type { Workflow, WorkflowTask, TaskDependency, Agent } from "@shared/schema";

export interface OrchestratorConfig {
  maxConcurrentTasks: number;
  maxWorkflowTimeout: number;
  enableQualityGate: boolean;
  plannerModel: string;
}

export interface WorkflowResult {
  workflowId: string;
  status: "completed" | "failed" | "cancelled";
  tasks: Array<{
    id: string;
    agentId: string | null;
    description: string;
    status: string;
    result: string | null;
  }>;
  summary: string;
  qualityCheck?: QualityCheckResult;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  maxConcurrentTasks: 3,
  maxWorkflowTimeout: 300000,
  enableQualityGate: true,
  plannerModel: "claude-sonnet-4-6",
};

const activeWorkflows = new Map<string, AbortController>();

export class Orchestrator {
  private planner: TaskPlanner;
  private scheduler: TaskScheduler;
  private qualityGate: QualityGate;
  private config: OrchestratorConfig;

  constructor(config?: Partial<OrchestratorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.planner = new TaskPlanner(this.config.plannerModel);
    this.scheduler = new TaskScheduler();
    this.qualityGate = new QualityGate(this.config.plannerModel);
  }

  async executeWorkflow(request: string, createdBy?: string): Promise<WorkflowResult> {
    const agents = await storage.getAllAgents();
    if (agents.length === 0) {
      throw new Error("사용 가능한 에이전트가 없습니다. 먼저 에이전트를 생성하세요.");
    }

    // 1. Plan tasks
    const plan = await this.planner.planTasks(request, agents);

    // 2. Create workflow in DB
    const workflow = await storage.createWorkflow({
      title: plan.title,
      description: request,
      status: "running",
      createdBy: createdBy ?? null,
    });

    emitEvent({ type: "workflow_created" as any, data: { workflowId: workflow.id, title: plan.title } });

    // 3. Create workflow tasks and dependencies
    const taskMap = new Map<number, string>(); // index -> taskId
    for (let i = 0; i < plan.tasks.length; i++) {
      const pt = plan.tasks[i];
      const agentId = this.scheduler.assignAgent(pt.suggestedRole, agents);
      const wt = await storage.createWorkflowTask({
        workflowId: workflow.id,
        agentId,
        description: pt.description,
        status: "pending",
        result: null,
        priority: pt.priority,
        suggestedRole: pt.suggestedRole,
        orderIndex: i,
      });
      taskMap.set(i, wt.id);
    }

    // Create dependencies
    for (let i = 0; i < plan.tasks.length; i++) {
      for (const depIndex of plan.tasks[i].dependsOn) {
        const taskId = taskMap.get(i);
        const depTaskId = taskMap.get(depIndex);
        if (taskId && depTaskId) {
          await storage.createTaskDependency({ taskId, dependsOnTaskId: depTaskId });
        }
      }
    }

    // 4. Setup abort controller
    const abortController = new AbortController();
    activeWorkflows.set(workflow.id, abortController);

    // 5. Execute workflow loop
    try {
      const result = await this.runWorkflowLoop(workflow, request, agents, abortController.signal);
      return result;
    } finally {
      activeWorkflows.delete(workflow.id);
    }
  }

  private async runWorkflowLoop(
    workflow: Workflow,
    originalRequest: string,
    agents: Agent[],
    signal: AbortSignal
  ): Promise<WorkflowResult> {
    const timeoutAt = Date.now() + this.config.maxWorkflowTimeout;

    emitEvent({ type: "workflow_started" as any, data: { workflowId: workflow.id } });

    while (Date.now() < timeoutAt) {
      if (signal.aborted) {
        await storage.updateWorkflow(workflow.id, { status: "cancelled" });
        emitEvent({ type: "workflow_cancelled" as any, data: { workflowId: workflow.id } });
        const tasks = await storage.getWorkflowTasks(workflow.id);
        return {
          workflowId: workflow.id,
          status: "cancelled",
          tasks: tasks.map(t => ({ id: t.id, agentId: t.agentId, description: t.description, status: t.status, result: t.result })),
          summary: "워크플로우가 취소되었습니다.",
        };
      }

      const tasks = await storage.getWorkflowTasks(workflow.id);
      const deps = await this.getAllDependencies(workflow.id, tasks);

      // Check if all tasks are done
      const allDone = tasks.every(t => t.status === "completed" || t.status === "failed" || t.status === "skipped");
      if (allDone) break;

      // Get ready tasks
      const readyTasks = this.scheduler.getReadyTasks(tasks, deps);

      if (readyTasks.length === 0) {
        // Check if stuck (no ready tasks but not all done)
        const hasRunning = tasks.some(t => t.status === "running");
        if (!hasRunning) {
          // Deadlock or all remaining tasks have failed dependencies
          break;
        }
        // Wait for running tasks
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      // Execute ready tasks (up to maxConcurrentTasks)
      const batch = readyTasks.slice(0, this.config.maxConcurrentTasks);
      await Promise.all(batch.map(t => this.executeTask(t, agents)));
    }

    // Finalize
    const finalTasks = await storage.getWorkflowTasks(workflow.id);
    const hasFailed = finalTasks.some(t => t.status === "failed");
    const allCompleted = finalTasks.every(t => t.status === "completed");

    const finalStatus = allCompleted ? "completed" : hasFailed ? "failed" : "completed";

    await storage.updateWorkflow(workflow.id, {
      status: finalStatus,
      completedAt: new Date().toISOString(),
    });

    // Quality check
    let qualityCheck: QualityCheckResult | undefined;
    if (this.config.enableQualityGate && allCompleted) {
      try {
        qualityCheck = await this.qualityGate.checkWorkflowResult(workflow, finalTasks, originalRequest);
      } catch {}
    }

    const summary = allCompleted
      ? `워크플로우 "${workflow.title}" 완료 (${finalTasks.length}개 작업 성공)`
      : `워크플로우 "${workflow.title}" 부분 완료 (${finalTasks.filter(t => t.status === "completed").length}/${finalTasks.length})`;

    emitEvent({
      type: (finalStatus === "completed" ? "workflow_completed" : "workflow_failed") as any,
      data: { workflowId: workflow.id, summary },
    });

    return {
      workflowId: workflow.id,
      status: finalStatus as any,
      tasks: finalTasks.map(t => ({ id: t.id, agentId: t.agentId, description: t.description, status: t.status, result: t.result })),
      summary,
      qualityCheck,
    };
  }

  private async executeTask(task: WorkflowTask, agents: Agent[]): Promise<void> {
    if (!task.agentId) {
      await storage.updateWorkflowTask(task.id, { status: "skipped", completedAt: new Date().toISOString() });
      return;
    }

    await storage.updateWorkflowTask(task.id, { status: "running" });
    emitEvent({ type: "workflow_task_started" as any, data: { taskId: task.id, workflowId: task.workflowId, agentId: task.agentId } });

    try {
      const response = await chatWithAgent(
        task.agentId,
        `[워크플로우 작업] ${task.description}\n\n이 작업을 수행하고 결과를 보고해주세요.`
      );

      await storage.updateWorkflowTask(task.id, {
        status: "completed",
        result: response,
        completedAt: new Date().toISOString(),
      });

      emitEvent({ type: "workflow_task_completed" as any, data: { taskId: task.id, workflowId: task.workflowId, agentId: task.agentId } });
    } catch (error: any) {
      await storage.updateWorkflowTask(task.id, {
        status: "failed",
        result: `오류: ${error.message}`,
        completedAt: new Date().toISOString(),
      });

      emitEvent({ type: "workflow_task_failed" as any, data: { taskId: task.id, workflowId: task.workflowId, error: error.message } });
    }
  }

  private async getAllDependencies(workflowId: string, tasks: WorkflowTask[]): Promise<TaskDependency[]> {
    const allDeps: TaskDependency[] = [];
    for (const t of tasks) {
      const deps = await storage.getTaskDependencies(t.id);
      allDeps.push(...deps);
    }
    return allDeps;
  }

  async retryWorkflow(workflowId: string): Promise<void> {
    const workflow = await storage.getWorkflow(workflowId);
    if (!workflow) throw new Error("워크플로우를 찾을 수 없습니다");
    if (workflow.status !== "failed") throw new Error("실패한 워크플로우만 재실행할 수 있습니다");

    const tasks = await storage.getWorkflowTasks(workflowId);
    // Reset failed tasks to pending; keep completed tasks
    for (const task of tasks) {
      if (task.status === "failed") {
        await storage.updateWorkflowTask(task.id, { status: "pending", result: null, completedAt: null as any });
      }
    }

    await storage.updateWorkflow(workflowId, { status: "running", completedAt: null as any });

    const agents = await storage.getAllAgents();
    const abortController = new AbortController();
    activeWorkflows.set(workflowId, abortController);

    this.runWorkflowLoop(workflow, workflow.description || "", agents, abortController.signal)
      .catch(console.error)
      .finally(() => activeWorkflows.delete(workflowId));
  }

  async retryTask(workflowId: string, taskId: string): Promise<void> {
    const workflow = await storage.getWorkflow(workflowId);
    if (!workflow) throw new Error("워크플로우를 찾을 수 없습니다");

    const tasks = await storage.getWorkflowTasks(workflowId);
    const task = tasks.find(t => t.id === taskId);
    if (!task) throw new Error("작업을 찾을 수 없습니다");
    if (task.status !== "failed") throw new Error("실패한 작업만 재실행할 수 있습니다");

    // Reset the single task
    await storage.updateWorkflowTask(taskId, { status: "pending", result: null, completedAt: null as any });

    const agents = await storage.getAllAgents();
    await this.executeTask({ ...task, status: "pending", result: null }, agents);

    // Re-evaluate workflow status
    const updatedTasks = await storage.getWorkflowTasks(workflowId);
    const hasFailed = updatedTasks.some(t => t.status === "failed");
    const allCompleted = updatedTasks.every(t => t.status === "completed");
    const finalStatus = allCompleted ? "completed" : hasFailed ? "failed" : workflow.status;
    await storage.updateWorkflow(workflowId, { status: finalStatus });
  }

  async cancelWorkflow(workflowId: string): Promise<void> {
    const controller = activeWorkflows.get(workflowId);
    if (controller) {
      controller.abort();
    } else {
      await storage.updateWorkflow(workflowId, { status: "cancelled" });
    }
  }

  async getWorkflowStatus(workflowId: string) {
    const workflow = await storage.getWorkflow(workflowId);
    if (!workflow) throw new Error("워크플로우를 찾을 수 없습니다");

    const tasks = await storage.getWorkflowTasks(workflowId);
    const deps = await this.getAllDependencies(workflowId, tasks);

    const progress = {
      total: tasks.length,
      completed: tasks.filter(t => t.status === "completed").length,
      running: tasks.filter(t => t.status === "running").length,
      failed: tasks.filter(t => t.status === "failed").length,
      pending: tasks.filter(t => t.status === "pending").length,
    };

    return { workflow, tasks, dependencies: deps, progress };
  }
}

// Singleton instance
export const orchestrator = new Orchestrator();
