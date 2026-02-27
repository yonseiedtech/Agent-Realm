import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Settings } from "lucide-react";

export default function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [defaultModel, setDefaultModel] = useState("claude-sonnet-4-6");
  const queryClient = useQueryClient();

  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
    enabled: open,
  });

  useEffect(() => {
    if (settings) {
      setApiKey(settings.custom_api_key || "");
      setBaseUrl(settings.custom_base_url || "");
      setDefaultModel(settings.default_model || "claude-sonnet-4-6");
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      await apiRequest("PUT", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      custom_api_key: apiKey,
      custom_base_url: baseUrl,
      default_model: defaultModel,
    });
  };

  const maskedKey = apiKey ? apiKey.slice(0, 8) + "..." + apiKey.slice(-4) : "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" data-testid="button-global-settings">
          <Settings className="w-4 h-4 text-gray-400" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#2C2F33] border-[#40444B]">
        <DialogHeader>
          <DialogTitle className="text-white">글로벌 설정</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">커스텀 API 키</label>
            <Input
              data-testid="input-api-key"
              type="password"
              placeholder="sk-ant-..."
              className="bg-[#40444B] border-none text-white placeholder:text-gray-500"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            {apiKey && (
              <p className="text-[10px] text-gray-500 mt-1" data-testid="text-masked-key">현재: {maskedKey}</p>
            )}
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Base URL (선택사항)</label>
            <Input
              data-testid="input-base-url"
              placeholder="https://api.anthropic.com"
              className="bg-[#40444B] border-none text-white placeholder:text-gray-500"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">기본 모델</label>
            <Select value={defaultModel} onValueChange={setDefaultModel}>
              <SelectTrigger className="bg-[#40444B] border-none text-white" data-testid="select-default-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude-sonnet-4-6">Claude Sonnet 4</SelectItem>
                <SelectItem value="claude-haiku-4-5">Claude Haiku 4.5</SelectItem>
                <SelectItem value="claude-opus-4-6">Claude Opus 4</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            data-testid="button-save-global-settings"
            className="w-full bg-[#57F287] hover:bg-[#47d377] text-black font-semibold"
            onClick={handleSave}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "저장 중..." : "설정 저장"}
          </Button>

          {saveMutation.isSuccess && (
            <p className="text-xs text-[#57F287] text-center" data-testid="text-global-settings-saved">설정이 저장되었습니다</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
