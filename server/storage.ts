import {
  type User, type InsertUser,
  type Agent, type InsertAgent,
  type Task, type InsertTask,
  type AgentMessage, type InsertAgentMessage,
  type ActivityLog, type InsertActivityLog,
  type ChatHistory, type InsertChatHistory,
  type Settings,
  type MeetingRoom, type InsertMeetingRoom,
  type MeetingParticipant, type InsertMeetingParticipant,
  type MeetingMessage, type InsertMeetingMessage,
  agents, tasks, agentMessages, activityLogs, users,
  chatHistory, settings, meetingRooms, meetingParticipants, meetingMessages,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, or, and, asc } from "drizzle-orm";

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

  getChatHistory(agentId: number): Promise<ChatHistory[]>;
  createChatMessage(msg: InsertChatHistory): Promise<ChatHistory>;
  clearChatHistory(agentId: number): Promise<void>;

  getSetting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<void>;
  getAllSettings(): Promise<Settings[]>;

  createMeetingRoom(room: InsertMeetingRoom): Promise<MeetingRoom>;
  getMeetingRoom(id: number): Promise<MeetingRoom | undefined>;
  getAllMeetingRooms(): Promise<MeetingRoom[]>;
  closeMeetingRoom(id: number): Promise<void>;

  addParticipant(data: InsertMeetingParticipant): Promise<MeetingParticipant>;
  removeParticipant(roomId: number, agentId: number): Promise<void>;
  getRoomParticipants(roomId: number): Promise<MeetingParticipant[]>;

  createMeetingMessage(msg: InsertMeetingMessage): Promise<MeetingMessage>;
  getMeetingMessages(roomId: number): Promise<MeetingMessage[]>;
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
    await db.delete(chatHistory).where(eq(chatHistory.agentId, id));
    await db.delete(meetingParticipants).where(eq(meetingParticipants.agentId, id));
    await db.delete(meetingMessages).where(eq(meetingMessages.agentId, id));
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

  async getChatHistory(agentId: number): Promise<ChatHistory[]> {
    return db.select().from(chatHistory)
      .where(eq(chatHistory.agentId, agentId))
      .orderBy(asc(chatHistory.createdAt));
  }

  async createChatMessage(msg: InsertChatHistory): Promise<ChatHistory> {
    const [created] = await db.insert(chatHistory).values(msg).returning();
    return created;
  }

  async clearChatHistory(agentId: number): Promise<void> {
    await db.delete(chatHistory).where(eq(chatHistory.agentId, agentId));
  }

  async getSetting(key: string): Promise<string | undefined> {
    const [row] = await db.select().from(settings).where(eq(settings.key, key));
    return row?.value;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const existing = await this.getSetting(key);
    if (existing !== undefined) {
      await db.update(settings).set({ value }).where(eq(settings.key, key));
    } else {
      await db.insert(settings).values({ key, value });
    }
  }

  async getAllSettings(): Promise<Settings[]> {
    return db.select().from(settings);
  }

  async createMeetingRoom(room: InsertMeetingRoom): Promise<MeetingRoom> {
    const [created] = await db.insert(meetingRooms).values(room).returning();
    return created;
  }

  async getMeetingRoom(id: number): Promise<MeetingRoom | undefined> {
    const [room] = await db.select().from(meetingRooms).where(eq(meetingRooms.id, id));
    return room;
  }

  async getAllMeetingRooms(): Promise<MeetingRoom[]> {
    return db.select().from(meetingRooms).orderBy(desc(meetingRooms.createdAt));
  }

  async closeMeetingRoom(id: number): Promise<void> {
    await db.update(meetingRooms).set({ status: "closed" }).where(eq(meetingRooms.id, id));
  }

  async addParticipant(data: InsertMeetingParticipant): Promise<MeetingParticipant> {
    const [created] = await db.insert(meetingParticipants).values(data).returning();
    return created;
  }

  async removeParticipant(roomId: number, agentId: number): Promise<void> {
    await db.delete(meetingParticipants).where(
      and(eq(meetingParticipants.roomId, roomId), eq(meetingParticipants.agentId, agentId))
    );
  }

  async getRoomParticipants(roomId: number): Promise<MeetingParticipant[]> {
    return db.select().from(meetingParticipants).where(eq(meetingParticipants.roomId, roomId));
  }

  async createMeetingMessage(msg: InsertMeetingMessage): Promise<MeetingMessage> {
    const [created] = await db.insert(meetingMessages).values(msg).returning();
    return created;
  }

  async getMeetingMessages(roomId: number): Promise<MeetingMessage[]> {
    return db.select().from(meetingMessages)
      .where(eq(meetingMessages.roomId, roomId))
      .orderBy(asc(meetingMessages.createdAt));
  }
}

export const storage = new DatabaseStorage();
