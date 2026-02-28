// Web Audio API 기반 사운드 매니저 — 라이브러리 불필요
const STORAGE_KEY = "agent-realm-sound";

interface SoundSettings {
  volume: number; // 0–1
  muted: boolean;
}

function loadSettings(): SoundSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { volume: 0.5, muted: false };
}

function saveSettings(s: SoundSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

class SoundManager {
  private ctx: AudioContext | null = null;
  private settings: SoundSettings;

  constructor() {
    this.settings = loadSettings();
  }

  private getCtx(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private gain(ctx: AudioContext, volume?: number): GainNode {
    const g = ctx.createGain();
    g.gain.value = this.settings.muted ? 0 : (volume ?? this.settings.volume) * 0.3;
    g.connect(ctx.destination);
    return g;
  }

  // ── 톤 헬퍼 ────────────────────────────────────
  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = "sine",
    vol?: number,
  ) {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const g = this.gain(ctx, vol);
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(g);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  private playSweep(
    startFreq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType = "sine",
  ) {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const g = this.gain(ctx);
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(endFreq, ctx.currentTime + duration);
    osc.connect(g);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  private playChord(freqs: number[], duration: number, type: OscillatorType = "sine") {
    const ctx = this.getCtx();
    const g = this.gain(ctx);
    for (const freq of freqs) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      osc.connect(g);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    }
  }

  // ── 공개 사운드 이벤트 ──────────────────────────
  /** 에이전트 생성 — 상승 차임 C5→E5 */
  agentCreated() {
    this.playSweep(523.25, 659.25, 0.25, "sine");
  }

  /** 메시지 수신 — "딩" A5 */
  messageReceived() {
    this.playTone(880, 0.12, "sine");
  }

  /** 메시지 전송 — 부드러운 "뿅" E5 */
  messageSent() {
    this.playTone(659.25, 0.08, "sine", 0.2);
  }

  /** 작업 완료 — 성공 코드 C5+E5+G5 */
  taskCompleted() {
    this.playChord([523.25, 659.25, 783.99], 0.3, "sine");
  }

  /** 작업 실패 — 하강 톤 E4→C4 */
  taskFailed() {
    this.playSweep(329.63, 261.63, 0.3, "sawtooth");
  }

  /** UI 클릭 — 마이크로 클릭 */
  uiClick() {
    this.playTone(1200, 0.03, "square", 0.15);
  }

  /** 알림 */
  notification() {
    this.playTone(660, 0.08, "sine");
    setTimeout(() => this.playTone(880, 0.08, "sine"), 100);
  }

  // ── 설정 ────────────────────────────────────────
  getVolume() {
    return this.settings.volume;
  }
  setVolume(v: number) {
    this.settings.volume = Math.max(0, Math.min(1, v));
    saveSettings(this.settings);
  }

  isMuted() {
    return this.settings.muted;
  }
  setMuted(m: boolean) {
    this.settings.muted = m;
    saveSettings(this.settings);
  }
  toggleMute() {
    this.settings.muted = !this.settings.muted;
    saveSettings(this.settings);
    return this.settings.muted;
  }
}

export const soundManager = new SoundManager();
