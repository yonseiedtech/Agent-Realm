import { storage } from "./storage";
import { createAgent, removeAgent, assignTask } from "./agents";

let bot: any = null;

export async function initTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log("TELEGRAM_BOT_TOKEN not set, Telegram bot disabled");
    return;
  }

  try {
    const TelegramBot = (await import("node-telegram-bot-api")).default;
    bot = new TelegramBot(token, { polling: true });

    bot.onText(/\/start/, (msg: any) => {
      bot.sendMessage(msg.chat.id,
        "🤖 AI 에이전트 팀 봇입니다!\n\n" +
        "사용 가능한 명령어:\n" +
        "/status - 에이전트 상태 확인\n" +
        "/list - 에이전트 목록\n" +
        "/add <이름> <역할> - 에이전트 추가\n" +
        "/remove <ID> - 에이전트 제거\n" +
        "/task <ID> <설명> - 작업 할당"
      );
    });

    bot.onText(/\/status/, async (msg: any) => {
      const agents = await storage.getAllAgents();
      if (agents.length === 0) {
        bot.sendMessage(msg.chat.id, "등록된 에이전트가 없습니다.");
        return;
      }
      const statusText = agents.map(a =>
        `${a.name} (${a.id}) - ${a.role} | ${a.status}${a.currentTask ? ` | 📋 ${a.currentTask}` : ""}`
      ).join("\n");
      bot.sendMessage(msg.chat.id, `📊 에이전트 상태:\n\n${statusText}`);
    });

    bot.onText(/\/list/, async (msg: any) => {
      const agents = await storage.getAllAgents();
      if (agents.length === 0) {
        bot.sendMessage(msg.chat.id, "등록된 에이전트가 없습니다.");
        return;
      }
      const list = agents.map(a => `• ${a.id} ${a.name} (${a.role})`).join("\n");
      bot.sendMessage(msg.chat.id, `👥 에이전트 목록:\n\n${list}`);
    });

    bot.onText(/\/add (.+)/, async (msg: any, match: any) => {
      const parts = match[1].trim().split(" ");
      const name = parts[0];
      const role = parts[1] || "general";
      try {
        const agent = await createAgent(name, role);
        bot.sendMessage(msg.chat.id, `✅ 에이전트 생성됨: ${agent.name} (${agent.id}) - ${agent.role}`);
      } catch (e: any) {
        bot.sendMessage(msg.chat.id, `❌ 오류: ${e.message}`);
      }
    });

    bot.onText(/\/remove (.+)/, async (msg: any, match: any) => {
      try {
        const agentId = match[1].trim();
        await removeAgent(agentId);
        bot.sendMessage(msg.chat.id, `✅ 에이전트 ${agentId} 제거됨`);
      } catch (e: any) {
        bot.sendMessage(msg.chat.id, `❌ 오류: ${e.message}`);
      }
    });

    bot.onText(/\/task (\S+) (.+)/, async (msg: any, match: any) => {
      const agentId = match[1];
      const description = match[2];
      try {
        bot.sendMessage(msg.chat.id, `⏳ 에이전트 ${agentId}에게 작업 할당 중...`);
        const result = await assignTask(agentId, description);
        const truncated = result.response.length > 500 ? result.response.substring(0, 500) + "..." : result.response;
        bot.sendMessage(msg.chat.id, `✅ 작업 완료:\n\n${truncated}`);
      } catch (e: any) {
        bot.sendMessage(msg.chat.id, `❌ 오류: ${e.message}`);
      }
    });

    console.log("Telegram bot started successfully");
  } catch (e: any) {
    console.log("Telegram bot failed to initialize:", e.message);
  }
}

export function sendTelegramNotification(chatId: string, message: string) {
  if (bot) {
    bot.sendMessage(chatId, message).catch(() => {});
  }
}
