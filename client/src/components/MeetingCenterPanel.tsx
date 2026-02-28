import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ArrowLeft,
  UserPlus,
  Users,
  Play,
  Square,
  MessageCircle,
  Send,
  Loader2,
  User,
  Plus,
  X,
  Target,
  RotateCcw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { roleLabels, roleColors, getCharacterImage } from "@/lib/constants";
import type { Agent, MeetingRoom as MeetingRoomType } from "@shared/schema";

interface MeetingRoomDetail extends MeetingRoomType {
  participants: Array<{
    id: string;
    roomId: string;
    agentId: string;
    agentName?: string;
    agentRole?: string;
    agentColor?: string;
  }>;
  messages: Array<{
    id: string;
    roomId: string;
    agentId: string;
    content: string;
    agentName?: string;
    agentRole?: string;
    createdAt: string;
  }>;
}

interface MeetingCenterPanelProps {
  roomId: string;
  agents: Agent[];
  onBack: () => void;
}

/**
 * Compute seat positions on upper half-arc of an ellipse.
 */
function computeSeatPositions(
  count: number,
  containerW: number,
  containerH: number,
) {
  const cx = containerW * 0.5;
  const cy = containerH * 0.38;
  const rx = containerW * 0.36;
  const ry = containerH * 0.30;

  const startDeg = -160;
  const endDeg = -20;
  const spanDeg = endDeg - startDeg;

  return Array.from({ length: count }, (_, i) => {
    const deg = count === 1
      ? (startDeg + endDeg) / 2
      : startDeg + (spanDeg * i) / (count - 1);
    const rad = (deg * Math.PI) / 180;
    return {
      x: cx + rx * Math.cos(rad),
      y: cy + ry * Math.sin(rad),
    };
  });
}

