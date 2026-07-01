import { useEffect, useSyncExternalStore } from "react";
import * as FileSystem from "expo-file-system/legacy";
import type { EchoReminderSettings, EchoReminderStyle } from "../types/memory";

const STORE_DIR = `${FileSystem.documentDirectory ?? ""}echo-store/`;
const SETTINGS_FILE = `${STORE_DIR}reminder-settings.json`;

const defaultSettings: EchoReminderSettings = {
  enabled: false,
  permissionStatus: "unknown",
  style: "balanced",
  morningBriefEnabled: true,
  eveningReflectionEnabled: true,
  taskRemindersEnabled: true,
  hasSeenReminderPrompt: false,
  lastScheduledAt: null,
};

let settings: EchoReminderSettings = defaultSettings;
let hasHydrated = false;
let hydratePromise: Promise<void> | null = null;
let persistPromise: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

async function ensureStoreDir() {
  if (!FileSystem.documentDirectory) return false;

  const dirInfo = await FileSystem.getInfoAsync(STORE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(STORE_DIR, { intermediates: true });
  }

  return true;
}

async function readSettingsFromDisk() {
  if (!(await ensureStoreDir())) return defaultSettings;

  const fileInfo = await FileSystem.getInfoAsync(SETTINGS_FILE);
  if (!fileInfo.exists) return defaultSettings;

  const raw = await FileSystem.readAsStringAsync(SETTINGS_FILE);
  const parsed = JSON.parse(raw);

  return { ...defaultSettings, ...(parsed ?? {}) } as EchoReminderSettings;
}

function persistSettings() {
  const snapshot = settings;

  persistPromise = persistPromise
    .catch(() => undefined)
    .then(async () => {
      if (!(await ensureStoreDir())) return;
      await FileSystem.writeAsStringAsync(SETTINGS_FILE, JSON.stringify(snapshot));
    })
    .catch((error) => {
      console.warn("[Echo Reminders] Failed to persist reminder settings", error);
    });

  return persistPromise;
}

export function hydrateReminderSettings() {
  if (hasHydrated) return Promise.resolve();
  if (hydratePromise) return hydratePromise;

  hydratePromise = readSettingsFromDisk()
    .then((storedSettings) => {
      settings = storedSettings;
      hasHydrated = true;
      emit();
    })
    .catch((error) => {
      hasHydrated = true;
      console.warn("[Echo Reminders] Failed to hydrate reminder settings", error);
      emit();
    });

  return hydratePromise;
}

export function getReminderSettings() {
  return settings;
}

export function updateReminderSettings(patch: Partial<EchoReminderSettings>) {
  settings = { ...settings, ...patch };
  emit();
  void persistSettings();
}

export function setReminderStyle(style: EchoReminderStyle) {
  updateReminderSettings({ style });
}

export function useReminderSettings() {
  useEffect(() => {
    void hydrateReminderSettings();
  }, []);

  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => settings,
    () => settings
  );
}
