import Anthropic from "@anthropic-ai/sdk";
import { storage } from "./storage";
import { workspace } from "./workspace";
import type { Agent } from "@shared/schema";

async function getAnthropicClient(): Promise<Anthropic> {
  const customApiKey = await storage.getSetting("custom_api_key");
  const customBaseUrl = await storage.getSetting("custom_base_url");

  const apiKey = customApiKey || process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  const baseURL = customBaseUrl || process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;

  if (!apiKey) {
    throw new Error("AI_INTEGRATIONS_ANTHROPIC_API_KEY 환경 변수가 설정되지 않았습니다");
  }
  return new Anthropic({ apiKey, baseURL });
}

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
  frontend: `당신은 프론트엔드 개발 전문 AI 에이전트입니다. React, TypeScript, CSS, HTML에 능숙합니다.
프로젝트의 프론트엔드 코드를 분석, 개선, 리팩토링할 수 있습니다.
다른 에이전트와 협업하여 프로젝트를 개선하세요. 한국어로 응답하세요.
파일을 읽거나 수정할 때는 반드시 도구를 사용하세요.`,
  backend: `당신은 백엔드 개발 전문 AI 에이전트입니다. Node.js, Express, 데이터베이스, API 설계에 능숙합니다.
프로젝트의 서버 코드를 분석, 개선, 리팩토링할 수 있습니다.
다른 에이전트와 협업하여 프로젝트를 개선하세요. 한국어로 응답하세요.
파일을 읽거나 수정할 때는 반드시 도구를 사용하세요.`,
  testing: `당신은 테스팅 전문 AI 에이전트입니다. 코드 리뷰, 버그 발견, 테스트 케이스 작성에 능숙합니다.
프로젝트의 코드 품질을 검증하고 개선 제안을 합니다.
다른 에이전트와 협업하여 프로젝트를 개선하세요. 한국어로 응답하세요.`,
  general: `당신은 범용 개발 AI 에이전트입니다. 풀스택 개발에 능숙합니다.
프로젝트 코드를 분석하고 개선할 수 있습니다.
다른 에이전트와 협업하여 프로젝트를 개선하세요. 한국어로 응답하세요.
파일을 읽거나 수정할 때는 반드시 도구를 사용하세요.`,
};

const AVATAR_COLORS: Record<string, string> = {
  frontend: "#5865F2",
  backend: "#57F287",
  testing: "#FEE75C",
  general: "#ED4245",
};

const AVATAR_TYPES = ["developer", "designer", "analyst", "engineer", "architect", "researcher"];

function getTools(): Anthropic.Tool[] {
  return [
    {
      name: "list_files",
      description: "프로젝트 디렉토리의 파일 목록을 조회합니다",
      input_schema: {
        type: "object" as const,
        properties: {
          path: { type: "string", description: "조회할 디렉토리 경로 (기본: '.')" }
        },
        required: [],
      },
    },
    {
      name: "read_file",
      description: "파일 내용을 읽습니다",
      input_schema: {
        type: "object" as const,
        properties: {
          path: { type: "string", description: "읽을 파일 경로" }
        },
        required: ["path"],
      },
    },
    {
      name: "write_file",
      description: "파일에 내용을 작성합니다",
      input_schema: {
        type: "object" as const,
        properties: {
          path: { type: "string", description: "작성할 파일 경로" },
          content: { type: "string", description: "파일 내용" }
        },
        required: ["path", "content"],
      },
    },
    {
      name: "send_message_to_agent",
      description: "다른 에이전트에게 메시지를 보냅니다 (협업, 리뷰 요청 등)",
      input_schema: {
        type: "object" as const,
        properties: {
          to_agent_id: { type: "number", description: "메시지를 받을 에이전트 ID" },
          message: { type: "string", description: "보낼 메시지 내용" },
          message_type: { type: "string", enum: ["discussion", "suggestion", "request", "response"], description: "메시지 유형" }
        },
        required: ["to_agent_id", "message"],
      },
    },
  ];
}

