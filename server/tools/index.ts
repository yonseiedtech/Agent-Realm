import { toolRegistry } from "./tool-registry";
import {
  listFilesDef, readFileDef, writeFileDef, editFileDef, searchFilesDef,
  listFilesHandler, readFileHandler, writeFileHandler, editFileHandler, searchFilesHandler,
} from "./core/file-tools";
import {
  sendMessageDef, createTaskDef,
  sendMessageHandler, createTaskHandler,
} from "./core/agent-tools";
import {
  runCommandDef,
  runCommandHandler,
} from "./core/command-tools";
import {
  gitOperationsDef,
  gitOperationsHandler,
} from "./core/git-tools";

export { toolRegistry } from "./tool-registry";
export { toolLoader } from "./tool-loader";
export type { ToolHandler, RegisteredTool } from "./tool-registry";

// Register all core tools on import
export function initCoreTools(): void {
  toolRegistry.registerCore("list_files", listFilesDef, listFilesHandler);
  toolRegistry.registerCore("read_file", readFileDef, readFileHandler);
  toolRegistry.registerCore("write_file", writeFileDef, writeFileHandler);
  toolRegistry.registerCore("edit_file", editFileDef, editFileHandler);
  toolRegistry.registerCore("search_files", searchFilesDef, searchFilesHandler);
  toolRegistry.registerCore("send_message_to_agent", sendMessageDef, sendMessageHandler);
  toolRegistry.registerCore("create_task", createTaskDef, createTaskHandler);
  toolRegistry.registerCore("run_command", runCommandDef, runCommandHandler);
  toolRegistry.registerCore("git_operations", gitOperationsDef, gitOperationsHandler);
}

// Auto-initialize on first import
initCoreTools();
