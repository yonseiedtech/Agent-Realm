import { roleLabels, getCharacterImage } from "@/lib/constants";
import type { Agent } from "@shared/schema";

interface AgentListItemProps {
  agent: Agent;
  selected: boolean;
  onClick: () => void;
}

export default function AgentListItem({ agent, selected, onClick }: AgentListItemProps) {
  const isWorking = agent.status === "working";

  return (
    <button
      onClick={onClick}
      data-testid={`agent-list-item-${agent.id}`}
      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors group"
      style={{
        background: selected
          ? "var(--dc-bg-modifier-active)"
          : "transparent",
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = "var(--dc-bg-modifier-hover)";
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = "transparent";
      }}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <div
          className="w-8 h-8 rounded-full overflow-hidden border-2"
          style={{ borderColor: agent.color }}
        >
          <img
            src={getCharacterImage(agent)}
            alt={agent.name}
            className="w-full h-full object-cover"
          />
        </div>
        {/* Status dot */}
        <div
          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
          style={{
            borderColor: "var(--dc-bg-sidebar)",
            backgroundColor: isWorking ? "#FEE75C" : "#57F287",
          }}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 text-left">
        <div
          className="text-sm font-medium truncate"
          style={{ color: "var(--dc-text-primary)" }}
        >
          {agent.name}
        </div>
        <div
          className="text-[11px] truncate"
          style={{ color: agent.color }}
        >
          {roleLabels[agent.role] || agent.role}
        </div>
      </div>

      {/* Working indicator */}
      {isWorking && (
        <div className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-[#FEE75C]/15 text-[#FEE75C]">
          작업 중
        </div>
      )}
    </button>
  );
}
