import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Send, MessageSquare, Search, Radio, Users,
} from "lucide-react";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onBroadcast: (msg: string) => void;
  onDiscuss: (topic: string) => void;
  broadcastPending: boolean;
  discussPending: boolean;
  disabled: boolean;
}

type CommandMode = "search" | "broadcast" | "discuss";

export default function CommandPalette({
  open,
  onClose,
  onBroadcast,
  onDiscuss,
  broadcastPending,
  discussPending,
  disabled,
}: CommandPaletteProps) {
  const [mode, setMode] = useState<CommandMode>("search");
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setMode("search");
      setInput("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSubmit = () => {
    if (!input.trim() || disabled) return;
    if (mode === "broadcast") {
      onBroadcast(input);
      setInput("");
      onClose();
    } else if (mode === "discuss") {
      onDiscuss(input);
      setInput("");
      onClose();
    }
  };

  const commands = [
    {
      id: "broadcast",
      label: "전체 브로드캐스트",
      description: "모든 에이전트에게 작업 지시",
      icon: Radio,
      action: () => setMode("broadcast"),
    },
    {
      id: "discuss",
      label: "토론 시작",
      description: "에이전트 간 토론 주제 설정",
      icon: Users,
      action: () => setMode("discuss"),
    },
  ];

  const filteredCommands = input.trim()
    ? commands.filter(
        (c) =>
          c.label.toLowerCase().includes(input.toLowerCase()) ||
          c.description.toLowerCase().includes(input.toLowerCase()),
      )
    : commands;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100]"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={onClose}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 w-[520px] max-w-[calc(100vw-2rem)] z-[101] rounded-xl overflow-hidden"
            style={{
              background: "var(--dc-bg-secondary)",
              border: "1px solid var(--dc-border-strong)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
            }}
          >
            {/* Input area */}
            <div
              className="flex items-center gap-2 px-4 py-3"
              style={{ borderBottom: "1px solid var(--dc-border-subtle)" }}
            >
              {mode === "search" ? (
                <Search className="w-5 h-5 shrink-0" style={{ color: "var(--dc-text-muted)" }} />
              ) : mode === "broadcast" ? (
                <Radio className="w-5 h-5 shrink-0" style={{ color: "var(--dc-green)" }} />
              ) : (
                <MessageSquare className="w-5 h-5 shrink-0" style={{ color: "var(--dc-blurple)" }} />
              )}

              <Input
                ref={inputRef}
                placeholder={
                  mode === "search"
                    ? "명령어 검색..."
                    : mode === "broadcast"
                      ? "전체 에이전트에게 작업 지시..."
                      : "토론 주제 입력..."
                }
                className="bg-transparent border-none text-sm h-8 px-0 focus-visible:ring-0"
                style={{ color: "var(--dc-text-primary)" }}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    if (mode !== "search") {
                      setMode("search");
                      setInput("");
                    } else {
                      onClose();
                    }
                  }
                  if (e.key === "Enter") {
                    if (mode !== "search") {
                      handleSubmit();
                    }
                  }
                }}
                data-testid="input-command-palette"
              />

              {mode !== "search" && (
                <Button
                  size="sm"
                  className="h-7 px-3 text-xs shrink-0"
                  style={{
                    background: mode === "broadcast" ? "var(--dc-green)" : "var(--dc-blurple)",
                    color: mode === "broadcast" ? "#000" : "#fff",
                  }}
                  onClick={handleSubmit}
                  disabled={
                    !input.trim() ||
                    disabled ||
                    (mode === "broadcast" ? broadcastPending : discussPending)
                  }
                  data-testid="button-command-submit"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>

            {/* Command list (search mode only) */}
            {mode === "search" && (
              <div className="py-2 px-2">
                <div className="px-2 pb-1.5">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--dc-text-muted)" }}
                  >
                    명령어
                  </span>
                </div>
                {filteredCommands.map((cmd) => (
                  <button
                    key={cmd.id}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors"
                    style={{ color: "var(--dc-text-primary)" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--dc-bg-modifier-hover)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                    onClick={cmd.action}
                    data-testid={`command-${cmd.id}`}
                  >
                    <cmd.icon className="w-4 h-4 shrink-0" style={{ color: "var(--dc-text-muted)" }} />
                    <div className="text-left">
                      <div className="text-sm">{cmd.label}</div>
                      <div className="text-[11px]" style={{ color: "var(--dc-text-muted)" }}>
                        {cmd.description}
                      </div>
                    </div>
                  </button>
                ))}
                {filteredCommands.length === 0 && (
                  <div
                    className="px-3 py-4 text-center text-xs"
                    style={{ color: "var(--dc-text-muted)" }}
                  >
                    일치하는 명령어가 없습니다
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div
              className="px-4 py-2 flex items-center justify-between text-[10px]"
              style={{
                borderTop: "1px solid var(--dc-border-subtle)",
                color: "var(--dc-text-muted)",
              }}
            >
              <span>
                {mode === "search" ? "↑↓ 탐색 · Enter 선택" : "Enter 전송 · Esc 뒤로"}
              </span>
              <span>Ctrl+K</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
