interface WorkflowNodeProps {
  id: string;
  description: string;
  agentId: string | null;
  agentName?: string;
  agentRole?: string;
  status: string;
  x: number;
  y: number;
  selected?: boolean;
  onClick?: () => void;
}

const STATUS_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  pending: { bg: "#f3f4f6", border: "#d1d5db", icon: "⏳" },
  running: { bg: "#dbeafe", border: "#3b82f6", icon: "🔄" },
  completed: { bg: "#dcfce7", border: "#22c55e", icon: "✅" },
  failed: { bg: "#fee2e2", border: "#ef4444", icon: "❌" },
};

export default function WorkflowNode({
  description,
  agentName,
  agentRole,
  status,
  x,
  y,
  selected,
  onClick,
}: WorkflowNodeProps) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.pending;
  const nodeWidth = 160;
  const nodeHeight = 72;

  return (
    <g
      transform={`translate(${x - nodeWidth / 2}, ${y - nodeHeight / 2})`}
      onClick={onClick}
      style={{ cursor: "pointer" }}
    >
      <rect
        width={nodeWidth}
        height={nodeHeight}
        rx={8}
        fill={colors.bg}
        stroke={selected ? "#6366f1" : colors.border}
        strokeWidth={selected ? 2.5 : 1.5}
      />
      <text
        x={12}
        y={20}
        fontSize={12}
        fontWeight={600}
        fill="#1f2937"
      >
        {colors.icon} {description.length > 16 ? description.substring(0, 16) + "…" : description}
      </text>
      <text
        x={12}
        y={38}
        fontSize={10}
        fill="#6b7280"
      >
        {agentName || "미배정"} ({agentRole || "-"})
      </text>
      <text
        x={12}
        y={56}
        fontSize={10}
        fontWeight={500}
        fill={status === "completed" ? "#16a34a" : status === "failed" ? "#dc2626" : status === "running" ? "#2563eb" : "#9ca3af"}
      >
        {status === "pending" ? "대기" : status === "running" ? "진행 중" : status === "completed" ? "완료" : "실패"}
      </text>
    </g>
  );
}
