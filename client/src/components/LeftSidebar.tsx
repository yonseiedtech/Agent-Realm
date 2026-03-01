import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import AgentListItem from "@/components/AgentListItem";
import SettingsDialog from "@/components/SettingsDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Wifi,
  WifiOff,
  DoorOpen,
  MessageSquare,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  ChevronDown,
  ChevronRight,
  Trash2,
  Loader2,
} from "lucide-react";
import { soundManager } from "@/lib/sounds";
import type { Agent, MeetingRoom } from "@shared/schema";

interface LeftSidebarProps {
  agents: Agent[];
  selectedAgentId: string | null;
  onSelectAgent: (id: string) => void;
  connected: boolean;
  reconnecting?: boolean;
  muted: boolean;
  toggleMute: () => void;
  ttsEnabled: boolean;
  toggleTTS: () => void;
  onSelectMeetingRoom: (roomId: string) => void;
  activeMeetingRoomId: string | null;
  onToggleChatPanel: () => void;
  chatPanelOpen: boolean;
  onSelectWorkflow?: () => void;
  activeWorkflowView?: boolean;
}

export default function LeftSidebar({
  agents,
  selectedAgentId,
  onSelectAgent,
  connected,
  reconnecting,
  muted,
  toggleMute,
  ttsEnabled,
  toggleTTS,
  onSelectMeetingRoom,
  activeMeetingRoomId,
  onToggleChatPanel,
  chatPanelOpen,
  onSelectWorkflow,
  activeWorkflowView,
}: LeftSidebarProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentRole, setNewAgentRole] = useState("general");
  const [meetingSectionOpen, setMeetingSectionOpen] = useState(true);
  const [newRoomName, setNewRoomName] = useState("");
  const queryClient = useQueryClient();

  const { data: meetingRooms = [] } = useQuery<MeetingRoom[]>({
    queryKey: ["/api/meetings"],
    refetchInterval: 5000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/agents", {
        name: newAgentName,
        role: newAgentRole,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      setNewAgentName("");
      setNewAgentRole("general");
      setDialogOpen(false);
    },
  });

  const createRoomMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/meetings", { name: newRoomName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      setNewRoomName("");
    },
  });

  const deleteRoomMutation = useMutation({
    mutationFn: async (roomId: string) => {
      await apiRequest("DELETE", `/api/meetings/${roomId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
    },
  });

  return (
    <div
      className="w-full h-full flex flex-col"
      style={{
        background: "var(--dc-bg-sidebar)",
        borderRight: "1px solid var(--dc-border-subtle)",
      }}
    >
      {/* Header: Logo + Connection */}
      <div
        className="px-4 h-12 flex items-center justify-between shrink-0"
        style={{ borderBottom: "1px solid var(--dc-border-subtle)" }}
      >
        <div className="flex items-center gap-2">
          <h1
            className="text-sm font-bold"
            style={{
              color: "var(--dc-text-primary)",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            Agent Realm
          </h1>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{
              background: "var(--dc-bg-modifier-hover)",
              color: "var(--dc-text-muted)",
            }}
          >
            {agents.length}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px]">
          {reconnecting ? (
            <span className="flex items-center gap-1" style={{ color: "var(--dc-yellow, #FEE75C)" }}>
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-[9px]">재연결</span>
            </span>
          ) : connected ? (
            <Wifi className="w-3.5 h-3.5 text-[#57F287]" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-[#ED4245]" />
          )}
        </div>
      </div>

      {/* Agent list */}
      <div
        className="px-2 pt-3 pb-1"
        style={{ color: "var(--dc-text-muted)" }}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide px-2">
          에이전트 &mdash; {agents.length}
        </span>
      </div>

      <ScrollArea className="flex-1 px-2">
        <div className="space-y-0.5 pb-2">
          {agents.length === 0 && (
            <div className="px-2 py-6 text-center text-xs" style={{ color: "var(--dc-text-muted)" }}>
              에이전트가 없습니다
            </div>
          )}
          {agents.map((agent) => (
            <AgentListItem
              key={agent.id}
              agent={agent}
              selected={agent.id === selectedAgentId && !activeMeetingRoomId}
              onClick={() => onSelectAgent(agent.id)}
            />
          ))}
        </div>

        {/* Workflow button */}
        {onSelectWorkflow && (
          <div className="mt-3 px-2">
            <button
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-left text-xs font-medium"
              style={{
                background: activeWorkflowView ? "var(--dc-bg-active)" : "transparent",
                color: activeWorkflowView ? "var(--dc-text-primary)" : "var(--dc-text-secondary)",
              }}
              onClick={onSelectWorkflow}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="6" cy="6" r="3" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="12" cy="18" r="3" />
                <path d="M8.5 7.5L10.5 16" />
                <path d="M15.5 7.5L13.5 16" />
              </svg>
              워크플로우
            </button>
          </div>
        )}

        {/* Meeting rooms section */}
        <div className="mt-3 pb-2">
          <button
            className="flex items-center gap-1 px-2 py-1 w-full text-left"
            onClick={() => setMeetingSectionOpen(v => !v)}
          >
            {meetingSectionOpen ? (
              <ChevronDown className="w-3 h-3" style={{ color: "var(--dc-text-muted)" }} />
            ) : (
              <ChevronRight className="w-3 h-3" style={{ color: "var(--dc-text-muted)" }} />
            )}
            <span
              className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--dc-text-muted)" }}
            >
              회의실 &mdash; {meetingRooms.length}
            </span>
          </button>

          {meetingSectionOpen && (
            <div className="mt-1 space-y-0.5">
              {meetingRooms.map(room => (
                <div
                  key={room.id}
                  className="group flex items-center rounded-md transition-colors"
                  style={{
                    background: activeMeetingRoomId === room.id
                      ? "var(--dc-bg-modifier-selected)"
                      : "transparent",
                  }}
                  onMouseEnter={e => {
                    if (activeMeetingRoomId !== room.id)
                      (e.currentTarget as HTMLElement).style.background = "var(--dc-bg-modifier-hover)";
                  }}
                  onMouseLeave={e => {
                    if (activeMeetingRoomId !== room.id)
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  <button
                    className="flex-1 text-left flex items-center gap-2 px-2 py-1.5 cursor-pointer min-w-0"
                    onClick={() => {
                      soundManager.uiClick();
                      onSelectMeetingRoom(room.id);
                    }}
                  >
                    <DoorOpen
                      className="w-4 h-4 shrink-0"
                      style={{ color: room.status === "active" ? "#57F287" : "var(--dc-text-muted)" }}
                    />
                    <span
                      className="text-xs truncate flex-1"
                      style={{ color: "var(--dc-text-primary)" }}
                    >
                      {room.name}
                    </span>
                    <Badge
                      className="text-[8px] px-1 py-0 h-3.5 border-none shrink-0"
                      style={{
                        backgroundColor: room.status === "active" ? "rgba(87,242,135,0.15)" : "rgba(128,128,128,0.15)",
                        color: room.status === "active" ? "#57F287" : "#999",
                      }}
                    >
                      {room.status === "active" ? "진행" : "종료"}
                    </Badge>
                  </button>
                  <button
                    className="w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mr-1"
                    style={{ color: "var(--dc-text-muted)" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--dc-red)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--dc-text-muted)")}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteRoomMutation.mutate(room.id);
                    }}
                    title="회의실 삭제"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {/* Inline new room creation */}
              <div className="flex items-center gap-1 px-1 mt-1">
                <Input
                  placeholder="새 회의실..."
                  className="bg-transparent border-none text-[11px] h-7 px-2 focus-visible:ring-0"
                  style={{
                    background: "var(--dc-bg-input)",
                    color: "var(--dc-text-primary)",
                  }}
                  value={newRoomName}
                  onChange={e => setNewRoomName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && newRoomName.trim()) {
                      createRoomMutation.mutate();
                    }
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 shrink-0"
                  onClick={() => newRoomName.trim() && createRoomMutation.mutate()}
                  disabled={!newRoomName.trim() || createRoomMutation.isPending}
                >
                  <Plus className="w-3.5 h-3.5" style={{ color: "#5865F2" }} />
                </Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Bottom actions */}
      <div
        className="px-2 py-2 space-y-2 shrink-0"
        style={{ borderTop: "1px solid var(--dc-border-subtle)" }}
      >
        {/* Quick action buttons */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8"
              onClick={() => {
                soundManager.uiClick();
                onToggleChatPanel();
              }}
              title="에이전트 대화"
              data-testid="button-toggle-agent-chat"
            >
              <MessageSquare
                className={`w-4 h-4 ${chatPanelOpen ? "text-[#5865F2]" : "text-[var(--dc-text-muted)]"}`}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8"
              onClick={toggleMute}
              title={muted ? "소리 켜기" : "소리 끄기"}
              data-testid="button-toggle-mute"
            >
              {muted ? (
                <VolumeX className="w-4 h-4 text-[var(--dc-text-muted)]" />
              ) : (
                <Volume2 className="w-4 h-4 text-[var(--dc-text-muted)]" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8"
              onClick={toggleTTS}
              title={ttsEnabled ? "TTS 끄기" : "TTS 켜기"}
              data-testid="button-toggle-tts"
            >
              {ttsEnabled ? (
                <Mic className="w-4 h-4 text-[#FF79C6]" />
              ) : (
                <MicOff className="w-4 h-4 text-[var(--dc-text-muted)]" />
              )}
            </Button>
            <SettingsDialog />
          </div>
        </div>

        {/* Add agent button */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              data-testid="button-add-agent"
              className="w-full h-8 text-xs font-semibold"
              style={{
                background: "var(--dc-blurple)",
                color: "#fff",
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              에이전트 추가
            </Button>
          </DialogTrigger>
          <DialogContent
            style={{
              background: "var(--dc-bg-secondary)",
              border: "1px solid var(--dc-border-subtle)",
            }}
          >
            <DialogHeader>
              <DialogTitle style={{ color: "var(--dc-text-primary)" }}>
                새 에이전트 생성
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label
                  className="text-xs mb-1 block"
                  style={{ color: "var(--dc-text-muted)" }}
                >
                  이름
                </label>
                <Input
                  data-testid="input-agent-name"
                  placeholder="에이전트 이름"
                  className="border-none"
                  style={{ background: "var(--dc-bg-input)", color: "var(--dc-text-primary)" }}
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                />
              </div>
              <div>
                <label
                  className="text-xs mb-1 block"
                  style={{ color: "var(--dc-text-muted)" }}
                >
                  역할
                </label>
                <Select value={newAgentRole} onValueChange={setNewAgentRole}>
                  <SelectTrigger
                    className="border-none"
                    style={{ background: "var(--dc-bg-input)", color: "var(--dc-text-primary)" }}
                    data-testid="select-new-role"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pm">PM</SelectItem>
                    <SelectItem value="fullstack">풀스택</SelectItem>
                    <SelectItem value="designer">디자이너</SelectItem>
                    <SelectItem value="tester">테스터</SelectItem>
                    <SelectItem value="devops">DevOps</SelectItem>
                    <SelectItem value="general">일반</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                data-testid="button-create-agent"
                className="w-full font-semibold" style={{ background: "#23a559", color: "#fff" }}
                onClick={() => createMutation.mutate()}
                disabled={!newAgentName.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? "생성 중..." : "에이전트 생성"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
