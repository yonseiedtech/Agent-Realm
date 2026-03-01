import { useState, useCallback, useEffect } from "react";
import { soundManager } from "@/lib/sounds";

interface AppState {
  selectedAgentId: string | null;
  rightPanelOpen: boolean;
  activeMeetingRoomId: string | null;
  activeWorkflowView: boolean;
  chatPanelOpen: boolean;
  commandPaletteOpen: boolean;
}

export function useAppState() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [activeMeetingRoomId, setActiveMeetingRoomId] = useState<string | null>(null);
  const [activeWorkflowView, setActiveWorkflowView] = useState(false);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const selectAgent = useCallback((id: string) => {
    soundManager.uiClick();
    setSelectedAgentId(id);
    setActiveMeetingRoomId(null);
    setActiveWorkflowView(false);
  }, []);

  const selectMeetingRoom = useCallback((roomId: string) => {
    setActiveMeetingRoomId(roomId);
    setSelectedAgentId(null);
    setActiveWorkflowView(false);
  }, []);

  const selectWorkflow = useCallback(() => {
    setActiveWorkflowView(true);
    setActiveMeetingRoomId(null);
    setSelectedAgentId(null);
  }, []);

  const clearMeetingRoom = useCallback(() => {
    setActiveMeetingRoomId(null);
  }, []);

  const clearSelectedAgent = useCallback(() => {
    setSelectedAgentId(null);
  }, []);

  const toggleRightPanel = useCallback(() => {
    setRightPanelOpen((v) => !v);
  }, []);

  const closeRightPanel = useCallback(() => {
    setRightPanelOpen(false);
  }, []);

  const toggleChatPanel = useCallback(() => {
    setChatPanelOpen((v) => !v);
  }, []);

  const toggleCommandPalette = useCallback(() => {
    setCommandPaletteOpen((v) => !v);
  }, []);

  const setCommandPaletteState = useCallback((open: boolean) => {
    setCommandPaletteOpen(open);
  }, []);

  const setChatPanelState = useCallback((open: boolean) => {
    setChatPanelOpen(open);
  }, []);

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

  // Navigate to agent from Electron widget
  useEffect(() => {
    window.electronAPI?.onNavigateToAgent((agentId: string) => {
      setSelectedAgentId(agentId);
      setActiveMeetingRoomId(null);
    });
  }, []);

  return {
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
  };
}
