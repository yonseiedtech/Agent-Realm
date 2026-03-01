const { app, BrowserWindow, shell, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;
let widgetWindow;
let savedBounds = null; // { x, y, width, height } before minimize
let widgetScale = 1.0; // 0.6 ~ 1.6
const PORT = 18080;

function loadEnv() {
  const candidates = [
    path.join(app.getAppPath(), ".env"),
    path.join(path.dirname(app.getAppPath()), ".env"),
    path.join(process.resourcesPath || "", ".env"),
  ];

  for (const envPath of candidates) {
    try {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const value = trimmed.slice(eqIdx + 1).trim();
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
      console.log(`[electron] Loaded .env from ${envPath}`);
      break;
    } catch {}
  }
}

function startServer() {
  return new Promise((resolve, reject) => {
    process.env.NODE_ENV = "production";
    process.env.PORT = String(PORT);

    try {
      process.chdir(app.getAppPath());
    } catch {}

    const serverPath = path.join(app.getAppPath(), "dist", "index.cjs");

    if (!fs.existsSync(serverPath)) {
      const msg = `서버 파일을 찾을 수 없습니다: ${serverPath}`;
      console.error(msg);
      reject(new Error(msg));
      return;
    }

    try {
      require(serverPath);
      console.log(`[electron] Server module loaded from ${serverPath}`);
    } catch (err) {
      console.error("[electron] Server load error:", err);
      reject(err);
      return;
    }

    let attempts = 0;
    const maxRetries = 40;
    const check = () => {
      const http = require("http");
      const req = http.get(`http://localhost:${PORT}/api/agents`, (res) => {
        console.log(`[electron] Server ready on port ${PORT}`);
        resolve();
      });
      req.on("error", () => {
        attempts++;
        if (attempts >= maxRetries) {
          reject(new Error("Server did not respond in time"));
        } else {
          setTimeout(check, 500);
        }
      });
      req.end();
    };
    setTimeout(check, 1000);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Agent Realm",
    backgroundColor: "#ffffff",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
    show: false,
    autoHideMenuBar: true,
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });

  // Minimize -> save bounds, hide main window + show widget
  mainWindow.on("minimize", (e) => {
    e.preventDefault();
    savedBounds = mainWindow.getBounds();
    mainWindow.hide();
    createWidgetWindow();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createWidgetWindow() {
  if (widgetWindow) {
    widgetWindow.focus();
    return;
  }

  widgetWindow = new BrowserWindow({
    width: 320,
    height: 100,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    backgroundColor: "#00000000",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  widgetWindow.loadURL(`http://localhost:${PORT}/widget`);

  widgetWindow.on("closed", () => {
    widgetWindow = null;
  });
}

// IPC handlers
ipcMain.on("restore-from-widget", (_event, agentId) => {
  const widget = widgetWindow;
  widgetWindow = null;

  if (mainWindow) {
    mainWindow.show();
    if (savedBounds) {
      mainWindow.setBounds(savedBounds);
      savedBounds = null;
    }
    mainWindow.focus();

    if (agentId) {
      mainWindow.webContents.send("navigate-to-agent", agentId);
    }
  }

  // Destroy widget after main window is restored to avoid crashing
  // the renderer that sent this IPC message
  if (widget && !widget.isDestroyed()) {
    setImmediate(() => widget.destroy());
  }
});

ipcMain.on("resize-widget", (_event, width, height) => {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.setSize(Math.round(width), Math.round(height));
  }
});

ipcMain.on("is-widget", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  event.returnValue = win === widgetWindow;
});

ipcMain.on("set-widget-scale", (_event, scale) => {
  widgetScale = Math.min(1.6, Math.max(0.6, scale));
});

ipcMain.on("get-widget-scale", (event) => {
  event.returnValue = widgetScale;
});

app.whenReady().then(async () => {
  loadEnv();

  try {
    await startServer();
  } catch (e) {
    console.error("[electron] Failed to start server:", e);
    dialog.showErrorBox(
      "서버 시작 실패",
      `서버를 시작할 수 없습니다.\n\n${e.message}\n\n.env 파일에 ANTHROPIC_API_KEY가 설정되어 있는지 확인하세요.`
    );
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
