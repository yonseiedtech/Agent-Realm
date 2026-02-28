// Web Speech API (SpeechSynthesis) 기반 TTS 매니저
const STORAGE_KEY = "agent-realm-tts";

interface TTSSettings {
  enabled: boolean;
  rate: number;
  volume: number;
  voiceURI: string | null;
}

const ROLE_VOICE_PROFILES: Record<string, { pitch: number; rate: number }> = {
  pm: { pitch: 1.0, rate: 1.0 },
  frontend: { pitch: 1.1, rate: 1.05 },
  backend: { pitch: 0.9, rate: 0.95 },
  designer: { pitch: 1.2, rate: 1.0 },
  tester: { pitch: 0.85, rate: 1.1 },
  devops: { pitch: 0.8, rate: 0.9 },
  general: { pitch: 1.0, rate: 1.0 },
};

function loadSettings(): TTSSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { enabled: false, rate: 1.0, volume: 0.8, voiceURI: null };
}

function saveSettings(s: TTSSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

class TTSManager {
  private settings: TTSSettings;
  private synth: SpeechSynthesis | null = null;

  constructor() {
    this.settings = loadSettings();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      this.synth = window.speechSynthesis;
    }
  }

  private getVoice(): SpeechSynthesisVoice | null {
    if (!this.synth) return null;
    const voices = this.synth.getVoices();
    // Try saved voice first
    if (this.settings.voiceURI) {
      const saved = voices.find((v) => v.voiceURI === this.settings.voiceURI);
      if (saved) return saved;
    }
    // Try Korean voices
    const korean = voices.find((v) => v.lang.startsWith("ko"));
    if (korean) return korean;
    // Fallback to first available
    return voices[0] || null;
  }

  speak(text: string, role: string = "general") {
    if (!this.synth || !this.settings.enabled) return;
    // Cancel any ongoing speech
    this.synth.cancel();

    // Clean text — remove markdown/code blocks for cleaner speech
    const cleaned = text
      .replace(/```[\s\S]*?```/g, " 코드 블록 ")
      .replace(/`[^`]+`/g, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/#{1,6}\s/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, " ")
      .trim();

    if (!cleaned) return;

    // Chunk long text (SpeechSynthesis has limits)
    const maxChunk = 200;
    const chunks = [];
    let remaining = cleaned;
    while (remaining.length > 0) {
      if (remaining.length <= maxChunk) {
        chunks.push(remaining);
        break;
      }
      // Find a good break point
      let breakIdx = remaining.lastIndexOf(". ", maxChunk);
      if (breakIdx < 50) breakIdx = remaining.lastIndexOf(" ", maxChunk);
      if (breakIdx < 50) breakIdx = maxChunk;
      chunks.push(remaining.slice(0, breakIdx + 1));
      remaining = remaining.slice(breakIdx + 1);
    }

    const profile = ROLE_VOICE_PROFILES[role] || ROLE_VOICE_PROFILES.general;
    const voice = this.getVoice();

    for (const chunk of chunks) {
      const utter = new SpeechSynthesisUtterance(chunk);
      if (voice) utter.voice = voice;
      utter.pitch = profile.pitch;
      utter.rate = this.settings.rate * profile.rate;
      utter.volume = this.settings.volume;
      utter.lang = "ko-KR";
      this.synth.speak(utter);
    }
  }

  stop() {
    if (this.synth) this.synth.cancel();
  }

  // ── Settings ──
  isEnabled() {
    return this.settings.enabled;
  }
  setEnabled(enabled: boolean) {
    this.settings.enabled = enabled;
    saveSettings(this.settings);
  }
  toggleEnabled() {
    this.settings.enabled = !this.settings.enabled;
    saveSettings(this.settings);
    if (!this.settings.enabled) this.stop();
    return this.settings.enabled;
  }

  getRate() {
    return this.settings.rate;
  }
  setRate(rate: number) {
    this.settings.rate = Math.max(0.5, Math.min(2.0, rate));
    saveSettings(this.settings);
  }

  getVolume() {
    return this.settings.volume;
  }
  setVolume(volume: number) {
    this.settings.volume = Math.max(0, Math.min(1, volume));
    saveSettings(this.settings);
  }

  getVoiceURI() {
    return this.settings.voiceURI;
  }
  setVoiceURI(uri: string | null) {
    this.settings.voiceURI = uri;
    saveSettings(this.settings);
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    return this.synth.getVoices();
  }
}

export const ttsManager = new TTSManager();
