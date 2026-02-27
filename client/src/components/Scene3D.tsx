import { useState, useEffect, useRef } from "react";
import type { Agent } from "@shared/schema";

interface Scene3DProps {
  agents: Agent[];
  selectedAgentId: string | null;
  onSelectAgent: (id: string) => void;
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

const roleCharacterImages: Record<string, { idle: string; working: string }> = {
  frontend: { idle: "/characters/frontend.png", working: "/characters/frontend_working.png" },
  backend: { idle: "/characters/backend.png", working: "/characters/backend_working.png" },
  testing: { idle: "/characters/testing.png", working: "/characters/testing_working.png" },
  general: { idle: "/characters/general.png", working: "/characters/general_working.png" },
};

const extraCharacterImages = [
  "/characters/char_extra1.png",
  "/characters/char_extra2.png",
];

function getCharacterImage(agent: Agent, index: number): string {
  const images = roleCharacterImages[agent.role];
  if (images) {
    return agent.status === "working" ? images.working : images.idle;
  }
  return extraCharacterImages[index % extraCharacterImages.length];
}

function getIdleImage(agent: Agent, index: number): string {
  const images = roleCharacterImages[agent.role];
  return images?.idle || extraCharacterImages[index % extraCharacterImages.length];
}

function TypingParticles({ color }: { color: string }) {
  return (
    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-20 h-6 pointer-events-none">
      {[0, 1, 2, 3, 4].map(i => (
        <span
          key={i}
          className="absolute rounded-full opacity-0"
          style={{
            width: "3px",
            height: "3px",
            backgroundColor: color,
            left: `${15 + i * 15}%`,
            bottom: "0px",
            animation: `typingParticle 1.5s ease-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function StatusIndicator({ status, color }: { status: string; color: string }) {
  if (status === "working") {
    return (
      <div className="flex items-center gap-1">
        <div className="flex gap-[2px]">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="inline-block w-[3px] rounded-full"
              style={{
                backgroundColor: "#FEE75C",
                animation: `typingDot 0.8s ease-in-out ${i * 0.15}s infinite`,
                height: "8px",
              }}
            />
          ))}
        </div>
        <span className="text-[10px] text-[#FEE75C] ml-1">코딩 중...</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{
          backgroundColor: status === "idle" ? "#57F287" : "#aaa",
          animation: status === "idle" ? "gentlePulse 3s ease-in-out infinite" : "none",
        }}
      />
      <span className="text-[10px]" style={{ color: status === "idle" ? "#57F287" : "#aaa" }}>
        {statusLabels[status] || status}
      </span>
    </div>
  );
}

function AgentCard({ agent, selected, onClick, index }: { agent: Agent; selected: boolean; onClick: () => void; index: number }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const isWorking = agent.status === "working";
  const currentImage = getCharacterImage(agent, index);
  const idleImage = getIdleImage(agent, index);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImageLoaded(true);
    img.src = currentImage;
    if (currentImage !== idleImage) {
      const preload = new Image();
      preload.src = idleImage;
    }
  }, [currentImage, idleImage]);

  return (
    <div
      data-testid={`agent-card-${agent.id}`}
      onClick={onClick}
      className="flex flex-col items-center cursor-pointer transition-all duration-300 group"
      style={{ minWidth: "160px" }}
    >
      <div
        className="relative mb-2 transition-transform duration-500 group-hover:scale-105"
        style={{
          filter: selected
            ? `drop-shadow(0 0 24px ${agent.color}80)`
            : isWorking
            ? `drop-shadow(0 0 12px ${agent.color}40)`
            : "none",
        }}
      >
        <div
          className="rounded-2xl overflow-hidden transition-all duration-500 relative"
          style={{
            background: selected
              ? `linear-gradient(135deg, ${agent.color}40, rgba(87,242,135,0.2))`
              : "linear-gradient(135deg, rgba(64,68,75,0.8), rgba(44,47,51,0.9))",
            border: selected ? `2px solid ${agent.color}` : isWorking ? `2px solid ${agent.color}60` : "2px solid transparent",
            boxShadow: isWorking
              ? `0 0 20px ${agent.color}30, 0 8px 32px rgba(0,0,0,0.4)`
              : "0 4px 16px rgba(0,0,0,0.3)",
            padding: "8px",
          }}
        >
          <div
            className="w-24 h-24 mx-auto rounded-xl overflow-hidden relative"
            style={{
              animation: isWorking ? "none" : "breathe 4s ease-in-out infinite",
            }}
          >
            <img
              src={currentImage}
              alt={agent.name}
              className="w-full h-full object-cover transition-all duration-700"
              style={{
                opacity: imageLoaded ? 1 : 0,
                transform: isWorking ? "scale(1.05)" : "scale(1)",
              }}
              data-testid={`img-agent-avatar-${agent.id}`}
              onLoad={() => setImageLoaded(true)}
            />

            {isWorking && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `linear-gradient(180deg, transparent 60%, ${agent.color}15 100%)`,
                  animation: "screenGlow 2s ease-in-out infinite",
                }}
              />
            )}
          </div>

          {isWorking && (
            <>
              <div className="relative w-20 h-5 mx-auto mt-2 rounded-sm overflow-hidden bg-[#0d1117] border border-[#333]">
                <div className="absolute inset-0 flex items-center px-1 gap-[1px]">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-[1px]"
                      style={{
                        width: `${3 + Math.random() * 8}px`,
                        height: "2px",
                        backgroundColor: agent.color,
                        opacity: 0,
                        animation: `codeStream 2s ease-in-out ${i * 0.12}s infinite`,
                      }}
                    />
                  ))}
                </div>
                <div
                  className="absolute top-0 left-0 h-full w-[2px]"
                  style={{
                    backgroundColor: "#57F287",
                    animation: "cursorBlink 1s step-end infinite",
                  }}
                />
              </div>
              <TypingParticles color={agent.color} />
            </>
          )}

          {!isWorking && (
            <div className="relative w-20 h-5 mx-auto mt-2 rounded-sm bg-[#111] border border-[#222]">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-[#333]"
                  style={{ animation: "gentlePulse 3s ease-in-out infinite" }}
                />
              </div>
            </div>
          )}
        </div>

        {isWorking && (
          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#FEE75C]"
            style={{ animation: "pulse 1.5s ease-in-out infinite", boxShadow: "0 0 8px #FEE75C80" }}
          />
        )}
      </div>

      <div
        className="rounded-xl px-3 py-2 text-center transition-all duration-300"
        style={{
          background: selected ? `${agent.color}F0` : "rgba(64, 68, 75, 0.9)",
          border: selected ? `1px solid ${agent.color}` : "1px solid rgba(255,255,255,0.08)",
          boxShadow: selected ? `0 4px 20px ${agent.color}40` : "0 4px 16px rgba(0,0,0,0.4)",
          backdropFilter: "blur(10px)",
          minWidth: "120px",
        }}
      >
        <div className="font-bold text-white text-sm" data-testid={`text-agent-name-${agent.id}`}>
          {agent.name}
        </div>
        <div className="text-[10px] mt-0.5" style={{ color: selected ? "rgba(255,255,255,0.8)" : agent.color }}>
          {roleLabels[agent.role] || agent.role}
        </div>
        <div className="flex items-center justify-center mt-1">
          <StatusIndicator status={agent.status} color={agent.color} />
        </div>
        {agent.currentFile && (
          <div className="text-[9px] text-gray-400 mt-1 truncate max-w-[110px] flex items-center gap-1">
            <span className="inline-block w-1 h-1 rounded-full bg-[#57F287]" />
            {agent.currentFile}
          </div>
        )}
      </div>
    </div>
  );
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

      <div className="absolute bottom-0 left-0 right-0 h-[80px]" style={{
        background: "linear-gradient(180deg, transparent, rgba(26,27,38,0.9))",
      }} />

      <div className="absolute top-4 left-0 right-0 text-center">
        <h2 className="text-gray-500 text-xs tracking-widest uppercase" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Virtual Workspace
        </h2>
      </div>

      <div className="relative z-10 flex items-end gap-8 flex-wrap justify-center px-4">
        {agents.map((agent, index) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            selected={selectedAgentId === agent.id}
            onClick={() => onSelectAgent(agent.id)}
            index={index}
          />
        ))}
      </div>

      <style>{`
        @keyframes breathe {
          0%, 100% { transform: scale(1) translateY(0); }
          50% { transform: scale(1.02) translateY(-2px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        @keyframes gentlePulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes typingDot {
          0%, 100% { height: 4px; opacity: 0.4; }
          50% { height: 10px; opacity: 1; }
        }
        @keyframes codeStream {
          0% { opacity: 0; transform: translateX(-4px); }
          20% { opacity: 0.8; }
          80% { opacity: 0.8; }
          100% { opacity: 0; transform: translateX(4px); }
        }
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes screenGlow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        @keyframes typingParticle {
          0% { opacity: 0; transform: translateY(0) scale(0.5); }
          30% { opacity: 0.8; transform: translateY(-8px) scale(1); }
          100% { opacity: 0; transform: translateY(-20px) scale(0.3); }
        }
        @keyframes codeType {
          0%, 100% { height: 2px; }
          50% { height: 6px; }
        }
      `}</style>
    </div>
  );
}
