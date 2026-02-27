import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { storage } from "./storage";
import { createAgent, removeAgent, chatWithAgent, assignTask, broadcastTask, triggerInterAgentDiscussion, onAgentEvent } from "./agents";
import { workspace } from "./workspace";

const createAgentSchema = z.object({
  name: z.string().min(1, "이름이 필요합니다"),
  role: z.enum(["frontend", "backend", "testing", "general"]).default("general"),
});

const updateAgentSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["frontend", "backend", "testing", "general"]).optional(),
  status: z.enum(["idle", "working", "paused"]).optional(),
}).strict();

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
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
      await removeAgent(parseInt(req.params.id));
      res.status(204).send();
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/agents/:id", async (req, res) => {
    try {
      const parsed = updateAgentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
      const updated = await storage.updateAgent(parseInt(req.params.id), parsed.data);
      if (!updated) return res.status(404).json({ error: "에이전트를 찾을 수 없습니다" });
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/agents/:id/chat", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: "메시지가 필요합니다" });
      const response = await chatWithAgent(parseInt(req.params.id), message);
      res.json({ response });
    } catch (e: any) {
      if (e.message?.includes("AI_INTEGRATIONS_ANTHROPIC_API_KEY")) {
        return res.status(503).json({ error: "AI API가 설정되지 않았습니다. Replit AI Integration을 확인하세요." });
      }
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/agents/:id/task", async (req, res) => {
    try {
      const { description } = req.body;
      if (!description) return res.status(400).json({ error: "작업 설명이 필요합니다" });
      const result = await assignTask(parseInt(req.params.id), description);
      res.json(result);
    } catch (e: any) {
      if (e.message?.includes("AI_INTEGRATIONS_ANTHROPIC_API_KEY")) {
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
    const agentTasks = await storage.getTasksByAgent(parseInt(req.params.id));
    res.json(agentTasks);
  });

  app.get("/api/agent-messages", async (req, res) => {
    const agentId = req.query.agentId ? parseInt(req.query.agentId as string) : undefined;
    const messages = await storage.getAgentMessages(agentId);
    res.json(messages);
  });

  app.get("/api/activities", async (_req, res) => {
    const logs = await storage.getActivityLogs(50);
    res.json(logs);
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

  return httpServer;
}
