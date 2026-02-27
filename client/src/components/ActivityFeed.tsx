import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileCode, MessageSquare, CheckCircle, AlertCircle, Zap } from "lucide-react";
import type { ActivityLog, AgentMessage } from "@shared/schema";

const actionIcons: Record<string, any> = {
  file_write: FileCode,
  task_assigned: Zap,
  task_completed: CheckCircle,
  task_failed: AlertCircle,
};

function formatTime(date: string | Date) {
  return new Date(date).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function ActivityFeed() {
  const { data: activities = [] } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activities"],
    refetchInterval: 5000,
  });

  const { data: messages = [] } = useQuery<AgentMessage[]>({
    queryKey: ["/api/agent-messages"],
    refetchInterval: 5000,
  });

  const combined = [
    ...activities.map(a => ({ ...a, _type: "activity" as const, _time: new Date(a.createdAt).getTime() })),
    ...messages.map(m => ({ ...m, _type: "message" as const, _time: new Date(m.createdAt).getTime() })),
  ].sort((a, b) => b._time - a._time).slice(0, 30);

  return (
    <div data-testid="activity-feed" className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-[#40444B] flex items-center gap-2">
        <Zap className="w-4 h-4 text-[#FEE75C]" />
        <span className="text-sm font-semibold text-white">활동 피드</span>
        <span className="text-xs text-gray-500 ml-auto">{combined.length}개</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {combined.length === 0 && (
            <div className="text-center text-gray-500 text-xs py-4">아직 활동이 없습니다</div>
          )}
          {combined.map((item, i) => {
            if (item._type === "activity") {
              const act = item as ActivityLog & { _type: string; _time: number };
              const Icon = actionIcons[act.action] || Zap;
              return (
                <div key={`a-${i}`} className="flex items-start gap-2 text-xs p-2 rounded-lg bg-[#36393F]/50">
                  <Icon className="w-3.5 h-3.5 mt-0.5 text-[#57F287] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-gray-300 truncate">{act.details || act.action}</div>
                    {act.filePath && <div className="text-gray-500 truncate">📄 {act.filePath}</div>}
                    <div className="text-gray-600">{formatTime(act.createdAt)}</div>
                  </div>
                </div>
              );
            } else {
              const msg = item as AgentMessage & { _type: string; _time: number };
              return (
                <div key={`m-${i}`} className="flex items-start gap-2 text-xs p-2 rounded-lg bg-[#36393F]/50">
                  <MessageSquare className="w-3.5 h-3.5 mt-0.5 text-[#5865F2] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-gray-400">
                      에이전트 #{msg.fromAgentId} → {msg.toAgentId ? `#${msg.toAgentId}` : "전체"}
                    </div>
                    <div className="text-gray-300 line-clamp-2">{msg.content}</div>
                    <div className="text-gray-600">{formatTime(msg.createdAt)}</div>
                  </div>
                </div>
              );
            }
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
