import Anthropic from "@anthropic-ai/sdk";
import { storage } from "./storage";

export async function getAnthropicClient(): Promise<Anthropic> {
  const customApiKey = await storage.getSetting("custom_api_key");
  const customBaseUrl = await storage.getSetting("custom_base_url");

  const apiKey = customApiKey || process.env.ANTHROPIC_API_KEY;
  const baseURL = customBaseUrl || undefined;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY 환경 변수가 설정되지 않았습니다");
  }
  return new Anthropic({ apiKey, baseURL });
}
