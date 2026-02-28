import fs from "fs";
import path from "path";
import { storage } from "./storage";
import { chatCompletion, continueWithToolResults } from "./ai-client";
import type { Agent } from "@shared/schema";
import { generateAgentAvatar } from "./image-gen";
import { contextBuilder } from "./memory/context-builder";
import { episodicMemory } from "./memory/episodic-memory";
import { toolRegistry } from "./tools";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

type EventCallback = (event: AgentEvent) => void;

export interface AgentEvent {
  type: "status_change" | "activity" | "agent_message" | "task_update" | "agent_created" | "agent_deleted" | "meeting_update";
  data: any;
}

const eventListeners: EventCallback[] = [];

export function onAgentEvent(cb: EventCallback) {
  eventListeners.push(cb);
  return () => {
    const idx = eventListeners.indexOf(cb);
    if (idx !== -1) eventListeners.splice(idx, 1);
  };
}

export function emitEvent(event: AgentEvent) {
  for (const cb of eventListeners) {
    try { cb(event); } catch {}
  }
}

const ROLE_SYSTEM_PROMPTS: Record<string, string> = {
  pm: `당신은 프로젝트 매니저 AI 에이전트입니다. 작업 분배, 진행 관리, 팀 조율에 능숙합니다.
팀원 에이전트들에게 작업을 할당하고 진행 상황을 추적합니다.
create_task 도구를 사용하여 다른 에이전트에게 작업을 할당하세요.
다른 에이전트와 협업하여 프로젝트를 개선하세요. 한국어로 응답하세요.
파일을 읽거나 수정할 때는 반드시 도구를 사용하세요.`,
  fullstack: `당신은 풀스택 개발 전문 AI 에이전트입니다. React, TypeScript, Node.js, Express, 데이터베이스, API 설계에 능숙합니다.
프로젝트의 프론트엔드와 백엔드 코드를 분석, 개선, 리팩토링할 수 있습니다.
다른 에이전트와 협업하여 프로젝트를 개선하세요. 한국어로 응답하세요.
파일을 읽거나 수정할 때는 반드시 도구를 사용하세요.`,
  designer: `당신은 UI/UX 디자이너 AI 에이전트입니다. 사용자 인터페이스, 스타일 가이드, CSS 디자인에 능숙합니다.
프로젝트의 디자인과 사용자 경험을 개선합니다.
다른 에이전트와 협업하여 프로젝트를 개선하세요. 한국어로 응답하세요.
파일을 읽거나 수정할 때는 반드시 도구를 사용하세요.`,
  tester: `당신은 테스팅 전문 AI 에이전트입니다. 코드 리뷰, 버그 발견, 테스트 케이스 작성에 능숙합니다.
프로젝트의 코드 품질을 검증하고 개선 제안을 합니다.
다른 에이전트와 협업하여 프로젝트를 개선하세요. 한국어로 응답하세요.`,
  devops: `당신은 DevOps 전문 AI 에이전트입니다. 빌드, 배포, CI/CD, 인프라 관리에 능숙합니다.
프로젝트의 빌드 설정, 배포 파이프라인, 환경 구성을 관리합니다.
run_command와 git_operations 도구를 적극 활용하세요.
다른 에이전트와 협업하여 프로젝트를 개선하세요. 한국어로 응답하세요.`,
  general: `당신은 범용 개발 AI 에이전트입니다. 풀스택 개발에 능숙합니다.
프로젝트 코드를 분석하고 개선할 수 있습니다.
다른 에이전트와 협업하여 프로젝트를 개선하세요. 한국어로 응답하세요.
파일을 읽거나 수정할 때는 반드시 도구를 사용하세요.`,
};

const AVATAR_COLORS: Record<string, string> = {
  pm: "#FF6B6B",
  fullstack: "#5865F2",
  designer: "#FF79C6",
  tester: "#FEE75C",
  devops: "#BD93F9",
  general: "#ED4245",
};

const AVATAR_TYPES = ["developer", "designer", "analyst", "engineer", "architect", "researcher"];

