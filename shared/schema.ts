import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull().default("general"),
  status: text("status").notNull().default("idle"),
  color: text("color").notNull().default("#5865F2"),
  avatarType: text("avatar_type").notNull().default("cat"),
  currentTask: text("current_task"),
  currentFile: text("current_file"),
  systemPrompt: text("system_prompt"),
  model: text("model").notNull().default("claude-sonnet-4-6"),
  maxTokens: integer("max_tokens").notNull().default(4096),
  temperature: text("temperature").notNull().default("1"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  createdAt: true,
});

export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agents.$inferSelect;

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("pending"),
  filePath: text("file_path"),
  result: text("result"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export const agentMessages = pgTable("agent_messages", {
  id: serial("id").primaryKey(),
  fromAgentId: integer("from_agent_id").notNull(),
  toAgentId: integer("to_agent_id"),
  content: text("content").notNull(),
  messageType: text("message_type").notNull().default("discussion"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertAgentMessageSchema = createInsertSchema(agentMessages).omit({
  id: true,
  createdAt: true,
});

export type InsertAgentMessage = z.infer<typeof insertAgentMessageSchema>;
export type AgentMessage = typeof agentMessages.$inferSelect;

export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  action: text("action").notNull(),
  details: text("details"),
  filePath: text("file_path"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

export const chatHistory = pgTable("chat_history", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  attachmentUrl: text("attachment_url"),
  attachmentType: text("attachment_type"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertChatHistorySchema = createInsertSchema(chatHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertChatHistory = z.infer<typeof insertChatHistorySchema>;
export type ChatHistory = typeof chatHistory.$inferSelect;

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
});

export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

export const meetingRooms = pgTable("meeting_rooms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  topic: text("topic"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertMeetingRoomSchema = createInsertSchema(meetingRooms).omit({
  id: true,
  createdAt: true,
});

export type InsertMeetingRoom = z.infer<typeof insertMeetingRoomSchema>;
export type MeetingRoom = typeof meetingRooms.$inferSelect;

export const meetingParticipants = pgTable("meeting_participants", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  agentId: integer("agent_id").notNull(),
  joinedAt: timestamp("joined_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertMeetingParticipantSchema = createInsertSchema(meetingParticipants).omit({
  id: true,
  joinedAt: true,
});

export type InsertMeetingParticipant = z.infer<typeof insertMeetingParticipantSchema>;
export type MeetingParticipant = typeof meetingParticipants.$inferSelect;

export const meetingMessages = pgTable("meeting_messages", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  agentId: integer("agent_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertMeetingMessageSchema = createInsertSchema(meetingMessages).omit({
  id: true,
  createdAt: true,
});

export type InsertMeetingMessage = z.infer<typeof insertMeetingMessageSchema>;
export type MeetingMessage = typeof meetingMessages.$inferSelect;
