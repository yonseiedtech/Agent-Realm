import { storage } from "../storage";
import type { AgentMemory, InsertAgentMemory } from "@shared/schema";

export class MemoryStore {
  async save(data: InsertAgentMemory): Promise<AgentMemory> {
    return storage.createAgentMemory(data);
  }

  async search(agentId: string, query: string, limit = 5): Promise<AgentMemory[]> {
    const results = await storage.searchAgentMemories(agentId, query, limit);
    // Touch each accessed memory
    for (const mem of results) {
      await storage.touchAgentMemory(mem.id);
    }
    return results;
  }

  async getRecent(agentId: string, limit = 10): Promise<AgentMemory[]> {
    return storage.getAgentMemories(agentId, undefined, limit);
  }

  async getByType(agentId: string, type: string, limit = 10): Promise<AgentMemory[]> {
    return storage.getAgentMemories(agentId, type, limit);
  }

  async getImportant(agentId: string, limit = 5): Promise<AgentMemory[]> {
    // getAgentMemories already orders by importance DESC
    return storage.getAgentMemories(agentId, undefined, limit);
  }

  async delete(memoryId: string): Promise<void> {
    return storage.deleteAgentMemory(memoryId);
  }

  async clearAll(agentId: string): Promise<void> {
    return storage.clearAgentMemories(agentId);
  }
}

export const memoryStore = new MemoryStore();
