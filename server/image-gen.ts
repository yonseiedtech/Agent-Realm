import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs/promises";
import { mkdirSync, existsSync } from "fs";
import path from "path";

const ROLE_DESCRIPTIONS: Record<string, string> = {
  pm: "a professional project manager who coordinates teams",
  fullstack: "a skilled full-stack developer who codes and builds software",
  designer: "a creative UI/UX designer who designs beautiful interfaces",
  tester: "a meticulous QA tester who finds bugs and ensures quality",
  devops: "a DevOps engineer who manages infrastructure and deployments",
  general: "a versatile software developer who can handle any task",
};

export async function generateAgentAvatar(
  agentId: string,
  agentName: string,
  agentRole: string,
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.");
  }

  let response: any;
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        responseModalities: ["Text", "Image"] as any,
      } as any,
    });

    const roleDesc = ROLE_DESCRIPTIONS[agentRole] || ROLE_DESCRIPTIONS.general;
    const prompt = `Generate a cute, stylized full-body chibi-style character avatar for an AI agent named "${agentName}" who is ${roleDesc}.
The character should:
- Be a single full-body character on a completely transparent background (PNG with alpha channel)
- Have an expressive, friendly face
- Show subtle visual cues related to their role (e.g. headset for PM, laptop for developer, palette for designer)
- Use a modern, appealing anime/chibi art style
- Full-body standing pose, suitable as a character sprite
- Do NOT include any text or letters in the image
- The background must be fully transparent, not white or any solid color`;

    response = await model.generateContent(prompt);
  } catch (error: any) {
    const msg = error.message || String(error);
    // Parse common Gemini API errors
    if (msg.includes("API_KEY_INVALID") || msg.includes("API key not valid")) {
      throw new Error("GEMINI_API_KEY가 유효하지 않습니다. 키를 다시 확인하세요.");
    }
    if (msg.includes("PERMISSION_DENIED")) {
      throw new Error("Gemini API 접근 권한이 없습니다. API 키 권한을 확인하세요.");
    }
    if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
      throw new Error("Gemini API 사용량 한도에 도달했습니다. 잠시 후 다시 시도하세요.");
    }
    if (msg.includes("models/") && msg.includes("not found")) {
      throw new Error("이미지 생성 모델을 사용할 수 없습니다. Gemini API 설정을 확인하세요.");
    }
    if (msg.includes("SAFETY") || msg.includes("blocked")) {
      throw new Error("안전 필터에 의해 이미지 생성이 차단되었습니다. 다시 시도하세요.");
    }
    throw new Error(`Gemini API 오류: ${msg.substring(0, 200)}`);
  }

  // Check for safety block in response
  const candidate = response.response.candidates?.[0];
  if (!candidate) {
    const blockReason = response.response.promptFeedback?.blockReason;
    if (blockReason) {
      throw new Error(`안전 필터에 의해 차단되었습니다 (${blockReason}). 다시 시도하세요.`);
    }
    throw new Error("이미지 생성 응답이 비어있습니다. 다시 시도해주세요.");
  }

  if (candidate.finishReason === "SAFETY") {
    throw new Error("안전 필터에 의해 이미지 생성이 중단되었습니다. 다시 시도하세요.");
  }

  const parts = candidate.content?.parts;
  if (!parts || parts.length === 0) {
    throw new Error("이미지 생성 응답에 데이터가 없습니다. 다시 시도해주세요.");
  }

  for (const part of parts) {
    if ((part as any).inlineData) {
      const inlineData = (part as any).inlineData;
      const buffer = Buffer.from(inlineData.data, "base64");
      const uploadDir = path.join(process.cwd(), "uploads");
      if (!existsSync(uploadDir)) {
        mkdirSync(uploadDir, { recursive: true });
      }
      const filename = `avatar_${agentId}.png`;
      const filePath = path.join(uploadDir, filename);
      await fs.writeFile(filePath, buffer);
      return `/uploads/${filename}`;
    }
  }

  throw new Error("응답에 이미지 데이터가 포함되지 않았습니다. 다시 시도하세요.");
}
