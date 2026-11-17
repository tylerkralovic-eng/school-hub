"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/** Optional read-aloud (speechSynthesis) and dictation (SpeechRecognition) — both built into the browser. */
export function useVoice() {
  const [speakOn, setSpeakOn] = useState(false);
  const [canListen, setCanListen] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    try { setSpeakOn(localStorage.getItem("sh_speak") === "1"); } catch {}
    const w = window as unknown as Record<string, unknown>;
    setCanListen(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const toggleSpeak = useCallback(() => {
    setSpeakOn((v) => {
      try { localStorage.setItem("sh_speak", v ? "0" : "1"); } catch {}
      if (v) window.speechSynthesis?.cancel();
      return !v;
    });
  }, []);

  const speak = useCallback((text: string) => {
    if (!speakOn || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.03;
    window.speechSynthesis.speak(u);
  }, [speakOn]);

  const listen = useCallback((onText: (t: string) => void) => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Rec = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Rec) return;
    if (listening) { recRef.current?.stop(); return; }
    const rec = new Rec();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => onText(Array.from(e.results).map((r) => r[0].transcript).join(" "));
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    window.speechSynthesis?.cancel();
    setListening(true);
    rec.start();
  }, [listening]);

  return { speakOn, toggleSpeak, speak, canListen, listening, listen };
}

interface SpeechRec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
}
