import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AgentMemory {
  id: string;
  agentId: string;
  type: string;
  content: string;
  metadata: string | null;
  importance: number;
  accessCount: number;
  lastAccessedAt: string | null;
  createdAt: string;
}

interface MemoryInspectorProps {
  agentId: string;
  agentName: string;
}

const TYPE_ICONS: Record<string, string> = {
  knowledge: "\ud83d\udcda",
  episode: "\ud83d\udcdd",
  preference: "\u2b50",
};

const TYPE_LABELS: Record<string, string> = {
  knowledge: "\uc9c0\uc2dd",
  episode: "\uc5d0\ud53c\uc18c\ub4dc",
  preference: "\uc120\ud638",
};

export default function MemoryInspector({ agentId, agentName }: MemoryInspectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeType, setActiveType] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: memories = [] } = useQuery<AgentMemory[]>({
    queryKey: ["/api/agents", agentId, "memories", activeType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeType) params.set("type", activeType);
      params.set("limit", "50");
      const res = await fetch(`/api/agents/${agentId}/memories?${params}`);
      return res.json();
    },
  });

  const { data: searchResults } = useQuery<AgentMemory[]>({
    queryKey: ["/api/agents", agentId, "memories", "search", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const res = await fetch(`/api/agents/${agentId}/memories/search?q=${encodeURIComponent(searchQuery)}&limit=10`);
      return res.json();
    },
    enabled: searchQuery.trim().length > 0,
  });

  const deleteMutation = useMutation({
    mutationFn: async (memId: string) => {
      await apiRequest("DELETE", `/api/agents/${agentId}/memories/${memId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", agentId, "memories"] });
    },
  });

  const displayMemories = searchQuery.trim() ? (searchResults || []) : memories;

  // Group by type
  const grouped: Record<string, AgentMemory[]> = {};
  for (const mem of displayMemories) {
    if (!grouped[mem.type]) grouped[mem.type] = [];
    grouped[mem.type].push(mem);
  }

  return (
    <div className="flex flex-col h-full text-sm">
      {/* Header */}
      <div className="px-3 py-2 border-b" style={{ borderColor: "var(--dc-border-subtle)" }}>
        <div className="text-xs font-semibold mb-2" style={{ color: "var(--dc-text-muted)" }}>
          {agentName}\uc758 \uba54\ubaa8\ub9ac
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="\uac80\uc0c9..."
          className="w-full text-xs px-2 py-1.5 rounded"
          style={{
            background: "var(--dc-bg-tertiary)",
            color: "var(--dc-text-primary)",
            border: "1px solid var(--dc-border-subtle)",
          }}
        />
        {/* Type filter */}
        <div className="flex gap-1 mt-2">
          <button
            onClick={() => setActiveType(null)}
            className="text-xs px-2 py-0.5 rounded"
            style={{
              background: activeType === null ? "var(--dc-accent)" : "var(--dc-bg-tertiary)",
              color: activeType === null ? "white" : "var(--dc-text-muted)",
            }}
          >
            \uc804\uccb4
          </button>
          {["knowledge", "episode", "preference"].map(t => (
            <button
              key={t}
              onClick={() => setActiveType(activeType === t ? null : t)}
              className="text-xs px-2 py-0.5 rounded"
              style={{
                background: activeType === t ? "var(--dc-accent)" : "var(--dc-bg-tertiary)",
                color: activeType === t ? "white" : "var(--dc-text-muted)",
              }}
            >
              {TYPE_ICONS[t]} {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Memory list */}
      <div className="flex-1 overflow-auto px-3 py-2">
        {Object.keys(grouped).length === 0 ? (
          <div className="text-xs text-center py-8" style={{ color: "var(--dc-text-muted)" }}>
            {searchQuery ? "\uac80\uc0c9 \uacb0\uacfc\uac00 \uc5c6\uc2b5\ub2c8\ub2e4" : "\uba54\ubaa8\ub9ac\uac00 \uc5c6\uc2b5\ub2c8\ub2e4"}
          </div>
        ) : (
          Object.entries(grouped).map(([type, mems]) => (
            <div key={type} className="mb-3">
              <div className="text-xs font-semibold mb-1" style={{ color: "var(--dc-text-muted)" }}>
                {TYPE_ICONS[type] || "\ud83d\udcc4"} {TYPE_LABELS[type] || type} ({mems.length})
              </div>
              {mems.map(mem => (
                <div
                  key={mem.id}
                  className="group flex items-start gap-2 px-2 py-1.5 rounded mb-1 hover:bg-opacity-50"
                  style={{ background: "var(--dc-bg-secondary)" }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs truncate" style={{ color: "var(--dc-text-primary)" }}>
                      {mem.content.substring(0, 120)}{mem.content.length > 120 ? "..." : ""}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--dc-text-muted)" }}>
                      \uc911\uc694\ub3c4: {mem.importance.toFixed(1)} \u00b7 \uc811\uadfc: {mem.accessCount}\ud68c \u00b7 {new Date(mem.createdAt).toLocaleDateString("ko-KR")}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(mem.id)}
                    className="hidden group-hover:block text-xs px-1 rounded"
                    style={{ color: "var(--dc-text-muted)" }}
                    title="\uc0ad\uc81c"
                  >
                    \u00d7
                  </button>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
