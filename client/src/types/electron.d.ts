export {};

declare global {
  interface Window {
    electronAPI?: {
      restoreFromWidget: (agentId?: string | null) => void;
      isWidget: () => boolean;
      resizeWidget: (width: number, height: number) => void;
      onNavigateToAgent: (callback: (agentId: string) => void) => void;
    };
  }
}
