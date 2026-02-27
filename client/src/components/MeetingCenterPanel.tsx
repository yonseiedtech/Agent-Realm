import { useState, useEffect, useRef } from "react";
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
  ArrowLeft,
  UserPlus,
  UserMinus,
  Users,
  Play,
  Square,
  MessageCircle,
  Send,
  Loader2,
  User,
} from "lucide-react";
import { roleLabels, getCharacterImage } from "@/lib/constants";
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

export default function MeetingCenterPanel({ roomId, agents, onBack }: MeetingCenterPanelProps) {
  const [discussTopic, setDiscussTopic] = useState("");
  const [rounds, setRounds] = useState("2");
  const [userMessage, setUserMessage] = useState("");
  const [inviteAgentId, setInviteAgentId] = useState("");
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: roomDetail } = useQuery<MeetingRoomDetail>({
    queryKey: ["/api/meetings", roomId],
    enabled: !!roomId,
    refetchInterval: 2000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [roomDetail?.messages?.length]);

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
      setDiscussTopic("");
    },
  });

  const userMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      await apiRequest("POST", `/api/meetings/${roomId}/user-message`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings", roomId] });
      setUserMessage("");
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
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 shrink-0"
            onClick={onBack}
          >
            <ArrowLeft className="w-4 h-4" style={{ color: "var(--dc-text-muted)" }} />
          </Button>
          <MessageCircle className="w-5 h-5 shrink-0" style={{ color: "#5865F2" }} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="text-sm font-semibold truncate"
                style={{ color: "var(--dc-text-primary)" }}
              >
                {roomDetail.name}
              </span>
              <Badge
                className="text-[10px] px-1.5 py-0 h-4 border-none shrink-0"
                style={{
                  backgroundColor: isActive ? "rgba(87,242,135,0.2)" : "rgba(128,128,128,0.2)",
                  color: isActive ? "#57F287" : "#999",
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
              className="text-[10px] h-7 px-2 text-red-400"
              onClick={() => closeMutation.mutate()}
              disabled={closeMutation.isPending}
            >
              <Square className="w-3 h-3 mr-1" />
              회의 종료
            </Button>
          )}
        </div>
      </div>

      {/* Participants bar */}
      <div
        className="px-4 py-2 shrink-0"
        style={{ borderBottom: "1px solid var(--dc-border-subtle)" }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] shrink-0" style={{ color: "var(--dc-text-muted)" }}>
            참가자:
          </span>
          {roomDetail.participants.map(p => {
            const agent = agents.find(a => a.id === p.agentId);
            return (
              <div
                key={p.id}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px]"
                style={{ background: "var(--dc-bg-modifier-hover)" }}
              >
                <img
                  src={agent ? getCharacterImage(agent) : `/characters/${p.agentRole || "general"}.png`}
                  alt={p.agentName || ""}
                  className="w-4 h-4 rounded-full inline-block object-cover"
                />
                <span style={{ color: "var(--dc-text-primary)" }}>{p.agentName || `#${p.agentId}`}</span>
                {isActive && (
                  <button
                    className="hover:text-red-400 ml-0.5"
                    style={{ color: "var(--dc-text-muted)" }}
                    onClick={() => removeMutation.mutate(p.agentId)}
                  >
                    <UserMinus className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            );
          })}

          {isActive && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px]"
                style={{ color: "#5865F2" }}
                onClick={() => inviteAllMutation.mutate()}
                disabled={inviteAllMutation.isPending || availableAgents.length === 0}
              >
                <Users className="w-3 h-3 mr-1" />
                전체 초대
              </Button>
              {availableAgents.length > 0 && (
                <div className="flex items-center gap-1">
                  <Select value={inviteAgentId} onValueChange={setInviteAgentId}>
                    <SelectTrigger
                      className="border-none text-white text-[10px] h-6 w-[120px]"
                      style={{ background: "var(--dc-bg-input)" }}
                    >
                      <SelectValue placeholder="에이전트 선택..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableAgents.map(a => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.name} ({roleLabels[a.role] || a.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    style={{ color: "#5865F2" }}
                    onClick={() => inviteAgentId && inviteMutation.mutate(inviteAgentId)}
                    disabled={!inviteAgentId || inviteMutation.isPending}
                  >
                    <UserPlus className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {(!roomDetail.messages || roomDetail.messages.length === 0) && (
            <div className="text-center py-12" style={{ color: "var(--dc-text-muted)" }}>
              <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">아직 발언이 없습니다</p>
              <p className="text-xs mt-1">에이전트를 초대하고 토론을 시작하세요</p>
            </div>
          )}
          {roomDetail.messages?.map(msg => {
            const isUser = msg.agentId === "user";
            const agent = !isUser ? agents.find(a => a.id === msg.agentId) : null;

            return (
              <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
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
                  {/* Header */}
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
                    <span className="text-[10px]" style={{ color: "var(--dc-text-muted)" }}>
                      {new Date(msg.createdAt).toLocaleTimeString("ko-KR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {/* Message bubble */}
                  <div
                    className="rounded-lg px-3.5 py-2 text-sm inline-block"
                    style={{
                      background: isUser ? "var(--dc-blurple)" : "var(--dc-bg-secondary)",
                      color: isUser ? "#fff" : "var(--dc-text-primary)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      textAlign: "left",
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
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Bottom controls */}
      {isActive && (
        <div
          className="px-4 py-3 shrink-0 space-y-2"
          style={{ borderTop: "1px solid var(--dc-border-subtle)" }}
        >
          {/* Discussion controls */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="토론 주제 입력..."
              className="bg-transparent border-none text-sm h-9 px-3 flex-1"
              style={{
                background: "var(--dc-bg-input)",
                color: "var(--dc-text-primary)",
              }}
              value={discussTopic}
              onChange={e => setDiscussTopic(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && discussTopic.trim() && !discussMutation.isPending) {
                  discussMutation.mutate({ topic: discussTopic, roundCount: parseInt(rounds) });
                }
              }}
            />
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px]" style={{ color: "var(--dc-text-muted)" }}>라운드:</span>
              <Select value={rounds} onValueChange={setRounds}>
                <SelectTrigger
                  className="border-none text-white text-[11px] h-9 w-[55px]"
                  style={{ background: "var(--dc-bg-input)" }}
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
            <Button
              size="sm"
              className="h-9 px-3 text-xs font-semibold shrink-0"
              style={{ background: "#57F287", color: "#000" }}
              onClick={() =>
                discussTopic.trim() &&
                discussMutation.mutate({ topic: discussTopic, roundCount: parseInt(rounds) })
              }
              disabled={
                !discussTopic.trim() ||
                discussMutation.isPending ||
                roomDetail.participants.length < 2
              }
            >
              {discussMutation.isPending ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Play className="w-3 h-3 mr-1" />
              )}
              {discussMutation.isPending ? "진행 중..." : "토론 시작"}
            </Button>
          </div>

          {/* User message input */}
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 flex-1"
              style={{ background: "var(--dc-bg-input)" }}
            >
              <Input
                placeholder="사용자 메시지 입력... (회의에 직접 참여)"
                className="bg-transparent border-none text-sm h-7 px-0 focus-visible:ring-0"
                style={{ color: "var(--dc-text-primary)" }}
                value={userMessage}
                onChange={e => setUserMessage(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && userMessage.trim() && !userMessageMutation.isPending) {
                    userMessageMutation.mutate(userMessage);
                  }
                }}
              />
              <Button
                size="icon"
                className="w-7 h-7 shrink-0"
                style={{ background: "var(--dc-blurple)", color: "#fff" }}
                onClick={() => userMessage.trim() && userMessageMutation.mutate(userMessage)}
                disabled={!userMessage.trim() || userMessageMutation.isPending}
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
