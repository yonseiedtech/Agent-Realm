import { storage } from "../../storage";
import { emitEvent, assignTask } from "../../agents";
import type { ToolDefinition } from "../../ai-client";
import type { ToolHandler } from "../tool-registry";

// ─── Tool Definitions ────────────────────────────────────

export const sendMessageDef: ToolDefinition = {
  name: "send_message_to_agent",
  description: "다른 에이전트에게 메시지를 보냅니다 (협업, 리뷰 요청 등)",
  input_schema: {
    type: "object" as const,
    properties: {
      to_agent_id: { type: "string", description: "메시지를 받을 에이전트 ID" },
      message: { type: "string", description: "보낼 메시지 내용" },
      message_type: { type: "string", enum: ["discussion", "suggestion", "request", "response"], description: "메시지 유형" },
    },
    required: ["to_agent_id", "message"],
  },
};

export const createTaskDef: ToolDefinition = {
  name: "create_task",
  description: "다른 에이전트에게 작업을 생성하고 할당합니다 (PM 역할에 최적)",
  input_schema: {
    type: "object" as const,
    properties: {
      agent_id: { type: "string", description: "작업을 할당할 에이전트 ID" },
      description: { type: "string", description: "작업 설명" },
      priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "우선순위" },
    },
    required: ["agent_id", "description"],
  },
};

// ─── Tool Handlers ───────────────────────────────────────

export const sendMessageHandler: ToolHandler = async (agentId, input) => {
  const msg = await storage.createAgentMessage({
    fromAgentId: agentId,
    toAgentId: input.to_agent_id,
    content: input.message,
    messageType: input.message_type || "discussion",
  });
  emitEvent({ type: "agent_message", data: msg });
  return `메시지가 에이전트 #${input.to_agent_id}에게 전송되었습니다`;
};

export const createTaskHandler: ToolHandler = async (agentId, input) => {
  try {
    const task = await storage.createTask({
      agentId: input.agent_id,
      description: input.description,
      status: "pending",
      filePath: null,
      result: null,
      assignedAgentId: input.agent_id,
      priority: input.priority || "medium",
    });
    emitEvent({ type: "task_update", data: { ...task, priority: input.priority || "medium" } });
    emitEvent({
      type: "activity",
      data: { agentId, action: "task_created", details: `에이전트 #${input.agent_id}에게 작업 할당: ${input.description}` },
    });
    assignTask(input.agent_id, input.description).catch(console.error);
    return `작업이 에이전트 #${input.agent_id}에게 할당되었습니다: ${input.description}`;
  } catch (e: any) {
    return `작업 생성 오류: ${e.message}`;
  }
};
