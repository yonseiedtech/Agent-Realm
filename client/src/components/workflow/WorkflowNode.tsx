import { useState } from "react";

interface WorkflowNodeProps {
  id: string;
  description: string;
  agentId: string | null;
  agentName?: string;
  agentRole?: string;
  status: string;
  result?: string | null;
  x: number;
  y: number;
  selected?: boolean;
  onClick?: () => void;
  onRetry?: () => void;
}

const STATUS_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  pending: { bg: "#f3f4f6", border: "#d1d5db", icon: "\u23f3" },
  running: { bg: "#dbeafe", border: "#3b82f6", icon: "\ud83d\udd04" },
  completed: { bg: "#dcfce7", border: "#22c55e", icon: "\u2705" },
  failed: { bg: "#fee2e2", border: "#ef4444", icon: "\u274c" },
};

export default function WorkflowNode({
  description,
  agentName,
  agentRole,
  status,
  result,
  x,
  y,
  selected,
  onClick,
  onRetry,
}: WorkflowNodeProps) {
  const [hovered, setHovered] = useState(false);
  const colors = STATUS_COLORS[status] || STATUS_COLORS.pending;
  const nodeWidth = 160;
  const nodeHeight = 72;

  const tooltipText = [
    description,
    result ? `\n\uacb0\uacfc: ${result.substring(0, 100)}${result.length > 100 ? "..." : ""}` : "",
  ].join("");

  return (
    <g
      transform={`translate(${x - nodeWidth / 2}, ${y - nodeHeight / 2})`}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: "pointer" }}
    >
      <title>{tooltipText}</title>

      {/* Running glow pulse */}
      {status === "running" && (
        <rect
          width={nodeWidth + 6}
          height={nodeHeight + 6}
          x={-3}
          y={-3}
          rx={10}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
          opacity={0.4}
        >
          <animate attributeName="opacity" values="0.2;0.6;0.2" dur="1.5s" repeatCount="indefinite" />
          <animate attributeName="stroke-width" values="1;3;1" dur="1.5s" repeatCount="indefinite" />
        </rect>
      )}

      <rect
        width={nodeWidth}
        height={nodeHeight}
        rx={8}
        fill={colors.bg}
        stroke={hovered ? "#6366f1" : selected ? "#6366f1" : colors.border}
        strokeWidth={hovered || selected ? 2.5 : 1.5}
        style={{ transition: "stroke 0.15s, stroke-width 0.15s" }}
      />
      <text
        x={12}
        y={20}
        fontSize={12}
        fontWeight={600}
        fill="#1f2937"
      >
        {colors.icon} {description.length > 16 ? description.substring(0, 16) + "\u2026" : description}
      </text>
      <text
        x={12}
        y={38}
        fontSize={10}
        fill="#6b7280"
      >
        {agentName || "\ubbf8\ubc30\uc815"} ({agentRole || "-"})
      </text>
      <text
        x={12}
        y={56}
        fontSize={10}
        fontWeight={500}
        fill={status === "completed" ? "#16a34a" : status === "failed" ? "#dc2626" : status === "running" ? "#2563eb" : "#9ca3af"}
      >
        {status === "pending" ? "\ub300\uae30" : status === "running" ? "\uc9c4\ud589 \uc911" : status === "completed" ? "\uc644\ub8cc" : "\uc2e4\ud328"}
      </text>

      {/* Retry button for failed nodes */}
      {status === "failed" && onRetry && (
        <g
          transform={`translate(${nodeWidth - 24}, 4)`}
          onClick={(e) => {
            e.stopPropagation();
            onRetry();
          }}
          style={{ cursor: "pointer" }}
        >
          <title>{"\uc7ac\uc2e4\ud589"}</title>
          <rect width={18} height={18} rx={4} fill="#fecaca" stroke="#ef4444" strokeWidth={1} />
          <text x={4} y={13} fontSize={11} fill="#dc2626">{"\u21bb"}</text>
        </g>
      )}
    </g>
  );
}
