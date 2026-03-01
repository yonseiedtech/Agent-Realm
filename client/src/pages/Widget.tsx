import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { getCharacterImage } from "@/lib/constants";
import type { Agent } from "@shared/schema";

// Base sizes (before scale)
const BASE_CHAR_W = 64;
const BASE_CHAR_H = 70;
const GAP = 4;
const PAD_X = 4;
const NAME_H = 14;
const MIN_SCALE = 0.6;
const MAX_SCALE = 1.6;
const SCALE_STEP = 0.1;

function calcSize(count: number, scale: number) {
  const charW = Math.round(BASE_CHAR_W * scale);
  const n = Math.max(count, 1);
  const w = PAD_X * 2 + n * charW + (n - 1) * GAP;
  const h = Math.round((BASE_CHAR_H + NAME_H) * scale) + 8;
  return { w: Math.max(w, 80), h };
}

export default function Widget() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [scale, setScale] = useState(() => {
    return window.electronAPI?.getWidgetScale?.() ?? 1.0;
  });
  const prevCount = useRef(0);
  const prevScale = useRef(scale);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await fetch("/api/agents");
        if (res.ok) setAgents(await res.json());
      } catch {}
    };
    fetchAgents();
    const interval = setInterval(fetchAgents, 3000);
    return () => clearInterval(interval);
  }, []);

  // Resize widget window when agent count or scale changes
  useEffect(() => {
    if (agents.length !== prevCount.current || scale !== prevScale.current) {
      prevCount.current = agents.length;
      prevScale.current = scale;
      const { w, h } = calcSize(agents.length, scale);
      window.electronAPI?.resizeWidget?.(w, h);
    }
  }, [agents.length, scale]);

  const handleRestore = () => {
    window.electronAPI?.restoreFromWidget();
  };

  const handleAgentClick = (agentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.electronAPI?.restoreFromWidget(agentId);
  };

  // Mouse wheel to resize
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setScale((prev) => {
      const next = e.deltaY < 0
        ? Math.min(MAX_SCALE, prev + SCALE_STEP)
        : Math.max(MIN_SCALE, prev - SCALE_STEP);
      const rounded = Math.round(next * 10) / 10;
      window.electronAPI?.setWidgetScale?.(rounded);
      return rounded;
    });
  }, []);

  const charW = Math.round(BASE_CHAR_W * scale);
  const charH = Math.round(BASE_CHAR_H * scale);

  return (
    <div
      onClick={handleRestore}
      onWheel={handleWheel}
      style={{
        width: "100%",
        height: "100%",
        background: "transparent",
        display: "flex",
        flexDirection: "row" as const,
        alignItems: "flex-end",
        justifyContent: "center",
        gap: GAP,
        padding: `0 ${PAD_X}px`,
        cursor: "pointer",
        // @ts-ignore
        WebkitAppRegion: "drag",
        userSelect: "none" as const,
        overflow: "hidden",
      }}
    >
      {agents.length === 0 && (
        <div
          style={{
            fontSize: 11,
            color: "rgba(0,0,0,0.5)",
            textAlign: "center",
            width: "100%",
            paddingBottom: 30,
            textShadow: "0 1px 2px rgba(255,255,255,0.8)",
          }}
        >
          에이전트 없음
        </div>
      )}
      {agents.map((agent) => {
        const isWorking = agent.status === "working";
        const isHovered = hoveredId === agent.id;

        return (
          <motion.div
            key={agent.id}
            onClick={(e) => handleAgentClick(agent.id, e)}
            onMouseEnter={() => setHoveredId(agent.id)}
            onMouseLeave={() => setHoveredId(null)}
            animate={{
              scale: isHovered ? 1.12 : 1,
              y: isHovered ? -6 : 0,
            }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 22,
            }}
            style={{
              display: "flex",
              flexDirection: "column" as const,
              alignItems: "center",
              // @ts-ignore
              WebkitAppRegion: "no-drag",
              width: charW,
              flexShrink: 0,
              position: "relative",
            }}
          >
            {/* Character image — full body, no circular crop */}
            <motion.div
              style={{
                position: "relative",
                filter: isHovered
                  ? `drop-shadow(0 4px 12px ${agent.color || "#5865F2"}60)`
                  : "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
                transition: "filter 0.2s ease",
              }}
              animate={
                isWorking && !isHovered
                  ? { y: [0, -3, 0], rotate: [0, 1, -1, 0] }
                  : {}
              }
              transition={
                isWorking && !isHovered
                  ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
                  : {}
              }
            >
              <img
                src={getCharacterImage(agent)}
                alt={agent.name}
                style={{
                  width: charW,
                  height: charH,
                  objectFit: "contain" as const,
                }}
              />
            </motion.div>

            {/* Name label */}
            <div
              style={{
                fontSize: Math.round(8 * scale),
                fontWeight: 700,
                color: "#1a1a1a",
                lineHeight: 1.1,
                textAlign: "center" as const,
                whiteSpace: "nowrap" as const,
                overflow: "hidden",
                textOverflow: "ellipsis",
                width: "100%",
                textShadow: "0 0 4px rgba(255,255,255,0.9)",
                marginTop: 1,
              }}
            >
              {agent.name}
            </div>

            {/* Status indicator */}
            <motion.div
              style={{
                position: "absolute" as const,
                top: 0,
                right: Math.round(4 * scale),
                width: Math.round(8 * scale),
                height: Math.round(8 * scale),
                borderRadius: "50%",
                background: isWorking
                  ? "linear-gradient(135deg, #f0a020, #ff6b6b)"
                  : "linear-gradient(135deg, #23a559, #57F287)",
                border: "1.5px solid rgba(255,255,255,0.9)",
                boxShadow: isWorking
                  ? "0 0 6px rgba(240,160,32,0.6)"
                  : "0 0 4px rgba(35,165,89,0.4)",
              }}
              animate={
                isWorking
                  ? { scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }
                  : {}
              }
              transition={
                isWorking
                  ? { duration: 1.5, repeat: Infinity }
                  : {}
              }
            />
          </motion.div>
        );
      })}
    </div>
  );
}
