import { useState } from "react";
import type { EngineMode } from "./types";

export function useEngineSequence() {
  const [mode, setMode] = useState<EngineMode>("idle");

  function start() {
    setMode("wake");

    setTimeout(() => {
      setMode("listening");
    }, 180);
  }

  function stop() {
    setMode("thinking");

    setTimeout(() => {
      setMode("storing");
    }, 500);

    setTimeout(() => {
      setMode("settling");
    }, 1050);

    setTimeout(() => {
      setMode("idle");
    }, 1650);
  }

  function toggle() {
    if (mode === "idle" || mode === "settling") {
      start();
      return;
    }

    if (mode === "wake" || mode === "listening") {
      stop();
    }
  }

  const isListening = mode === "wake" || mode === "listening";

  return {
    mode,
    isListening,
    start,
    stop,
    toggle,
  };}