import { useState, useEffect, Suspense } from "react";
import type { Agent } from "@shared/schema";

interface Scene3DProps {
  agents: Agent[];
  selectedAgentId: number | null;
  onSelectAgent: (id: number) => void;
}

const roleLabels: Record<string, string> = {
  frontend: "프론트엔드",
  backend: "백엔드",
  testing: "테스팅",
  general: "일반",
};

const statusLabels: Record<string, string> = {
  idle: "대기 중",
  working: "작업 중",
  paused: "일시정지",
};

const avatarEmojis: Record<string, string> = {
  cat: "🐱",
  dog: "🐶",
  pig: "🐷",
  rabbit: "🐰",
  bear: "🐻",
  fox: "🦊",
};

function AgentCard({ agent, selected, onClick }: { agent: Agent; selected: boolean; onClick: () => void }) {
  return (
    <div
      data-testid={`agent-card-${agent.id}`}
      onClick={onClick}
      className="flex flex-col items-center cursor-pointer transition-all duration-300 group"
      style={{ minWidth: "140px" }}
    >
      <div
        className="relative mb-2 transition-transform duration-300 group-hover:scale-105"
        style={{
          filter: selected ? "drop-shadow(0 0 20px rgba(88, 101, 242, 0.6))" : "none",
        }}
      >
        <div
          className="rounded-2xl p-3 text-center transition-all duration-300"
          style={{
            background: selected
              ? "linear-gradient(135deg, rgba(88,101,242,0.3), rgba(87,242,135,0.2))"
              : "linear-gradient(135deg, rgba(64,68,75,0.8), rgba(44,47,51,0.9))",
            border: selected ? `2px solid ${agent.color}` : "2px solid transparent",
            boxShadow: agent.status === "working" ? `0 0 15px ${agent.color}40` : "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          <div className="text-5xl mb-1 transition-transform duration-500" style={{
            animation: agent.status === "working" ? "bounce 1s infinite" : "none",
          }}>
            {avatarEmojis[agent.avatarType] || "🤖"}
          </div>

          <div className="relative w-16 h-8 mx-auto mb-1">
            <div className="absolute inset-0 rounded bg-[#1a1b26] border border-[#333]">
              <div
                className="absolute inset-[2px] rounded-sm"
                style={{
                  backgroundColor: agent.status === "working" ? "#0d1117" : "#111",
                  boxShadow: agent.status === "working" ? `inset 0 0 8px ${agent.color}30` : "none",
                }}
              >
                {agent.status === "working" && (
                  <div className="flex items-center justify-center h-full gap-[1px]">
                    {[0, 1, 2, 3].map(i => (
                      <div
                        key={i}
                        className="w-[2px] bg-[#57F287] rounded-full"
                        style={{
                          animation: `codeType 0.6s ease-in-out ${i * 0.1}s infinite`,
                          height: "4px",
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className="rounded-xl px-3 py-2 text-center transition-all duration-300"
        style={{
          background: selected ? "rgba(88, 101, 242, 0.95)" : "rgba(64, 68, 75, 0.9)",
          border: selected ? "1px solid #5865F2" : "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          backdropFilter: "blur(10px)",
          minWidth: "110px",
        }}
      >
        <div className="font-bold text-white text-sm" data-testid={`text-agent-name-${agent.id}`}>
          {agent.name}
        </div>
        <div className="text-[10px] mt-0.5" style={{ color: agent.color }}>
          {roleLabels[agent.role] || agent.role}
        </div>
        <div className="flex items-center justify-center gap-1 mt-1 text-[10px]" style={{
          color: agent.status === "working" ? "#FEE75C" : "#57F287",
        }}>
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: agent.status === "working" ? "#FEE75C" : agent.status === "idle" ? "#57F287" : "#aaa",
              animation: agent.status === "working" ? "pulse 1s infinite" : "none",
            }}
          />
          {statusLabels[agent.status] || agent.status}
        </div>
        {agent.currentFile && (
          <div className="text-[9px] text-gray-400 mt-1 truncate max-w-[100px]">
            {agent.currentFile}
          </div>
        )}
      </div>
    </div>
  );
}

let Canvas3D: any = null;

function Scene3DWithWebGL({ agents, selectedAgentId, onSelectAgent }: Scene3DProps) {
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      setWebglAvailable(!!gl);
    } catch {
      setWebglAvailable(false);
    }
  }, []);

  if (webglAvailable === null) return null;
  if (!webglAvailable) return null;

  return null;
}

export default function Scene3D({ agents, selectedAgentId, onSelectAgent }: Scene3DProps) {
  return (
    <div
      data-testid="scene-3d"
      className="w-full h-full relative flex items-end justify-center pb-8"
      style={{
        background: "linear-gradient(180deg, #1a1b26 0%, #2C2F33 40%, #23272A 100%)",
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at 50% 80%, rgba(88,101,242,0.08) 0%, transparent 60%)",
        }}
      />

      <div className="absolute bottom-0 left-0 right-0 h-[60px]" style={{
        background: "linear-gradient(180deg, transparent, rgba(26,27,38,0.8))",
      }} />

      <div className="absolute top-4 left-0 right-0 text-center">
        <h2 className="text-gray-500 text-xs tracking-widest uppercase" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Virtual Workspace
        </h2>
      </div>

      <div className="relative z-10 flex items-end gap-6 flex-wrap justify-center px-4">
        {agents.map(agent => (
          <AgentCard
            key={agent.id}
            agent={agent}
            selected={selectedAgentId === agent.id}
            onClick={() => onSelectAgent(agent.id)}
          />
        ))}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes codeType {
          0%, 100% { height: 2px; }
          50% { height: 6px; }
        }
      `}</style>
    </div>
  );
}
