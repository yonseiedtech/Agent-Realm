import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { storage } from "./storage";
import { createAgent, removeAgent, chatWithAgent, assignTask, broadcastTask, triggerInterAgentDiscussion, onAgentEvent } from "./agents";
import { generateAgentAvatar } from "./image-gen";
import { workspace } from "./workspace";
import { createRoom, inviteAgent, removeAgentFromRoom, startDiscussion, closeRoom, reopenRoom, setMeetingBroadcast, addUserMessage, inviteAllAgents } from "./meetings";
import { orchestrator } from "./orchestrator";
import { memoryStore } from "./memory/memory-store";
import { memoryPruner } from "./memory/memory-pruner";
import { toolRegistry } from "./tools";

const createAgentSchema = z.object({
  name: z.string().min(1, "이름이 필요합니다"),
  role: z.enum(["pm", "fullstack", "designer", "tester", "devops", "general"]).default("general"),
});

const updateAgentSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["pm", "fullstack", "designer", "tester", "devops", "general"]).optional(),
  status: z.enum(["idle", "working", "paused"]).optional(),
  systemPrompt: z.string().nullable().optional(),
  model: z.string().optional(),
  maxTokens: z.number().min(1024).max(8192).optional(),
  temperature: z.string().optional(),
  apiKey: z.string().nullable().optional(),
}).strict();

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Load workspace path from settings on startup
  try {
    const allSettings = await storage.getAllSettings();
    const wpSetting = allSettings.find(s => s.key === "workspace_path");
    if (wpSetting && wpSetting.value) {
      workspace.setBasePath(wpSetting.value);
    }
  } catch {}

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  const clients = new Set<WebSocket>();

  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
  });

  function broadcast(data: any) {
    const msg = JSON.stringify(data);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  onAgentEvent((event) => {
    broadcast(event);
  });

  setMeetingBroadcast(broadcast);

  app.get("/api/agents", async (_req, res) => {
    const agents = await storage.getAllAgents();
    res.json(agents);
  });

  app.post("/api/agents", async (req, res) => {
    try {
      const parsed = createAgentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
      const agent = await createAgent(parsed.data.name, parsed.data.role);
      res.status(201).json(agent);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/agents/:id", async (req, res) => {
    try {
      await removeAgent(req.params.id);
      res.status(204).send();
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/agents/:id", async (req, res) => {
    try {
      const parsed = updateAgentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
      const updated = await storage.updateAgent(req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ error: "에이전트를 찾을 수 없습니다" });
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/agents/:id/chat", async (req, res) => {
    try {
      const { message, attachmentUrl } = req.body;
      if (!message) return res.status(400).json({ error: "메시지가 필요합니다" });
      const response = await chatWithAgent(req.params.id, message, attachmentUrl);
      res.json({ response });
    } catch (e: any) {
      if (e.message?.includes("ANTHROPIC_API_KEY")) {
        return res.status(503).json({ error: "AI API가 설정되지 않았습니다. ANTHROPIC_API_KEY 환경변수를 확인하세요." });
      }
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/agents/:id/history", async (req, res) => {
    try {
      const history = await storage.getChatHistory(req.params.id);
      res.json(history);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/agents/:id/history", async (req, res) => {
    try {
      await storage.clearChatHistory(req.params.id);
      res.status(204).send();
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/agents/:id/generate-avatar", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) return res.status(404).json({ error: "에이전트를 찾을 수 없습니다" });
      const avatarUrl = await generateAgentAvatar(agent.id, agent.name, agent.role);
      if (!avatarUrl) return res.status(500).json({ error: "이미지 생성에 실패했습니다" });
      await storage.updateAgent(agent.id, { avatarUrl } as any);
      res.json({ avatarUrl });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/settings", async (_req, res) => {
    try {
      const allSettings = await storage.getAllSettings();
      const result: Record<string, string> = {};
      for (const s of allSettings) result[s.key] = s.value;
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/settings", async (req, res) => {
    try {
      const entries = Object.entries(req.body) as [string, string][];
      for (const [key, value] of entries) {
        await storage.setSetting(key, value);
      }
      // Apply workspace path change immediately
      if (req.body.workspace_path !== undefined) {
        const wp = req.body.workspace_path as string;
        if (wp.trim()) {
          workspace.setBasePath(wp.trim());
        }
      }
      res.json({ message: "설정이 저장되었습니다" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/upload", async (req, res) => {
    try {
      const { data, filename } = req.body;
      if (!data) return res.status(400).json({ error: "데이터가 필요합니다" });
      const buffer = Buffer.from(data, "base64");
      const allowedExts = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
      const rawExt = (filename?.split(".").pop() || "png").toLowerCase();
      const ext = allowedExts.includes(rawExt) ? rawExt : "png";
      const name = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const fs = await import("fs/promises");
      const path = await import("path");
      const uploadDir = path.join(process.cwd(), "uploads");
      await fs.mkdir(uploadDir, { recursive: true });
      const filePath = path.join(uploadDir, name);
      await fs.writeFile(filePath, buffer);
      res.json({ url: `/uploads/${name}` });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/agents/:id/task", async (req, res) => {
    try {
      const { description } = req.body;
      if (!description) return res.status(400).json({ error: "작업 설명이 필요합니다" });
      const result = await assignTask(req.params.id, description);
      res.json(result);
    } catch (e: any) {
      if (e.message?.includes("ANTHROPIC_API_KEY")) {
        return res.status(503).json({ error: "AI API가 설정되지 않았습니다." });
      }
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/agents/broadcast", async (req, res) => {
    try {
      const { description } = req.body;
      if (!description) return res.status(400).json({ error: "작업 설명이 필요합니다" });
      await broadcastTask(description);
      res.json({ message: "작업이 모든 에이전트에게 전달되었습니다" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/agents/discuss", async (req, res) => {
    try {
      const { topic } = req.body;
      if (!topic) return res.status(400).json({ error: "토론 주제가 필요합니다" });
      await triggerInterAgentDiscussion(topic);
      res.json({ message: "팀 토론이 시작되었습니다" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/tasks", async (_req, res) => {
    const allTasks = await storage.getAllTasks();
    res.json(allTasks);
  });

  app.get("/api/agents/:id/tasks", async (req, res) => {
    const agentTasks = await storage.getTasksByAgent(req.params.id);
    res.json(agentTasks);
  });

  app.patch("/api/tasks/:id", async (req, res) => {
    try {
      const { status, result } = req.body;
      const updated = await storage.updateTask(req.params.id, { status, result });
      if (!updated) return res.status(404).json({ error: "작업을 찾을 수 없습니다" });
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/agent-messages", async (req, res) => {
    const agentId = req.query.agentId as string | undefined;
    const messages = await storage.getAgentMessages(agentId);
    res.json(messages);
  });

  app.get("/api/activities", async (_req, res) => {
    const logs = await storage.getActivityLogs(50);
    res.json(logs);
  });

  app.get("/api/workspace/path", (_req, res) => {
    res.json({ path: workspace.getBasePath() });
  });

  app.post("/api/workspace/files", async (req, res) => {
    try {
      const { path } = req.body;
      const files = await workspace.listFiles(path || ".");
      res.json(files);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/workspace/file", async (req, res) => {
    try {
      const filePath = req.query.path as string;
      if (!filePath) return res.status(400).json({ error: "파일 경로가 필요합니다" });
      const content = await workspace.readFile(filePath);
      res.json({ path: filePath, content });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/meetings", async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1, "회의실 이름이 필요합니다"),
        topic: z.string().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
      const room = await createRoom(parsed.data.name, parsed.data.topic);
      res.status(201).json(room);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/meetings", async (_req, res) => {
    try {
      const rooms = await storage.getAllMeetingRooms();
      res.json(rooms);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/meetings/:id", async (req, res) => {
    try {
      const roomId = req.params.id;
      const room = await storage.getMeetingRoom(roomId);
      if (!room) return res.status(404).json({ error: "회의실을 찾을 수 없습니다" });
      const participants = await storage.getRoomParticipants(roomId);
      const messages = await storage.getMeetingMessages(roomId);
      const agents = await storage.getAllAgents();
      const participantDetails = participants.map(p => {
        const agent = agents.find(a => a.id === p.agentId);
        return { ...p, agentName: agent?.name, agentRole: agent?.role, agentColor: agent?.color };
      });
      const messageDetails = messages.map(m => {
        const agent = agents.find(a => a.id === m.agentId);
        return { ...m, agentName: agent?.name, agentRole: agent?.role };
      });
      res.json({ ...room, participants: participantDetails, messages: messageDetails });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/meetings/:id/invite", async (req, res) => {
    try {
      const schema = z.object({ agentId: z.string() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "에이전트 ID가 필요합니다" });
      const participant = await inviteAgent(req.params.id, parsed.data.agentId);
      res.status(201).json(participant);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/meetings/:id/participants/:agentId", async (req, res) => {
    try {
      await removeAgentFromRoom(req.params.id, req.params.agentId);
      res.status(204).send();
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/meetings/:id/discuss", async (req, res) => {
    try {
      const schema = z.object({
        topic: z.string().min(1, "토론 주제가 필요합니다"),
        rounds: z.number().min(1).max(5).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
      const roomId = req.params.id;
      const rounds = parsed.data.rounds ?? 2;
      startDiscussion(roomId, parsed.data.topic, rounds).catch(console.error);
      res.json({ message: "토론이 시작되었습니다" });
    } catch (e: any) {
      if (e.message?.includes("ANTHROPIC_API_KEY")) {
        return res.status(503).json({ error: "AI API가 설정되지 않았습니다." });
      }
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/meetings/:id/user-message", async (req, res) => {
    try {
      const schema = z.object({ content: z.string().min(1, "메시지 내용이 필요합니다") });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
      const msg = await addUserMessage(req.params.id, parsed.data.content);
      res.status(201).json(msg);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/meetings/:id/invite-all", async (req, res) => {
    try {
      const added = await inviteAllAgents(req.params.id);
      res.json({ message: `${added.length}명의 에이전트가 초대되었습니다`, added });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/meetings/:id/reopen", async (req, res) => {
    try {
      await reopenRoom(req.params.id);
      res.json({ message: "회의가 재개되었습니다" });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/meetings/:id/close", async (req, res) => {
    try {
      await closeRoom(req.params.id);
      res.json({ message: "회의가 종료되었습니다" });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/meetings/:id", async (req, res) => {
    try {
      await storage.deleteMeetingRoom(req.params.id);
      res.status(204).send();
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ═══════════════════════════════════════════════
  // Workflow API
  // ═══════════════════════════════════════════════

  app.post("/api/workflows", async (req, res) => {
    try {
      const schema = z.object({
        request: z.string().min(1, "요청 내용이 필요합니다"),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

      // Start workflow async, return immediately
      const resultPromise = orchestrator.executeWorkflow(parsed.data.request);
      // Get workflow ID from the first status check
      const status = await new Promise<any>((resolve) => {
        const check = setInterval(async () => {
          const workflows = await storage.getAllWorkflows();
          const latest = workflows[0];
          if (latest && latest.status === "running") {
            clearInterval(check);
            resolve(latest);
          }
        }, 100);
        // Timeout after 5s
        setTimeout(() => { clearInterval(check); resolve(null); }, 5000);
      });

      if (status) {
        // Don't await - let it run in background
        resultPromise.catch(console.error);
        res.status(201).json({ workflowId: status.id, status: "running" });
      } else {
        // If we couldn't find the running workflow, still try
        const result = await resultPromise;
        res.status(201).json(result);
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/workflows", async (_req, res) => {
    try {
      const workflows = await storage.getAllWorkflows();
      res.json(workflows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/workflows/:id", async (req, res) => {
    try {
      const status = await orchestrator.getWorkflowStatus(req.params.id);
      if (!status) return res.status(404).json({ error: "워크플로우를 찾을 수 없습니다" });
      res.json(status);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/workflows/:id/cancel", async (req, res) => {
    try {
      await orchestrator.cancelWorkflow(req.params.id);
      res.json({ message: "워크플로우가 취소되었습니다" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/workflows/:id/retry", async (req, res) => {
    try {
      await orchestrator.retryWorkflow(req.params.id);
      res.json({ message: "워크플로우가 재실행되었습니다" });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/workflows/:id/tasks/:taskId/retry", async (req, res) => {
    try {
      await orchestrator.retryTask(req.params.id, req.params.taskId);
      res.json({ message: "작업이 재실행되었습니다" });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/workflows/:id", async (req, res) => {
    try {
      await storage.deleteWorkflow(req.params.id);
      res.status(204).send();
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ═══════════════════════════════════════════════
  // Agent Memory API
  // ═══════════════════════════════════════════════

  app.get("/api/agents/:id/memories", async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const memories = await storage.getAgentMemories(req.params.id, type, limit);
      res.json(memories);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/agents/:id/memories", async (req, res) => {
    try {
      const schema = z.object({
        type: z.enum(["knowledge", "episode", "preference"]).default("knowledge"),
        content: z.string().min(1, "내용이 필요합니다"),
        importance: z.number().min(0).max(1).default(0.5),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

      const memory = await memoryStore.save({
        agentId: req.params.id,
        type: parsed.data.type,
        content: parsed.data.content,
        metadata: null,
        importance: parsed.data.importance,
      });
      res.status(201).json(memory);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/agents/:id/memories/search", async (req, res) => {
    try {
      const q = req.query.q as string;
      if (!q) return res.status(400).json({ error: "검색어가 필요합니다" });
      const limit = parseInt(req.query.limit as string) || 10;
      const results = await memoryStore.search(req.params.id, q, limit);
      res.json(results);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/agents/:id/memories/:memId", async (req, res) => {
    try {
      await memoryStore.delete(req.params.memId);
      res.status(204).send();
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/agents/:id/memories/prune", async (req, res) => {
    try {
      const result = await memoryPruner.prune(req.params.id);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ═══════════════════════════════════════════════
  // Tool Plugin API
  // ═══════════════════════════════════════════════

  app.get("/api/tools", async (_req, res) => {
    try {
      const tools = toolRegistry.getAllTools();
      res.json(tools.map(t => ({
        name: t.definition.name,
        description: t.definition.description,
        source: t.source,
        roles: t.roles,
      })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/plugins", async (_req, res) => {
    try {
      const plugins = await storage.getAllToolPlugins();
      res.json(plugins);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return httpServer;
}
