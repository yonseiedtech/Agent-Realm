import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Settings, Volume2, VolumeX, Mic, MicOff, FolderOpen } from "lucide-react";
import { useSound } from "@/hooks/useSound";
import { useTTS } from "@/hooks/useTTS";
import { ttsManager } from "@/lib/tts";

export default function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [googleApiKey, setGoogleApiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState("claude-sonnet-4-6");
  const [workspacePath, setWorkspacePath] = useState("");
  const queryClient = useQueryClient();
  const { muted, volume, toggleMute, setVolume } = useSound();
  const { enabled: ttsEnabled, toggleTTS, rate: ttsRate, setRate: setTTSRate } = useTTS();
  const [ttsVoices, setTtsVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>("");

  useEffect(() => {
    if (open) {
      const loadVoices = () => {
        const voices = ttsManager.getAvailableVoices();
        setTtsVoices(voices);
        setSelectedVoiceURI(ttsManager.getVoiceURI() || "");
      };
      loadVoices();
      // voices may load asynchronously
      window.speechSynthesis?.addEventListener("voiceschanged", loadVoices);
      return () => window.speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
    }
  }, [open]);

  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
    enabled: open,
  });

  useEffect(() => {
    if (settings) {
      setApiKey(settings.custom_api_key || "");
      setBaseUrl(settings.custom_base_url || "");
      setOpenaiApiKey(settings.openai_api_key || "");
      setGoogleApiKey(settings.google_api_key || "");
      setDefaultModel(settings.default_model || "claude-sonnet-4-6");
      setWorkspacePath(settings.workspace_path || "");
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
      openai_api_key: openaiApiKey,
      google_api_key: googleApiKey,
      default_model: defaultModel,
      workspace_path: workspacePath,
    });
  };

  const maskedKey = apiKey ? apiKey.slice(0, 8) + "..." + apiKey.slice(-4) : "";
  const maskedOpenaiKey = openaiApiKey ? openaiApiKey.slice(0, 8) + "..." + openaiApiKey.slice(-4) : "";
  const maskedGoogleKey = googleApiKey ? googleApiKey.slice(0, 8) + "..." + googleApiKey.slice(-4) : "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" data-testid="button-global-settings">
          <Settings className="w-4 h-4 text-[var(--dc-text-muted)]" />
        </Button>
      </DialogTrigger>
      <DialogContent className="border" style={{ background: "var(--dc-bg-secondary)", borderColor: "var(--dc-border-subtle)" }}>
        <DialogHeader>
          <DialogTitle className="text-foreground">글로벌 설정</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* 사운드 설정 */}
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: "var(--dc-text-muted)" }}>사운드</label>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 shrink-0"
                onClick={toggleMute}
                data-testid="button-settings-mute"
              >
                {muted ? (
                  <VolumeX className="w-4 h-4 text-[var(--dc-text-muted)]" />
                ) : (
                  <Volume2 className="w-4 h-4 text-[#57F287]" />
                )}
              </Button>
              <Slider
                data-testid="slider-volume"
                min={0}
                max={1}
                step={0.05}
                value={[muted ? 0 : volume]}
                onValueChange={([v]) => setVolume(v)}
                className="flex-1"
              />
              <span className="text-[10px] text-[var(--dc-text-muted)] w-8 text-right">
                {muted ? "OFF" : `${Math.round(volume * 100)}%`}
              </span>
            </div>
          </div>

          {/* TTS 설정 */}
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: "var(--dc-text-muted)" }}>TTS (음성 읽기)</label>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 shrink-0"
                  onClick={toggleTTS}
                >
                  {ttsEnabled ? (
                    <Mic className="w-4 h-4 text-[#FF79C6]" />
                  ) : (
                    <MicOff className="w-4 h-4 text-[var(--dc-text-muted)]" />
                  )}
                </Button>
                <span className="text-xs text-[var(--dc-text-secondary)]">{ttsEnabled ? "켜짐" : "꺼짐"}</span>
              </div>
              <div>
                <label className="text-[10px] text-[var(--dc-text-muted)] mb-0.5 block">속도: {ttsRate.toFixed(1)}x</label>
                <Slider
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  value={[ttsRate]}
                  onValueChange={([v]) => setTTSRate(v)}
                  className="flex-1"
                />
              </div>
              {ttsVoices.length > 0 && (
                <div>
                  <label className="text-[10px] text-[var(--dc-text-muted)] mb-0.5 block">음성</label>
                  <Select
                    value={selectedVoiceURI}
                    onValueChange={(v) => {
                      setSelectedVoiceURI(v);
                      ttsManager.setVoiceURI(v || null);
                    }}
                  >
                    <SelectTrigger className="border-none text-xs h-7" style={{ background: "var(--dc-bg-input)", color: "var(--dc-text-primary)" }}>
                      <SelectValue placeholder="자동 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">자동 선택</SelectItem>
                      {ttsVoices
                        .filter((v) => v.lang.startsWith("ko") || v.lang.startsWith("en"))
                        .slice(0, 20)
                        .map((v) => (
                          <SelectItem key={v.voiceURI} value={v.voiceURI}>
                            {v.name} ({v.lang})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--dc-text-muted)" }}>Anthropic API 키</label>
            <Input
              data-testid="input-api-key"
              type="password"
              placeholder="sk-ant-..."
              className="border-none placeholder:opacity-50" style={{ background: "var(--dc-bg-input)", color: "var(--dc-text-primary)" }}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            {apiKey && (
              <p className="text-[10px] text-[var(--dc-text-muted)] mt-1" data-testid="text-masked-key">현재: {maskedKey}</p>
            )}
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--dc-text-muted)" }}>Anthropic Base URL (선택사항)</label>
            <Input
              data-testid="input-base-url"
              placeholder="https://api.anthropic.com"
              className="border-none placeholder:opacity-50" style={{ background: "var(--dc-bg-input)", color: "var(--dc-text-primary)" }}
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--dc-text-muted)" }}>OpenAI API 키</label>
            <Input
              type="password"
              placeholder="sk-..."
              className="border-none placeholder:opacity-50" style={{ background: "var(--dc-bg-input)", color: "var(--dc-text-primary)" }}
              value={openaiApiKey}
              onChange={(e) => setOpenaiApiKey(e.target.value)}
            />
            {openaiApiKey && (
              <p className="text-[10px] text-[var(--dc-text-muted)] mt-1">현재: {maskedOpenaiKey}</p>
            )}
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--dc-text-muted)" }}>Google Gemini API 키</label>
            <Input
              type="password"
              placeholder="AI..."
              className="border-none placeholder:opacity-50" style={{ background: "var(--dc-bg-input)", color: "var(--dc-text-primary)" }}
              value={googleApiKey}
              onChange={(e) => setGoogleApiKey(e.target.value)}
            />
            {googleApiKey && (
              <p className="text-[10px] text-[var(--dc-text-muted)] mt-1">현재: {maskedGoogleKey}</p>
            )}
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--dc-text-muted)" }}>기본 모델</label>
            <Select value={defaultModel} onValueChange={setDefaultModel}>
              <SelectTrigger className="border-none" style={{ background: "var(--dc-bg-input)", color: "var(--dc-text-primary)" }} data-testid="select-default-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude-sonnet-4-6">Claude Sonnet 4</SelectItem>
                <SelectItem value="claude-haiku-4-5">Claude Haiku 4.5</SelectItem>
                <SelectItem value="claude-opus-4-6">Claude Opus 4</SelectItem>
                <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                <SelectItem value="gpt-4o-mini">GPT-4o mini</SelectItem>
                <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--dc-text-muted)" }}>
              <FolderOpen className="w-3.5 h-3.5 inline mr-1" />
              워크스페이스 경로
            </label>
            <Input
              placeholder="C:\work\my-project"
              className="border-none placeholder:opacity-50"
              style={{ background: "var(--dc-bg-input)", color: "var(--dc-text-primary)" }}
              value={workspacePath}
              onChange={(e) => setWorkspacePath(e.target.value)}
            />
            <p className="text-[10px] mt-1" style={{ color: "var(--dc-text-muted)" }}>
              에이전트가 파일을 읽고 수정할 프로젝트 디렉토리
            </p>
          </div>

          <Button
            data-testid="button-save-global-settings"
            className="w-full font-semibold" style={{ background: "#23a559", color: "#fff" }}
            onClick={handleSave}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "저장 중..." : "설정 저장"}
          </Button>

          {saveMutation.isSuccess && (
            <p className="text-xs text-center" style={{ color: "#23a559" }} data-testid="text-global-settings-saved">설정이 저장되었습니다</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
