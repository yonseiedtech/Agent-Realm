import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, X, Loader2, FileCode, MessageSquare } from "lucide-react";
import type { Agent, Task } from "@shared/schema";

interface AgentPanelProps {
  agent: Agent;
  onClose: () => void;
}

export default function AgentPanel({ agent, onClose }: AgentPanelProps) {
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const queryClient = useQueryClient();

  const { data: agentTasks = [] } = useQuery<Task[]>({
    queryKey: [`/api/agents/${agent.id}/tasks`],
    refetchInterval: 5000,
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", `/api/agents/${agent.id}/chat`, { message });
      return res.json();
    },
    onSuccess: (data) => {
      setChatHistory(prev => [...prev, { role: "assistant", content: data.response }]);
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (role: string) => {
      await apiRequest("PATCH", `/api/agents/${agent.id}`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
    },
  });

  const handleSend = () => {
    if (!chatInput.trim() || chatMutation.isPending) return;
    setChatHistory(prev => [...prev, { role: "user", content: chatInput }]);
    chatMutation.mutate(chatInput);
    setChatInput("");
  };

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

  return (
    <div data-testid={`agent-panel-${agent.id}`} className="flex flex-col h-full bg-[#2C2F33] border-l border-[#40444B]">
      <div className="flex items-center justify-between p-4 border-b border-[#40444B]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold" style={{ backgroundColor: agent.color }}>
            {agent.avatarType === "cat" ? "🐱" : agent.avatarType === "dog" ? "🐶" : agent.avatarType === "pig" ? "🐷" : agent.avatarType === "rabbit" ? "🐰" : agent.avatarType === "bear" ? "🐻" : "🦊"}
          </div>
          <div>
            <h3 className="font-bold text-white text-lg" data-testid={`text-agent-name-${agent.id}`}>{agent.name}</h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs" style={{ borderColor: agent.color, color: agent.color }}>
                {roleLabels[agent.role]}
              </Badge>
              <span className={`text-xs ${agent.status === "working" ? "text-[#FEE75C]" : "text-[#57F287]"}`}>
                {statusLabels[agent.status]}
              </span>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-panel">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="px-4 py-3 border-b border-[#40444B]">
        <label className="text-xs text-gray-400 mb-1 block">역할 변경</label>
        <Select value={agent.role} onValueChange={(v) => updateRoleMutation.mutate(v)}>
          <SelectTrigger className="bg-[#40444B] border-none text-white" data-testid="select-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="frontend">프론트엔드</SelectItem>
            <SelectItem value="backend">백엔드</SelectItem>
            <SelectItem value="testing">테스팅</SelectItem>
            <SelectItem value="general">일반</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {agent.currentFile && (
        <div className="px-4 py-2 border-b border-[#40444B] flex items-center gap-2 text-xs text-gray-400">
          <FileCode className="w-3 h-3" />
          <span className="truncate">{agent.currentFile}</span>
        </div>
      )}

      {agentTasks.length > 0 && (
        <div className="px-4 py-2 border-b border-[#40444B]">
          <div className="text-xs text-gray-400 mb-1">최근 작업</div>
          {agentTasks.slice(0, 3).map(task => (
            <div key={task.id} className="text-xs text-gray-300 flex items-center gap-1 py-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${task.status === "completed" ? "bg-[#57F287]" : task.status === "failed" ? "bg-red-500" : "bg-[#FEE75C]"}`} />
              <span className="truncate">{task.description}</span>
            </div>
          ))}
        </div>
      )}

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {chatHistory.length === 0 && (
            <div className="text-center text-gray-500 text-sm py-8">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              에이전트와 대화를 시작하세요
            </div>
          )}
          {chatHistory.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-[#5865F2] text-white"
                    : "bg-[#40444B] text-gray-200"
                }`}
                style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {chatMutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-[#40444B] rounded-xl px-3 py-2 text-sm text-gray-400 flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                생각 중...
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-[#40444B]">
        <div className="flex gap-2">
          <Input
            data-testid="input-chat"
            placeholder="메시지를 입력하세요..."
            className="bg-[#40444B] border-none text-white placeholder:text-gray-500"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={chatMutation.isPending}
          />
          <Button
            data-testid="button-send-chat"
            onClick={handleSend}
            disabled={!chatInput.trim() || chatMutation.isPending}
            className="bg-[#5865F2] hover:bg-[#4752C4]"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
