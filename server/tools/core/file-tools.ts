import { workspace } from "../../workspace";
import { storage } from "../../storage";
import { emitEvent } from "../../agents";
import type { ToolDefinition } from "../../ai-client";
import type { ToolHandler } from "../tool-registry";

// ─── Tool Definitions ────────────────────────────────────

export const listFilesDef: ToolDefinition = {
  name: "list_files",
  description: "프로젝트 디렉토리의 파일 목록을 조회합니다",
  input_schema: {
    type: "object" as const,
    properties: {
      path: { type: "string", description: "조회할 디렉토리 경로 (기본: '.')" },
    },
    required: [],
  },
};

export const readFileDef: ToolDefinition = {
  name: "read_file",
  description: "파일 내용을 읽습니다",
  input_schema: {
    type: "object" as const,
    properties: {
      path: { type: "string", description: "읽을 파일 경로" },
    },
    required: ["path"],
  },
};

export const writeFileDef: ToolDefinition = {
  name: "write_file",
  description: "파일에 내용을 작성합니다",
  input_schema: {
    type: "object" as const,
    properties: {
      path: { type: "string", description: "작성할 파일 경로" },
      content: { type: "string", description: "파일 내용" },
    },
    required: ["path", "content"],
  },
};

export const editFileDef: ToolDefinition = {
  name: "edit_file",
  description: "파일의 특정 줄 범위를 새 내용으로 교체합니다 (전체 덮어쓰기 대신 부분 편집)",
  input_schema: {
    type: "object" as const,
    properties: {
      path: { type: "string", description: "편집할 파일 경로" },
      start_line: { type: "number", description: "시작 줄 번호 (1부터)" },
      end_line: { type: "number", description: "끝 줄 번호" },
      new_content: { type: "string", description: "대체할 새 내용" },
    },
    required: ["path", "start_line", "end_line", "new_content"],
  },
};

export const searchFilesDef: ToolDefinition = {
  name: "search_files",
  description: "프로젝트 내 파일에서 텍스트/정규식 패턴을 검색합니다 (최대 50개 결과)",
  input_schema: {
    type: "object" as const,
    properties: {
      pattern: { type: "string", description: "검색할 텍스트 또는 정규식 패턴" },
      path: { type: "string", description: "검색할 디렉토리 경로 (기본: '.')" },
      file_pattern: { type: "string", description: "파일명 필터 (예: '*.ts', '*.tsx')" },
    },
    required: ["pattern"],
  },
};

// ─── Tool Handlers ───────────────────────────────────────

export const listFilesHandler: ToolHandler = async (_agentId, input) => {
  const files = await workspace.listFiles(input.path || ".");
  return JSON.stringify(files, null, 2);
};

export const readFileHandler: ToolHandler = async (_agentId, input) => {
  try {
    const content = await workspace.readFile(input.path);
    return content.length > 5000 ? content.substring(0, 5000) + "\n... (잘림)" : content;
  } catch {
    return `오류: 파일을 읽을 수 없습니다 - ${input.path}`;
  }
};

export const writeFileHandler: ToolHandler = async (agentId, input) => {
  try {
    await workspace.writeFile(input.path, input.content, agentId);
    await storage.createActivityLog({
      agentId,
      action: "file_write",
      details: `파일 수정: ${input.path}`,
      filePath: input.path,
    });
    emitEvent({
      type: "activity",
      data: { agentId, action: "file_write", filePath: input.path },
    });
    return `파일이 성공적으로 작성되었습니다: ${input.path}`;
  } catch (e: any) {
    return `오류: ${e.message}`;
  }
};

export const editFileHandler: ToolHandler = async (agentId, input) => {
  try {
    const result = await workspace.editFile(input.path, input.start_line, input.end_line, input.new_content, agentId);
    await storage.createActivityLog({
      agentId,
      action: "file_edit",
      details: `파일 부분 수정: ${input.path} (${input.start_line}-${input.end_line}줄)`,
      filePath: input.path,
    });
    emitEvent({
      type: "activity",
      data: { agentId, action: "file_edit", filePath: input.path },
    });
    return `파일이 성공적으로 편집되었습니다: ${input.path} (${result.linesChanged}줄 변경)`;
  } catch (e: any) {
    return `편집 오류: ${e.message}`;
  }
};

export const searchFilesHandler: ToolHandler = async (_agentId, input) => {
  try {
    const results = await workspace.searchFiles(input.pattern, input.path || ".", input.file_pattern);
    if (results.length === 0) return "검색 결과가 없습니다";
    return results.map(r => `${r.file}:${r.line}: ${r.content}`).join("\n");
  } catch (e: any) {
    return `검색 오류: ${e.message}`;
  }
};
