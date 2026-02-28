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
  Plus,
  UserPlus,
  UserMinus,
  Play,
  Square,
  MessageCircle,
  DoorOpen,
} from "lucide-react";
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

const roleLabels: Record<string, string> = {
  frontend: "프론트엔드",
  backend: "백엔드",
  testing: "테스팅",
  general: "일반",
};

export default function MeetingRoom({ agents }: { agents: Agent[] }) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomTopic, setNewRoomTopic] = useState("");
  const [discussTopic, setDiscussTopic] = useState("");
  const [inviteAgentId, setInviteAgentId] = useState<string>("");
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: rooms = [] } = useQuery<MeetingRoomType[]>({
    queryKey: ["/api/meetings"],
    refetchInterval: 5000,
  });

  const { data: roomDetail } = useQuery<MeetingRoomDetail>({
    queryKey: ["/api/meetings", selectedRoomId],
    enabled: !!selectedRoomId,
    refetchInterval: 3000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [roomDetail?.messages?.length]);

  const createRoomMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/meetings", {
        name: newRoomName,
        topic: newRoomTopic || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      setNewRoomName("");
      setNewRoomTopic("");
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (agentId: string) => {
      await apiRequest("POST", `/api/meetings/${selectedRoomId}/invite`, { agentId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings", selectedRoomId] });
      setInviteAgentId("");
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (agentId: string) => {
      await apiRequest("DELETE", `/api/meetings/${selectedRoomId}/participants/${agentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings", selectedRoomId] });
    },
  });

  const discussMutation = useMutation({
    mutationFn: async (topic: string) => {
      await apiRequest("POST", `/api/meetings/${selectedRoomId}/discuss`, { topic });
    },
    onSuccess: () => {
      setDiscussTopic("");
    },
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/meetings/${selectedRoomId}/close`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings", selectedRoomId] });
    },
  });

  if (selectedRoomId && roomDetail) {
    const participantAgentIds = new Set(roomDetail.participants.map((p) => p.agentId));
    const availableAgents = agents.filter((a) => !participantAgentIds.has(a.id));
    const isActive = roomDetail.status === "active";

    return (
      <div data-testid="meeting-room-detail" className="h-full flex flex-col">
        <div className="px-3 py-2 flex items-center gap-2 shrink-0" style={{ borderBottom: "1px solid var(--dc-border-subtle)" }}>
          <Button
            data-testid="button-back-to-rooms"
            size="icon"
            variant="ghost"
            onClick={() => setSelectedRoomId(null)}
            style={{ color: "var(--dc-text-muted)" }}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold truncate" style={{ color: "var(--dc-text-primary)" }} data-testid="text-room-name">
              {roomDetail.name}
            </h3>
            {roomDetail.topic && (
              <p className="text-[10px] truncate" style={{ color: "var(--dc-text-muted)" }}>{roomDetail.topic}</p>
            )}
          </div>
          <Badge
            data-testid="badge-room-status"
            className="border-none"
            style={{
              backgroundColor: isActive ? "rgba(35,165,89,0.15)" : "rgba(128,128,128,0.15)",
              color: isActive ? "#23a559" : "var(--dc-text-muted)",
            }}
          >
            {isActive ? "진행 중" : "종료"}
          </Badge>
        </div>

        <div className="px-3 py-2 shrink-0" style={{ borderBottom: "1px solid var(--dc-border-subtle)" }}>
          <div className="flex items-center gap-1 mb-2 flex-wrap">
            <span className="text-[10px] mr-1" style={{ color: "var(--dc-text-muted)" }}>참가자:</span>
            {roomDetail.participants.map((p) => (
              <div
                key={p.id}
                data-testid={`badge-participant-${p.agentId}`}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px]"
                style={{ background: "var(--dc-bg-tertiary)" }}
              >
                <img
                  src={`/characters/${p.agentRole || "general"}.png`}
                  alt={p.agentName || ""}
                  className="w-4 h-4 rounded-full inline-block object-cover"
                />
                <span style={{ color: "var(--dc-text-primary)" }}>{p.agentName || `#${p.agentId}`}</span>
                {isActive && (
                  <button
                    data-testid={`button-remove-participant-${p.agentId}`}
                    className="ml-0.5 transition-colors"
                    style={{ color: "var(--dc-text-muted)" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--dc-red)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--dc-text-muted)")}
                    onClick={() => removeMutation.mutate(p.agentId)}
                  >
                    <UserMinus className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {isActive && availableAgents.length > 0 && (
            <div className="flex gap-1.5">
              <Select value={inviteAgentId} onValueChange={setInviteAgentId}>
                <SelectTrigger
                  data-testid="select-invite-agent"
                  className="border-none text-xs h-7 flex-1"
                  style={{ background: "var(--dc-bg-input)", color: "var(--dc-text-primary)" }}
                >
                  <SelectValue placeholder="에이전트 선택..." />
                </SelectTrigger>
                <SelectContent>
                  {availableAgents.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.name} ({roleLabels[a.role] || a.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                data-testid="button-invite-agent"
                size="sm"
                className="text-xs h-7"
                style={{ background: "#5865F2", color: "#fff" }}
                onClick={() => inviteAgentId && inviteMutation.mutate(inviteAgentId)}
                disabled={!inviteAgentId || inviteMutation.isPending}
              >
                <UserPlus className="w-3 h-3 mr-1" />
                초대
              </Button>
            </div>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {(!roomDetail.messages || roomDetail.messages.length === 0) && (
              <div className="text-center text-xs py-8" style={{ color: "var(--dc-text-muted)" }}>
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                아직 발언이 없습니다
              </div>
            )}
            {roomDetail.messages?.map((msg) => {
              const agent = agents.find((a) => a.id === msg.agentId);
              return (
                <div
                  key={msg.id}
                  data-testid={`message-${msg.id}`}
                  className="rounded-xl p-2.5"
                  style={{ background: "var(--dc-bg-secondary)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <img
                      src={`/characters/${msg.agentRole || "general"}.png`}
                      alt={msg.agentName || ""}
                      className="w-5 h-5 rounded-full inline-block shrink-0 object-cover"
                    />
                    <span className="text-xs font-semibold" style={{ color: "var(--dc-text-primary)" }}>
                      {msg.agentName || `에이전트 #${msg.agentId}`}
                    </span>
                    {msg.agentRole && (
                      <span className="text-[10px]" style={{ color: "var(--dc-text-muted)" }}>
                        {roleLabels[msg.agentRole] || msg.agentRole}
                      </span>
                    )}
                    <span className="text-[10px] ml-auto" style={{ color: "var(--dc-text-muted)" }}>
                      {new Date(msg.createdAt).toLocaleTimeString("ko-KR")}
                    </span>
                  </div>
                  <div className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: "var(--dc-text-secondary)" }}>
                    {msg.content}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {isActive && (
          <div className="px-3 py-2 shrink-0 space-y-2" style={{ borderTop: "1px solid var(--dc-border-subtle)" }}>
            <div className="flex gap-1.5">
              <Input
                data-testid="input-discuss-topic"
                placeholder="토론 주제 입력..."
                className="border-none text-xs h-8"
                style={{ background: "var(--dc-bg-input)", color: "var(--dc-text-primary)" }}
                value={discussTopic}
                onChange={(e) => setDiscussTopic(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  discussTopic.trim() &&
                  discussMutation.mutate(discussTopic)
                }
              />
              <Button
                data-testid="button-start-discuss"
                size="sm"
                className="text-xs h-8"
                style={{ background: "#23a559", color: "#fff" }}
                onClick={() =>
                  discussTopic.trim() && discussMutation.mutate(discussTopic)
                }
                disabled={
                  !discussTopic.trim() ||
                  discussMutation.isPending ||
                  roomDetail.participants.length < 2
                }
              >
                <Play className="w-3 h-3 mr-1" />
                {discussMutation.isPending ? "진행 중..." : "토론 시작"}
              </Button>
            </div>
            <Button
              data-testid="button-close-meeting"
              size="sm"
              variant="destructive"
              className="w-full text-xs"
              onClick={() => closeMutation.mutate()}
              disabled={closeMutation.isPending}
            >
              <Square className="w-3 h-3 mr-1" />
              회의 종료
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div data-testid="meeting-room-list" className="h-full flex flex-col">
      <div className="px-4 py-3 flex items-center gap-2 shrink-0" style={{ borderBottom: "1px solid var(--dc-border-subtle)" }}>
        <DoorOpen className="w-4 h-4" style={{ color: "#5865F2" }} />
        <span className="text-sm font-semibold" style={{ color: "var(--dc-text-primary)" }}>회의실</span>
      </div>

      <div className="px-3 py-2 shrink-0 space-y-2" style={{ borderBottom: "1px solid var(--dc-border-subtle)" }}>
        <Input
          data-testid="input-room-name"
          placeholder="회의실 이름"
          className="border-none text-xs"
          style={{ background: "var(--dc-bg-input)", color: "var(--dc-text-primary)" }}
          value={newRoomName}
          onChange={(e) => setNewRoomName(e.target.value)}
        />
        <Input
          data-testid="input-room-topic"
          placeholder="주제 (선택사항)"
          className="border-none text-xs"
          style={{ background: "var(--dc-bg-input)", color: "var(--dc-text-primary)" }}
          value={newRoomTopic}
          onChange={(e) => setNewRoomTopic(e.target.value)}
        />
        <Button
          data-testid="button-create-room"
          size="sm"
          className="w-full text-xs"
          style={{ background: "#5865F2", color: "#fff" }}
          onClick={() => createRoomMutation.mutate()}
          disabled={!newRoomName.trim() || createRoomMutation.isPending}
        >
          <Plus className="w-3 h-3 mr-1" />
          {createRoomMutation.isPending ? "생성 중..." : "회의실 생성"}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {rooms.length === 0 && (
            <div className="text-center text-xs py-8" style={{ color: "var(--dc-text-muted)" }}>
              <DoorOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
              회의실이 없습니다
            </div>
          )}
          {rooms.map((room) => (
            <button
              key={room.id}
              data-testid={`button-room-${room.id}`}
              className="w-full text-left rounded-xl p-3 hover-elevate cursor-pointer"
              style={{ background: "var(--dc-bg-secondary)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
              onClick={() => setSelectedRoomId(room.id)}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-semibold truncate" style={{ color: "var(--dc-text-primary)" }}>
                  {room.name}
                </span>
                <Badge
                  className="border-none"
                  style={{
                    backgroundColor: room.status === "active" ? "rgba(35,165,89,0.15)" : "rgba(128,128,128,0.15)",
                    color: room.status === "active" ? "#23a559" : "var(--dc-text-muted)",
                  }}
                >
                  {room.status === "active" ? "진행 중" : "종료"}
                </Badge>
              </div>
              {room.topic && (
                <p className="text-[10px] truncate" style={{ color: "var(--dc-text-muted)" }}>{room.topic}</p>
              )}
              <p className="text-[10px] mt-1" style={{ color: "var(--dc-text-muted)" }}>
                {new Date(room.createdAt).toLocaleDateString("ko-KR")}
              </p>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
