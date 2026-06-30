import { useSyncExternalStore } from "react";
import type { EchoReminderSettings, EchoReminderStyle } from "../types/memory";

let settings: EchoReminderSettings = {
  enabled: false,
  permissionStatus: "unknown",
  style: "balanced",
  morningBriefEnabled: true,
  eveningReflectionEnabled: true,
  taskRemindersEnabled: true,
  hasSeenReminderPrompt: false,
  lastScheduledAt: null,
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function getReminderSettings() {
  return settings;
}

export function updateReminderSettings(patch: Partial<EchoReminderSettings>) {
  settings = { ...settings, ...patch };
  emit();
}

export function setReminderStyle(style: EchoReminderStyle) {
  updateReminderSettings({ style });
}

export function useReminderSettings() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => settings,
    () => settings
  );
}
