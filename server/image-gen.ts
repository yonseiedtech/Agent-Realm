import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
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
    console.warn("[image-gen] GEMINI_API_KEY not set, skipping avatar generation");
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-image",
      generationConfig: {
        responseModalities: ["Text", "Image"] as any,
      } as any,
    });

    const roleDesc = ROLE_DESCRIPTIONS[agentRole] || ROLE_DESCRIPTIONS.general;
    const prompt = `Generate a cute, stylized chibi-style character avatar for an AI agent named "${agentName}" who is ${roleDesc}.
The character should:
- Be a single character portrait on a clean solid color background
- Have an expressive, friendly face
- Show subtle visual cues related to their role (e.g. headset for PM, laptop for developer, palette for designer)
- Use a modern, appealing anime/chibi art style
- Be suitable as a circular profile picture
- Do NOT include any text or letters in the image`;

    const response = await model.generateContent(prompt);
    const parts = response.response.candidates?.[0]?.content?.parts;
    if (!parts) {
      console.warn("[image-gen] No parts in response");
      return null;
    }

    for (const part of parts) {
      if ((part as any).inlineData) {
        const inlineData = (part as any).inlineData;
        const buffer = Buffer.from(inlineData.data, "base64");
        const uploadDir = path.join(process.cwd(), "uploads");
        fs.mkdirSync(uploadDir, { recursive: true });
        const filename = `avatar_${agentId}.png`;
        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, buffer);
        return `/uploads/${filename}`;
      }
    }

    console.warn("[image-gen] No image data in response");
    return null;
  } catch (error: any) {
    console.error("[image-gen] Error generating avatar:", error.message);
    return null;
  }
}