function getProjectContext(): string {
  try {
    const cwd = process.cwd();
    const pkgPath = path.join(cwd, "package.json");
    let context = "";
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      context += `프로젝트: ${pkg.name || "unknown"} v${pkg.version || "0.0.0"}\n`;
      if (pkg.scripts) {
        context += `스크립트: ${Object.keys(pkg.scripts).join(", ")}\n`;
      }
      const deps = Object.keys(pkg.dependencies || {}).slice(0, 15);
      if (deps.length) context += `주요 의존성: ${deps.join(", ")}\n`;
    }
    // 디렉토리 구조 (1 depth)
    try {
      const entries = fs.readdirSync(cwd, { withFileTypes: true });
      const dirs = entries
        .filter(e => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules" && e.name !== "dist")
        .map(e => e.name);
      const files = entries
        .filter(e => e.isFile() && !e.name.startsWith("."))
        .map(e => e.name)
        .slice(0, 10);
      if (dirs.length) context += `디렉토리: ${dirs.join(", ")}\n`;
      if (files.length) context += `루트 파일: ${files.join(", ")}\n`;
    } catch {}
    return context;
  } catch {
    return "";
  }
}

// Tools are now managed by ToolRegistry (see server/tools/)

export async function createAgent(name: string, role: string): Promise<Agent> {
  const existingAgents = await storage.getAllAgents();
  const avatarIndex = existingAgents.length % AVATAR_TYPES.length;
  const agent = await storage.createAgent({
    name,
    role,
    status: "idle",
    color: AVATAR_COLORS[role] || "#5865F2",
    avatarType: AVATAR_TYPES[avatarIndex],
    currentTask: null,
    currentFile: null,
    systemPrompt: null,
    model: "claude-sonnet-4-6",
    maxTokens: 4096,
    temperature: "1",
  });
  emitEvent({ type: "agent_created", data: agent });

  // Async avatar generation (non-blocking)
  generateAgentAvatar(agent.id, agent.name, agent.role)
    .then(async (avatarUrl) => {
      if (avatarUrl) {
        await storage.updateAgent(agent.id, { avatarUrl } as any);
        emitEvent({ type: "status_change", data: { agentId: agent.id, avatarUrl } });
      }
    })
    .catch((err) => console.error("[agents] Avatar generation failed:", err.message));

  return agent;
}

export async function removeAgent(id: string): Promise<void> {
  await storage.deleteAgent(id);
  emitEvent({ type: "agent_deleted", data: { id } });
}

async function loadConversation(agentId: string): Promise<ConversationMessage[]> {
  const history = await storage.getChatHistory(agentId);
  return history.map(h => ({
    role: h.role as "user" | "assistant",
    content: h.content,
  }));
}