async function handleToolCall(agentId: number, toolName: string, input: any): Promise<string> {
  switch (toolName) {
    case "list_files": {
      const files = await workspace.listFiles(input.path || ".");
      return JSON.stringify(files, null, 2);
    }
    case "read_file": {
      try {
        const content = await workspace.readFile(input.path);
        return content.length > 5000 ? content.substring(0, 5000) + "\n... (잘림)" : content;
      } catch {
        return `오류: 파일을 읽을 수 없습니다 - ${input.path}`;
      }
    }
    case "write_file": {
      try {
        await workspace.writeFile(input.path, input.content, agentId);
        await storage.createActivityLog({
          agentId,
          action: "file_write",
          details: `파일 수정: ${input.path}`,
          filePath: input.path,
        });
        emitEvent({
          type: "activity",
          data: { agentId, action: "file_write", filePath: input.path },
        });
        return `파일이 성공적으로 작성되었습니다: ${input.path}`;
      } catch (e: any) {
        return `오류: ${e.message}`;
      }
    }
    case "send_message_to_agent": {
      const msg = await storage.createAgentMessage({
        fromAgentId: agentId,
        toAgentId: input.to_agent_id,
        content: input.message,
        messageType: input.message_type || "discussion",
      });
      emitEvent({ type: "agent_message", data: msg });
      return `메시지가 에이전트 #${input.to_agent_id}에게 전송되었습니다`;
    }
    default:
      return "알 수 없는 도구입니다";
  }
}

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
  return agent;
}

export async function removeAgent(id: number): Promise<void> {
  await storage.deleteAgent(id);
  emitEvent({ type: "agent_deleted", data: { id } });
}

async function loadConversation(agentId: number): Promise<ConversationMessage[]> {
  const history = await storage.getChatHistory(agentId);
  return history.map(h => ({
    role: h.role as "user" | "assistant",
    content: h.content,
  }));
}

export async function chatWithAgent(agentId: number, userMessage: string, attachmentUrl?: string): Promise<string> {
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
  const systemPrompt = `${basePrompt}

현재 당신의 정보:
- 이름: ${agent.name}
- 역할: ${agent.role}
- ID: ${agent.id}

팀원 에이전트:
${agentListStr || "없음"}

협업이 필요하면 send_message_to_agent 도구를 사용하세요.`;

  await storage.updateAgent(agentId, { status: "working" });
  emitEvent({ type: "status_change", data: { agentId, status: "working" } });

  const recentConversation = conversation.slice(-20);

  try {
    const anthropic = await getAnthropicClient();
    const modelName = agent.model || "claude-sonnet-4-6";
    const maxTokens = agent.maxTokens || 4096;
    const temp = parseFloat(agent.temperature || "1");

    let response = await anthropic.messages.create({
      model: modelName,
      max_tokens: maxTokens,
      temperature: temp,
      system: systemPrompt,
      tools: getTools(),
      messages: recentConversation.map(m => ({ role: m.role, content: m.content })),
    });

    let fullResponse = "";
    let iterations = 0;
    const maxIterations = 5;

    while (response.stop_reason === "tool_use" && iterations < maxIterations) {
      iterations++;
      const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text");
      if (textBlocks.length > 0) {
        fullResponse += textBlocks.map(b => b.text).join("");
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolBlock of toolUseBlocks) {
        const result = await handleToolCall(agentId, toolBlock.name, toolBlock.input);
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolBlock.id,
          content: result,
        });

        if (toolBlock.name === "read_file" || toolBlock.name === "write_file") {
          await storage.updateAgent(agentId, { currentFile: (toolBlock.input as any).path });
          emitEvent({ type: "status_change", data: { agentId, currentFile: (toolBlock.input as any).path } });
        }
      }

      recentConversation.push({ role: "assistant", content: JSON.stringify(response.content) });
      recentConversation.push({ role: "user", content: JSON.stringify(toolResults) });

      response = await anthropic.messages.create({
        model: modelName,
        max_tokens: maxTokens,
        temperature: temp,
        system: systemPrompt,
        tools: getTools(),
        messages: recentConversation.map(m => ({ role: m.role, content: m.content })),
      });
    }

    const finalTextBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text");
    fullResponse += finalTextBlocks.map(b => b.text).join("");

    await storage.createChatMessage({
      agentId,
      role: "assistant",
      content: fullResponse,
      attachmentUrl: null,
      attachmentType: null,
    });

    await storage.updateAgent(agentId, { status: "idle", currentFile: null });
    emitEvent({ type: "status_change", data: { agentId, status: "idle" } });

    return fullResponse;
  } catch (error: any) {
    await storage.updateAgent(agentId, { status: "idle" });
    emitEvent({ type: "status_change", data: { agentId, status: "idle" } });
    throw error;
  }
}

export async function assignTask(agentId: number, description: string): Promise<{ task: any; response: string }> {
  const task = await storage.createTask({
    agentId,
    description,
    status: "in-progress",
    filePath: null,
    result: null,
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
