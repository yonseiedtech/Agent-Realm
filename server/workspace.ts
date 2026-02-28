import fs from "fs/promises";
import path from "path";

const fileLocks = new Map<string, string>();

export class Workspace {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || process.cwd();
  }

  getBasePath(): string {
    return this.basePath;
  }

  setBasePath(newPath: string) {
    this.basePath = path.resolve(newPath);
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

  async searchFiles(
    pattern: string,
    dirPath: string = ".",
    filePattern?: string,
  ): Promise<{ file: string; line: number; content: string }[]> {
    const resolved = this.resolvePath(dirPath);
    const results: { file: string; line: number; content: string }[] = [];
    const regex = new RegExp(pattern, "gi");
    const maxResults = 50;

    const walk = async (dir: string, rel: string) => {
      if (results.length >= maxResults) return;
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (results.length >= maxResults) return;
        if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") continue;
        const fullPath = path.join(dir, entry.name);
        const relPath = path.join(rel, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath, relPath);
        } else {
          if (filePattern && !entry.name.match(new RegExp(filePattern.replace(/\*/g, ".*")))) continue;
          try {
            const content = await fs.readFile(fullPath, "utf-8");
            const lines = content.split("\n");
            for (let i = 0; i < lines.length; i++) {
              if (regex.test(lines[i])) {
                results.push({ file: relPath, line: i + 1, content: lines[i].trim() });
                regex.lastIndex = 0;
                if (results.length >= maxResults) return;
              }
            }
          } catch {
            // binary file or read error — skip
          }
        }
      }
    };

    await walk(resolved, dirPath === "." ? "" : dirPath);
    return results;
  }

  async editFile(
    filePath: string,
    startLine: number,
    endLine: number,
    newContent: string,
    agentId: string,
  ): Promise<{ linesChanged: number }> {
    const lockHolder = fileLocks.get(filePath);
    if (lockHolder && lockHolder !== agentId) {
      throw new Error(`파일이 에이전트 #${lockHolder}에 의해 잠겨 있습니다`);
    }
    const resolved = this.resolvePath(filePath);
    const content = await fs.readFile(resolved, "utf-8");
    const lines = content.split("\n");
    if (startLine < 1 || startLine > lines.length) {
      throw new Error(`시작 줄 ${startLine}이(가) 범위를 벗어났습니다 (1-${lines.length})`);
    }
    const end = Math.min(endLine, lines.length);
    const newLines = newContent.split("\n");
    lines.splice(startLine - 1, end - startLine + 1, ...newLines);
    await fs.writeFile(resolved, lines.join("\n"), "utf-8");
    return { linesChanged: newLines.length };
  }
}

export const workspace = new Workspace();
