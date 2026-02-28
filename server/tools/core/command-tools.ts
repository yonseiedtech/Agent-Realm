import { execSync } from "child_process";
import { storage } from "../../storage";
import { emitEvent } from "../../agents";
import type { ToolDefinition } from "../../ai-client";
import type { ToolHandler } from "../tool-registry";

// ─── Tool Definitions ────────────────────────────────────

export const runCommandDef: ToolDefinition = {
  name: "run_command",
  description: "안전한 셸 명령을 실행합니다 (npm, npx, node, git, tsc, ls, cat, pwd 허용)",
  input_schema: {
    type: "object" as const,
    properties: {
      command: { type: "string", description: "실행할 명령어" },
      timeout: { type: "number", description: "타임아웃 (밀리초, 기본 30000, 최대 60000)" },
    },
    required: ["command"],
  },
};

// ─── Tool Handlers ───────────────────────────────────────

const ALLOWED_COMMANDS = ["npm", "npx", "node", "git", "tsc", "ls", "cat", "pwd", "echo", "mkdir", "cp"];
const BLOCKED_PATTERNS = ["rm -rf", "sudo", "chmod", "> /", "| sh", "curl |", "wget |", "&& rm", "; rm"];

export const runCommandHandler: ToolHandler = async (agentId, input) => {
  const cmd = input.command.trim();
  const baseCmd = cmd.split(/\s+/)[0];
  if (!ALLOWED_COMMANDS.includes(baseCmd)) {
    return `차단됨: '${baseCmd}' 명령은 허용되지 않습니다. 허용: ${ALLOWED_COMMANDS.join(", ")}`;
  }
  for (const blocked of BLOCKED_PATTERNS) {
    if (cmd.includes(blocked)) {
      return `차단됨: 위험한 패턴 '${blocked}'이 감지되었습니다`;
    }
  }
  try {
    const timeout = Math.min(input.timeout || 30000, 60000);
    const output = execSync(cmd, {
      cwd: process.cwd(),
      timeout,
      encoding: "utf-8",
      maxBuffer: 1024 * 1024,
    });
    await storage.createActivityLog({
      agentId,
      action: "command_run",
      details: `명령 실행: ${cmd}`,
      filePath: null,
    });
    emitEvent({
      type: "activity",
      data: { agentId, action: "command_run", details: cmd },
    });
    const trimmed = output.length > 3000 ? output.substring(0, 3000) + "\n... (잘림)" : output;
    return trimmed || "(출력 없음)";
  } catch (e: any) {
    return `명령 실행 오류: ${e.stderr || e.message}`;
  }
};
