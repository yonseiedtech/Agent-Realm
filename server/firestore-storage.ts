import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getFirestore, type Firestore, FieldValue } from "firebase-admin/firestore";
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
import type { IStorage } from "./storage";

function initFirebase(): App {
  if (getApps().length > 0) return getApps()[0];

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccount) {
    return initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
  }
  // On GCP Cloud Run, default credentials are available automatically
  return initializeApp();
}

function toDate(val: any): Date {
  if (!val) return new Date();
  if (val.toDate) return val.toDate(); // Firestore Timestamp
  if (val instanceof Date) return val;
  return new Date(val);
}

export class FirestoreStorage implements IStorage {
  private db: Firestore;

  constructor() {
    initFirebase();
    this.db = getFirestore();
  }

  // ============ User ============
  async getUser(id: string): Promise<User | undefined> {
    const doc = await this.db.collection("users").doc(id).get();
    if (!doc.exists) return undefined;
    return { id: doc.id, ...doc.data() } as User;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const snap = await this.db.collection("users").where("username", "==", username).limit(1).get();
    if (snap.empty) return undefined;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as User;
  }

  async createUser(user: InsertUser): Promise<User> {
    const ref = await this.db.collection("users").add(user);
    return { id: ref.id, ...user };
  }

  // ============ Agent ============
  async getAllAgents(): Promise<Agent[]> {
    const snap = await this.db.collection("agents").orderBy("createdAt", "asc").get();
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: toDate(doc.data().createdAt),
    } as Agent));
  }

  async getAgent(id: string): Promise<Agent | undefined> {
    const doc = await this.db.collection("agents").doc(id).get();
    if (!doc.exists) return undefined;
    const data = doc.data()!;
    return { id: doc.id, ...data, createdAt: toDate(data.createdAt) } as Agent;
  }

  async createAgent(agent: InsertAgent): Promise<Agent> {
    const data = { ...agent, createdAt: FieldValue.serverTimestamp() };
    const ref = await this.db.collection("agents").add(data);
    return {
      id: ref.id,
      ...agent,
      createdAt: new Date(),
    } as Agent;
  }

  async updateAgent(id: string, data: Partial<InsertAgent>): Promise<Agent | undefined> {
    const ref = this.db.collection("agents").doc(id);
    const doc = await ref.get();
    if (!doc.exists) return undefined;
    await ref.update(data as Record<string, any>);
    const updated = await ref.get();
    const d = updated.data()!;
    return { id: updated.id, ...d, createdAt: toDate(d.createdAt) } as Agent;
  }

  async deleteAgent(id: string): Promise<void> {
    // Delete related data first
    const batch = this.db.batch();

    const chatSnap = await this.db.collection("chatHistory").where("agentId", "==", id).get();
    chatSnap.docs.forEach(doc => batch.delete(doc.ref));

    const partSnap = await this.db.collection("meetingParticipants").where("agentId", "==", id).get();
    partSnap.docs.forEach(doc => batch.delete(doc.ref));

    const meetMsgSnap = await this.db.collection("meetingMessages").where("agentId", "==", id).get();
    meetMsgSnap.docs.forEach(doc => batch.delete(doc.ref));

    const fromMsgSnap = await this.db.collection("agentMessages").where("fromAgentId", "==", id).get();
    fromMsgSnap.docs.forEach(doc => batch.delete(doc.ref));

    const toMsgSnap = await this.db.collection("agentMessages").where("toAgentId", "==", id).get();
    toMsgSnap.docs.forEach(doc => batch.delete(doc.ref));

    const actSnap = await this.db.collection("activityLogs").where("agentId", "==", id).get();
    actSnap.docs.forEach(doc => batch.delete(doc.ref));

    const taskSnap = await this.db.collection("tasks").where("agentId", "==", id).get();
    taskSnap.docs.forEach(doc => batch.delete(doc.ref));

    batch.delete(this.db.collection("agents").doc(id));

    await batch.commit();
  }

  // ============ Task ============
  async getAllTasks(): Promise<Task[]> {
    const snap = await this.db.collection("tasks").orderBy("createdAt", "desc").get();
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: toDate(doc.data().createdAt),
    } as Task));
  }

  async getTasksByAgent(agentId: string): Promise<Task[]> {
    let snap;
    try {
      snap = await this.db.collection("tasks")
        .where("agentId", "==", agentId)
        .orderBy("createdAt", "desc")
        .get();
    } catch {
      snap = await this.db.collection("tasks")
        .where("agentId", "==", agentId)
        .get();
    }
    const results = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: toDate(doc.data().createdAt),
    } as Task));
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createTask(task: InsertTask): Promise<Task> {
    const data = { ...task, createdAt: FieldValue.serverTimestamp() };
    const ref = await this.db.collection("tasks").add(data);
    return { id: ref.id, ...task, createdAt: new Date() } as Task;
  }

  async updateTask(id: string, data: Partial<InsertTask>): Promise<Task | undefined> {
    const ref = this.db.collection("tasks").doc(id);
    const doc = await ref.get();
    if (!doc.exists) return undefined;
    await ref.update(data as Record<string, any>);
    const updated = await ref.get();
    const d = updated.data()!;
    return { id: updated.id, ...d, createdAt: toDate(d.createdAt) } as Task;
  }

  // ============ AgentMessage ============
  async getAgentMessages(agentId?: string): Promise<AgentMessage[]> {
    if (agentId) {
      const queryWithFallback = async (field: string, value: string) => {
        try {
          return await this.db.collection("agentMessages")
            .where(field, "==", value)
            .orderBy("createdAt", "desc")
            .limit(100)
            .get();
        } catch {
          return await this.db.collection("agentMessages")
            .where(field, "==", value)
            .limit(100)
            .get();
        }
      };
      const [fromSnap, toSnap] = await Promise.all([
        queryWithFallback("fromAgentId", agentId),
        queryWithFallback("toAgentId", agentId),
      ]);

      const map = new Map<string, AgentMessage>();
      for (const doc of [...fromSnap.docs, ...toSnap.docs]) {
        if (!map.has(doc.id)) {
          map.set(doc.id, {
            id: doc.id,
            ...doc.data(),
            createdAt: toDate(doc.data().createdAt),
          } as AgentMessage);
        }
      }
      return Array.from(map.values())
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 100);
    }

    const snap = await this.db.collection("agentMessages")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: toDate(doc.data().createdAt),
    } as AgentMessage));
  }

  async createAgentMessage(msg: InsertAgentMessage): Promise<AgentMessage> {
    const data = { ...msg, createdAt: FieldValue.serverTimestamp() };
    const ref = await this.db.collection("agentMessages").add(data);
    return { id: ref.id, ...msg, createdAt: new Date() } as AgentMessage;
  }

  // ============ ActivityLog ============
  async getActivityLogs(limit = 50): Promise<ActivityLog[]> {
    const snap = await this.db.collection("activityLogs")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: toDate(doc.data().createdAt),
    } as ActivityLog));
  }

  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const data = { ...log, createdAt: FieldValue.serverTimestamp() };
    const ref = await this.db.collection("activityLogs").add(data);
    return { id: ref.id, ...log, createdAt: new Date() } as ActivityLog;
  }

  // ============ ChatHistory ============
  async getChatHistory(agentId: string): Promise<ChatHistory[]> {
    let snap;
    try {
      snap = await this.db.collection("chatHistory")
        .where("agentId", "==", agentId)
        .orderBy("createdAt", "asc")
        .get();
    } catch {
      // Fallback if composite index is missing — fetch without orderBy, sort in memory
      snap = await this.db.collection("chatHistory")
        .where("agentId", "==", agentId)
        .get();
    }
    const results = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: toDate(doc.data().createdAt),
    } as ChatHistory));
    return results.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createChatMessage(msg: InsertChatHistory): Promise<ChatHistory> {
    const data = { ...msg, createdAt: FieldValue.serverTimestamp() };
    const ref = await this.db.collection("chatHistory").add(data);
    return { id: ref.id, ...msg, createdAt: new Date() } as ChatHistory;
  }

  async clearChatHistory(agentId: string): Promise<void> {
    const snap = await this.db.collection("chatHistory").where("agentId", "==", agentId).get();
    const batch = this.db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }

  // ============ Settings ============
  async getSetting(key: string): Promise<string | undefined> {
    const doc = await this.db.collection("settings").doc(key).get();
    if (!doc.exists) return undefined;
    return doc.data()?.value;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.db.collection("settings").doc(key).set({ key, value });
  }

  async getAllSettings(): Promise<Settings[]> {
    const snap = await this.db.collection("settings").get();
    return snap.docs.map(doc => ({
      id: doc.id,
      key: doc.data().key || doc.id,
      value: doc.data().value,
    } as Settings));
  }

  // ============ MeetingRoom ============
  async createMeetingRoom(room: InsertMeetingRoom): Promise<MeetingRoom> {
    const data = { ...room, createdAt: FieldValue.serverTimestamp() };
    const ref = await this.db.collection("meetingRooms").add(data);
    return { id: ref.id, ...room, createdAt: new Date() } as MeetingRoom;
  }

  async getMeetingRoom(id: string): Promise<MeetingRoom | undefined> {
    const doc = await this.db.collection("meetingRooms").doc(id).get();
    if (!doc.exists) return undefined;
    const data = doc.data()!;
    return { id: doc.id, ...data, createdAt: toDate(data.createdAt) } as MeetingRoom;
  }

  async getAllMeetingRooms(): Promise<MeetingRoom[]> {
    const snap = await this.db.collection("meetingRooms").orderBy("createdAt", "desc").get();
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: toDate(doc.data().createdAt),
    } as MeetingRoom));
  }

  async closeMeetingRoom(id: string): Promise<void> {
    await this.db.collection("meetingRooms").doc(id).update({ status: "closed" });
  }

  async reopenMeetingRoom(id: string): Promise<void> {
    await this.db.collection("meetingRooms").doc(id).update({ status: "active" });
  }

  // ============ MeetingParticipant ============
  async addParticipant(data: InsertMeetingParticipant): Promise<MeetingParticipant> {
    const docData = { ...data, joinedAt: FieldValue.serverTimestamp() };
    const ref = await this.db.collection("meetingParticipants").add(docData);
    return { id: ref.id, ...data, joinedAt: new Date() } as MeetingParticipant;
  }

  async removeParticipant(roomId: string, agentId: string): Promise<void> {
    const snap = await this.db.collection("meetingParticipants")
      .where("roomId", "==", roomId)
      .where("agentId", "==", agentId)
      .get();
    const batch = this.db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }

  async getRoomParticipants(roomId: string): Promise<MeetingParticipant[]> {
    const snap = await this.db.collection("meetingParticipants")
      .where("roomId", "==", roomId)
      .get();
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      joinedAt: toDate(doc.data().joinedAt),
    } as MeetingParticipant));
  }

  // ============ MeetingMessage ============
  async createMeetingMessage(msg: InsertMeetingMessage): Promise<MeetingMessage> {
    const data = { ...msg, createdAt: FieldValue.serverTimestamp() };
    const ref = await this.db.collection("meetingMessages").add(data);
    return { id: ref.id, ...msg, createdAt: new Date() } as MeetingMessage;
  }

  async getMeetingMessages(roomId: string): Promise<MeetingMessage[]> {
    let snap;
    try {
      snap = await this.db.collection("meetingMessages")
        .where("roomId", "==", roomId)
        .orderBy("createdAt", "asc")
        .get();
    } catch {
      snap = await this.db.collection("meetingMessages")
        .where("roomId", "==", roomId)
        .get();
    }
    const results = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: toDate(doc.data().createdAt),
    } as MeetingMessage));
    return results.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}
