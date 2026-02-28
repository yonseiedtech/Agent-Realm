import type { Agent } from "@shared/schema";

export const roleLabels: Record<string, string> = {
  pm: "PM",
  fullstack: "풀스택",
  designer: "디자이너",
  tester: "테스터",
  devops: "DevOps",
  general: "일반",
};

export const statusLabels: Record<string, string> = {
  idle: "대기 중",
  working: "작업 중",
  paused: "일시정지",
};

export const roleColors: Record<string, string> = {
  pm: "#FF6B6B",
  fullstack: "#5865F2",
  designer: "#FF79C6",
  tester: "#FEE75C",
  devops: "#43B581",
  general: "#B9BBBE",
};

export const roleCharacterImages: Record<string, { idle: string; working: string }> = {
  pm: { idle: "/characters/char_extra1.png", working: "/characters/char_extra1.png" },
  fullstack: { idle: "/characters/frontend.png", working: "/characters/frontend_working.png" },
  designer: { idle: "/characters/char_extra2.png", working: "/characters/char_extra2.png" },
  tester: { idle: "/characters/testing.png", working: "/characters/testing_working.png" },
  devops: { idle: "/characters/general.png", working: "/characters/general_working.png" },
  general: { idle: "/characters/general.png", working: "/characters/general_working.png" },
};

export function getCharacterImage(agent: Agent): string {
  if (agent.avatarUrl) return agent.avatarUrl;
  const images = roleCharacterImages[agent.role];
  if (images) return agent.status === "working" ? images.working : images.idle;
  return "/characters/general.png";
}

export const messageTypeLabels: Record<string, string> = {
  discussion: "토론",
  suggestion: "제안",
  request: "요청",
  response: "응답",
};

export const messageTypeColors: Record<string, string> = {
  discussion: "#5865F2",
  suggestion: "#57F287",
  request: "#FEE75C",
  response: "#ED4245",
};
