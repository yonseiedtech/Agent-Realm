import { storage } from "../storage";

export interface PruneConfig {
  maxMemoriesPerAgent: number;
  minImportance: number;
  maxAgeDays: number;
}

const DEFAULT_CONFIG: PruneConfig = {
  maxMemoriesPerAgent: 100,
  minImportance: 0.1,
  maxAgeDays: 90,
};

export class MemoryPruner {
  private config: PruneConfig;

  constructor(config?: Partial<PruneConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async prune(agentId: string): Promise<{ deleted: number }> {
    let deleted = 0;

    const memories = await storage.getAgentMemories(agentId, undefined, 999);

    // 1. Delete old low-importance memories
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.maxAgeDays);

    for (const mem of memories) {
      if (mem.importance < this.config.minImportance && mem.createdAt < cutoffDate) {
        await storage.deleteAgentMemory(mem.id);
        deleted++;
      }
    }

    // 2. Delete old never-accessed memories (30 days)
    const accessCutoff = new Date();
    accessCutoff.setDate(accessCutoff.getDate() - 30);

    for (const mem of memories) {
      if (mem.accessCount === 0 && mem.createdAt < accessCutoff) {
        await storage.deleteAgentMemory(mem.id);
        deleted++;
      }
    }

    // 3. Enforce max memories per agent (keep highest importance)
    const remaining = await storage.getAgentMemories(agentId, undefined, 999);
    if (remaining.length > this.config.maxMemoriesPerAgent) {
      // Already sorted by importance DESC
      const toDelete = remaining.slice(this.config.maxMemoriesPerAgent);
      for (const mem of toDelete) {
        await storage.deleteAgentMemory(mem.id);
        deleted++;
      }
    }

    return { deleted };
  }

  async pruneAll(): Promise<{ totalDeleted: number }> {
    const agents = await storage.getAllAgents();
    let totalDeleted = 0;

    for (const agent of agents) {
      const result = await this.prune(agent.id);
      totalDeleted += result.deleted;
    }

    return { totalDeleted };
  }
}

export const memoryPruner = new MemoryPruner();
