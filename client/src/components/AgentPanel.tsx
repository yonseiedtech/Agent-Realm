import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Send, X, Loader2, FileCode, MessageSquare, Settings, Trash2, Image } from "lucide-react";
import type { Agent, Task, ChatHistory } from "@shared/schema";

interface AgentPanelProps {
  agent: Agent;
  onClose: () => void;
}

export default function AgentPanel({ agent, onClose }: AgentPanelProps) {
  const [chatInput, setChatInput] = useState("");
  const [pendingImage, setPendingImage] = useState<{ base64: string; preview: string } | null>(null);
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt || "");
  const [model, setModel] = useState(agent.model);
  const [maxTokens, setMaxTokens] = useState(agent.maxTokens);
  const [temperature, setTemperature] = useState(parseFloat(agent.temperature));
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: chatHistoryData = [], isLoading: historyLoading } = useQuery<ChatHistory[]>({
    queryKey: ["/api/agents", agent.id, "history"],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${agent.id}/history`);
      if (!res.ok) throw new Error("Failed to load history");
      return res.json();
    },
  });

  const { data: agentTasks = [] } = useQuery<Task[]>({
    queryKey: [`/api/agents/${agent.id}/tasks`],
    refetchInterval: 5000,
  });

  useEffect(() => {
    setSystemPrompt(agent.systemPrompt || "");
    setModel(agent.model);
    setMaxTokens(agent.maxTokens);
    setTemperature(parseFloat(agent.temperature));
  }, [agent]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistoryData]);

  const chatMutation = useMutation({
    mutationFn: async ({ message, attachmentUrl }: { message: string; attachmentUrl?: string }) => {
      const res = await apiRequest("POST", `/api/agents/${agent.id}/chat`, { message, attachmentUrl });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", agent.id, "history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
    },
  });

  const clearHistoryMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/agents/${agent.id}/history`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", agent.id, "history"] });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: { systemPrompt?: string | null; model?: string; maxTokens?: number; temperature?: string }) => {
      await apiRequest("PATCH", `/api/agents/${agent.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (base64: string) => {
      const res = await apiRequest("POST", "/api/upload", { data: base64, filename: "paste.png" });
      return res.json();
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

  const handleSend = async () => {
    if ((!chatInput.trim() && !pendingImage) || chatMutation.isPending) return;
    let attachmentUrl: string | undefined;
    if (pendingImage) {
      try {
        const result = await uploadMutation.mutateAsync(pendingImage.base64);
        attachmentUrl = result.url;
      } catch {
        return;
      }
    }
    chatMutation.mutate({ message: chatInput || "(이미지 첨부)", attachmentUrl });
    setChatInput("");
    setPendingImage(null);
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1];
          setPendingImage({ base64, preview: result });
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  }, []);

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate({
      systemPrompt: systemPrompt.trim() || null,
      model,
      maxTokens,
      temperature: temperature.toString(),
    });
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

  const roleCharacterImages: Record<string, string> = {
    frontend: "/characters/frontend.png",
    backend: "/characters/backend.png",
    testing: "/characters/testing.png",
    general: "/characters/general.png",
  };

  const charImage = roleCharacterImages[agent.role] || "/characters/general.png";

  return (
    <div data-testid={`agent-panel-${agent.id}`} className="flex flex-col h-full bg-[#2C2F33] border-l border-[#40444B]">
      <div className="flex items-center justify-between p-4 border-b border-[#40444B]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2" style={{ borderColor: agent.color }}>
            <img src={charImage} alt={agent.name} className="w-full h-full object-cover" />
          </div>
          <div>
            <h3 className="font-bold text-white text-lg" data-testid={`text-agent-name-${agent.id}`}>{agent.name}</h3>
            <div className="flex items-center gap-2 flex-wrap">
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

      <Tabs defaultValue="chat" className="flex flex-col flex-1 min-h-0">
        <TabsList className="bg-[#23272A] border-b border-[#40444B] rounded-none h-9 shrink-0 mx-0">
          <TabsTrigger value="chat" className="text-xs data-[state=active]:bg-[#40444B] data-[state=active]:text-white" data-testid="tab-chat">
            <MessageSquare className="w-3 h-3 mr-1" />
            채팅
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-xs data-[state=active]:bg-[#40444B] data-[state=active]:text-white" data-testid="tab-settings">
            <Settings className="w-3 h-3 mr-1" />
            설정
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="flex-1 flex flex-col mt-0 min-h-0">
          <div className="px-4 py-2 border-b border-[#40444B] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Select value={agent.role} onValueChange={(v) => updateRoleMutation.mutate(v)}>
                <SelectTrigger className="bg-[#40444B] border-none text-white h-8 text-xs w-[120px]" data-testid="select-role">
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
              variant="ghost"
              size="sm"
              className="text-xs text-gray-400"
              onClick={() => clearHistoryMutation.mutate()}
              disabled={clearHistoryMutation.isPending}
              data-testid="button-clear-history"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              기록 초기화
            </Button>
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

          <ScrollArea className="flex-1" ref={scrollRef}>
            <div className="p-4 space-y-3">
              {historyLoading && (
                <div className="text-center text-gray-500 text-sm py-4">
                  <Loader2 className="w-5 h-5 mx-auto animate-spin mb-1" />
                  대화 기록 불러오는 중...
                </div>
              )}
              {!historyLoading && chatHistoryData.length === 0 && (
                <div className="text-center text-gray-500 text-sm py-8">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  에이전트와 대화를 시작하세요
                </div>
              )}
              {chatHistoryData.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-[#5865F2] text-white"
                        : "bg-[#40444B] text-gray-200"
                    }`}
                    style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                  >
                    {msg.attachmentUrl && (
                      <img
                        src={msg.attachmentUrl}
                        alt="첨부 이미지"
                        className="max-w-full rounded-md mb-2 max-h-48 object-contain"
                        data-testid={`img-attachment-${msg.id}`}
                      />
                    )}
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

          {pendingImage && (
            <div className="px-3 py-2 border-t border-[#40444B] flex items-center gap-2">
              <img src={pendingImage.preview} alt="미리보기" className="h-12 rounded-md object-contain" />
              <Button variant="ghost" size="icon" onClick={() => setPendingImage(null)} data-testid="button-remove-image">
                <X className="w-3 h-3" />
              </Button>
              <span className="text-xs text-gray-400">이미지 첨부됨</span>
            </div>
          )}

          <div className="p-3 border-t border-[#40444B]">
            <div className="flex gap-2">
              <Input
                data-testid="input-chat"
                placeholder="메시지를 입력하세요... (Ctrl+V로 이미지 붙여넣기)"
                className="bg-[#40444B] border-none text-white placeholder:text-gray-500"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                onPaste={handlePaste}
                disabled={chatMutation.isPending}
              />
              <Button
                data-testid="button-send-chat"
                onClick={handleSend}
                disabled={(!chatInput.trim() && !pendingImage) || chatMutation.isPending}
                className="bg-[#5865F2] hover:bg-[#4752C4]"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="flex-1 mt-0 overflow-auto">
          <div className="p-4 space-y-5">
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">시스템 프롬프트</label>
              <Textarea
                data-testid="input-system-prompt"
                placeholder="에이전트의 기본 시스템 프롬프트를 입력하세요..."
                className="bg-[#40444B] border-none text-white placeholder:text-gray-500 resize-none min-h-[100px]"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">모델</label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="bg-[#40444B] border-none text-white" data-testid="select-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude-sonnet-4-6">Claude Sonnet 4</SelectItem>
                  <SelectItem value="claude-haiku-4-5">Claude Haiku 4.5</SelectItem>
                  <SelectItem value="claude-opus-4-6">Claude Opus 4</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">최대 토큰: {maxTokens}</label>
              <Slider
                data-testid="slider-max-tokens"
                min={1024}
                max={8192}
                step={256}
                value={[maxTokens]}
                onValueChange={([v]) => setMaxTokens(v)}
                className="py-2"
              />
              <div className="flex justify-between text-[10px] text-gray-500">
                <span>1024</span>
                <span>8192</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Temperature: {temperature.toFixed(1)}</label>
              <Slider
                data-testid="slider-temperature"
                min={0}
                max={2}
                step={0.1}
                value={[temperature]}
                onValueChange={([v]) => setTemperature(v)}
                className="py-2"
              />
              <div className="flex justify-between text-[10px] text-gray-500">
                <span>0 (정확)</span>
                <span>2 (창의적)</span>
              </div>
            </div>

            <Button
              data-testid="button-save-settings"
              className="w-full bg-[#57F287] hover:bg-[#47d377] text-black font-semibold"
              onClick={handleSaveSettings}
              disabled={updateSettingsMutation.isPending}
            >
              {updateSettingsMutation.isPending ? "저장 중..." : "설정 저장"}
            </Button>

            {updateSettingsMutation.isSuccess && (
              <p className="text-xs text-[#57F287] text-center" data-testid="text-settings-saved">설정이 저장되었습니다</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
