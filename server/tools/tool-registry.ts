import type { ToolDefinition } from "../ai-client";

export interface ToolHandler {
  (agentId: string, input: any): Promise<string>;
}

export interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
  roles: string[] | null; // null = all roles
  source: "core" | "plugin";
}

export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();

  registerCore(name: string, def: ToolDefinition, handler: ToolHandler): void {
    this.tools.set(name, { definition: def, handler, roles: null, source: "core" });
  }

  registerPlugin(
    name: string,
    def: ToolDefinition,
    handler: ToolHandler,
    roles?: string[]
  ): void {
    this.tools.set(name, {
      definition: def,
      handler,
      roles: roles || null,
      source: "plugin",
    });
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  getToolsForRole(role: string): ToolDefinition[] {
    const result: ToolDefinition[] = [];
    const entries = Array.from(this.tools.values());
    for (const tool of entries) {
      if (tool.roles === null || tool.roles.includes(role)) {
        result.push(tool.definition);
      }
    }
    return result;
  }

  async execute(toolName: string, agentId: string, input: any): Promise<string> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return "알 수 없는 도구입니다";
    }
    return tool.handler(agentId, input);
  }

  getAllTools(): RegisteredTool[] {
    const entries: RegisteredTool[] = [];
    this.tools.forEach(v => entries.push(v));
    return entries;
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getToolNames(): string[] {
    const names: string[] = [];
    this.tools.forEach((_v, k) => names.push(k));
    return names;
  }
}

export const toolRegistry = new ToolRegistry();
