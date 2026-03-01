import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { soundManager } from "@/lib/sounds";

export function useAgentActions(onDeleteSuccess?: () => void) {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async ({ name, role }: { name: string; role: string }) => {
      await apiRequest("POST", "/api/agents", { name, role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/agents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      onDeleteSuccess?.();
    },
  });

  const broadcastMutation = useMutation({
    mutationFn: async (description: string) => {
      soundManager.messageSent();
      await apiRequest("POST", "/api/agents/broadcast", { description });
    },
  });

  const discussMutation = useMutation({
    mutationFn: async (topic: string) => {
      soundManager.messageSent();
      await apiRequest("POST", "/api/agents/discuss", { topic });
    },
  });

  return {
    createAgent: createMutation.mutate,
    deleteAgent: deleteMutation.mutate,
    broadcast: broadcastMutation.mutate,
    discuss: discussMutation.mutate,
    isBroadcasting: broadcastMutation.isPending,
    isDiscussing: discussMutation.isPending,
  };
}
