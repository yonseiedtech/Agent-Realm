import { useState, useCallback } from "react";
import { soundManager } from "@/lib/sounds";

export function useSound() {
  const [muted, setMuted] = useState(soundManager.isMuted());
  const [volume, setVolumeState] = useState(soundManager.getVolume());

  const toggleMute = useCallback(() => {
    const newMuted = soundManager.toggleMute();
    setMuted(newMuted);
  }, []);

  const setVolume = useCallback((v: number) => {
    soundManager.setVolume(v);
    setVolumeState(v);
  }, []);

  return {
    muted,
    volume,
    toggleMute,
    setVolume,
    play: soundManager,
  };
}
