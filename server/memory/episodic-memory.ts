import { memoryStore } from "./memory-store";
import type { AgentMemory } from "@shared/schema";

export interface Episode {
  taskDescription: string;
  taskResult: string;
  success: boolean;
  toolsUsed: string[];
  filesModified: string[];
  duration: number;
  timestamp: Date;
}

export class EpisodicMemory {
  async recordEpisode(agentId: string, episode: Episode): Promise<AgentMemory> {
    const summary = this.summarizeEpisode(episode);
    const metadata = JSON.stringify({
      success: episode.success,
      toolsUsed: episode.toolsUsed,
      filesModified: episode.filesModified,
      duration: episode.duration,
      timestamp: episode.timestamp.toISOString(),
    });

    // Higher importance for successful episodes
    const importance = episode.success ? 0.7 : 0.4;

    return memoryStore.save({
      agentId,
      type: "episode",
      content: summary,
      metadata,
      importance,
    });
  }

  async findSimilarEpisodes(
    agentId: string,
    taskDescription: string,
    limit = 3
  ): Promise<AgentMemory[]> {
    // Extract keywords from task description
    const keywords = this.extractKeywords(taskDescription);
    if (keywords.length === 0) {
      return memoryStore.getByType(agentId, "episode", limit);
    }

    return memoryStore.search(agentId, keywords.join(" "), limit);
  }

  private summarizeEpisode(episode: Episode): string {
    const status = episode.success ? "성공" : "실패";
    const tools = episode.toolsUsed.length > 0
      ? `사용 도구: ${episode.toolsUsed.join(", ")}`
      : "";
    const files = episode.filesModified.length > 0
      ? `수정 파일: ${episode.filesModified.join(", ")}`
      : "";
    const duration = `소요: ${Math.round(episode.duration / 1000)}초`;

    // Truncate task result for summary
    const resultPreview = episode.taskResult.substring(0, 200);

    return `[${status}] ${episode.taskDescription}\n${resultPreview}\n${tools}\n${files}\n${duration}`.trim();
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction: remove common Korean particles and short words
    const stopWords = new Set(["의", "가", "이", "은", "는", "을", "를", "에", "에서", "로", "으로", "와", "과", "도", "만", "좀", "해", "하고", "합니다", "해주세요", "해줘", "하세요"]);
    return text
      .replace(/[^\wㄱ-ㅎㅏ-ㅣ가-힣\s]/g, "")
      .split(/\s+/)
      .filter(w => w.length > 1 && !stopWords.has(w))
      .slice(0, 5);
  }
}

export const episodicMemory = new EpisodicMemory();
