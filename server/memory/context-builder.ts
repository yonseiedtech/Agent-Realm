import { memoryStore } from "./memory-store";
import { episodicMemory } from "./episodic-memory";

export class ContextBuilder {
  /**
   * Builds an enhanced system prompt by injecting relevant memories.
   */
  async buildContext(
    agentId: string,
    basePrompt: string,
    currentMessage: string
  ): Promise<string> {
    // 1. Search relevant knowledge memories
    const knowledgeMemories = await memoryStore.search(agentId, currentMessage, 3);

    // 2. Find similar past episodes
    const episodes = await episodicMemory.findSimilarEpisodes(agentId, currentMessage, 2);

    // 3. Get important preferences
    const preferences = await memoryStore.getByType(agentId, "preference", 3);

    // Build memory section only if there's content
    const sections: string[] = [];

    if (knowledgeMemories.length > 0) {
      const items = knowledgeMemories.map(m =>
        `- ${m.content.substring(0, 150)} [중요도: ${m.importance}]`
      ).join("\n");
      sections.push(`─── 참고 정보 (장기 메모리) ───\n${items}`);
    }

    if (episodes.length > 0) {
      const items = episodes.map(m => {
        const meta = m.metadata ? JSON.parse(m.metadata) : {};
        const dateStr = meta.timestamp ? new Date(meta.timestamp).toLocaleDateString("ko-KR") : "";
        return `- ${m.content.substring(0, 150)} ${dateStr ? `[${dateStr}]` : ""}`;
      }).join("\n");
      sections.push(`─── 관련 과거 경험 ───\n${items}`);
    }

    if (preferences.length > 0) {
      const items = preferences.map(m => `- ${m.content.substring(0, 100)}`).join("\n");
      sections.push(`─── 선호/규칙 ───\n${items}`);
    }

    if (sections.length === 0) {
      return basePrompt;
    }

    return `${basePrompt}\n\n${sections.join("\n\n")}`;
  }
}

export const contextBuilder = new ContextBuilder();
