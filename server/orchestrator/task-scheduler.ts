import type { Agent, WorkflowTask, TaskDependency } from "@shared/schema";

export class TaskScheduler {
  /**
   * Returns tasks whose all dependencies are completed.
   */
  getReadyTasks(
    tasks: WorkflowTask[],
    dependencies: TaskDependency[]
  ): WorkflowTask[] {
    const completedIds = new Set(
      tasks.filter(t => t.status === "completed").map(t => t.id)
    );

    return tasks.filter(t => {
      if (t.status !== "pending") return false;
      const deps = dependencies.filter(d => d.taskId === t.id);
      return deps.every(d => completedIds.has(d.dependsOnTaskId));
    });
  }

  /**
   * Pick the best agent for a task based on role matching and availability.
   */
  assignAgent(
    suggestedRole: string,
    agents: Agent[]
  ): string | null {
    // 1. Exact role match + idle
    const idleMatch = agents.find(a => a.role === suggestedRole && a.status === "idle");
    if (idleMatch) return idleMatch.id;

    // 2. Any idle agent
    const anyIdle = agents.find(a => a.status === "idle");
    if (anyIdle) return anyIdle.id;

    // 3. Exact role match regardless of status
    const roleMatch = agents.find(a => a.role === suggestedRole);
    if (roleMatch) return roleMatch.id;

    // 4. First available agent
    return agents[0]?.id ?? null;
  }

  /**
   * Detect circular dependencies using Kahn's algorithm.
   * Returns true if a cycle exists.
   */
  detectCycle(
    tasks: WorkflowTask[],
    dependencies: TaskDependency[]
  ): boolean {
    const taskIds = tasks.map(t => t.id);
    const taskIdSet = new Set(taskIds);
    const inDegree: Record<string, number> = {};
    const adjList: Record<string, string[]> = {};

    for (const id of taskIds) {
      inDegree[id] = 0;
      adjList[id] = [];
    }

    for (const dep of dependencies) {
      if (taskIdSet.has(dep.taskId) && taskIdSet.has(dep.dependsOnTaskId)) {
        inDegree[dep.taskId] = (inDegree[dep.taskId] || 0) + 1;
        adjList[dep.dependsOnTaskId].push(dep.taskId);
      }
    }

    const queue: string[] = [];
    for (const id of taskIds) {
      if (inDegree[id] === 0) queue.push(id);
    }

    let processed = 0;
    while (queue.length > 0) {
      const current = queue.shift()!;
      processed++;
      for (const next of adjList[current] || []) {
        inDegree[next]--;
        if (inDegree[next] === 0) queue.push(next);
      }
    }

    return processed !== taskIds.length;
  }

  /**
   * Get topological order of tasks (for display/execution).
   */
  getTopologicalOrder(
    tasks: WorkflowTask[],
    dependencies: TaskDependency[]
  ): string[] {
    const taskIds = tasks.map(t => t.id);
    const taskIdSet = new Set(taskIds);
    const inDegree: Record<string, number> = {};
    const adjList: Record<string, string[]> = {};

    for (const id of taskIds) {
      inDegree[id] = 0;
      adjList[id] = [];
    }

    for (const dep of dependencies) {
      if (taskIdSet.has(dep.taskId) && taskIdSet.has(dep.dependsOnTaskId)) {
        inDegree[dep.taskId] = (inDegree[dep.taskId] || 0) + 1;
        adjList[dep.dependsOnTaskId].push(dep.taskId);
      }
    }

    const result: string[] = [];
    const queue: string[] = [];
    for (const id of taskIds) {
      if (inDegree[id] === 0) queue.push(id);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);
      for (const next of adjList[current] || []) {
        inDegree[next]--;
        if (inDegree[next] === 0) queue.push(next);
      }
    }

    return result;
  }
}
