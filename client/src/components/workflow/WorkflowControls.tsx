import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface WorkflowControlsProps {
  workflowId: string | null;
  status: string;
  progress: { total: number; completed: number; running: number; failed: number };
}

export default function WorkflowControls({ workflowId, status, progress }: WorkflowControlsProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!workflowId) return;
      await apiRequest("POST", `/api/workflows/${workflowId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      toast({ title: "워크플로우가 취소되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: "취소 실패", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!workflowId) return;
      await apiRequest("DELETE", `/api/workflows/${workflowId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      toast({ title: "워크플로우가 삭제되었습니다" });
    },
  });

  const retryMutation = useMutation({
    mutationFn: async () => {
      if (!workflowId) return;
      await apiRequest("POST", `/api/workflows/${workflowId}/retry`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      toast({ title: "워크플로우를 재실행합니다" });
    },
    onError: (error: any) => {
      toast({ title: "재실행 실패", description: error.message, variant: "destructive" });
    },
  });

  const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-t" style={{ borderColor: "var(--dc-border-subtle)" }}>
      {/* Progress bar */}
      <div className="flex-1">
        <div className="flex items-center justify-between text-xs mb-1" style={{ color: "var(--dc-text-muted)" }}>
          <span>진행률: {percent}% ({progress.completed}/{progress.total})</span>
          {progress.running > 0 && <span className="text-blue-500">{progress.running}개 진행 중</span>}
          {progress.failed > 0 && <span className="text-red-500">{progress.failed}개 실패</span>}
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--dc-bg-tertiary)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${percent}%`,
              background: progress.failed > 0 ? "#ef4444" : "#22c55e",
            }}
          />
        </div>
      </div>

      {/* Action buttons */}
      {status === "running" && (
        <button
          onClick={() => cancelMutation.mutate()}
          disabled={cancelMutation.isPending}
          className="px-3 py-1 text-xs rounded font-medium"
          style={{ background: "#fee2e2", color: "#dc2626" }}
        >
          취소
        </button>
      )}
      {status === "failed" && (
        <button
          onClick={() => retryMutation.mutate()}
          disabled={retryMutation.isPending}
          className="px-3 py-1 text-xs rounded font-medium"
          style={{ background: "#dbeafe", color: "#2563eb" }}
        >
          {retryMutation.isPending ? "재실행 중..." : "↻ 재실행"}
        </button>
      )}
      {(status === "completed" || status === "failed" || status === "cancelled") && (
        <button
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="px-3 py-1 text-xs rounded font-medium"
          style={{ background: "var(--dc-bg-tertiary)", color: "var(--dc-text-muted)" }}
        >
          삭제
        </button>
      )}
    </div>
  );
}
