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
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getAllAgents(): Promise<Agent[]>;
  getAgent(id: string): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: string, data: Partial<InsertAgent>): Promise<Agent | undefined>;
  deleteAgent(id: string): Promise<void>;

  getAllTasks(): Promise<Task[]>;
  getTasksByAgent(agentId: string): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, data: Partial<InsertTask>): Promise<Task | undefined>;

  getAgentMessages(agentId?: string): Promise<AgentMessage[]>;
  createAgentMessage(msg: InsertAgentMessage): Promise<AgentMessage>;

  getActivityLogs(limit?: number): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;

  getChatHistory(agentId: string): Promise<ChatHistory[]>;
  createChatMessage(msg: InsertChatHistory): Promise<ChatHistory>;
  clearChatHistory(agentId: string): Promise<void>;

  getSetting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<void>;
  getAllSettings(): Promise<Settings[]>;

  createMeetingRoom(room: InsertMeetingRoom): Promise<MeetingRoom>;
  getMeetingRoom(id: string): Promise<MeetingRoom | undefined>;
  getAllMeetingRooms(): Promise<MeetingRoom[]>;
  closeMeetingRoom(id: string): Promise<void>;

  addParticipant(data: InsertMeetingParticipant): Promise<MeetingParticipant>;
  removeParticipant(roomId: string, agentId: string): Promise<void>;
  getRoomParticipants(roomId: string): Promise<MeetingParticipant[]>;

  createMeetingMessage(msg: InsertMeetingMessage): Promise<MeetingMessage>;
  getMeetingMessages(roomId: string): Promise<MeetingMessage[]>;
}

import { FirestoreStorage } from "./firestore-storage";

export const storage = new FirestoreStorage();
