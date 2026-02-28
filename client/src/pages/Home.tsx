import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AnimatePresence } from "framer-motion";
import LeftSidebar from "@/components/LeftSidebar";
import CenterPanel from "@/components/CenterPanel";
import DetailPanel from "@/components/DetailPanel";
import CommandPalette from "@/components/CommandPalette";
import MeetingCenterPanel from "@/components/MeetingCenterPanel";
import AgentChatPanel from "@/components/AgentChatPanel";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useSound } from "@/hooks/useSound";
import { useTTS } from "@/hooks/useTTS";
import { soundManager } from "@/lib/sounds";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import type { Agent } from "@shared/schema";

export default function Home() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [activeMeetingRoomId, setActiveMeetingRoomId] = useState<string | null>(null);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const queryClient = useQueryClient();
  const { muted, toggleMute } = useSound();
  const { enabled: ttsEnabled, toggleTTS, speak } = useTTS();

  const onWsMessage = useCallback(
    (event: { type: string; data: any }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent-messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });

      if (activeMeetingRoomId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/meetings", activeMeetingRoomId],
        });
      }

      if (selectedAgentId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/agents", selectedAgentId, "history"],
        });
      }

      switch (event.type) {
        case "agent_created":
          soundManager.agentCreated();
          break;
        case "agent_message":
          soundManager.messageReceived();
          break;
        case "task_update":
          if (event.data?.status === "completed") soundManager.taskCompleted();
          if (event.data?.status === "failed") soundManager.taskFailed();
          break;
        case "status_change":
          if (event.data?.status === "working") soundManager.notification();
          break;
      }
    },
    [queryClient, selectedAgentId, activeMeetingRoomId],
  );

  const { connected } = useWebSocket(onWsMessage);

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
    refetchInterval: 5000,
  });

  const createMutation = useMutation({
    mutationFn: async ({ name, role }: { name: string; role: string }) => {
      await apiRequest("POST", "/api/agents", { name, role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/agents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      setSelectedAgentId(null);
    },
  });

  const broadcastMutation = useMutation({
    mutationFn: async (description: string) => {
      soundManager.messageSent();
      await apiRequest("POST", "/api/agents/broadcast", { description });
    },
  });

  const discussMutation = useMutation({
    mutationFn: async (topic: string) => {
      soundManager.messageSent();
      await apiRequest("POST", "/api/agents/discuss", { topic });
    },
  });

  const handleSelectAgent = useCallback((id: string) => {
    soundManager.uiClick();
    setSelectedAgentId(id);
  }, []);

  const handleTTSSpeak = useCallback(
    (text: string, role: string) => {
      speak(text, role);
    },
    [speak],
  );

  // Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Navigate to agent from widget
  useEffect(() => {
    window.electronAPI?.onNavigateToAgent((agentId: string) => {
      setSelectedAgentId(agentId);
      setActiveMeetingRoomId(null);
    });
  }, []);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  return (
    <div
      className="h-screen flex overflow-hidden"
      style={{ background: "var(--dc-bg-darkest)" }}
    >
      {/* Left sidebar */}
      <LeftSidebar
        agents={agents}
        selectedAgentId={selectedAgentId}
        onSelectAgent={(id) => {
          handleSelectAgent(id);
          setActiveMeetingRoomId(null);
        }}
        connected={connected}
        muted={muted}
        toggleMute={toggleMute}
        ttsEnabled={ttsEnabled}
        toggleTTS={toggleTTS}
        onSelectMeetingRoom={(roomId) => {
          setActiveMeetingRoomId(roomId);
          setSelectedAgentId(null);
        }}
        activeMeetingRoomId={activeMeetingRoomId}
        onToggleChatPanel={() => setChatPanelOpen((v) => !v)}
        chatPanelOpen={chatPanelOpen}
      />

      {/* Center panel — Meeting or Agent chat */}
      {activeMeetingRoomId ? (
        <MeetingCenterPanel
          roomId={activeMeetingRoomId}
          agents={agents}
          onBack={() => setActiveMeetingRoomId(null)}
        />
      ) : (
        <>
          <CenterPanel
            agents={agents}
            selectedAgentId={selectedAgentId}
            onDeleteAgent={(id) => deleteMutation.mutate(id)}
            ttsEnabled={ttsEnabled}
            onTTSSpeak={handleTTSSpeak}
            rightPanelOpen={rightPanelOpen}
            onToggleRightPanel={() => setRightPanelOpen((v) => !v)}
          />

          {/* Right detail panel */}
          <AnimatePresence>
            {rightPanelOpen && selectedAgent && (
              <DetailPanel
                agent={selectedAgent}
                onClose={() => setRightPanelOpen(false)}
              />
            )}
          </AnimatePresence>
        </>
      )}

      {/* Agent chat dialog */}
      <Dialog open={chatPanelOpen} onOpenChange={setChatPanelOpen}>
        <DialogContent
          className="max-w-md h-[600px] p-0 overflow-hidden"
          style={{
            background: "var(--dc-bg-secondary)",
            border: "1px solid var(--dc-border-subtle)",
          }}
        >
          <AgentChatPanel agents={agents} />
        </DialogContent>
      </Dialog>

      {/* Command palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onBroadcast={(msg) => broadcastMutation.mutate(msg)}
        onDiscuss={(topic) => discussMutation.mutate(topic)}
        broadcastPending={broadcastMutation.isPending}
        discussPending={discussMutation.isPending}
        disabled={agents.length === 0}
      />
    </div>
  );
}