export default function MeetingCenterPanel({ roomId, agents, onBack }: MeetingCenterPanelProps) {
  const [inputMode, setInputMode] = useState<"chat" | "discuss">("chat");
  const [inputText, setInputText] = useState("");
  const [rounds, setRounds] = useState("2");
  const [inviteAgentId, setInviteAgentId] = useState("");
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [sceneSize, setSceneSize] = useState({ w: 800, h: 350 });

  // ResizeObserver for conference scene
  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setSceneSize({ w: width, h: height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { data: roomDetail } = useQuery<MeetingRoomDetail>({
    queryKey: ["/api/meetings", roomId],
    enabled: !!roomId,
    refetchInterval: 2000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [roomDetail?.messages?.length]);

  // ─── Mutations ───
  const inviteMutation = useMutation({
    mutationFn: async (agentId: string) => {
      await apiRequest("POST", `/api/meetings/${roomId}/invite`, { agentId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings", roomId] });
      setInviteAgentId("");
    },
  });

  const inviteAllMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/meetings/${roomId}/invite-all`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings", roomId] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (agentId: string) => {
      await apiRequest("DELETE", `/api/meetings/${roomId}/participants/${agentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings", roomId] });
    },
  });

  const discussMutation = useMutation({
    mutationFn: async ({ topic, roundCount }: { topic: string; roundCount: number }) => {
      await apiRequest("POST", `/api/meetings/${roomId}/discuss`, { topic, rounds: roundCount });
    },
    onSuccess: () => {
      setInputText("");
    },
  });

  const userMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      await apiRequest("POST", `/api/meetings/${roomId}/user-message`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings", roomId] });
      setInputText("");
    },
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/meetings/${roomId}/close`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings", roomId] });
    },
  });

  const reopenMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/meetings/${roomId}/reopen`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings", roomId] });
    },
  });

  const handleInviteFromSeat = useCallback(
    (agentId: string) => {
      inviteMutation.mutate(agentId);
    },
    [inviteMutation],
  );

  const handleSend = () => {
    if (!inputText.trim()) return;
    if (inputMode === "discuss") {
      if (!discussMutation.isPending && roomDetail && roomDetail.participants.length >= 2) {
        discussMutation.mutate({ topic: inputText, roundCount: parseInt(rounds) });
      }
    } else {
      if (!userMessageMutation.isPending) {
        userMessageMutation.mutate(inputText);
      }
    }
  };

  // ─── Loading state ───
  if (!roomDetail) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ background: "var(--dc-bg-main)" }}
      >
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--dc-text-muted)" }} />
      </div>
    );
  }

  const participantAgentIds = new Set(roomDetail.participants.map(p => p.agentId));
  const availableAgents = agents.filter(a => !participantAgentIds.has(a.id));
  const isActive = roomDetail.status === "active";

  // Determine who is speaking (last message agent)
  const lastMsg = roomDetail.messages?.[roomDetail.messages.length - 1];
  const speakingAgentId = lastMsg && lastMsg.agentId !== "user" ? lastMsg.agentId : null;

  // Seat positions for current participants
  const participantAgents = roomDetail.participants.map(p => {
    const agent = agents.find(a => a.id === p.agentId);
    return { ...p, agent };
  });
  const seatPositions = computeSeatPositions(participantAgents.length, sceneSize.w, sceneSize.h);

  // Character size based on scene height
  const charSize = Math.max(70, Math.min(130, sceneSize.h * 0.32));

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
          <Button variant="ghost" size="icon" className="w-8 h-8 shrink-0" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" style={{ color: "var(--dc-text-muted)" }} />
          </Button>
          <MessageCircle className="w-5 h-5 shrink-0" style={{ color: "#5865F2" }} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold truncate" style={{ color: "var(--dc-text-primary)" }}>
                {roomDetail.name}
              </span>
              <Badge
                className="text-[10px] px-1.5 py-0 h-4 border-none shrink-0"
                style={{
                  backgroundColor: isActive ? "rgba(35,165,89,0.15)" : "rgba(128,128,128,0.15)",
                  color: isActive ? "#23a559" : "#6d6f78",
                }}
              >
                {isActive ? "진행 중" : "종료"}
              </Badge>
            </div>
            {roomDetail.topic && (
              <p className="text-[10px] truncate" style={{ color: "var(--dc-text-muted)" }}>
                {roomDetail.topic}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isActive && (
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] h-7 px-2"
              style={{ color: "var(--dc-red)" }}
              onClick={() => closeMutation.mutate()}
              disabled={closeMutation.isPending}
            >
              <Square className="w-3 h-3 mr-1" />
              회의 종료
            </Button>
          )}
          {!isActive && (
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] h-7 px-2"
              style={{ color: "#5865F2" }}
              onClick={() => reopenMutation.mutate()}
              disabled={reopenMutation.isPending}
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              {reopenMutation.isPending ? "재개 중..." : "회의 재개"}
            </Button>
          )}
        </div>
      </div>

      {/* Conference Room Scene (45%) — LIGHT + 3D */}
      <div
        ref={sceneRef}
        className="relative shrink-0 overflow-hidden select-none"
        style={{
          height: "45%",
          minHeight: 280,
          maxHeight: 400,
          background: "linear-gradient(180deg, var(--dc-bg-secondary) 0%, var(--dc-bg-main) 50%, var(--dc-bg-secondary) 100%)",
          perspective: "1000px",
          perspectiveOrigin: "50% 80%",
        }}
      >
        {/* Ceiling light effect */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(88,101,242,0.06) 0%, transparent 70%)",
          }}
        />

        {/* Ambient depth — floor vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(0deg, rgba(0,0,0,0.06) 0%, transparent 40%)",
            zIndex: 0,
          }}
        />

        {/* Oval table — LIGHT wood + 3D tilt */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            top: "38%",
            width: "42%",
            paddingBottom: "18%",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #c4b8a5 0%, #a89880 100%)",
            boxShadow:
              "inset 0 2px 12px rgba(255,255,255,0.3), inset 0 -4px 12px rgba(0,0,0,0.1), 0 8px 32px rgba(0,0,0,0.12)",
            border: "1px solid rgba(0,0,0,0.08)",
            transform: "rotateX(15deg)",
            transformOrigin: "center center",
            willChange: "transform",
          }}
        >
          {/* Topic badge on table */}
          {roomDetail.topic && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="px-3 py-1 rounded-full text-[10px] max-w-[80%] truncate text-center"
                style={{
                  background: "rgba(255,255,255,0.8)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(0,0,0,0.08)",
                  color: "var(--dc-text-secondary)",
                }}
              >
                {roomDetail.topic}
              </div>
            </div>
          )}
        </div>

        {/* Agent seats on arc */}
        <AnimatePresence>
          {participantAgents.map((p, idx) => {
            const pos = seatPositions[idx];
            if (!pos) return null;
            const agent = p.agent;
            const isSpeaking = speakingAgentId === p.agentId;
            const color = agent?.color || roleColors[p.agentRole || "general"] || "#5865F2";

            // Depth-based scaling: top (far) = 0.75x, bottom (near) = 1.1x
            const depthScale = 0.75 + (pos.y / sceneSize.h) * 0.35;
            const scaledCharSize = charSize * depthScale;

            return (
              <motion.div
                key={p.agentId}
                className="absolute flex flex-col items-center group"
                style={{
                  left: pos.x,
                  top: pos.y,
                  transform: "translate(-50%, -50%)",
                  zIndex: isSpeaking ? 10 : Math.round(pos.y),
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              >
                {/* Remove button on hover */}
                {isActive && (
                  <button
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
                    style={{
                      background: "var(--dc-red)",
                      color: "#fff",
                    }}
                    onClick={() => removeMutation.mutate(String(p.agentId))}
                    title="내보내기"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}

                {/* Speaking glow ring — centered on character */}
                {isSpeaking && (
                  <motion.div
                    className="absolute rounded-full pointer-events-none"
                    style={{
                      width: scaledCharSize + 20,
                      height: scaledCharSize + 20,
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -60%)",
                      border: `2px solid ${color}`,
                      boxShadow: `0 0 20px ${color}40, 0 0 40px ${color}20`,
                    }}
                    animate={{ opacity: [0.4, 1, 0.4], scale: [0.97, 1.03, 0.97] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}

                {/* Breathing bounce + subtle sway */}
                <motion.div
                  className="flex flex-col items-center"
                  animate={{
                    y: isSpeaking ? [0, -4, -1, -3, 0] : [0, -3, 0],
                    rotate: isSpeaking ? [0, -1, 1, -0.5, 0] : [0, 0.4, 0],
                    scale: isSpeaking ? [1, 1.02, 0.99, 1.01, 1] : [1, 1.005, 1],
                  }}
                  transition={{
                    duration: isSpeaking ? 2 : 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  {/* Character image — depth-scaled */}
                  <img
                    src={agent ? getCharacterImage(agent) : `/characters/${p.agentRole || "general"}.png`}
                    alt={p.agentName || ""}
                    style={{
                      height: scaledCharSize,
                      objectFit: "contain",
                      filter: `drop-shadow(0 4px 16px ${color}30)`,
                    }}
                  />

                  {/* Nameplate — LIGHT + depth-scaled */}
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg mt-1"
                    style={{
                      background: "rgba(255,255,255,0.85)",
                      backdropFilter: "blur(8px)",
                      border: `1px solid rgba(0,0,0,0.1)`,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                      transform: `scale(${depthScale})`,
                      transformOrigin: "center top",
                    }}
                  >
                    {isSpeaking && (
                      <motion.span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                      />
                    )}
                    <span className="text-[11px] font-semibold" style={{ color: "var(--dc-text-primary)" }}>
                      {p.agentName || `#${p.agentId}`}
                    </span>
                    <Badge
                      className="text-[8px] px-1 py-0 h-3.5 border-none"
                      style={{
                        backgroundColor: `${color}20`,
                        color: color,
                      }}
                    >
                      {roleLabels[p.agentRole || "general"] || p.agentRole}
                    </Badge>
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Empty seats (up to 2) */}
        {isActive && availableAgents.length > 0 && (
          <>
            {[0, 1].slice(0, Math.min(2, availableAgents.length)).map(seatIdx => {
              const totalOnArc = participantAgents.length + 2;
              const allPositions = computeSeatPositions(totalOnArc, sceneSize.w, sceneSize.h);
              const emptyPos = allPositions[participantAgents.length + seatIdx];
              if (!emptyPos) return null;

              return (
                <EmptySeat
                  key={`empty-${seatIdx}`}
                  x={emptyPos.x}
                  y={emptyPos.y}
                  size={charSize * 0.5}
                  availableAgents={availableAgents}
                  onInvite={handleInviteFromSeat}
                />
              );
            })}
          </>
        )}

        {/* User avatar (bottom center) */}
        <div
          className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
          style={{ bottom: 12 }}
        >
          <div
            className="rounded-full flex items-center justify-center"
            style={{
              width: charSize * 0.4,
              height: charSize * 0.4,
              background: "linear-gradient(135deg, #5865F2 0%, #4752C4 100%)",
              boxShadow: "0 4px 16px rgba(88,101,242,0.3)",
              border: "2px solid rgba(255,255,255,0.6)",
            }}
          >
            <User className="text-white" style={{ width: charSize * 0.2, height: charSize * 0.2 }} />
          </div>
          <div
            className="px-2 py-0.5 rounded-md mt-1 text-[10px] font-medium"
            style={{
              background: "rgba(255,255,255,0.85)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(88,101,242,0.2)",
              color: "var(--dc-text-primary)",
            }}
          >
            사용자
          </div>
        </div>

        {/* "Invite All" overlay button */}
        {isActive && availableAgents.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-3 right-3 h-7 px-2.5 text-[10px] font-semibold"
            style={{
              background: "rgba(88,101,242,0.1)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(88,101,242,0.2)",
              color: "#5865F2",
            }}
            onClick={() => inviteAllMutation.mutate()}
            disabled={inviteAllMutation.isPending}
          >
            {inviteAllMutation.isPending ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Users className="w-3 h-3 mr-1" />
            )}
            전체 초대
          </Button>
        )}
      </div>

      {/* Discussion Panel (55%) */}
      <ScrollArea className="flex-1" style={{ borderTop: "1px solid var(--dc-border-subtle)" }}>
        <div className="p-4 space-y-3">
          {(!roomDetail.messages || roomDetail.messages.length === 0) && (
            <div className="text-center py-12" style={{ color: "var(--dc-text-muted)" }}>
              <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">아직 발언이 없습니다</p>
              <p className="text-xs mt-1">에이전트를 초대하고 토론을 시작하세요</p>
            </div>
          )}
          {roomDetail.messages?.map((msg, idx) => {
            const isUser = msg.agentId === "user";
            const agent = !isUser ? agents.find(a => a.id === msg.agentId) : null;

            // Check if sender changed for a subtle divider
            const prevMsg = idx > 0 ? roomDetail.messages[idx - 1] : null;
            const senderChanged = prevMsg && prevMsg.agentId !== msg.agentId;

            return (
              <div key={msg.id}>
                {senderChanged && (
                  <div className="flex items-center gap-3 py-1">
                    <div className="flex-1 h-px" style={{ background: "var(--dc-border-subtle)" }} />
                    <span className="text-[9px]" style={{ color: "var(--dc-text-muted)" }}>
                      {new Date(msg.createdAt).toLocaleTimeString("ko-KR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <div className="flex-1 h-px" style={{ background: "var(--dc-border-subtle)" }} />
                  </div>
                )}

                <motion.div
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  {/* Agent avatar */}
                  {!isUser && (
                    <div className="shrink-0 mr-3 mt-0.5">
                      <div
                        className="w-8 h-8 rounded-full overflow-hidden border-2"
                        style={{ borderColor: agent?.color || "#5865F2" }}
                      >
                        <img
                          src={agent ? getCharacterImage(agent) : `/characters/${msg.agentRole || "general"}.png`}
                          alt={msg.agentName || ""}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}

                  <div className={`max-w-[75%] ${isUser ? "text-right" : "text-left"}`}>
                    <div className={`flex items-center gap-2 mb-1 ${isUser ? "justify-end" : ""}`}>
                      {isUser ? (
                        <span className="text-xs font-semibold" style={{ color: "#5865F2" }}>
                          사용자
                        </span>
                      ) : (
                        <>
                          <span
                            className="text-xs font-semibold"
                            style={{ color: agent?.color || "#5865F2" }}
                          >
                            {msg.agentName || `에이전트 #${msg.agentId}`}
                          </span>
                          {msg.agentRole && (
                            <span className="text-[10px]" style={{ color: "var(--dc-text-muted)" }}>
                              {roleLabels[msg.agentRole] || msg.agentRole}
                            </span>
                          )}
                        </>
                      )}
                      {!senderChanged && (
                        <span className="text-[10px]" style={{ color: "var(--dc-text-muted)" }}>
                          {new Date(msg.createdAt).toLocaleTimeString("ko-KR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>

                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm inline-block leading-relaxed ${
                        isUser ? "rounded-br-md" : "rounded-bl-md"
                      }`}
                      style={{
                        background: isUser ? "var(--dc-blurple)" : "var(--dc-bg-secondary)",
                        color: isUser ? "#fff" : "var(--dc-text-primary)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        textAlign: "left",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>

                  {/* User avatar */}
                  {isUser && (
                    <div className="shrink-0 ml-3 mt-0.5">
                      <div
                        className="w-8 h-8 rounded-full overflow-hidden border-2 flex items-center justify-center"
                        style={{ borderColor: "#5865F2", background: "var(--dc-blurple)" }}
                      >
                        <User className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>
            );
          })}

          {/* Typing indicator when discussion is pending */}
          {discussMutation.isPending && (
            <motion.div
              className="flex items-center gap-3 py-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Participant avatars (up to 3) */}
              <div className="flex -space-x-2">
                {participantAgents.slice(0, 3).map(p => (
                  <div
                    key={p.agentId}
                    className="w-6 h-6 rounded-full overflow-hidden border-2"
                    style={{
                      borderColor: "var(--dc-bg-main)",
                    }}
                  >
                    <img
                      src={p.agent ? getCharacterImage(p.agent) : `/characters/${p.agentRole || "general"}.png`}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
              {/* Pulsing dots */}
              <div className="flex items-center gap-1">
                {[0, 1, 2].map(i => (
                  <motion.span
                    key={i}
                    className="w-2 h-2 rounded-full"
                    style={{ background: "var(--dc-text-muted)" }}
                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
              <span className="text-xs" style={{ color: "var(--dc-text-muted)" }}>
                토론 진행 중...
              </span>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Bottom controls — unified input */}
      {isActive && (
        <div
          className="px-4 py-3 shrink-0"
          style={{ borderTop: "1px solid var(--dc-border-subtle)" }}
        >
          {/* Tab buttons */}
          <div className="flex items-center gap-1 mb-2">
            <button
              className="px-3 py-1 rounded-md text-xs font-medium transition-colors"
              style={{
                background: inputMode === "chat" ? "var(--dc-blurple)" : "var(--dc-bg-tertiary)",
                color: inputMode === "chat" ? "#fff" : "var(--dc-text-secondary)",
              }}
              onClick={() => setInputMode("chat")}
            >
              <MessageCircle className="w-3 h-3 inline mr-1" />
              메시지
            </button>
            <button
              className="px-3 py-1 rounded-md text-xs font-medium transition-colors"
              style={{
                background: inputMode === "discuss" ? "#23a559" : "var(--dc-bg-tertiary)",
                color: inputMode === "discuss" ? "#fff" : "var(--dc-text-secondary)",
              }}
              onClick={() => setInputMode("discuss")}
            >
              <Target className="w-3 h-3 inline mr-1" />
              토론
            </button>

            {/* Round selector for discuss mode */}
            {inputMode === "discuss" && (
              <div className="flex items-center gap-1 ml-2">
                <span className="text-[10px]" style={{ color: "var(--dc-text-muted)" }}>라운드:</span>
                <Select value={rounds} onValueChange={setRounds}>
                  <SelectTrigger
                    className="border-none text-[11px] h-7 w-[55px]"
                    style={{ background: "var(--dc-bg-input)", color: "var(--dc-text-primary)" }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Unified input */}
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-1.5"
            style={{
              background: "var(--dc-bg-input)",
              border: "1px solid var(--dc-border-subtle)",
            }}
          >
            <Input
              placeholder={
                inputMode === "chat"
                  ? "사용자 메시지 입력... (회의에 직접 참여)"
                  : "토론 주제 입력..."
              }
              className="bg-transparent border-none text-sm h-9 px-0 focus-visible:ring-0"
              style={{ color: "var(--dc-text-primary)" }}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") handleSend();
              }}
            />
            <Button
              size="icon"
              className="w-8 h-8 shrink-0 rounded-lg"
              style={{
                background: inputMode === "chat" ? "var(--dc-blurple)" : "#23a559",
                color: "#fff",
              }}
              onClick={handleSend}
              disabled={
                !inputText.trim() ||
                (inputMode === "chat" && userMessageMutation.isPending) ||
                (inputMode === "discuss" && (discussMutation.isPending || roomDetail.participants.length < 2))
              }
            >
              {inputMode === "chat" ? (
                userMessageMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )
              ) : (
                discussMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Empty Seat sub-component ─── */
function EmptySeat({
  x,
  y,
  size,
  availableAgents,
  onInvite,
}: {
  x: number;
  y: number;
  size: number;
  availableAgents: Agent[];
  onInvite: (agentId: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <motion.button
          className="absolute flex flex-col items-center gap-1 cursor-pointer"
          style={{
            left: x,
            top: y,
            transform: "translate(-50%, -50%)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          whileHover={{ scale: 1.1 }}
        >
          <div
            className="rounded-full flex items-center justify-center"
            style={{
              width: size,
              height: size,
              border: "2px dashed var(--dc-border-strong)",
              background: "rgba(0,0,0,0.02)",
            }}
          >
            <Plus style={{ width: size * 0.4, height: size * 0.4, color: "var(--dc-text-muted)" }} />
          </div>
          <span
            className="text-[9px]"
            style={{ color: "var(--dc-text-muted)" }}
          >
            초대
          </span>
        </motion.button>
      </PopoverTrigger>
      <PopoverContent
        className="w-48 p-1"
        style={{
          background: "var(--dc-bg-main)",
          border: "1px solid var(--dc-border-subtle)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        }}
      >
        <div className="max-h-48 overflow-y-auto">
          {availableAgents.map(a => (
            <button
              key={a.id}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors"
              style={{ color: "var(--dc-text-primary)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--dc-bg-modifier-hover)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              onClick={() => onInvite(String(a.id))}
            >
              <img
                src={getCharacterImage(a)}
                alt={a.name}
                className="w-6 h-6 rounded-full object-cover"
              />
              <span className="flex-1 truncate">{a.name}</span>
              <Badge
                className="text-[8px] px-1 py-0 h-3.5 border-none"
                style={{
                  backgroundColor: `${roleColors[a.role] || a.color}20`,
                  color: roleColors[a.role] || a.color,
                }}
              >
                {roleLabels[a.role] || a.role}
              </Badge>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
