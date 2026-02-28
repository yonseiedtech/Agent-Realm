import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare } from "lucide-react";
import type { AgentMessage, Agent } from "@shared/schema";

interface AgentChatPanelProps {
  agents: Agent[];
}

const messageTypeLabels: Record<string, string> = {
  discussion: "토론",
  suggestion: "제안",
  request: "요청",
  response: "응답",
};

const messageTypeColors: Record<string, string> = {
  discussion: "#5865F2",
  suggestion: "#57F287",
  request: "#FEE75C",
  response: "#ED4245",
};

export default function AgentChatPanel({ agents }: AgentChatPanelProps) {
  const { data: messages = [] } = useQuery<AgentMessage[]>({
    queryKey: ["/api/agent-messages"],
    refetchInterval: 3000,
  });

  const getAgentName = (id: string) => {
    const agent = agents.find(a => a.id === id);
    return agent?.name || `에이전트 #${id}`;
  };

  const getAgentImage = (id: string) => {
    const agent = agents.find(a => a.id === id);
    const role = agent?.role || "general";
    return `/characters/${role}.png`;
  };

  const sorted = [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <div data-testid="agent-chat-panel" className="h-full flex flex-col">
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--dc-border-subtle)" }}>
        <MessageSquare className="w-4 h-4" style={{ color: "#5865F2" }} />
        <span className="text-sm font-semibold" style={{ color: "var(--dc-text-primary)" }}>에이전트 간 대화</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {sorted.length === 0 && (
            <div className="text-center text-xs py-8" style={{ color: "var(--dc-text-muted)" }}>
              에이전트 간 대화가 아직 없습니다
            </div>
          )}
          {sorted.map((msg) => (
            <div key={msg.id} className="rounded-xl p-3" style={{ background: "var(--dc-bg-secondary)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div className="flex items-center gap-2 mb-1">
                <img src={getAgentImage(msg.fromAgentId)} alt="" className="w-5 h-5 rounded-full object-cover" />
                <span className="text-xs font-semibold" style={{ color: "var(--dc-text-primary)" }}>{getAgentName(msg.fromAgentId)}</span>
                <span className="text-xs" style={{ color: "var(--dc-text-muted)" }}>→</span>
                <span className="text-xs" style={{ color: "var(--dc-text-secondary)" }}>
                  {msg.toAgentId ? getAgentName(msg.toAgentId) : "전체"}
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded ml-auto"
                  style={{
                    backgroundColor: `${messageTypeColors[msg.messageType]}20`,
                    color: messageTypeColors[msg.messageType],
                  }}
                >
                  {messageTypeLabels[msg.messageType] || msg.messageType}
                </span>
              </div>
              <div className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: "var(--dc-text-secondary)" }}>{msg.content}</div>
              <div className="text-[10px] mt-1" style={{ color: "var(--dc-text-muted)" }}>
                {new Date(msg.createdAt).toLocaleTimeString("ko-KR")}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