export async function chatWithAgent(agentId: string, userMessage: string, attachmentUrl?: string): Promise<string> {
  const agent = await storage.getAgent(agentId);
  if (!agent) throw new Error("에이전트를 찾을 수 없습니다");

  await storage.createChatMessage({
    agentId,
    role: "user",
    content: userMessage,
    attachmentUrl: attachmentUrl || null,
    attachmentType: attachmentUrl ? "image" : null,
  });

  const conversation = await loadConversation(agentId);

  const allAgents = await storage.getAllAgents();
  const otherAgents = allAgents.filter(a => a.id !== agentId);
  const agentListStr = otherAgents.map(a => `- #${a.id} ${a.name} (${a.role}): ${a.status}`).join("\n");

  const basePrompt = agent.systemPrompt || ROLE_SYSTEM_PROMPTS[agent.role] || ROLE_SYSTEM_PROMPTS.general;
  const projectContext = getProjectContext();
  const baseSystemPrompt = `${basePrompt}

현재 당신의 정보:
- 이름: ${agent.name}
- 역할: ${agent.role}
- ID: ${agent.id}

${projectContext ? `프로젝트 컨텍스트:\n${projectContext}\n` : ""}팀원 에이전트:
${agentListStr || "없음"}

협업이 필요하면 send_message_to_agent 도구를 사용하세요.`;

  // Enhance system prompt with memory context
  const systemPrompt = await contextBuilder.buildContext(agentId, baseSystemPrompt, userMessage);

  await storage.updateAgent(agentId, { status: "working" });
  emitEvent({ type: "status_change", data: { agentId, status: "working" } });

  const recentConversation = conversation.slice(-20);

  try {
    const startTime = Date.now();
    const usedTools = new Set<string>();
    const modifiedFiles = new Set<string>();
    const modelName = agent.model || "claude-sonnet-4-6";
    const maxTokens = agent.maxTokens || 4096;
    const temp = parseFloat(agent.temperature || "1");
    const tools = toolRegistry.getToolsForRole(agent.role);

    let response = await chatCompletion({
      model: modelName,
      maxTokens,
      temperature: temp,
      system: systemPrompt,
      tools,
      messages: recentConversation.map(m => ({ role: m.role, content: m.content })),
    });

    let fullResponse = "";
    let iterations = 0;
    const maxIterations = 5;

    while (response.stopReason === "tool_use" && response.toolCalls && iterations < maxIterations) {
      iterations++;

      if (response.content) {
        fullResponse += response.content;
      }

      const toolResults: Array<{ toolCallId: string; name: string; result: string }> = [];
      for (const toolCall of response.toolCalls) {
        usedTools.add(toolCall.name);
        const result = await toolRegistry.execute(toolCall.name, agentId, toolCall.input);
        toolResults.push({
          toolCallId: toolCall.id,
          name: toolCall.name,
          result,
        });

        // Track file modifications
        if (toolCall.name === "write_file" || toolCall.name === "edit_file") {
          modifiedFiles.add((toolCall.input as any).path);
        }

        if (toolCall.name === "read_file" || toolCall.name === "write_file") {
          await storage.updateAgent(agentId, { currentFile: (toolCall.input as any).path });
          emitEvent({ type: "status_change", data: { agentId, currentFile: (toolCall.input as any).path } });
        }
      }

      response = await continueWithToolResults({
        model: modelName,
        maxTokens,
        temperature: temp,
        system: systemPrompt,
        tools,
        messages: recentConversation.map(m => ({ role: m.role, content: m.content })),
        toolResults,
        previousResponse: response,
      });
    }

    fullResponse += response.content || "";

    // ─── Self-evaluation loop ─────────────────────────────────────
    // After the initial response, ask the agent to evaluate whether
    // its answer is complete. If not, it can do additional work.
    const maxEvalRounds = 2;
    for (let evalRound = 0; evalRound < maxEvalRounds; evalRound++) {
      const evalMessages = [
        ...recentConversation.map(m => ({ role: m.role, content: m.content })),
        { role: "assistant" as const, content: fullResponse },
        {
          role: "user" as const,
          content: `[시스템] 위 답변을 스스로 평가해주세요.
- 사용자의 질문/요청에 충분히 답변했는가?
- 빠진 내용이나 보완할 점이 있는가?
- 추가로 파일을 확인하거나 작업이 필요한가?

충분하다면 "[COMPLETE]"로 시작하여 짧은 확인만 해주세요.
부족하다면 보완한 최종 답변을 작성해주세요. 필요시 도구를 사용할 수 있습니다.`,
        },
      ];

      let evalResponse = await chatCompletion({
        model: modelName,
        maxTokens,
        temperature: temp,
        system: systemPrompt,
        tools,
        messages: evalMessages,
      });

      // Handle tool calls during self-evaluation
      let evalIterations = 0;
      while (evalResponse.stopReason === "tool_use" && evalResponse.toolCalls && evalIterations < 3) {
        evalIterations++;

        const toolResults: Array<{ toolCallId: string; name: string; result: string }> = [];
        for (const toolCall of evalResponse.toolCalls) {
          usedTools.add(toolCall.name);
          const result = await toolRegistry.execute(toolCall.name, agentId, toolCall.input);
          toolResults.push({ toolCallId: toolCall.id, name: toolCall.name, result });

          if (toolCall.name === "write_file" || toolCall.name === "edit_file") {
            modifiedFiles.add((toolCall.input as any).path);
          }
          if (toolCall.name === "read_file" || toolCall.name === "write_file") {
            await storage.updateAgent(agentId, { currentFile: (toolCall.input as any).path });
            emitEvent({ type: "status_change", data: { agentId, currentFile: (toolCall.input as any).path } });
          }
        }

        evalResponse = await continueWithToolResults({
          model: modelName,
          maxTokens,
          temperature: temp,
          system: systemPrompt,
          tools,
          messages: evalMessages,
          toolResults,
          previousResponse: evalResponse,
        });
      }

      const evalContent = evalResponse.content || "";

      // If the agent says [COMPLETE], the answer is sufficient — stop
      if (evalContent.trim().startsWith("[COMPLETE]")) {
        break;
      }

      // Otherwise, replace with the refined answer and optionally loop again
      if (evalContent.trim().length > 0) {
        fullResponse = evalContent;
      }
    }
    // ─── End self-evaluation loop ─────────────────────────────────

    await storage.createChatMessage({
      agentId,
      role: "assistant",
      content: fullResponse,
      attachmentUrl: null,
      attachmentType: null,
    });

    // Record episodic memory (non-blocking)
    episodicMemory.recordEpisode(agentId, {
      taskDescription: userMessage.substring(0, 200),
      taskResult: fullResponse.substring(0, 500),
      success: true,
      toolsUsed: Array.from(usedTools),
      filesModified: Array.from(modifiedFiles),
      duration: Date.now() - startTime,
      timestamp: new Date(),
    }).catch(() => {});

    await storage.updateAgent(agentId, { status: "idle", currentFile: null });
    emitEvent({ type: "status_change", data: { agentId, status: "idle" } });

    return fullResponse;
  } catch (error: any) {
    await storage.updateAgent(agentId, { status: "idle" });
    emitEvent({ type: "status_change", data: { agentId, status: "idle" } });
    throw error;
  }
}

