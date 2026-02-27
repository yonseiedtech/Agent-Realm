import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Scene3D from "@/components/Scene3D";
import AgentPanel from "@/components/AgentPanel";
import ActivityFeed from "@/components/ActivityFeed";
import AgentChatPanel from "@/components/AgentChatPanel";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Users, Wifi, WifiOff, Send, MessageSquare } from "lucide-react";
import type { Agent } from "@shared/schema";

export default function Home() {
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentRole, setNewAgentRole] = useState("general");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [broadcastInput, setBroadcastInput] = useState("");
  const [discussInput, setDiscussInput] = useState("");
  const queryClient = useQueryClient();

  const onWsMessage = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
    queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
    queryClient.invalidateQueries({ queryKey: ["/api/agent-messages"] });
  }, [queryClient]);

  const { connected } = useWebSocket(onWsMessage);

  const { data: agents = [], isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
    refetchInterval: 5000,
  });

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/agents", { name: newAgentName, role: newAgentRole });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      setNewAgentName("");
      setNewAgentRole("general");
      setDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/agents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      if (selectedAgentId) setSelectedAgentId(null);
    },
  });

  const broadcastMutation = useMutation({
    mutationFn: async (description: string) => {
      await apiRequest("POST", "/api/agents/broadcast", { description });
    },
    onSuccess: () => setBroadcastInput(""),
  });

  const discussMutation = useMutation({
    mutationFn: async (topic: string) => {
      await apiRequest("POST", "/api/agents/discuss", { topic });
    },
    onSuccess: () => setDiscussInput(""),
  });

  return (
    <div className="h-screen flex flex-col bg-[#2C2F33] overflow-hidden">
      <header className="flex items-center justify-between px-4 py-2 border-b border-[#40444B] bg-[#23272A] shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            🤖 AI 에이전트 팀
          </h1>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Users className="w-3.5 h-3.5" />
            <span data-testid="text-agent-count">{agents.length}명</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            {connected ? (
              <><Wifi className="w-3 h-3 text-[#57F287]" /><span className="text-[#57F287]">연결됨</span></>
            ) : (
              <><WifiOff className="w-3 h-3 text-red-400" /><span className="text-red-400">연결 끊김</span></>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-agent" size="sm" className="bg-[#5865F2] hover:bg-[#4752C4] text-white">
                <Plus className="w-4 h-4 mr-1" /> 에이전트 추가
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#2C2F33] border-[#40444B]">
              <DialogHeader>
                <DialogTitle className="text-white">새 에이전트 생성</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">이름</label>
                  <Input
                    data-testid="input-agent-name"
                    placeholder="에이전트 이름"
                    className="bg-[#40444B] border-none text-white"
                    value={newAgentName}
                    onChange={(e) => setNewAgentName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">역할</label>
                  <Select value={newAgentRole} onValueChange={setNewAgentRole}>
                    <SelectTrigger className="bg-[#40444B] border-none text-white" data-testid="select-new-role">
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
                <Button
                  data-testid="button-create-agent"
                  className="w-full bg-[#57F287] hover:bg-[#47d377] text-black font-semibold"
                  onClick={() => createMutation.mutate()}
                  disabled={!newAgentName.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? "생성 중..." : "에이전트 생성"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {selectedAgent && (
            <Button
              data-testid="button-remove-agent"
              size="sm"
              variant="destructive"
              onClick={() => { deleteMutation.mutate(selectedAgent.id); }}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="w-4 h-4 mr-1" /> 제거
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex-1 relative">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-gray-500">로딩 중...</div>
            ) : agents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
                <Users className="w-16 h-16 opacity-30" />
                <p className="text-lg">에이전트를 추가하여 시작하세요</p>
                <p className="text-sm text-gray-600">상단의 "에이전트 추가" 버튼을 클릭하세요</p>
              </div>
            ) : (
              <Scene3D
                agents={agents}
                selectedAgentId={selectedAgentId}
                onSelectAgent={setSelectedAgentId}
              />
            )}
          </div>

          {agents.length > 0 && (
            <div className="border-t border-[#40444B] bg-[#23272A] p-3 shrink-0">
              <div className="flex gap-2">
                <div className="flex-1 flex gap-2">
                  <Input
                    data-testid="input-broadcast"
                    placeholder="전체 에이전트에게 작업 지시..."
                    className="bg-[#40444B] border-none text-white placeholder:text-gray-500 text-sm"
                    value={broadcastInput}
                    onChange={(e) => setBroadcastInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && broadcastInput.trim() && broadcastMutation.mutate(broadcastInput)}
                  />
                  <Button
                    data-testid="button-broadcast"
                    size="sm"
                    className="bg-[#57F287] hover:bg-[#47d377] text-black"
                    onClick={() => broadcastInput.trim() && broadcastMutation.mutate(broadcastInput)}
                    disabled={broadcastMutation.isPending}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex-1 flex gap-2">
                  <Input
                    data-testid="input-discuss"
                    placeholder="에이전트 간 토론 주제..."
                    className="bg-[#40444B] border-none text-white placeholder:text-gray-500 text-sm"
                    value={discussInput}
                    onChange={(e) => setDiscussInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && discussInput.trim() && discussMutation.mutate(discussInput)}
                  />
                  <Button
                    data-testid="button-discuss"
                    size="sm"
                    className="bg-[#5865F2] hover:bg-[#4752C4] text-white"
                    onClick={() => discussInput.trim() && discussMutation.mutate(discussInput)}
                    disabled={discussMutation.isPending}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="w-[340px] shrink-0 border-l border-[#40444B] bg-[#2C2F33] flex flex-col">
          {selectedAgent ? (
            <AgentPanel agent={selectedAgent} onClose={() => setSelectedAgentId(null)} />
          ) : (
            <Tabs defaultValue="activity" className="flex flex-col h-full">
              <TabsList className="bg-[#23272A] border-b border-[#40444B] rounded-none h-10 shrink-0">
                <TabsTrigger value="activity" className="text-xs data-[state=active]:bg-[#40444B] data-[state=active]:text-white">
                  활동 피드
                </TabsTrigger>
                <TabsTrigger value="chat" className="text-xs data-[state=active]:bg-[#40444B] data-[state=active]:text-white">
                  에이전트 대화
                </TabsTrigger>
              </TabsList>
              <TabsContent value="activity" className="flex-1 mt-0 overflow-hidden">
                <ActivityFeed />
              </TabsContent>
              <TabsContent value="chat" className="flex-1 mt-0 overflow-hidden">
                <AgentChatPanel agents={agents} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
