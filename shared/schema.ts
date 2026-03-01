import { z } from "zod";

// ============ User ============
export interface User {
  id: string;
  username: string;
  password: string;
}

export const insertUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export type InsertUser = z.infer<typeof insertUserSchema>;

// ============ Agent ============
export interface Agent {
  id: string;
  name: string;
  role: string;
  status: string;
  color: string;
  avatarType: string;
  avatarUrl: string | null;
  currentTask: string | null;
  currentFile: string | null;
  systemPrompt: string | null;
  model: string;
  maxTokens: number;
  temperature: string;
  apiKey: string | null;
  createdAt: Date;
}

export const insertAgentSchema = z.object({
  name: z.string().min(1),
  role: z.string().default("general"),
  status: z.string().default("idle"),
  color: z.string().default("#5865F2"),
  avatarType: z.string().default("cat"),
  avatarUrl: z.string().nullable().default(null),
  currentTask: z.string().nullable().default(null),
  currentFile: z.string().nullable().default(null),
  systemPrompt: z.string().nullable().default(null),
  model: z.string().default("claude-sonnet-4-6"),
  maxTokens: z.number().default(4096),
  temperature: z.string().default("1"),
  apiKey: z.string().nullable().default(null),
});

export type InsertAgent = z.infer<typeof insertAgentSchema>;

// ============ Task ============
export interface Task {
  id: string;
  agentId: string;
  description: string;
  status: string;
  filePath: string | null;
  result: string | null;
  assignedAgentId: string | null;
  priority: string | null;
  createdAt: Date;
}

export const insertTaskSchema = z.object({
  agentId: z.string(),
  description: z.string().min(1),
  status: z.string().default("pending"),
  filePath: z.string().nullable().default(null),
  result: z.string().nullable().default(null),
  assignedAgentId: z.string().nullable().default(null),
  priority: z.string().nullable().default(null),
});

export type InsertTask = z.infer<typeof insertTaskSchema>;

// ============ AgentMessage ============
export interface AgentMessage {
  id: string;
  fromAgentId: string;
  toAgentId: string | null;
  content: string;
  messageType: string;
  createdAt: Date;
}

export const insertAgentMessageSchema = z.object({
  fromAgentId: z.string(),
  toAgentId: z.string().nullable().default(null),
  content: z.string().min(1),
  messageType: z.string().default("discussion"),
});

export type InsertAgentMessage = z.infer<typeof insertAgentMessageSchema>;

// ============ ActivityLog ============
export interface ActivityLog {
  id: string;
  agentId: string;
  action: string;
  details: string | null;
  filePath: string | null;
  createdAt: Date;
}

export const insertActivityLogSchema = z.object({
  agentId: z.string(),
  action: z.string().min(1),
  details: z.string().nullable().default(null),
  filePath: z.string().nullable().default(null),
});

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

// ============ ChatHistory ============
export interface ChatHistory {
  id: string;
  agentId: string;
  role: string;
  content: string;
  attachmentUrl: string | null;
  attachmentType: string | null;
  createdAt: Date;
}

export const insertChatHistorySchema = z.object({
  agentId: z.string(),
  role: z.string().min(1),
  content: z.string().min(1),
  attachmentUrl: z.string().nullable().default(null),
  attachmentType: z.string().nullable().default(null),
});

export type InsertChatHistory = z.infer<typeof insertChatHistorySchema>;

// ============ Settings ============
export interface Settings {
  id: string;
  key: string;
  value: string;
}

export const insertSettingsSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

export type InsertSettings = z.infer<typeof insertSettingsSchema>;

// ============ MeetingRoom ============
export interface MeetingRoom {
  id: string;
  name: string;
  topic: string | null;
  status: string;
  createdAt: Date;
}

export const insertMeetingRoomSchema = z.object({
  name: z.string().min(1),
  topic: z.string().nullable().default(null),
  status: z.string().default("active"),
});

export type InsertMeetingRoom = z.infer<typeof insertMeetingRoomSchema>;

// ============ MeetingParticipant ============
export interface MeetingParticipant {
  id: string;
  roomId: string;
  agentId: string;
  joinedAt: Date;
}

export const insertMeetingParticipantSchema = z.object({
  roomId: z.string(),
  agentId: z.string(),
});

export type InsertMeetingParticipant = z.infer<typeof insertMeetingParticipantSchema>;

// ============ MeetingMessage ============
export interface MeetingMessage {
  id: string;
  roomId: string;
  agentId: string;
  content: string;
  createdAt: Date;
}

export const insertMeetingMessageSchema = z.object({
  roomId: z.string(),
  agentId: z.string(),
  content: z.string().min(1),
});

export type InsertMeetingMessage = z.infer<typeof insertMeetingMessageSchema>;

// ============ Workflow ============
export interface Workflow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdBy: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export const insertWorkflowSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().default(null),
  status: z.string().default("pending"),
  createdBy: z.string().nullable().default(null),
});

export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;

// ============ WorkflowTask ============
export interface WorkflowTask {
  id: string;
  workflowId: string;
  agentId: string | null;
  description: string;
  status: string;
  result: string | null;
  priority: string;
  suggestedRole: string | null;
  orderIndex: number;
  createdAt: Date;
  completedAt: Date | null;
}

export const insertWorkflowTaskSchema = z.object({
  workflowId: z.string(),
  agentId: z.string().nullable().default(null),
  description: z.string().min(1),
  status: z.string().default("pending"),
  result: z.string().nullable().default(null),
  priority: z.string().default("medium"),
  suggestedRole: z.string().nullable().default(null),
  orderIndex: z.number().default(0),
});

export type InsertWorkflowTask = z.infer<typeof insertWorkflowTaskSchema>;

// ============ TaskDependency ============
export interface TaskDependency {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
}

export const insertTaskDependencySchema = z.object({
  taskId: z.string(),
  dependsOnTaskId: z.string(),
});

export type InsertTaskDependency = z.infer<typeof insertTaskDependencySchema>;

// ============ AgentMemory ============
export interface AgentMemory {
  id: string;
  agentId: string;
  type: string;
  content: string;
  metadata: string | null;
  importance: number;
  accessCount: number;
  lastAccessedAt: Date | null;
  createdAt: Date;
}

export const insertAgentMemorySchema = z.object({
  agentId: z.string(),
  type: z.enum(["knowledge", "episode", "preference"]),
  content: z.string().min(1),
  metadata: z.string().nullable().default(null),
  importance: z.number().min(0).max(1).default(0.5),
});

export type InsertAgentMemory = z.infer<typeof insertAgentMemorySchema>;

// ============ ToolPlugin ============
export interface ToolPlugin {
  id: string;
  name: string;
  description: string | null;
  inputSchema: string;
  handlerPath: string;
  enabledRoles: string | null;
  isEnabled: boolean;
  createdAt: Date;
}

export const insertToolPluginSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().default(null),
  inputSchema: z.string(),
  handlerPath: z.string(),
  enabledRoles: z.string().nullable().default(null),
  isEnabled: z.boolean().default(true),
});

export type InsertToolPlugin = z.infer<typeof insertToolPluginSchema>;
