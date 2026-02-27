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

  const getAgentName = (id: number) => {
    const agent = agents.find(a => a.id === id);
    return agent?.name || `에이전트 #${id}`;
  };

  const getAgentImage = (id: number) => {
    const agent = agents.find(a => a.id === id);
    const role = agent?.role || "general";
    return `/characters/${role}.png`;
  };

  const sorted = [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <div data-testid="agent-chat-panel" className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-[#40444B] flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-[#5865F2]" />
        <span className="text-sm font-semibold text-white">에이전트 간 대화</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {sorted.length === 0 && (
            <div className="text-center text-gray-500 text-xs py-8">
              에이전트 간 대화가 아직 없습니다
            </div>
          )}
          {sorted.map((msg) => (
            <div key={msg.id} className="rounded-lg bg-[#36393F] p-3">
              <div className="flex items-center gap-2 mb-1">
                <img src={getAgentImage(msg.fromAgentId)} alt="" className="w-5 h-5 rounded-full object-cover" />
                <span className="text-xs font-semibold text-white">{getAgentName(msg.fromAgentId)}</span>
                <span className="text-xs text-gray-500">→</span>
                <span className="text-xs text-gray-400">
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
              <div className="text-xs text-gray-300 whitespace-pre-wrap">{msg.content}</div>
              <div className="text-[10px] text-gray-600 mt-1">
                {new Date(msg.createdAt).toLocaleTimeString("ko-KR")}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
