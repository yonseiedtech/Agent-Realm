import fs from "fs/promises";
import path from "path";

const fileLocks = new Map<string, string>();

export class Workspace {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || process.cwd();
  }

  private resolvePath(filePath: string): string {
    const resolved = path.resolve(this.basePath, filePath);
    if (!resolved.startsWith(this.basePath)) {
      throw new Error("경로가 작업 디렉토리를 벗어났습니다");
    }
    return resolved;
  }

  async listFiles(dirPath: string = "."): Promise<{ name: string; type: string; path: string }[]> {
    const resolved = this.resolvePath(dirPath);
    try {
      const entries = await fs.readdir(resolved, { withFileTypes: true });
      const results: { name: string; type: string; path: string }[] = [];
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") continue;
        results.push({
          name: entry.name,
          type: entry.isDirectory() ? "directory" : "file",
          path: path.join(dirPath, entry.name),
        });
      }
      return results.sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    } catch {
      return [];
    }
  }

  async readFile(filePath: string): Promise<string> {
    const resolved = this.resolvePath(filePath);
    return fs.readFile(resolved, "utf-8");
  }

  async writeFile(filePath: string, content: string, agentId: string): Promise<void> {
    const lockHolder = fileLocks.get(filePath);
    if (lockHolder && lockHolder !== agentId) {
      throw new Error(`파일이 에이전트 #${lockHolder}에 의해 잠겨 있습니다`);
    }
    const resolved = this.resolvePath(filePath);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, "utf-8");
  }

  acquireLock(filePath: string, agentId: string): boolean {
    const lockHolder = fileLocks.get(filePath);
    if (lockHolder && lockHolder !== agentId) return false;
    fileLocks.set(filePath, agentId);
    return true;
  }

  releaseLock(filePath: string, agentId: string): void {
    if (fileLocks.get(filePath) === agentId) {
      fileLocks.delete(filePath);
    }
  }

  isLocked(filePath: string): { locked: boolean; agentId?: string } {
    const lockHolder = fileLocks.get(filePath);
    return lockHolder ? { locked: true, agentId: lockHolder } : { locked: false };
  }
}

export const workspace = new Workspace();
