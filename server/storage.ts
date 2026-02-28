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
  reopenMeetingRoom(id: string): Promise<void>;

  addParticipant(data: InsertMeetingParticipant): Promise<MeetingParticipant>;
  removeParticipant(roomId: string, agentId: string): Promise<void>;
  getRoomParticipants(roomId: string): Promise<MeetingParticipant[]>;

  createMeetingMessage(msg: InsertMeetingMessage): Promise<MeetingMessage>;
  getMeetingMessages(roomId: string): Promise<MeetingMessage[]>;

  // Workflow
  createWorkflow(data: InsertWorkflow): Promise<Workflow>;
  getWorkflow(id: string): Promise<Workflow | undefined>;
  getAllWorkflows(): Promise<Workflow[]>;
  updateWorkflow(id: string, data: Partial<InsertWorkflow & { completedAt: string }>): Promise<Workflow | undefined>;
  deleteWorkflow(id: string): Promise<void>;

  // WorkflowTask
  createWorkflowTask(data: InsertWorkflowTask): Promise<WorkflowTask>;
  getWorkflowTask(id: string): Promise<WorkflowTask | undefined>;
  getWorkflowTasks(workflowId: string): Promise<WorkflowTask[]>;
  updateWorkflowTask(id: string, data: Partial<InsertWorkflowTask & { completedAt: string }>): Promise<WorkflowTask | undefined>;

  // TaskDependency
  createTaskDependency(data: InsertTaskDependency): Promise<TaskDependency>;
  getTaskDependencies(taskId: string): Promise<TaskDependency[]>;
  getDependents(taskId: string): Promise<TaskDependency[]>;

  // AgentMemory
  createAgentMemory(data: InsertAgentMemory): Promise<AgentMemory>;
  getAgentMemories(agentId: string, type?: string, limit?: number): Promise<AgentMemory[]>;
  searchAgentMemories(agentId: string, query: string, limit?: number): Promise<AgentMemory[]>;
  deleteAgentMemory(id: string): Promise<void>;
  clearAgentMemories(agentId: string): Promise<void>;
  touchAgentMemory(id: string): Promise<void>;

  // ToolPlugin
  createToolPlugin(data: InsertToolPlugin): Promise<ToolPlugin>;
  getToolPlugin(id: string): Promise<ToolPlugin | undefined>;
  getAllToolPlugins(): Promise<ToolPlugin[]>;
  updateToolPlugin(id: string, data: Partial<InsertToolPlugin>): Promise<ToolPlugin | undefined>;
  deleteToolPlugin(id: string): Promise<void>;

  // Meeting deletion
  deleteMeetingRoom(id: string): Promise<void>;
}

import { SqliteStorage } from "./sqlite-storage";

export const storage: IStorage = new SqliteStorage();