export async function assignTask(agentId: string, description: string): Promise<{ task: any; response: string }> {
  const task = await storage.createTask({
    agentId,
    description,
    status: "in-progress",
    filePath: null,
    result: null,
    assignedAgentId: agentId,
    priority: null,
  });

  await storage.updateAgent(agentId, { currentTask: description, status: "working" });
  emitEvent({ type: "task_update", data: { ...task, status: "in-progress" } });
  emitEvent({ type: "status_change", data: { agentId, status: "working", currentTask: description } });

  await storage.createActivityLog({
    agentId,
    action: "task_assigned",
    details: description,
    filePath: null,
  });

  try {
    const response = await chatWithAgent(agentId, `새로운 작업이 할당되었습니다: ${description}\n\n이 작업을 수행해주세요.`);

    await storage.updateTask(task.id, { status: "completed", result: response });
    await storage.updateAgent(agentId, { currentTask: null });
    await storage.createActivityLog({
      agentId,
      action: "task_completed",
      details: description,
      filePath: null,
    });
    emitEvent({ type: "task_update", data: { ...task, status: "completed" } });
    emitEvent({ type: "activity", data: { agentId, action: "task_completed", details: description } });

    return { task, response };
  } catch (error: any) {
    await storage.updateTask(task.id, { status: "failed", result: error.message });
    await storage.updateAgent(agentId, { currentTask: null, status: "idle" });
    await storage.createActivityLog({
      agentId,
      action: "task_failed",
      details: `${description} - ${error.message}`,
      filePath: null,
    });
    emitEvent({ type: "task_update", data: { ...task, status: "failed" } });
    emitEvent({ type: "activity", data: { agentId, action: "task_failed", details: error.message } });
    throw error;
  }
}

export async function broadcastTask(description: string): Promise<void> {
  const allAgents = await storage.getAllAgents();
  for (const agent of allAgents) {
    if (agent.status === "idle") {
      assignTask(agent.id, description).catch(console.error);
    }
  }
}

export async function triggerInterAgentDiscussion(topic: string): Promise<void> {
  const allAgents = await storage.getAllAgents();
  if (allAgents.length < 2) return;

  const initiator = allAgents[0];
  for (const other of allAgents.slice(1)) {
    const msg = await storage.createAgentMessage({
      fromAgentId: initiator.id,
      toAgentId: other.id,
      content: `${topic}`,
      messageType: "discussion",
    });
    emitEvent({ type: "agent_message", data: msg });
  }

  for (const agent of allAgents) {
    chatWithAgent(agent.id, `팀 토론에 참여해주세요. 주제: ${topic}\n다른 에이전트들의 의견을 듣고 당신의 전문 분야 관점에서 의견을 제시해주세요.`).catch(console.error);
  }
}
