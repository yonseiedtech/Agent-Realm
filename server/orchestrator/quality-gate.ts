import { chatCompletion } from "../ai-client";
import type { Workflow, WorkflowTask } from "@shared/schema";

export interface QualityCheckResult {
  passed: boolean;
  score: number;
  feedback: string;
  suggestions: string[];
}

export class QualityGate {
  private model: string;

  constructor(model = "claude-sonnet-4-6") {
    this.model = model;
  }

  async checkTaskResult(
    task: WorkflowTask,
    result: string
  ): Promise<QualityCheckResult> {
    const response = await chatCompletion({
      model: this.model,
      maxTokens: 1024,
      temperature: 0.2,
      system: `당신은 품질 검증 전문가입니다. 작업 결과를 평가하세요.
반드시 다음 JSON 형식으로만 응답하세요:
{
  "passed": true/false,
  "score": 0-100,
  "feedback": "평가 요약",
  "suggestions": ["개선 제안1", "개선 제안2"]
}`,
      messages: [{
        role: "user",
        content: `작업 설명: ${task.description}\n\n작업 결과:\n${result.substring(0, 3000)}\n\n이 결과가 작업 설명을 충족하는지 평가하세요.`,
      }],
    });

    return this.parseQualityResult(response.content);
  }

  async checkWorkflowResult(
    workflow: Workflow,
    tasks: WorkflowTask[],
    originalRequest: string
  ): Promise<QualityCheckResult> {
    const taskSummary = tasks.map((t, i) =>
      `[${i + 1}] ${t.description} → ${t.status}${t.result ? `: ${t.result.substring(0, 200)}` : ""}`
    ).join("\n");

    const response = await chatCompletion({
      model: this.model,
      maxTokens: 1024,
      temperature: 0.2,
      system: `당신은 품질 검증 전문가입니다. 워크플로우 전체 결과를 평가하세요.
반드시 다음 JSON 형식으로만 응답하세요:
{
  "passed": true/false,
  "score": 0-100,
  "feedback": "종합 평가",
  "suggestions": ["개선 제안1"]
}`,
      messages: [{
        role: "user",
        content: `원본 요청: ${originalRequest}\n\n워크플로우: ${workflow.title}\n\n작업 결과:\n${taskSummary}\n\n원본 요청을 충족하는지 종합 평가하세요.`,
      }],
    });

    return this.parseQualityResult(response.content);
  }

  private parseQualityResult(content: string): QualityCheckResult {
    try {
      let jsonStr = content.trim();
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr);
      return {
        passed: !!parsed.passed,
        score: Math.min(100, Math.max(0, parsed.score || 0)),
        feedback: parsed.feedback || "",
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      };
    } catch {
      return { passed: true, score: 70, feedback: "평가 파싱 실패 (기본 통과)", suggestions: [] };
    }
  }
}
