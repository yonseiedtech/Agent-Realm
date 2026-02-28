import { execSync } from "child_process";
import { storage } from "../../storage";
import { emitEvent } from "../../agents";
import type { ToolDefinition } from "../../ai-client";
import type { ToolHandler } from "../tool-registry";

// ─── Tool Definitions ────────────────────────────────────

export const gitOperationsDef: ToolDefinition = {
  name: "git_operations",
  description: "Git 명령을 실행합니다 (status, diff, add, commit, log)",
  input_schema: {
    type: "object" as const,
    properties: {
      operation: { type: "string", enum: ["status", "diff", "add", "commit", "log"], description: "Git 명령" },
      args: { type: "string", description: "추가 인자 (예: commit의 경우 메시지, add의 경우 파일 경로)" },
    },
    required: ["operation"],
  },
};

// ─── Tool Handlers ───────────────────────────────────────

export const gitOperationsHandler: ToolHandler = async (agentId, input) => {
  const op = input.operation;
  const args = input.args || "";
  let gitCmd: string;
  switch (op) {
    case "status": gitCmd = "git status"; break;
    case "diff": gitCmd = `git diff ${args}`.trim(); break;
    case "add": gitCmd = `git add ${args || "."}`.trim(); break;
    case "commit": gitCmd = `git commit -m "${args.replace(/"/g, '\\"')}"`.trim(); break;
    case "log": gitCmd = `git log --oneline -20 ${args}`.trim(); break;
    default: return `알 수 없는 git 명령: ${op}`;
  }
  try {
    const output = execSync(gitCmd, {
      cwd: process.cwd(),
      timeout: 15000,
      encoding: "utf-8",
    });
    await storage.createActivityLog({
      agentId,
      action: "git_operation",
      details: `Git: ${gitCmd}`,
      filePath: null,
    });
    emitEvent({
      type: "activity",
      data: { agentId, action: "git_operation", details: gitCmd },
    });
    return output || "(출력 없음)";
  } catch (e: any) {
    return `Git 오류: ${e.stderr || e.message}`;
  }
};
