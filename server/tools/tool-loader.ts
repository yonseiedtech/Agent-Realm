import fs from "fs";
import path from "path";
import { toolRegistry } from "./tool-registry";
import { storage } from "../storage";
import type { RegisteredTool } from "./tool-registry";

export class ToolLoader {
  async loadPlugins(pluginDir: string): Promise<number> {
    if (!fs.existsSync(pluginDir)) {
      return 0;
    }

    const entries = fs.readdirSync(pluginDir, { withFileTypes: true });
    let loaded = 0;

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".js")) continue;
      if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;

      try {
        const filePath = path.join(pluginDir, entry.name);
        await this.loadPlugin(filePath);
        loaded++;
      } catch (err: any) {
        console.error(`[ToolLoader] Failed to load plugin ${entry.name}:`, err.message);
      }
    }

    return loaded;
  }

  async loadPlugin(filePath: string): Promise<RegisteredTool> {
    const mod = await import(filePath);
    const plugin = mod.default || mod;

    if (!plugin.name || !plugin.inputSchema || !plugin.handler) {
      throw new Error(`Invalid plugin format: ${filePath} (requires name, inputSchema, handler)`);
    }

    const definition = {
      name: plugin.name,
      description: plugin.description || "",
      input_schema: plugin.inputSchema,
    };

    const tool: RegisteredTool = {
      definition,
      handler: plugin.handler,
      roles: plugin.roles || null,
      source: "plugin",
    };

    toolRegistry.registerPlugin(plugin.name, definition, plugin.handler, plugin.roles || undefined);

    return tool;
  }

  async loadFromDb(): Promise<number> {
    try {
      const plugins = await storage.getAllToolPlugins();
      let loaded = 0;

      for (const plugin of plugins) {
        if (!plugin.isEnabled) continue;

        try {
          const inputSchema = JSON.parse(plugin.inputSchema);
          const roles = plugin.enabledRoles ? JSON.parse(plugin.enabledRoles) : null;

          // Load the handler from handlerPath
          const mod = await import(plugin.handlerPath);
          const handler = mod.default || mod.handler;

          if (typeof handler !== "function") {
            console.error(`[ToolLoader] Invalid handler in ${plugin.handlerPath}`);
            continue;
          }

          toolRegistry.registerPlugin(
            plugin.name,
            {
              name: plugin.name,
              description: plugin.description || "",
              input_schema: inputSchema,
            },
            handler,
            roles || undefined
          );
          loaded++;
        } catch (err: any) {
          console.error(`[ToolLoader] Failed to load DB plugin ${plugin.name}:`, err.message);
        }
      }

      return loaded;
    } catch {
      return 0;
    }
  }
}

export const toolLoader = new ToolLoader();
