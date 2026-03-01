import { useEffect, useRef, useCallback, useState } from "react";

interface AgentEvent {
  type: string;
  data: any;
}

export function useWebSocket(onMessage?: (event: AgentEvent) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const hasConnectedOnce = useRef(false);

  const connect = useCallback(() => {
    if (hasConnectedOnce.current) {
      setReconnecting(true);
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      setConnected(true);
      setReconnecting(false);
      hasConnectedOnce.current = true;
    };
    ws.onclose = () => {
      setConnected(false);
      setTimeout(connect, 3000);
    };
    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as AgentEvent;
        onMessage?.(event);
      } catch {}
    };

    wsRef.current = ws;
  }, [onMessage]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected, reconnecting };
}
