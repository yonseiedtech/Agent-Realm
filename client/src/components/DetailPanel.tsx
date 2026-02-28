import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { motion } from "framer-motion";
import {
  roleLabels,
  statusLabels,
  getCharacterImage,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ListTodo,
  Settings,
  Zap,
  FileCode,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  X,
  RefreshCw,
} from "lucide-react";
import MemoryInspector from "@/components/memory/MemoryInspector";
import type { Agent, Task, ActivityLog, AgentMessage } from "@shared/schema";

interface DetailPanelProps {
  agent: Agent;
  onClose: () => void;
}

const actionIcons: Record<string, any> = {
  file_write: FileCode,
  task_assigned: Zap,
  task_completed: CheckCircle,
  task_failed: AlertCircle,
};

function formatTime(date: string | Date) {
  return new Date(date).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function DetailPanel({ agent, onClose }: DetailPanelProps) {
  const [systemPrompt, setSystemPrompt] = useState("");
  const [model, setModel] = useState("claude-sonnet-4-6");
  const [maxTokens, setMaxTokens] = useState(4096);
  const [temperature, setTemperature] = useState(1);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (agent) {
      setSystemPrompt(agent.systemPrompt || "");
      setModel(agent.model);
      setMaxTokens(agent.maxTokens);
      setTemperature(parseFloat(agent.temperature));
    }
  }, [
    agent?.id,
    agent?.systemPrompt,
    agent?.model,
    agent?.maxTokens,
    agent?.temperature,
  ]);

  const { data: agentTasks = [] } = useQuery<Task[]>({
    queryKey: [`/api/agents/${agent.id}/tasks`],
    refetchInterval: 5000,
    enabled: !!agent.id,
  });

  const { data: activities = [] } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activities"],
    refetchInterval: 5000,
  });

  const { data: agentMessages = [] } = useQuery<AgentMessage[]>({
    queryKey: ["/api/agent-messages"],
    refetchInterval: 5000,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: {
      systemPrompt?: string | null;
      model?: string;
      maxTokens?: number;
      temperature?: string;
    }) => {
      await apiRequest("PATCH", `/api/agents/${agent.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
    },
  });

  const generateAvatarMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/agents/${agent.id}/generate-avatar`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
    },
  });

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate({
      systemPrompt: systemPrompt.trim() || null,
      model,
      maxTokens,
      temperature: temperature.toString(),
    });
  };

  // Filter activities for this agent
  const agentActivities = [
    ...activities
      .filter((a) => a.agentId === agent.id)
      .map((a) => ({
        ...a,
        _type: "activity" as const,
        _time: new Date(a.createdAt).getTime(),
      })),
    ...agentMessages
      .filter((m) => m.fromAgentId === agent.id || m.toAgentId === agent.id)
      .map((m) => ({
        ...m,
        _type: "message" as const,
        _time: new Date(m.createdAt).getTime(),
      })),
  ].sort((a, b) => b._time - a._time);

  return (
    <motion.div
      initial={{ x: 320 }}
      animate={{ x: 0 }}
      exit={{ x: 320 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="w-[320px] h-full flex flex-col shrink-0"
      style={{
        background: "var(--dc-bg-secondary)",
        borderLeft: "1px solid var(--dc-border-subtle)",
      }}
    >
      {/* Agent card header */}
      <div
        className="px-4 py-4 flex flex-col items-center shrink-0 relative"
        style={{ borderBottom: "1px solid var(--dc-border-subtle)" }}
      >
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 w-6 h-6"
          onClick={onClose}
        >
          <X
            className="w-3.5 h-3.5"
            style={{ color: "var(--dc-text-muted)" }}
          />
        </Button>

        <div
          className="w-20 h-20 rounded-full overflow-hidden border-3 mb-3"
          style={{ borderColor: agent.color, borderWidth: "3px" }}
        >
          <img
            src={getCharacterImage(agent)}
            alt={agent.name}
            className="w-full h-full object-cover"
          />
        </div>
        <h3
          className="text-base font-bold"
          style={{ color: "var(--dc-text-primary)" }}
        >
          {agent.name}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          <Badge
            className="text-[10px] px-2 py-0.5 border-none"
            style={{
              backgroundColor: `${agent.color}20`,
              color: agent.color,
            }}
          >
            {roleLabels[agent.role] || agent.role}
          </Badge>
          <span
            className="text-[11px]"
            style={{
              color:
                agent.status === "working" ? "#FEE75C" : "#57F287",
            }}
          >
            {statusLabels[agent.status]}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tasks" className="flex flex-col flex-1 min-h-0">
        <TabsList
          className="bg-transparent rounded-none h-9 shrink-0 mx-0 px-2"
          style={{ borderBottom: "1px solid var(--dc-border-subtle)" }}
        >
          <TabsTrigger
            value="tasks"
            className="text-[11px] h-7 data-[state=active]:bg-[var(--dc-bg-modifier-active)] data-[state=active]:text-[var(--dc-text-primary)]"
          >
            <ListTodo className="w-3.5 h-3.5 mr-1" />
            작업
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="text-[11px] h-7 data-[state=active]:bg-[var(--dc-bg-modifier-active)] data-[state=active]:text-[var(--dc-text-primary)]"
          >
            <Settings className="w-3.5 h-3.5 mr-1" />
            설정
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            className="text-[11px] h-7 data-[state=active]:bg-[var(--dc-bg-modifier-active)] data-[state=active]:text-[var(--dc-text-primary)]"
          >
            <Zap className="w-3.5 h-3.5 mr-1" />
            활동
          </TabsTrigger>
          <TabsTrigger
            value="memory"
            className="text-[11px] h-7 data-[state=active]:bg-[var(--dc-bg-modifier-active)] data-[state=active]:text-[var(--dc-text-primary)]"
          >
            <MessageSquare className="w-3.5 h-3.5 mr-1" />
            메모리
          </TabsTrigger>
        </TabsList>

        {/* Tasks tab */}
        <TabsContent value="tasks" className="flex-1 mt-0 overflow-auto">
          <div className="p-3 space-y-2">
            {agentTasks.length === 0 && (
              <div
                className="text-center text-xs py-8"
                style={{ color: "var(--dc-text-muted)" }}
              >
                <ListTodo className="w-8 h-8 mx-auto mb-2 opacity-30" />
                할당된 작업이 없습니다
              </div>
            )}
            {agentTasks.map((task) => (
              <div
                key={task.id}
                className="p-2.5 rounded-lg"
                style={{
                  background: "var(--dc-bg-modifier-hover)",
                  border: "1px solid var(--dc-border-subtle)",
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      task.status === "completed"
                        ? "bg-[#57F287]"
                        : task.status === "failed"
                          ? "bg-red-500"
                          : task.status === "in-progress"
                            ? "bg-[#FEE75C]"
                            : "bg-gray-500"
                    }`}
                  />
                  <span
                    className="text-[10px] uppercase"
                    style={{ color: "var(--dc-text-muted)" }}
                  >
                    {task.status}
                  </span>
                </div>
                <p
                  className="text-xs"
                  style={{ color: "var(--dc-text-secondary)" }}
                >
                  {task.description}
                </p>
                {task.result && (
                  <p
                    className="text-[10px] mt-1 line-clamp-3"
                    style={{ color: "var(--dc-text-muted)" }}
                  >
                    {task.result}
                  </p>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Settings tab */}
        <TabsContent value="settings" className="flex-1 mt-0 overflow-auto">
          <div className="p-3 space-y-4">
            <div>
              <label
                className="text-[11px] mb-1 block"
                style={{ color: "var(--dc-text-muted)" }}
              >
                시스템 프롬프트
              </label>
              <Textarea
                placeholder="에이전트의 기본 시스템 프롬프트..."
                className="border-none placeholder:opacity-50 resize-none min-h-[80px] text-xs"
                style={{ background: "var(--dc-bg-input)", color: "var(--dc-text-primary)" }}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
              />
            </div>
            <div>
              <label
                className="text-[11px] mb-1 block"
                style={{ color: "var(--dc-text-muted)" }}
              >
                모델
              </label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger
                  className="border-none text-xs h-8"
                  style={{ background: "var(--dc-bg-input)", color: "var(--dc-text-primary)" }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude-sonnet-4-6">
                    Claude Sonnet 4
                  </SelectItem>
                  <SelectItem value="claude-haiku-4-5">
                    Claude Haiku 4.5
                  </SelectItem>
                  <SelectItem value="claude-opus-4-6">
                    Claude Opus 4
                  </SelectItem>
                  <SelectItem value="gpt-4o">
                    GPT-4o
                  </SelectItem>
                  <SelectItem value="gpt-4o-mini">
                    GPT-4o mini
                  </SelectItem>
                  <SelectItem value="gemini-2.5-flash">
                    Gemini 2.5 Flash
                  </SelectItem>
                  <SelectItem value="gemini-2.5-pro">
                    Gemini 2.5 Pro
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label
                className="text-[11px] mb-1 block"
                style={{ color: "var(--dc-text-muted)" }}
              >
                최대 토큰: {maxTokens}
              </label>
              <Slider
                min={1024}
                max={8192}
                step={256}
                value={[maxTokens]}
                onValueChange={([v]) => setMaxTokens(v)}
                className="py-1"
              />
            </div>
            <div>
              <label
                className="text-[11px] mb-1 block"
                style={{ color: "var(--dc-text-muted)" }}
              >
                Temperature: {temperature.toFixed(1)}
              </label>
              <Slider
                min={0}
                max={2}
                step={0.1}
                value={[temperature]}
                onValueChange={([v]) => setTemperature(v)}
                className="py-1"
              />
            </div>
            <Button
              className="w-full text-black font-semibold text-xs h-8"
              style={{ background: "#57F287" }}
              onClick={handleSaveSettings}
              disabled={updateSettingsMutation.isPending}
            >
              {updateSettingsMutation.isPending
                ? "저장 중..."
                : "설정 저장"}
            </Button>
            {updateSettingsMutation.isSuccess && (
              <p className="text-[10px] text-[#57F287] text-center">
                설정이 저장되었습니다
              </p>
            )}

            <div
              className="pt-3 mt-3"
              style={{ borderTop: "1px solid var(--dc-border-subtle)" }}
            >
              <label
                className="text-[11px] mb-1 block"
                style={{ color: "var(--dc-text-muted)" }}
              >
                AI 아바타
              </label>
              <Button
                variant="outline"
                className="w-full text-xs h-8"
                style={{
                  borderColor: "var(--dc-border-subtle)",
                  color: "var(--dc-text-secondary)",
                }}
                onClick={() => generateAvatarMutation.mutate()}
                disabled={generateAvatarMutation.isPending}
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 mr-1.5 ${generateAvatarMutation.isPending ? "animate-spin" : ""}`}
                />
                {generateAvatarMutation.isPending
                  ? "생성 중..."
                  : agent.avatarUrl
                    ? "아바타 재생성"
                    : "AI 아바타 생성"}
              </Button>
              {generateAvatarMutation.isSuccess && (
                <p className="text-[10px] text-[#57F287] text-center mt-1">
                  아바타가 생성되었습니다
                </p>
              )}
              {generateAvatarMutation.isError && (
                <p className="text-[10px] text-red-500 text-center mt-1">
                  아바타 생성에 실패했습니다
                </p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Activity tab */}
        <TabsContent value="activity" className="flex-1 mt-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-1">
              {agentActivities.length === 0 && (
                <div
                  className="text-center text-xs py-8"
                  style={{ color: "var(--dc-text-muted)" }}
                >
                  <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  활동이 없습니다
                </div>
              )}
              {agentActivities.slice(0, 30).map((item, i) => {
                if (item._type === "activity") {
                  const Icon =
                    actionIcons[(item as any).action] || Zap;
                  return (
                    <div
                      key={`a-${i}`}
                      className="flex items-start gap-2 text-[11px] p-2 rounded-md"
                      style={{ background: "var(--dc-bg-modifier-hover)" }}
                    >
                      <Icon className="w-3.5 h-3.5 mt-0.5 text-[#57F287] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div style={{ color: "var(--dc-text-secondary)" }}>
                          {(item as any).details || (item as any).action}
                        </div>
                        <div style={{ color: "var(--dc-text-muted)" }}>
                          {formatTime((item as any).createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div
                    key={`m-${i}`}
                    className="flex items-start gap-2 text-[11px] p-2 rounded-md"
                    style={{ background: "var(--dc-bg-modifier-hover)" }}
                  >
                    <MessageSquare className="w-3.5 h-3.5 mt-0.5 text-[#5865F2] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div
                        className="truncate"
                        style={{ color: "var(--dc-text-secondary)" }}
                      >
                        {(item as any).content}
                      </div>
                      <div style={{ color: "var(--dc-text-muted)" }}>
                        {formatTime((item as any).createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Memory tab */}
        <TabsContent value="memory" className="flex-1 mt-0 overflow-auto">
          <MemoryInspector agentId={agent.id} agentName={agent.name} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
