import { chatCompletion } from "../ai-client";
import type { Agent } from "@shared/schema";

export interface PlannedTask {
  description: string;
  suggestedRole: string;
  priority: "low" | "medium" | "high" | "urgent";
  dependsOn: number[];
  estimatedComplexity: "simple" | "moderate" | "complex";
}

export interface TaskPlan {
  title: string;
  tasks: PlannedTask[];
}

export class TaskPlanner {
  private model: string;

  constructor(model = "claude-sonnet-4-6") {
    this.model = model;
  }

  async planTasks(request: string, availableAgents: Agent[]): Promise<TaskPlan> {
    const agentList = availableAgents
      .map(a => `- ${a.name} (역할: ${a.role}, 상태: ${a.status})`)
      .join("\n");

    const roles = Array.from(new Set(availableAgents.map(a => a.role)));

    const systemPrompt = `당신은 프로젝트 매니저입니다. 사용자의 요청을 분석하여 구체적인 작업 목록으로 분해하세요.

현재 사용 가능한 에이전트:
${agentList}

사용 가능한 역할: ${roles.join(", ")}

반드시 다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "title": "워크플로우 제목",
  "tasks": [
    {
      "description": "구체적인 작업 설명",
      "suggestedRole": "${roles[0] || "general"}",
      "priority": "medium",
      "dependsOn": [],
      "estimatedComplexity": "moderate"
    }
  ]
}

규칙:
1. 각 작업은 단일 에이전트가 수행할 수 있는 단위로 분해
2. dependsOn은 선행 작업의 인덱스(0부터)로 표현
3. 병렬 실행 가능한 작업은 동일한 의존성 레벨로 설정
4. 최소 1개, 최대 8개의 작업으로 분해
5. suggestedRole은 반드시 사용 가능한 역할 중 하나`;

    const response = await chatCompletion({
      model: this.model,
      maxTokens: 2048,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: "user", content: request }],
    });

    const plan = this.parseResponse(response.content);
    const validation = this.validatePlan(plan);
    if (!validation.valid) {
      throw new Error(`작업 계획 검증 실패: ${validation.errors.join(", ")}`);
    }

    return plan;
  }

  private parseResponse(content: string): TaskPlan {
    // Extract JSON from response (may contain markdown code blocks)
    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    // Try to find JSON object in the response
    const objMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objMatch) {
      jsonStr = objMatch[0];
    }

    try {
      const parsed = JSON.parse(jsonStr);
      return {
        title: parsed.title || "워크플로우",
        tasks: (parsed.tasks || []).map((t: any) => ({
          description: t.description || "",
          suggestedRole: t.suggestedRole || "general",
          priority: t.priority || "medium",
          dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn : [],
          estimatedComplexity: t.estimatedComplexity || "moderate",
        })),
      };
    } catch {
      // Fallback: single task
      return {
        title: "워크플로우",
        tasks: [{
          description: content.substring(0, 500),
          suggestedRole: "general",
          priority: "medium",
          dependsOn: [],
          estimatedComplexity: "moderate",
        }],
      };
    }
  }

  validatePlan(plan: TaskPlan): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!plan.tasks || plan.tasks.length === 0) {
      errors.push("작업이 없습니다");
    }
    if (plan.tasks.length > 8) {
      errors.push("작업이 8개를 초과합니다");
    }

    // Check for circular dependencies
    if (this.hasCycle(plan.tasks)) {
      errors.push("순환 의존성이 감지되었습니다");
    }

    // Check dependency references
    for (let i = 0; i < plan.tasks.length; i++) {
      for (const dep of plan.tasks[i].dependsOn) {
        if (dep < 0 || dep >= plan.tasks.length || dep === i) {
          errors.push(`작업 ${i}의 의존성 인덱스 ${dep}가 유효하지 않습니다`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private hasCycle(tasks: PlannedTask[]): boolean {
    const n = tasks.length;
    const visited = new Array(n).fill(0); // 0=unvisited, 1=in-stack, 2=done

    const dfs = (node: number): boolean => {
      visited[node] = 1;
      for (const dep of tasks[node].dependsOn) {
        if (dep >= 0 && dep < n) {
          if (visited[dep] === 1) return true;
          if (visited[dep] === 0 && dfs(dep)) return true;
        }
      }
      visited[node] = 2;
      return false;
    };

    for (let i = 0; i < n; i++) {
      if (visited[i] === 0 && dfs(i)) return true;
    }
    return false;
  }
}
