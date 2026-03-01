export {};

declare global {
  interface Window {
    electronAPI?: {
      restoreFromWidget: (agentId?: string | null) => void;
      isWidget: () => boolean;
      resizeWidget: (width: number, height: number) => void;
      setWidgetScale: (scale: number) => void;
      getWidgetScale: () => number;
      onNavigateToAgent: (callback: (agentId: string) => void) => void;
    };
  }
}
