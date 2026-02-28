import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { getCharacterImage, roleLabels } from "@/lib/constants";
import type { Agent } from "@shared/schema";

// Per-agent card width + gaps
const CARD_W = 56;
const GAP = 4;
const PAD_X = 12;
const HEADER_H = 28;
const CARD_H = 62;
const PAD_Y = 6;

function calcSize(count: number) {
  const n = Math.max(count, 1);
  const w = PAD_X * 2 + n * CARD_W + (n - 1) * GAP;
  const h = HEADER_H + CARD_H + PAD_Y * 2;
  return { w: Math.max(w, 160), h };
}

export default function Widget() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const prevCount = useRef(0);

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

  // Resize widget window when agent count changes
  useEffect(() => {
    if (agents.length !== prevCount.current) {
      prevCount.current = agents.length;
      const { w, h } = calcSize(agents.length);
      window.electronAPI?.resizeWidget?.(w, h);
    }
  }, [agents.length]);

  const handleRestore = () => {
    window.electronAPI?.restoreFromWidget();
  };

  const handleAgentClick = (agentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.electronAPI?.restoreFromWidget(agentId);
  };

  // Tilt state per agent
  const [tiltState, setTiltState] = useState<Record<string, { x: number; y: number }>>({});

  const handleItemMouseMove = useCallback(
    (agentId: string, e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      setTiltState((prev) => ({ ...prev, [agentId]: { x, y } }));
    },
    [],
  );

  const handleItemMouseLeave = useCallback((agentId: string) => {
    setHoveredId(null);
    setTiltState((prev) => ({ ...prev, [agentId]: { x: 0, y: 0 } }));
  }, []);

  const workingCount = agents.filter((a) => a.status === "working").length;

  return (
    <motion.div
      onClick={handleRestore}
      animate={{
        rotateX: [0, 0.8, 0, -0.8, 0],
        rotateY: [0, -0.5, 0, 0.5, 0],
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 16,
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.96) 0%, rgba(242,243,255,0.96) 100%)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(88,101,242,0.10)",
        boxShadow:
          "0 8px 28px rgba(0,0,0,0.10), 0 2px 6px rgba(88,101,242,0.06)",
        overflow: "hidden",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column" as const,
        // @ts-ignore
        WebkitAppRegion: "drag",
        userSelect: "none" as const,
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        perspective: "800px",
        transformStyle: "preserve-3d" as const,
        willChange: "transform",
      }}
    >
      {/* Header — compact */}
      <div
        style={{
          height: HEADER_H,
          padding: "0 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background:
                workingCount > 0
                  ? "linear-gradient(135deg, #f0a020, #ff6b6b)"
                  : "linear-gradient(135deg, #23a559, #57F287)",
              boxShadow:
                workingCount > 0
                  ? "0 0 6px rgba(240,160,32,0.5)"
                  : "0 0 6px rgba(35,165,89,0.5)",
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#2e3035",
              letterSpacing: "0.02em",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            Agent Realm
          </span>
        </div>
        <span
          style={{
            fontSize: 8,
            fontWeight: 600,
            color: "#6d6f78",
            background: "rgba(0,0,0,0.04)",
            padding: "1px 6px",
            borderRadius: 8,
          }}
        >
          {workingCount > 0 ? `${workingCount} 작업중` : "대기"}
        </span>
      </div>

      {/* Agent list — horizontal */}
      <div
        style={{
          flex: 1,
          padding: `0 ${PAD_X}px ${PAD_Y}px`,
          display: "flex",
          flexDirection: "row" as const,
          alignItems: "center",
          gap: GAP,
          overflowX: "auto" as const,
          overflowY: "hidden" as const,
        }}
      >
        {agents.length === 0 && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              color: "#6d6f78",
            }}
          >
            에이전트 없음
          </div>
        )}
        {agents.map((agent) => {
          const isWorking = agent.status === "working";
          const isHovered = hoveredId === agent.id;
          const tilt = tiltState[agent.id] || { x: 0, y: 0 };

          const shadowX = tilt.x * -3;
          const shadowY = tilt.y * -3;
          const hoverShadow = isHovered
            ? `${shadowX}px ${shadowY + 3}px 10px rgba(88,101,242,0.14), 0 1px 3px rgba(0,0,0,0.06)`
            : "none";

          return (
            <motion.div
              key={agent.id}
              onClick={(e) => handleAgentClick(agent.id, e)}
              onMouseEnter={() => setHoveredId(agent.id)}
              onMouseMove={(e) => handleItemMouseMove(agent.id, e)}
              onMouseLeave={() => handleItemMouseLeave(agent.id)}
              animate={{
                rotateY: tilt.x * 8,
                rotateX: -tilt.y * 5,
                scale: isHovered ? 1.06 : 1,
              }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 20,
              }}
              style={{
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "center",
                gap: 3,
                padding: "4px 2px",
                borderRadius: 12,
                background: isHovered
                  ? "rgba(88,101,242,0.06)"
                  : "transparent",
                transition: "background 0.15s ease",
                // @ts-ignore
                WebkitAppRegion: "no-drag",
                transformStyle: "preserve-3d" as const,
                perspective: "600px",
                boxShadow: hoverShadow,
                willChange: "transform",
                width: CARD_W,
                flexShrink: 0,
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  position: "relative",
                  transform: "translateZ(15px)",
                  transformStyle: "preserve-3d" as const,
                }}
              >
                <motion.img
                  src={getCharacterImage(agent)}
                  alt={agent.name}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    objectFit: "cover" as const,
                    border: `2px solid ${agent.color || "#5865F2"}`,
                  }}
                  animate={
                    isHovered
                      ? { scale: [1, 1.12, 1], rotate: [0, 6, -6, 0] }
                      : isWorking
                        ? { scale: [1, 1.04, 1] }
                        : {}
                  }
                  transition={
                    isHovered
                      ? { duration: 0.5, ease: "easeInOut" }
                      : isWorking
                        ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
                        : {}
                  }
                />
                {/* Status dot */}
                <motion.span
                  style={{
                    position: "absolute" as const,
                    bottom: -1,
                    right: -1,
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,0.95)",
                    background: isWorking ? "#f0a020" : "#23a559",
                    transform: "translateZ(25px)",
                  }}
                  animate={
                    isWorking
                      ? { scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }
                      : {}
                  }
                  transition={
                    isWorking
                      ? { duration: 1.5, repeat: Infinity }
                      : {}
                  }
                />
              </div>

              {/* Name */}
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: "#060607",
                  lineHeight: 1.1,
                  textAlign: "center" as const,
                  whiteSpace: "nowrap" as const,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  width: "100%",
                  transform: "translateZ(8px)",
                }}
              >
                {agent.name}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
