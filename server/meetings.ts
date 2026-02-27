import Anthropic from "@anthropic-ai/sdk";
import { storage } from "./storage";
import type { MeetingRoom, Agent } from "@shared/schema";

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

type MeetingBroadcast = (data: any) => void;
let broadcastFn: MeetingBroadcast = () => {};

export function setMeetingBroadcast(fn: MeetingBroadcast) {
  broadcastFn = fn;
}

export async function createRoom(name: string, topic?: string): Promise<MeetingRoom> {
  const room = await storage.createMeetingRoom({
    name,
    topic: topic || null,
    status: "active",
  });
  return room;
}

export async function inviteAgent(roomId: number, agentId: number) {
  const room = await storage.getMeetingRoom(roomId);
  if (!room) throw new Error("회의실을 찾을 수 없습니다");
  if (room.status === "closed") throw new Error("종료된 회의실입니다");

  const agent = await storage.getAgent(agentId);
  if (!agent) throw new Error("에이전트를 찾을 수 없습니다");

  const existing = await storage.getRoomParticipants(roomId);
  if (existing.some(p => p.agentId === agentId)) {
    throw new Error("이미 참가 중인 에이전트입니다");
  }

  const participant = await storage.addParticipant({ roomId, agentId });
  return participant;
}

export async function removeAgentFromRoom(roomId: number, agentId: number) {
  const room = await storage.getMeetingRoom(roomId);
  if (!room) throw new Error("회의실을 찾을 수 없습니다");

  await storage.removeParticipant(roomId, agentId);
}

export async function startDiscussion(roomId: number, topic: string) {
  const room = await storage.getMeetingRoom(roomId);
  if (!room) throw new Error("회의실을 찾을 수 없습니다");
  if (room.status === "closed") throw new Error("종료된 회의실입니다");

  const participants = await storage.getRoomParticipants(roomId);
  if (participants.length === 0) throw new Error("참가자가 없습니다");

  const agents: Agent[] = [];
  for (const p of participants) {
    const agent = await storage.getAgent(p.agentId);
    if (agent) agents.push(agent);
  }

  if (agents.length === 0) throw new Error("유효한 참가 에이전트가 없습니다");

  const existingMessages = await storage.getMeetingMessages(roomId);
  const conversationContext: Array<{ agentName: string; agentRole: string; content: string }> = [];

  for (const msg of existingMessages) {
    const msgAgent = agents.find(a => a.id === msg.agentId);
    if (msgAgent) {
      conversationContext.push({
        agentName: msgAgent.name,
        agentRole: msgAgent.role,
        content: msg.content,
      });
    }
  }

  const anthropic = await getAnthropicClient();

  for (const agent of agents) {
    const previousDiscussion = conversationContext
      .map(c => `[${c.agentName} (${c.agentRole})]: ${c.content}`)
      .join("\n\n");

    const systemPrompt = agent.systemPrompt ||
      getDefaultSystemPrompt(agent.role);

    const fullSystemPrompt = `${systemPrompt}

현재 당신의 정보:
- 이름: ${agent.name}
- 역할: ${agent.role}
- ID: ${agent.id}

회의실: ${room.name}
토론 주제: ${topic}

참가 에이전트:
${agents.map(a => `- ${a.name} (${a.role})`).join("\n")}

당신의 전문 분야 관점에서 주제에 대해 의견을 제시하세요. 간결하고 핵심적으로 답변하세요.`;

    const userMessage = previousDiscussion
      ? `회의 토론 주제: ${topic}\n\n이전 발언:\n${previousDiscussion}\n\n위 내용을 참고하여 당신의 전문 분야 관점에서 의견을 제시해주세요.`
      : `회의 토론 주제: ${topic}\n\n첫 번째 발언자로서 당신의 전문 분야 관점에서 의견을 제시해주세요.`;

    try {
      const model = agent.model || "claude-sonnet-4-6";
      const maxTokens = agent.maxTokens || 4096;
      const temperature = parseFloat(agent.temperature || "1");

      const response = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: fullSystemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });

      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === "text"
      );
      const content = textBlocks.map(b => b.text).join("");

      const meetingMsg = await storage.createMeetingMessage({
        roomId,
        agentId: agent.id,
        content,
      });

      conversationContext.push({
        agentName: agent.name,
        agentRole: agent.role,
        content,
      });

      broadcastFn({
        type: "meeting_message",
        data: {
          ...meetingMsg,
          agentName: agent.name,
          agentRole: agent.role,
        },
      });
    } catch (error: any) {
      const errorMsg = await storage.createMeetingMessage({
        roomId,
        agentId: agent.id,
        content: `[오류] 발언 생성 실패: ${error.message}`,
      });

      broadcastFn({
        type: "meeting_message",
        data: {
          ...errorMsg,
          agentName: agent.name,
          agentRole: agent.role,
        },
      });
    }
  }
}

export async function closeRoom(roomId: number) {
  const room = await storage.getMeetingRoom(roomId);
  if (!room) throw new Error("회의실을 찾을 수 없습니다");

  await storage.closeMeetingRoom(roomId);

  broadcastFn({
    type: "meeting_closed",
    data: { roomId },
  });
}

function getDefaultSystemPrompt(role: string): string {
  const prompts: Record<string, string> = {
    frontend: `당신은 프론트엔드 개발 전문 AI 에이전트입니다. React, TypeScript, CSS, HTML에 능숙합니다.
프로젝트의 프론트엔드 코드를 분석, 개선, 리팩토링할 수 있습니다.
다른 에이전트와 협업하여 프로젝트를 개선하세요. 한국어로 응답하세요.`,
    backend: `당신은 백엔드 개발 전문 AI 에이전트입니다. Node.js, Express, 데이터베이스, API 설계에 능숙합니다.
프로젝트의 서버 코드를 분석, 개선, 리팩토링할 수 있습니다.
다른 에이전트와 협업하여 프로젝트를 개선하세요. 한국어로 응답하세요.`,
    testing: `당신은 테스팅 전문 AI 에이전트입니다. 코드 리뷰, 버그 발견, 테스트 케이스 작성에 능숙합니다.
프로젝트의 코드 품질을 검증하고 개선 제안을 합니다.
다른 에이전트와 협업하여 프로젝트를 개선하세요. 한국어로 응답하세요.`,
    general: `당신은 범용 개발 AI 에이전트입니다. 풀스택 개발에 능숙합니다.
프로젝트 코드를 분석하고 개선할 수 있습니다.
다른 에이전트와 협업하여 프로젝트를 개선하세요. 한국어로 응답하세요.`,
  };
  return prompts[role] || prompts.general;
}
