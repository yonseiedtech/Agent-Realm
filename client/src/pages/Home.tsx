import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import LeftSidebar from "@/components/LeftSidebar";

import CenterPanel from "@/components/CenterPanel";
import DetailPanel from "@/components/DetailPanel";
import CommandPalette from "@/components/CommandPalette";
import MeetingCenterPanel from "@/components/MeetingCenterPanel";
import AgentChatPanel from "@/components/AgentChatPanel";
import WorkflowBoard from "@/components/workflow/WorkflowBoard";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useSound } from "@/hooks/useSound";
import { useTTS } from "@/hooks/useTTS";
import { useAppState } from "@/hooks/useAppState";
import { useAgentActions } from "@/hooks/useAgentActions";
import { soundManager } from "@/lib/sounds";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import type { Agent } from "@shared/schema";

export default function Home() {
  const {
    selectedAgentId,
    rightPanelOpen,
    activeMeetingRoomId,
    activeWorkflowView,
    chatPanelOpen,
    commandPaletteOpen,
    selectAgent,
    selectMeetingRoom,
    selectWorkflow,
    clearMeetingRoom,
    clearSelectedAgent,
    toggleRightPanel,
    closeRightPanel,
    toggleChatPanel,
    toggleCommandPalette,
    setCommandPaletteState,
    setChatPanelState,
  } = useAppState();

  const queryClient = useQueryClient();
  const { muted, toggleMute } = useSound();
  const { enabled: ttsEnabled, toggleTTS, speak } = useTTS();

  const { deleteAgent, broadcast, discuss, isBroadcasting, isDiscussing } =
    useAgentActions(clearSelectedAgent);

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

      if (event.type.startsWith("workflow_")) {
        queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
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
        case "workflow_completed":
          soundManager.taskCompleted();
          break;
        case "workflow_failed":
          soundManager.taskFailed();
          break;
      }
    },
    [queryClient, selectedAgentId, activeMeetingRoomId],
  );

  const { connected, reconnecting } = useWebSocket(onWsMessage);

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
    refetchInterval: 5000,
  });

  const handleTTSSpeak = useCallback(
    (text: string, role: string) => {
      speak(text, role);
    },
    [speak],
  );

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  // Workflow/Meeting views use full center area (no resizable panels)
  const isFullCenterView = activeWorkflowView || !!activeMeetingRoomId;

  return (
    <div
      className="h-screen overflow-hidden"
      style={{ background: "var(--dc-bg-darkest)" }}
    >
      <ResizablePanelGroup direction="horizontal">
        {/* Left sidebar panel */}
        <ResizablePanel defaultSize={18} minSize={13} maxSize={28}>
          <LeftSidebar
            agents={agents}
            selectedAgentId={selectedAgentId}
            onSelectAgent={selectAgent}
            connected={connected}
            reconnecting={reconnecting}
            muted={muted}
            toggleMute={toggleMute}
            ttsEnabled={ttsEnabled}
            toggleTTS={toggleTTS}
            onSelectMeetingRoom={selectMeetingRoom}
            activeMeetingRoomId={activeMeetingRoomId}
            onToggleChatPanel={toggleChatPanel}
            chatPanelOpen={chatPanelOpen}
            onSelectWorkflow={selectWorkflow}
            activeWorkflowView={activeWorkflowView}
          />
        </ResizablePanel>

        <ResizableHandle />

        {/* Center panel */}
        <ResizablePanel defaultSize={isFullCenterView || !rightPanelOpen || !selectedAgent ? 82 : 57}>
          {activeWorkflowView ? (
            <div className="h-full">
              <WorkflowBoard agents={agents} />
            </div>
          ) : activeMeetingRoomId ? (
            <MeetingCenterPanel
              roomId={activeMeetingRoomId}
              agents={agents}
              onBack={clearMeetingRoom}
            />
          ) : (
            <CenterPanel
              agents={agents}
              selectedAgentId={selectedAgentId}
              onDeleteAgent={deleteAgent}
              ttsEnabled={ttsEnabled}
              onTTSSpeak={handleTTSSpeak}
              rightPanelOpen={rightPanelOpen}
              onToggleRightPanel={toggleRightPanel}
            />
          )}
        </ResizablePanel>

        {/* Right detail panel — only in agent chat view */}
        {!isFullCenterView && rightPanelOpen && selectedAgent && (
          <>
            <ResizableHandle />
            <ResizablePanel defaultSize={25} minSize={18} maxSize={40}>
              <DetailPanel
                agent={selectedAgent}
                onClose={closeRightPanel}
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      <Dialog open={chatPanelOpen} onOpenChange={setChatPanelState}>
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

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteState(false)}
        onBroadcast={broadcast}
        onDiscuss={discuss}
        broadcastPending={isBroadcasting}
        discussPending={isDiscussing}
        disabled={agents.length === 0}
      />
    </div>
  );
}
