import {
  type User, type InsertUser,
  type Agent, type InsertAgent,
  type Task, type InsertTask,
  type AgentMessage, type InsertAgentMessage,
  type ActivityLog, type InsertActivityLog,
  agents, tasks, agentMessages, activityLogs, users,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, or, and } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getAllAgents(): Promise<Agent[]>;
  getAgent(id: number): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: number, data: Partial<InsertAgent>): Promise<Agent | undefined>;
  deleteAgent(id: number): Promise<void>;

  getAllTasks(): Promise<Task[]>;
  getTasksByAgent(agentId: number): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, data: Partial<InsertTask>): Promise<Task | undefined>;

  getAgentMessages(agentId?: number): Promise<AgentMessage[]>;
  createAgentMessage(msg: InsertAgentMessage): Promise<AgentMessage>;

  getActivityLogs(limit?: number): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getAllAgents(): Promise<Agent[]> {
    return db.select().from(agents).orderBy(agents.createdAt);
  }

  async getAgent(id: number): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    return agent;
  }

  async createAgent(agent: InsertAgent): Promise<Agent> {
    const [created] = await db.insert(agents).values(agent).returning();
    return created;
  }

  async updateAgent(id: number, data: Partial<InsertAgent>): Promise<Agent | undefined> {
    const [updated] = await db.update(agents).set(data).where(eq(agents.id, id)).returning();
    return updated;
  }

  async deleteAgent(id: number): Promise<void> {
    await db.delete(agentMessages).where(
      or(eq(agentMessages.fromAgentId, id), eq(agentMessages.toAgentId, id))
    );
    await db.delete(activityLogs).where(eq(activityLogs.agentId, id));
    await db.delete(tasks).where(eq(tasks.agentId, id));
    await db.delete(agents).where(eq(agents.id, id));
  }

  async getAllTasks(): Promise<Task[]> {
    return db.select().from(tasks).orderBy(desc(tasks.createdAt));
  }

  async getTasksByAgent(agentId: number): Promise<Task[]> {
    return db.select().from(tasks).where(eq(tasks.agentId, agentId)).orderBy(desc(tasks.createdAt));
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [created] = await db.insert(tasks).values(task).returning();
    return created;
  }

  async updateTask(id: number, data: Partial<InsertTask>): Promise<Task | undefined> {
    const [updated] = await db.update(tasks).set(data).where(eq(tasks.id, id)).returning();
    return updated;
  }

  async getAgentMessages(agentId?: number): Promise<AgentMessage[]> {
    if (agentId) {
      return db.select().from(agentMessages).where(
        or(eq(agentMessages.fromAgentId, agentId), eq(agentMessages.toAgentId, agentId))
      ).orderBy(desc(agentMessages.createdAt)).limit(100);
    }
    return db.select().from(agentMessages).orderBy(desc(agentMessages.createdAt)).limit(100);
  }

  async createAgentMessage(msg: InsertAgentMessage): Promise<AgentMessage> {
    const [created] = await db.insert(agentMessages).values(msg).returning();
    return created;
  }

  async getActivityLogs(limit = 50): Promise<ActivityLog[]> {
    return db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(limit);
  }

  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [created] = await db.insert(activityLogs).values(log).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
