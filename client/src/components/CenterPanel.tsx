import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { motion } from "framer-motion";
import { roleLabels, roleColors, statusLabels, getCharacterImage } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Send,
  X,
  Loader2,
  FileCode,
  MessageSquare,
  Trash2,
  Volume2,
  PanelRightOpen,
  PanelRightClose,
  Monitor,
} from "lucide-react";
import { soundManager } from "@/lib/sounds";
import { useToast } from "@/hooks/use-toast";
import ChatSkeleton from "@/components/ui/ChatSkeleton";
import type { Agent, ChatHistory } from "@shared/schema";

interface CenterPanelProps {
  agents: Agent[];
  selectedAgentId: string | null;
  onDeleteAgent: (id: string) => void;
  ttsEnabled?: boolean;
  onTTSSpeak?: (text: string, role: string) => void;
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
}

export default function CenterPanel({
  agents,
  selectedAgentId,
  onDeleteAgent,
  ttsEnabled,
  onTTSSpeak,
  rightPanelOpen,
  onToggleRightPanel,
}: CenterPanelProps) {
  const agent = agents.find((a) => a.id === selectedAgentId);
  const { toast } = useToast();
  const [chatInput, setChatInput] = useState("");
  const [pendingImage, setPendingImage] = useState<{
    base64: string;
    preview: string;
  } | null>(null);
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: chatHistoryData = [], isLoading: historyLoading } =
    useQuery<ChatHistory[]>({
      queryKey: ["/api/agents", selectedAgentId, "history"],
      queryFn: async () => {
        const res = await fetch(`/api/agents/${selectedAgentId}/history`);
        if (!res.ok) throw new Error("Failed to load history");
        return res.json();
      },
      enabled: !!selectedAgentId,
    });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistoryData]);

  const chatMutation = useMutation({
    mutationFn: async ({
      message,
      attachmentUrl,
    }: {
      message: string;
      attachmentUrl?: string;
    }) => {
      soundManager.messageSent();
      const res = await apiRequest(
        "POST",
        `/api/agents/${selectedAgentId}/chat`,
        { message, attachmentUrl },
      );
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/agents", selectedAgentId, "history"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      if (ttsEnabled && onTTSSpeak && data?.response && agent) {
        onTTSSpeak(data.response, agent.role);
      }
    },
    onError: (error: any) => {
      toast({ title: "메시지 전송 실패", description: error.message, variant: "destructive" });
    },
  });

  const clearHistoryMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/agents/${selectedAgentId}/history`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/agents", selectedAgentId, "history"],
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (role: string) => {
      await apiRequest("PATCH", `/api/agents/${selectedAgentId}`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
    },
  });

  const updateModelMutation = useMutation({
    mutationFn: async (model: string) => {
      await apiRequest("PATCH", `/api/agents/${selectedAgentId}`, { model });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (base64: string) => {
      const res = await apiRequest("POST", "/api/upload", {
        data: base64,
        filename: "paste.png",
      });
      return res.json();
    },
  });

  const handleSend = async () => {
    if ((!chatInput.trim() && !pendingImage) || chatMutation.isPending) return;
    let attachmentUrl: string | undefined;
    if (pendingImage) {
      try {
        const result = await uploadMutation.mutateAsync(pendingImage.base64);
        attachmentUrl = result.url;
      } catch {
        return;
      }
    }
    chatMutation.mutate({
      message: chatInput || "(이미지 첨부)",
      attachmentUrl,
    });
    setChatInput("");
    setPendingImage(null);
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1];
          setPendingImage({ base64, preview: result });
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  }, []);

  // Empty state
  if (!agent) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center"
        style={{ background: "var(--dc-bg-main)" }}
      >
        <MessageSquare
          className="w-16 h-16 mb-4"
          style={{ color: "var(--dc-text-muted)", opacity: 0.3 }}
        />
        <p
          className="text-lg font-semibold mb-1"
          style={{ color: "var(--dc-text-secondary)" }}
        >
          에이전트를 선택하세요
        </p>
        <p className="text-sm" style={{ color: "var(--dc-text-muted)" }}>
          좌측 사이드바에서 에이전트를 클릭하여 대화를 시작하세요
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col min-w-0"
      style={{ background: "var(--dc-bg-main)" }}
    >
      {/* Top bar */}
      <div
        className="h-12 px-4 flex items-center justify-between shrink-0"
        style={{ borderBottom: "1px solid var(--dc-border-subtle)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-full overflow-hidden border-2 shrink-0"
            style={{ borderColor: agent.color }}
          >
            <img
              src={getCharacterImage(agent)}
              alt={agent.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="text-sm font-semibold truncate"
                style={{ color: "var(--dc-text-primary)" }}
              >
                {agent.name}
              </span>
              <Badge
                className="text-[10px] px-1.5 py-0 h-4 border-none shrink-0"
                style={{
                  backgroundColor: `${agent.color}20`,
                  color: agent.color,
                }}
              >
                {roleLabels[agent.role] || agent.role}
              </Badge>
              <span
                className="text-[11px] shrink-0"
                style={{
                  color:
                    agent.status === "working" ? "#FEE75C" : "#57F287",
                }}
              >
                {statusLabels[agent.status]}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Role change */}
          <Select
            value={agent.role}
            onValueChange={(v) => updateRoleMutation.mutate(v)}
          >
            <SelectTrigger
              className="border-none h-7 text-[10px] w-[90px]"
              style={{ background: "var(--dc-bg-input)", color: "var(--dc-text-primary)" }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pm">PM</SelectItem>
              <SelectItem value="frontend">프론트엔드</SelectItem>
              <SelectItem value="backend">백엔드</SelectItem>
              <SelectItem value="designer">디자이너</SelectItem>
              <SelectItem value="tester">테스터</SelectItem>
              <SelectItem value="devops">DevOps</SelectItem>
              <SelectItem value="general">일반</SelectItem>
            </SelectContent>
          </Select>

          {/* Model change */}
          <Select
            value={agent.model}
            onValueChange={(v) => updateModelMutation.mutate(v)}
          >
            <SelectTrigger
              className="border-none h-7 text-[10px] w-[120px]"
              style={{ background: "var(--dc-bg-input)", color: "var(--dc-text-primary)" }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="claude-sonnet-4-6">Sonnet 4</SelectItem>
              <SelectItem value="claude-haiku-4-5">Haiku 4.5</SelectItem>
              <SelectItem value="claude-opus-4-6">Opus 4</SelectItem>
              <SelectItem value="gpt-4o">GPT-4o</SelectItem>
              <SelectItem value="gpt-4o-mini">GPT-4o mini</SelectItem>
              <SelectItem value="gemini-2.5-flash">Gemini Flash</SelectItem>
              <SelectItem value="gemini-2.5-pro">Gemini Pro</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="sm"
            className="text-[10px] h-7 px-2"
            style={{ color: "var(--dc-text-muted)" }}
            onClick={() => clearHistoryMutation.mutate()}
            disabled={clearHistoryMutation.isPending}
          >
            <Trash2 className="w-3 h-3 mr-1" />
            초기화
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[10px] text-red-400 h-7 px-2"
            onClick={() => onDeleteAgent(agent.id)}
          >
            <Trash2 className="w-3 h-3 mr-1" />
            제거
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7"
            onClick={onToggleRightPanel}
            title={rightPanelOpen ? "패널 닫기" : "패널 열기"}
          >
            {rightPanelOpen ? (
              <PanelRightClose
                className="w-4 h-4"
                style={{ color: "var(--dc-text-muted)" }}
              />
            ) : (
              <PanelRightOpen
                className="w-4 h-4"
                style={{ color: "var(--dc-text-muted)" }}
              />
            )}
          </Button>
        </div>
      </div>

      {/* Current file indicator */}
      {agent.currentFile && (
        <div
          className="px-4 py-1.5 flex items-center gap-1.5 text-[11px]"
          style={{
            borderBottom: "1px solid var(--dc-border-subtle)",
            color: "var(--dc-text-muted)",
          }}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span className="truncate">{agent.currentFile}</span>
        </div>
      )}

      {/* Zoom-style agent video view — 3D scene */}
      <div
        className="shrink-0 relative"
        style={{
          height: "200px",
          background: `linear-gradient(135deg, ${roleColors[agent.role] || agent.color}10 0%, var(--dc-bg-tertiary) 50%, ${roleColors[agent.role] || agent.color}08 100%)`,
          borderBottom: "1px solid var(--dc-border-subtle)",
          perspective: "1200px",
          perspectiveOrigin: "50% 60%",
          overflow: "hidden",
        }}
      >
        {/* Desk / workspace background */}
        <div
          className="absolute inset-0 flex items-end justify-center"
          style={{ overflow: "visible" }}
        >
          {/* Desk surface — 3D tilted */}
          <div
            className="absolute bottom-0 left-0 right-0 h-[40%] rounded-t-xl"
            style={{
              background: "linear-gradient(180deg, rgba(200,190,175,0.7) 0%, rgba(185,175,160,0.9) 100%)",
              borderTop: "2px solid rgba(0,0,0,0.06)",
              transform: "rotateX(25deg)",
              transformOrigin: "bottom center",
              willChange: "transform",
            }}
          />
          {/* Laptop glow */}
          {agent.status === "working" && (
            <motion.div
              className="absolute bottom-[38%] w-32 h-1"
              style={{
                background: `linear-gradient(90deg, transparent, ${roleColors[agent.role] || "#5865F2"}60, transparent)`,
                borderRadius: "4px",
              }}
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
          {/* Laptop screen — slightly tilted back */}
          <div
            className="absolute bottom-[40%] w-28 h-20 rounded-t-md"
            style={{
              background: agent.status === "working"
                ? `linear-gradient(180deg, ${roleColors[agent.role] || "#5865F2"}20 0%, rgba(230,230,240,0.9) 100%)`
                : "linear-gradient(180deg, rgba(230,230,240,0.6) 0%, rgba(220,220,230,0.8) 100%)",
              border: "2px solid rgba(0,0,0,0.1)",
              borderBottom: "none",
              transform: "rotateX(-5deg)",
              transformOrigin: "bottom center",
            }}
          >
            {/* Screen content lines */}
            {agent.status === "working" && (
              <div className="p-2 space-y-1">
                <motion.div
                  className="h-1 rounded-full"
                  style={{ background: `${roleColors[agent.role] || "#5865F2"}60`, width: "70%" }}
                  animate={{ width: ["50%", "80%", "60%"] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <motion.div
                  className="h-1 rounded-full"
                  style={{ background: `${roleColors[agent.role] || "#5865F2"}40`, width: "50%" }}
                  animate={{ width: ["40%", "65%", "45%"] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                />
                <motion.div
                  className="h-1 rounded-full"
                  style={{ background: `${roleColors[agent.role] || "#5865F2"}30`, width: "60%" }}
                  animate={{ width: ["55%", "75%", "50%"] }}
                  transition={{ duration: 1.8, repeat: Infinity, delay: 0.6 }}
                />
              </div>
            )}
          </div>
          {/* Laptop base */}
          <div
            className="absolute bottom-[38%] w-36 h-2 rounded-b-sm"
            style={{
              background: "linear-gradient(180deg, rgba(180,180,190,0.7) 0%, rgba(160,160,170,0.9) 100%)",
            }}
          />
        </div>

        {/* Character with parallax shadow */}
        <motion.div
          key={agent.id}
          className="absolute bottom-0 left-1/2 -translate-x-1/2"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          {/* Ground shadow — inversely animated with character bounce */}
          <motion.div
            className="absolute bottom-0 left-1/2"
            style={{
              width: 100,
              height: 16,
              marginLeft: -50,
              borderRadius: "50%",
              background: "radial-gradient(ellipse, rgba(0,0,0,0.15) 0%, transparent 70%)",
            }}
            animate={
              agent.status === "working"
                ? { scaleX: [1, 0.9, 1, 0.88, 1], opacity: [0.5, 0.35, 0.5, 0.33, 0.5] }
                : { scaleX: [1, 0.93, 1], opacity: [0.5, 0.38, 0.5] }
            }
            transition={{
              duration: agent.status === "working" ? 1.5 : 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          <motion.div
            className="relative"
            animate={
              agent.status === "working"
                ? { y: [0, -4, -1, -5, 0], rotate: [0, -0.5, 0.5, -0.3, 0] }
                : { y: [0, -3, 0], rotate: [0, 0.3, 0] }
            }
            transition={{
              duration: agent.status === "working" ? 1.5 : 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{ willChange: "transform" }}
          >
            <img
              src={getCharacterImage(agent)}
              alt={agent.name}
              className="h-[170px] object-contain drop-shadow-2xl"
              style={{
                filter: `drop-shadow(0 4px 20px ${roleColors[agent.role] || agent.color}40)`,
              }}
            />
          </motion.div>
        </motion.div>

        {/* Name plate overlay */}
        <div
          className="absolute bottom-3 left-3 flex items-center gap-2"
        >
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{
              background: "rgba(255,255,255,0.85)",
              backdropFilter: "blur(8px)",
              border: `1px solid rgba(0,0,0,0.08)`,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: agent.status === "working" ? "var(--dc-yellow)" : "var(--dc-green)",
                boxShadow: `0 0 6px ${agent.status === "working" ? "var(--dc-yellow)" : "var(--dc-green)"}`,
              }}
            />
            <span className="text-xs font-semibold" style={{ color: "var(--dc-text-primary)" }}>
              {agent.name}
            </span>
            <Badge
              className="text-[9px] px-1.5 py-0 h-4 border-none"
              style={{
                backgroundColor: `${roleColors[agent.role] || agent.color}30`,
                color: roleColors[agent.role] || agent.color,
              }}
            >
              {roleLabels[agent.role] || agent.role}
            </Badge>
          </div>
        </div>

        {/* Status badge - top right */}
        {agent.status === "working" && (
          <motion.div
            className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-md"
            style={{
              background: "rgba(240, 160, 32, 0.1)",
              border: "1px solid rgba(240, 160, 32, 0.25)",
            }}
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Monitor className="w-3 h-3" style={{ color: "var(--dc-yellow)" }} />
            <span className="text-[10px] font-medium" style={{ color: "var(--dc-yellow)" }}>
              작업 중
            </span>
          </motion.div>
        )}
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4 space-y-4">
          {historyLoading && <ChatSkeleton />}
          {!historyLoading && chatHistoryData.length === 0 && (
            <div className="text-center py-12" style={{ color: "var(--dc-text-muted)" }}>
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">대화를 시작하세요</p>
              <p className="text-xs mt-1">
                {agent.name}에게 메시지를 보내보세요
              </p>
            </div>
          )}
          {chatHistoryData.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                {/* Agent avatar (left side) */}
                {!isUser && (
                  <div className="shrink-0 mr-3 mt-0.5">
                    <div
                      className="w-9 h-9 rounded-full overflow-hidden border-2"
                      style={{ borderColor: agent.color }}
                    >
                      <img
                        src={getCharacterImage(agent)}
                        alt={agent.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}

                <div
                  className={`group max-w-[75%] ${isUser ? "text-right" : "text-left"}`}
                >
                  {/* Name + time header (agent messages only) */}
                  {!isUser && (
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: agent.color }}
                      >
                        {agent.name}
                      </span>
                      <span
                        className="text-[10px]"
                        style={{ color: "var(--dc-text-muted)" }}
                      >
                        {new Date(msg.createdAt).toLocaleTimeString("ko-KR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {/* TTS button */}
                      {onTTSSpeak && (
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => onTTSSpeak(msg.content, agent.role)}
                          title="음성으로 듣기"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-[var(--dc-text-muted)] hover:text-[var(--dc-text-primary)]" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Message bubble */}
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm inline-block leading-relaxed ${
                      isUser ? "rounded-br-md" : "rounded-bl-md"
                    }`}
                    style={{
                      background: isUser
                        ? "var(--dc-blurple)"
                        : "var(--dc-bg-secondary)",
                      color: isUser
                        ? "#fff"
                        : "var(--dc-text-primary)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      textAlign: "left",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    }}
                  >
                    {msg.attachmentUrl && (
                      <img
                        src={msg.attachmentUrl}
                        alt="첨부"
                        className="max-w-full rounded-md mb-2 max-h-40 object-contain"
                      />
                    )}
                    {msg.content}
                  </div>

                  {/* Time for user messages */}
                  {isUser && (
                    <div
                      className="text-[10px] mt-1"
                      style={{ color: "var(--dc-text-muted)" }}
                    >
                      {new Date(msg.createdAt).toLocaleTimeString("ko-KR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {chatMutation.isPending && (
            <div className="flex justify-start">
              <div className="shrink-0 mr-3 mt-0.5">
                <div
                  className="w-9 h-9 rounded-full overflow-hidden border-2"
                  style={{ borderColor: agent.color }}
                >
                  <img
                    src={getCharacterImage(agent)}
                    alt={agent.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: agent.color }}
                  >
                    {agent.name}
                  </span>
                </div>
                <div
                  className="rounded-2xl rounded-bl-md px-4 py-3 text-sm inline-flex items-center gap-1"
                  style={{
                    background: "var(--dc-bg-secondary)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="w-2 h-2 rounded-full"
                      style={{ background: "var(--dc-text-muted)" }}
                      animate={{ y: [0, -6, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Pending image preview */}
      {pendingImage && (
        <div
          className="px-4 py-2 flex items-center gap-2"
          style={{ borderTop: "1px solid var(--dc-border-subtle)" }}
        >
          <img
            src={pendingImage.preview}
            alt="미리보기"
            className="h-12 rounded-md object-contain"
          />
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6"
            onClick={() => setPendingImage(null)}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
          <span
            className="text-[11px]"
            style={{ color: "var(--dc-text-muted)" }}
          >
            이미지 첨부됨
          </span>
        </div>
      )}

      {/* Input bar */}
      <div className="px-4 pb-4 pt-2">
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-1.5"
          style={{ background: "var(--dc-bg-input)" }}
        >
          <Input
            placeholder={`${agent.name}에게 메시지 보내기... (Ctrl+V 이미지)`}
            className="bg-transparent border-none text-sm h-9 px-0 focus-visible:ring-0"
            style={{
              color: "var(--dc-text-primary)",
            }}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            onPaste={handlePaste}
            disabled={chatMutation.isPending}
          />
          <Button
            onClick={handleSend}
            disabled={
              (!chatInput.trim() && !pendingImage) || chatMutation.isPending
            }
            size="icon"
            className="w-8 h-8 shrink-0"
            style={{
              background: "var(--dc-blurple)",
              color: "#fff",
            }}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
