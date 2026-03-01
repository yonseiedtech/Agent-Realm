const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  restoreFromWidget: (agentId) => ipcRenderer.send("restore-from-widget", agentId || null),
  isWidget: () => ipcRenderer.sendSync("is-widget"),
  resizeWidget: (width, height) => ipcRenderer.send("resize-widget", width, height),
  setWidgetScale: (scale) => ipcRenderer.send("set-widget-scale", scale),
  getWidgetScale: () => ipcRenderer.sendSync("get-widget-scale"),
  onNavigateToAgent: (callback) => ipcRenderer.on("navigate-to-agent", (_e, agentId) => callback(agentId)),
});
