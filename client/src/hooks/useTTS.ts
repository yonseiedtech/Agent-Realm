import { useState, useCallback } from "react";
import { ttsManager } from "@/lib/tts";

export function useTTS() {
  const [enabled, setEnabledState] = useState(() => ttsManager.isEnabled());
  const [rate, setRateState] = useState(() => ttsManager.getRate());

  const toggleTTS = useCallback(() => {
    const newState = ttsManager.toggleEnabled();
    setEnabledState(newState);
  }, []);

  const speak = useCallback((text: string, role: string = "general") => {
    ttsManager.speak(text, role);
  }, []);

  const stop = useCallback(() => {
    ttsManager.stop();
  }, []);

  const setRate = useCallback((r: number) => {
    ttsManager.setRate(r);
    setRateState(r);
  }, []);

  return {
    enabled,
    toggleTTS,
    speak,
    stop,
    rate,
    setRate,
  };
}
