interface WorkflowEdgeProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  completed?: boolean;
}

export default function WorkflowEdge({ fromX, fromY, toX, toY, completed }: WorkflowEdgeProps) {
  const color = completed ? "#22c55e" : "#d1d5db";
  // Curved path for better visual
  const midX = (fromX + toX) / 2;

  return (
    <g>
      <defs>
        <marker
          id={`arrow-${completed ? "green" : "gray"}`}
          viewBox="0 0 10 10"
          refX={10}
          refY={5}
          markerWidth={8}
          markerHeight={8}
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 Z" fill={color} />
        </marker>
      </defs>
      <path
        d={`M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        markerEnd={`url(#arrow-${completed ? "green" : "gray"})`}
      />
    </g>
  );
}
