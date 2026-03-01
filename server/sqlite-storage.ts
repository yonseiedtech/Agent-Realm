import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import type {
  User, InsertUser,
  Agent, InsertAgent,
  Task, InsertTask,
  AgentMessage, InsertAgentMessage,
  ActivityLog, InsertActivityLog,
  ChatHistory, InsertChatHistory,
  Settings,
  MeetingRoom, InsertMeetingRoom,
  MeetingParticipant, InsertMeetingParticipant,
  MeetingMessage, InsertMeetingMessage,
  Workflow, InsertWorkflow,
  WorkflowTask, InsertWorkflowTask,
  TaskDependency, InsertTaskDependency,
  AgentMemory, InsertAgentMemory,
  ToolPlugin, InsertToolPlugin,
} from "@shared/schema";
import type { IStorage } from "./storage";

export class SqliteStorage implements IStorage {
  private db: Database.Database;

  constructor(dbPath = "./agent-realm.db") {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'general',
        status TEXT NOT NULL DEFAULT 'idle',
        color TEXT NOT NULL DEFAULT '#5865F2',
        avatarType TEXT NOT NULL DEFAULT 'cat',
        currentTask TEXT,
        currentFile TEXT,
        systemPrompt TEXT,
        model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
        maxTokens INTEGER NOT NULL DEFAULT 4096,
        temperature TEXT NOT NULL DEFAULT '1',
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        agentId TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        filePath TEXT,
        result TEXT,
        assignedAgentId TEXT,
        priority TEXT,
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agent_messages (
        id TEXT PRIMARY KEY,
        fromAgentId TEXT NOT NULL,
        toAgentId TEXT,
        content TEXT NOT NULL,
        messageType TEXT NOT NULL DEFAULT 'discussion',
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        agentId TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        filePath TEXT,
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chat_history (
        id TEXT PRIMARY KEY,
        agentId TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        attachmentUrl TEXT,
        attachmentType TEXT,
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS meeting_rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        topic TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS meeting_participants (
        id TEXT PRIMARY KEY,
        roomId TEXT NOT NULL,
        agentId TEXT NOT NULL,
        joinedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS meeting_messages (
        id TEXT PRIMARY KEY,
        roomId TEXT NOT NULL,
        agentId TEXT NOT NULL,
        content TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );

      -- Migration: add avatarUrl to agents
      CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY);
    `);

    // avatarUrl migration
    const hasMigration = this.db.prepare("SELECT 1 FROM _migrations WHERE name = 'add_avatarUrl'").get();
    if (!hasMigration) {
      try {
        this.db.exec("ALTER TABLE agents ADD COLUMN avatarUrl TEXT");
      } catch {}
      this.db.prepare("INSERT OR IGNORE INTO _migrations (name) VALUES ('add_avatarUrl')").run();
    }

    // apiKey migration
    const hasApiKeyMigration = this.db.prepare("SELECT 1 FROM _migrations WHERE name = 'add_agent_apiKey'").get();
    if (!hasApiKeyMigration) {
      try {
        this.db.exec("ALTER TABLE agents ADD COLUMN apiKey TEXT");
      } catch {}
      this.db.prepare("INSERT OR IGNORE INTO _migrations (name) VALUES ('add_agent_apiKey')").run();
    }

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_agentId ON tasks(agentId);
      CREATE INDEX IF NOT EXISTS idx_tasks_createdAt ON tasks(createdAt);
      CREATE INDEX IF NOT EXISTS idx_agent_messages_fromAgentId ON agent_messages(fromAgentId);
      CREATE INDEX IF NOT EXISTS idx_agent_messages_toAgentId ON agent_messages(toAgentId);
      CREATE INDEX IF NOT EXISTS idx_agent_messages_createdAt ON agent_messages(createdAt);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_agentId ON activity_logs(agentId);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_createdAt ON activity_logs(createdAt);
      CREATE INDEX IF NOT EXISTS idx_chat_history_agentId ON chat_history(agentId);
      CREATE INDEX IF NOT EXISTS idx_chat_history_createdAt ON chat_history(createdAt);
      CREATE INDEX IF NOT EXISTS idx_meeting_participants_roomId ON meeting_participants(roomId);
      CREATE INDEX IF NOT EXISTS idx_meeting_participants_agentId ON meeting_participants(agentId);
      CREATE INDEX IF NOT EXISTS idx_meeting_messages_roomId ON meeting_messages(roomId);
      CREATE INDEX IF NOT EXISTS idx_meeting_messages_createdAt ON meeting_messages(createdAt);
    `);

    // ─── Multi-Agent Advancement Tables ─────────────────────────────
    const hasAdvancementMigration = this.db.prepare("SELECT 1 FROM _migrations WHERE name = 'multi_agent_advancement'").get();
    if (!hasAdvancementMigration) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS workflows (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          createdBy TEXT,
          createdAt TEXT NOT NULL,
          completedAt TEXT
        );

        CREATE TABLE IF NOT EXISTS workflow_tasks (
          id TEXT PRIMARY KEY,
          workflowId TEXT NOT NULL,
          agentId TEXT,
          description TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          result TEXT,
          priority TEXT NOT NULL DEFAULT 'medium',
          suggestedRole TEXT,
          orderIndex INTEGER NOT NULL DEFAULT 0,
          createdAt TEXT NOT NULL,
          completedAt TEXT
        );

        CREATE TABLE IF NOT EXISTS task_dependencies (
          id TEXT PRIMARY KEY,
          taskId TEXT NOT NULL,
          dependsOnTaskId TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS agent_memories (
          id TEXT PRIMARY KEY,
          agentId TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'knowledge',
          content TEXT NOT NULL,
          metadata TEXT,
          importance REAL NOT NULL DEFAULT 0.5,
          accessCount INTEGER NOT NULL DEFAULT 0,
          lastAccessedAt TEXT,
          createdAt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tool_plugins (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          inputSchema TEXT NOT NULL,
          handlerPath TEXT NOT NULL,
          enabledRoles TEXT,
          isEnabled INTEGER NOT NULL DEFAULT 1,
          createdAt TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_workflow_tasks_workflowId ON workflow_tasks(workflowId);
        CREATE INDEX IF NOT EXISTS idx_workflow_tasks_agentId ON workflow_tasks(agentId);
        CREATE INDEX IF NOT EXISTS idx_workflow_tasks_status ON workflow_tasks(status);
        CREATE INDEX IF NOT EXISTS idx_task_dependencies_taskId ON task_dependencies(taskId);
        CREATE INDEX IF NOT EXISTS idx_task_dependencies_dependsOn ON task_dependencies(dependsOnTaskId);
        CREATE INDEX IF NOT EXISTS idx_agent_memories_agentId ON agent_memories(agentId);
        CREATE INDEX IF NOT EXISTS idx_agent_memories_type ON agent_memories(type);
        CREATE INDEX IF NOT EXISTS idx_agent_memories_importance ON agent_memories(importance);
      `);

      // FTS5 for agent memories full-text search
      try {
        this.db.exec(`
          CREATE VIRTUAL TABLE IF NOT EXISTS agent_memories_fts USING fts5(
            content,
            tokenize='unicode61'
          );
        `);
      } catch {}

      this.db.prepare("INSERT OR IGNORE INTO _migrations (name) VALUES ('multi_agent_advancement')").run();
    }
  }

  private now(): string {
    return new Date().toISOString();
  }

  // ============ User ============
  async getUser(id: string): Promise<User | undefined> {
    return this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User | undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.db.prepare("SELECT * FROM users WHERE username = ?").get(username) as User | undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = randomUUID();
    this.db.prepare("INSERT INTO users (id, username, password) VALUES (?, ?, ?)").run(id, user.username, user.password);
    return { id, ...user };
  }

  // ============ Agent ============
  async getAllAgents(): Promise<Agent[]> {
    const rows = this.db.prepare("SELECT * FROM agents ORDER BY createdAt ASC").all() as any[];
    return rows.map(r => ({ ...r, createdAt: new Date(r.createdAt) }));
  }

  async getAgent(id: string): Promise<Agent | undefined> {
    const row = this.db.prepare("SELECT * FROM agents WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    return { ...row, createdAt: new Date(row.createdAt) };
  }

  async createAgent(agent: InsertAgent): Promise<Agent> {
    const id = randomUUID();
    const createdAt = this.now();
    this.db.prepare(`
      INSERT INTO agents (id, name, role, status, color, avatarType, avatarUrl, currentTask, currentFile, systemPrompt, model, maxTokens, temperature, apiKey, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      agent.name,
      agent.role ?? "general",
      agent.status ?? "idle",
      agent.color ?? "#5865F2",
      agent.avatarType ?? "cat",
      agent.avatarUrl ?? null,
      agent.currentTask ?? null,
      agent.currentFile ?? null,
      agent.systemPrompt ?? null,
      agent.model ?? "claude-sonnet-4-6",
      agent.maxTokens ?? 4096,
      agent.temperature ?? "1",
      agent.apiKey ?? null,
      createdAt,
    );
    return { id, name: agent.name, role: agent.role ?? "general", status: agent.status ?? "idle", color: agent.color ?? "#5865F2", avatarType: agent.avatarType ?? "cat", avatarUrl: agent.avatarUrl ?? null, currentTask: agent.currentTask ?? null, currentFile: agent.currentFile ?? null, systemPrompt: agent.systemPrompt ?? null, model: agent.model ?? "claude-sonnet-4-6", maxTokens: agent.maxTokens ?? 4096, temperature: agent.temperature ?? "1", apiKey: agent.apiKey ?? null, createdAt: new Date(createdAt) };
  }

  async updateAgent(id: string, data: Partial<InsertAgent>): Promise<Agent | undefined> {
    const existing = this.db.prepare("SELECT * FROM agents WHERE id = ?").get(id) as any;
    if (!existing) return undefined;

    const fields: string[] = [];
    const values: any[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    if (fields.length > 0) {
      values.push(id);
      this.db.prepare(`UPDATE agents SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    }

    const row = this.db.prepare("SELECT * FROM agents WHERE id = ?").get(id) as any;
    return { ...row, createdAt: new Date(row.createdAt) };
  }

  async deleteAgent(id: string): Promise<void> {
    const del = this.db.transaction(() => {
      this.db.prepare("DELETE FROM chat_history WHERE agentId = ?").run(id);
      this.db.prepare("DELETE FROM meeting_participants WHERE agentId = ?").run(id);
      this.db.prepare("DELETE FROM meeting_messages WHERE agentId = ?").run(id);
      this.db.prepare("DELETE FROM agent_messages WHERE fromAgentId = ? OR toAgentId = ?").run(id, id);
      this.db.prepare("DELETE FROM activity_logs WHERE agentId = ?").run(id);
      this.db.prepare("DELETE FROM tasks WHERE agentId = ?").run(id);
      this.db.prepare("DELETE FROM agents WHERE id = ?").run(id);
    });
    del();
  }

  // ============ Task ============
  async getAllTasks(): Promise<Task[]> {
    const rows = this.db.prepare("SELECT * FROM tasks ORDER BY createdAt DESC").all() as any[];
    return rows.map(r => ({ ...r, createdAt: new Date(r.createdAt) }));
  }

  async getTasksByAgent(agentId: string): Promise<Task[]> {
    const rows = this.db.prepare("SELECT * FROM tasks WHERE agentId = ? ORDER BY createdAt DESC").all(agentId) as any[];
    return rows.map(r => ({ ...r, createdAt: new Date(r.createdAt) }));
  }

  async createTask(task: InsertTask): Promise<Task> {
    const id = randomUUID();
    const createdAt = this.now();
    this.db.prepare(`
      INSERT INTO tasks (id, agentId, description, status, filePath, result, assignedAgentId, priority, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, task.agentId, task.description, task.status ?? "pending", task.filePath ?? null, task.result ?? null, task.assignedAgentId ?? null, task.priority ?? null, createdAt);
    return { id, agentId: task.agentId, description: task.description, status: task.status ?? "pending", filePath: task.filePath ?? null, result: task.result ?? null, assignedAgentId: task.assignedAgentId ?? null, priority: task.priority ?? null, createdAt: new Date(createdAt) };
  }

  async updateTask(id: string, data: Partial<InsertTask>): Promise<Task | undefined> {
    const existing = this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as any;
    if (!existing) return undefined;

    const fields: string[] = [];
    const values: any[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    if (fields.length > 0) {
      values.push(id);
      this.db.prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    }

    const row = this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as any;
    return { ...row, createdAt: new Date(row.createdAt) };
  }

  // ============ AgentMessage ============
  async getAgentMessages(agentId?: string): Promise<AgentMessage[]> {
    let rows: any[];
    if (agentId) {
      rows = this.db.prepare(
        "SELECT * FROM agent_messages WHERE fromAgentId = ? OR toAgentId = ? ORDER BY createdAt DESC LIMIT 100"
      ).all(agentId, agentId) as any[];
    } else {
      rows = this.db.prepare("SELECT * FROM agent_messages ORDER BY createdAt DESC LIMIT 100").all() as any[];
    }
    return rows.map(r => ({ ...r, createdAt: new Date(r.createdAt) }));
  }

  async createAgentMessage(msg: InsertAgentMessage): Promise<AgentMessage> {
    const id = randomUUID();
    const createdAt = this.now();
    this.db.prepare(`
      INSERT INTO agent_messages (id, fromAgentId, toAgentId, content, messageType, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, msg.fromAgentId, msg.toAgentId ?? null, msg.content, msg.messageType ?? "discussion", createdAt);
    return { id, fromAgentId: msg.fromAgentId, toAgentId: msg.toAgentId ?? null, content: msg.content, messageType: msg.messageType ?? "discussion", createdAt: new Date(createdAt) };
  }

  // ============ ActivityLog ============
  async getActivityLogs(limit = 50): Promise<ActivityLog[]> {
    const rows = this.db.prepare("SELECT * FROM activity_logs ORDER BY createdAt DESC LIMIT ?").all(limit) as any[];
    return rows.map(r => ({ ...r, createdAt: new Date(r.createdAt) }));
  }

  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const id = randomUUID();
    const createdAt = this.now();
    this.db.prepare(`
      INSERT INTO activity_logs (id, agentId, action, details, filePath, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, log.agentId, log.action, log.details ?? null, log.filePath ?? null, createdAt);
    return { id, agentId: log.agentId, action: log.action, details: log.details ?? null, filePath: log.filePath ?? null, createdAt: new Date(createdAt) };
  }

  // ============ ChatHistory ============
  async getChatHistory(agentId: string): Promise<ChatHistory[]> {
    const rows = this.db.prepare("SELECT * FROM chat_history WHERE agentId = ? ORDER BY createdAt ASC").all(agentId) as any[];
    return rows.map(r => ({ ...r, createdAt: new Date(r.createdAt) }));
  }

  async createChatMessage(msg: InsertChatHistory): Promise<ChatHistory> {
    const id = randomUUID();
    const createdAt = this.now();
    this.db.prepare(`
      INSERT INTO chat_history (id, agentId, role, content, attachmentUrl, attachmentType, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, msg.agentId, msg.role, msg.content, msg.attachmentUrl ?? null, msg.attachmentType ?? null, createdAt);
    return { id, agentId: msg.agentId, role: msg.role, content: msg.content, attachmentUrl: msg.attachmentUrl ?? null, attachmentType: msg.attachmentType ?? null, createdAt: new Date(createdAt) };
  }

  async clearChatHistory(agentId: string): Promise<void> {
    this.db.prepare("DELETE FROM chat_history WHERE agentId = ?").run(agentId);
  }

  // ============ Settings ============
  async getSetting(key: string): Promise<string | undefined> {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as any;
    return row?.value;
  }

  async setSetting(key: string, value: string): Promise<void> {
    this.db.prepare(
      "INSERT INTO settings (id, key, value) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(randomUUID(), key, value);
  }

  async getAllSettings(): Promise<Settings[]> {
    return this.db.prepare("SELECT * FROM settings").all() as Settings[];
  }

  // ============ MeetingRoom ============
  async createMeetingRoom(room: InsertMeetingRoom): Promise<MeetingRoom> {
    const id = randomUUID();
    const createdAt = this.now();
    this.db.prepare(`
      INSERT INTO meeting_rooms (id, name, topic, status, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, room.name, room.topic ?? null, room.status ?? "active", createdAt);
    return { id, name: room.name, topic: room.topic ?? null, status: room.status ?? "active", createdAt: new Date(createdAt) };
  }

  async getMeetingRoom(id: string): Promise<MeetingRoom | undefined> {
    const row = this.db.prepare("SELECT * FROM meeting_rooms WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    return { ...row, createdAt: new Date(row.createdAt) };
  }

  async getAllMeetingRooms(): Promise<MeetingRoom[]> {
    const rows = this.db.prepare("SELECT * FROM meeting_rooms ORDER BY createdAt DESC").all() as any[];
    return rows.map(r => ({ ...r, createdAt: new Date(r.createdAt) }));
  }

  async closeMeetingRoom(id: string): Promise<void> {
    this.db.prepare("UPDATE meeting_rooms SET status = 'closed' WHERE id = ?").run(id);
  }

  async reopenMeetingRoom(id: string): Promise<void> {
    this.db.prepare("UPDATE meeting_rooms SET status = 'active' WHERE id = ?").run(id);
  }

  async deleteMeetingRoom(id: string): Promise<void> {
    this.db.prepare("DELETE FROM meeting_messages WHERE roomId = ?").run(id);
    this.db.prepare("DELETE FROM meeting_participants WHERE roomId = ?").run(id);
    this.db.prepare("DELETE FROM meeting_rooms WHERE id = ?").run(id);
  }

  // ============ MeetingParticipant ============
  async addParticipant(data: InsertMeetingParticipant): Promise<MeetingParticipant> {
    const id = randomUUID();
    const joinedAt = this.now();
    this.db.prepare(`
      INSERT INTO meeting_participants (id, roomId, agentId, joinedAt)
      VALUES (?, ?, ?, ?)
    `).run(id, data.roomId, data.agentId, joinedAt);
    return { id, roomId: data.roomId, agentId: data.agentId, joinedAt: new Date(joinedAt) };
  }

  async removeParticipant(roomId: string, agentId: string): Promise<void> {
    this.db.prepare("DELETE FROM meeting_participants WHERE roomId = ? AND agentId = ?").run(roomId, agentId);
  }

  async getRoomParticipants(roomId: string): Promise<MeetingParticipant[]> {
    const rows = this.db.prepare("SELECT * FROM meeting_participants WHERE roomId = ?").all(roomId) as any[];
    return rows.map(r => ({ ...r, joinedAt: new Date(r.joinedAt) }));
  }

  // ============ MeetingMessage ============
  async createMeetingMessage(msg: InsertMeetingMessage): Promise<MeetingMessage> {
    const id = randomUUID();
    const createdAt = this.now();
    this.db.prepare(`
      INSERT INTO meeting_messages (id, roomId, agentId, content, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, msg.roomId, msg.agentId, msg.content, createdAt);
    return { id, roomId: msg.roomId, agentId: msg.agentId, content: msg.content, createdAt: new Date(createdAt) };
  }

  async getMeetingMessages(roomId: string): Promise<MeetingMessage[]> {
    const rows = this.db.prepare("SELECT * FROM meeting_messages WHERE roomId = ? ORDER BY createdAt ASC").all(roomId) as any[];
    return rows.map(r => ({ ...r, createdAt: new Date(r.createdAt) }));
  }

  // ============ Workflow ============
  async createWorkflow(data: InsertWorkflow): Promise<Workflow> {
    const id = randomUUID();
    const createdAt = this.now();
    this.db.prepare(`
      INSERT INTO workflows (id, title, description, status, createdBy, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.title, data.description ?? null, data.status ?? "pending", data.createdBy ?? null, createdAt);
    return { id, title: data.title, description: data.description ?? null, status: data.status ?? "pending", createdBy: data.createdBy ?? null, createdAt: new Date(createdAt), completedAt: null };
  }

  async getWorkflow(id: string): Promise<Workflow | undefined> {
    const row = this.db.prepare("SELECT * FROM workflows WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    return { ...row, createdAt: new Date(row.createdAt), completedAt: row.completedAt ? new Date(row.completedAt) : null };
  }

  async getAllWorkflows(): Promise<Workflow[]> {
    const rows = this.db.prepare("SELECT * FROM workflows ORDER BY createdAt DESC LIMIT 50").all() as any[];
    return rows.map(r => ({ ...r, createdAt: new Date(r.createdAt), completedAt: r.completedAt ? new Date(r.completedAt) : null }));
  }

  async updateWorkflow(id: string, data: Partial<InsertWorkflow & { completedAt: string }>): Promise<Workflow | undefined> {
    const existing = this.db.prepare("SELECT * FROM workflows WHERE id = ?").get(id) as any;
    if (!existing) return undefined;
    const fields: string[] = [];
    const values: any[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) { fields.push(`${key} = ?`); values.push(value); }
    }
    if (fields.length > 0) {
      values.push(id);
      this.db.prepare(`UPDATE workflows SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    }
    return this.getWorkflow(id);
  }

  async deleteWorkflow(id: string): Promise<void> {
    const del = this.db.transaction(() => {
      const tasks = this.db.prepare("SELECT id FROM workflow_tasks WHERE workflowId = ?").all(id) as any[];
      for (const t of tasks) {
        this.db.prepare("DELETE FROM task_dependencies WHERE taskId = ? OR dependsOnTaskId = ?").run(t.id, t.id);
      }
      this.db.prepare("DELETE FROM workflow_tasks WHERE workflowId = ?").run(id);
      this.db.prepare("DELETE FROM workflows WHERE id = ?").run(id);
    });
    del();
  }

  // ============ WorkflowTask ============
  async createWorkflowTask(data: InsertWorkflowTask): Promise<WorkflowTask> {
    const id = randomUUID();
    const createdAt = this.now();
    this.db.prepare(`
      INSERT INTO workflow_tasks (id, workflowId, agentId, description, status, result, priority, suggestedRole, orderIndex, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.workflowId, data.agentId ?? null, data.description, data.status ?? "pending", data.result ?? null, data.priority ?? "medium", data.suggestedRole ?? null, data.orderIndex ?? 0, createdAt);
    return { id, workflowId: data.workflowId, agentId: data.agentId ?? null, description: data.description, status: data.status ?? "pending", result: data.result ?? null, priority: data.priority ?? "medium", suggestedRole: data.suggestedRole ?? null, orderIndex: data.orderIndex ?? 0, createdAt: new Date(createdAt), completedAt: null };
  }

  async getWorkflowTask(id: string): Promise<WorkflowTask | undefined> {
    const row = this.db.prepare("SELECT * FROM workflow_tasks WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    return { ...row, createdAt: new Date(row.createdAt), completedAt: row.completedAt ? new Date(row.completedAt) : null };
  }

  async getWorkflowTasks(workflowId: string): Promise<WorkflowTask[]> {
    const rows = this.db.prepare("SELECT * FROM workflow_tasks WHERE workflowId = ? ORDER BY orderIndex ASC").all(workflowId) as any[];
    return rows.map(r => ({ ...r, createdAt: new Date(r.createdAt), completedAt: r.completedAt ? new Date(r.completedAt) : null }));
  }

  async updateWorkflowTask(id: string, data: Partial<InsertWorkflowTask & { completedAt: string }>): Promise<WorkflowTask | undefined> {
    const existing = this.db.prepare("SELECT * FROM workflow_tasks WHERE id = ?").get(id) as any;
    if (!existing) return undefined;
    const fields: string[] = [];
    const values: any[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) { fields.push(`${key} = ?`); values.push(value); }
    }
    if (fields.length > 0) {
      values.push(id);
      this.db.prepare(`UPDATE workflow_tasks SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    }
    return this.getWorkflowTask(id);
  }

  // ============ TaskDependency ============
  async createTaskDependency(data: InsertTaskDependency): Promise<TaskDependency> {
    const id = randomUUID();
    this.db.prepare("INSERT INTO task_dependencies (id, taskId, dependsOnTaskId) VALUES (?, ?, ?)").run(id, data.taskId, data.dependsOnTaskId);
    return { id, taskId: data.taskId, dependsOnTaskId: data.dependsOnTaskId };
  }

  async getTaskDependencies(taskId: string): Promise<TaskDependency[]> {
    return this.db.prepare("SELECT * FROM task_dependencies WHERE taskId = ?").all(taskId) as TaskDependency[];
  }

  async getDependents(taskId: string): Promise<TaskDependency[]> {
    return this.db.prepare("SELECT * FROM task_dependencies WHERE dependsOnTaskId = ?").all(taskId) as TaskDependency[];
  }

  // ============ AgentMemory ============
  async createAgentMemory(data: InsertAgentMemory): Promise<AgentMemory> {
    const id = randomUUID();
    const createdAt = this.now();
    this.db.prepare(`
      INSERT INTO agent_memories (id, agentId, type, content, metadata, importance, accessCount, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `).run(id, data.agentId, data.type, data.content, data.metadata ?? null, data.importance ?? 0.5, createdAt);
    // Also insert into FTS
    try {
      this.db.prepare("INSERT INTO agent_memories_fts (rowid, content) VALUES ((SELECT rowid FROM agent_memories WHERE id = ?), ?)").run(id, data.content);
    } catch {}
    return { id, agentId: data.agentId, type: data.type, content: data.content, metadata: data.metadata ?? null, importance: data.importance ?? 0.5, accessCount: 0, lastAccessedAt: null, createdAt: new Date(createdAt) };
  }

  async getAgentMemories(agentId: string, type?: string, limit = 20): Promise<AgentMemory[]> {
    let query = "SELECT * FROM agent_memories WHERE agentId = ?";
    const params: any[] = [agentId];
    if (type) { query += " AND type = ?"; params.push(type); }
    query += " ORDER BY importance DESC, createdAt DESC LIMIT ?";
    params.push(limit);
    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(r => ({ ...r, importance: r.importance, lastAccessedAt: r.lastAccessedAt ? new Date(r.lastAccessedAt) : null, createdAt: new Date(r.createdAt) }));
  }

  async searchAgentMemories(agentId: string, query: string, limit = 5): Promise<AgentMemory[]> {
    try {
      const rows = this.db.prepare(`
        SELECT m.* FROM agent_memories m
        JOIN agent_memories_fts fts ON fts.rowid = m.rowid
        WHERE m.agentId = ? AND agent_memories_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `).all(agentId, query, limit) as any[];
      return rows.map(r => ({ ...r, lastAccessedAt: r.lastAccessedAt ? new Date(r.lastAccessedAt) : null, createdAt: new Date(r.createdAt) }));
    } catch {
      // Fallback to LIKE search if FTS fails
      const rows = this.db.prepare(`
        SELECT * FROM agent_memories WHERE agentId = ? AND content LIKE ?
        ORDER BY importance DESC LIMIT ?
      `).all(agentId, `%${query}%`, limit) as any[];
      return rows.map(r => ({ ...r, lastAccessedAt: r.lastAccessedAt ? new Date(r.lastAccessedAt) : null, createdAt: new Date(r.createdAt) }));
    }
  }

  async deleteAgentMemory(id: string): Promise<void> {
    try {
      this.db.prepare("INSERT INTO agent_memories_fts(agent_memories_fts, rowid, content) VALUES('delete', (SELECT rowid FROM agent_memories WHERE id = ?), (SELECT content FROM agent_memories WHERE id = ?))").run(id, id);
    } catch {}
    this.db.prepare("DELETE FROM agent_memories WHERE id = ?").run(id);
  }

  async clearAgentMemories(agentId: string): Promise<void> {
    try {
      const rows = this.db.prepare("SELECT rowid, content FROM agent_memories WHERE agentId = ?").all(agentId) as any[];
      for (const r of rows) {
        this.db.prepare("INSERT INTO agent_memories_fts(agent_memories_fts, rowid, content) VALUES('delete', ?, ?)").run(r.rowid, r.content);
      }
    } catch {}
    this.db.prepare("DELETE FROM agent_memories WHERE agentId = ?").run(agentId);
  }

  async touchAgentMemory(id: string): Promise<void> {
    this.db.prepare("UPDATE agent_memories SET accessCount = accessCount + 1, lastAccessedAt = ? WHERE id = ?").run(this.now(), id);
  }

  // ============ ToolPlugin ============
  async createToolPlugin(data: InsertToolPlugin): Promise<ToolPlugin> {
    const id = randomUUID();
    const createdAt = this.now();
    this.db.prepare(`
      INSERT INTO tool_plugins (id, name, description, inputSchema, handlerPath, enabledRoles, isEnabled, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.name, data.description ?? null, data.inputSchema, data.handlerPath, data.enabledRoles ?? null, data.isEnabled === false ? 0 : 1, createdAt);
    return { id, name: data.name, description: data.description ?? null, inputSchema: data.inputSchema, handlerPath: data.handlerPath, enabledRoles: data.enabledRoles ?? null, isEnabled: data.isEnabled !== false, createdAt: new Date(createdAt) };
  }

  async getToolPlugin(id: string): Promise<ToolPlugin | undefined> {
    const row = this.db.prepare("SELECT * FROM tool_plugins WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    return { ...row, isEnabled: !!row.isEnabled, createdAt: new Date(row.createdAt) };
  }

  async getAllToolPlugins(): Promise<ToolPlugin[]> {
    const rows = this.db.prepare("SELECT * FROM tool_plugins ORDER BY createdAt ASC").all() as any[];
    return rows.map(r => ({ ...r, isEnabled: !!r.isEnabled, createdAt: new Date(r.createdAt) }));
  }

  async updateToolPlugin(id: string, data: Partial<InsertToolPlugin>): Promise<ToolPlugin | undefined> {
    const existing = this.db.prepare("SELECT * FROM tool_plugins WHERE id = ?").get(id) as any;
    if (!existing) return undefined;
    const fields: string[] = [];
    const values: any[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        if (key === "isEnabled") { fields.push("isEnabled = ?"); values.push(value ? 1 : 0); }
        else { fields.push(`${key} = ?`); values.push(value); }
      }
    }
    if (fields.length > 0) {
      values.push(id);
      this.db.prepare(`UPDATE tool_plugins SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    }
    return this.getToolPlugin(id);
  }

  async deleteToolPlugin(id: string): Promise<void> {
    this.db.prepare("DELETE FROM tool_plugins WHERE id = ?").run(id);
  }
}
