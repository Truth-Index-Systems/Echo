import { useEffect, useSyncExternalStore } from "react";
import * as FileSystem from "expo-file-system/legacy";
import type { EchoMemory } from "../types/memory";

const STORE_DIR = `${FileSystem.documentDirectory ?? ""}echo-store/`;
const MEMORY_FILE = `${STORE_DIR}memories.json`;

let memories: EchoMemory[] = [];
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

async function readMemoriesFromDisk() {
  if (!(await ensureStoreDir())) return [];

  const fileInfo = await FileSystem.getInfoAsync(MEMORY_FILE);
  if (!fileInfo.exists) return [];

  const raw = await FileSystem.readAsStringAsync(MEMORY_FILE);
  const parsed = JSON.parse(raw);

  return Array.isArray(parsed) ? (parsed as EchoMemory[]) : [];
}

function persistMemories() {
  const snapshot = memories;

  persistPromise = persistPromise
    .catch(() => undefined)
    .then(async () => {
      if (!(await ensureStoreDir())) return;
      await FileSystem.writeAsStringAsync(MEMORY_FILE, JSON.stringify(snapshot));
    })
    .catch((error) => {
      console.warn("[Echo Memory] Failed to persist memories", error);
    });

  return persistPromise;
}

export function hydrateMemories() {
  if (hasHydrated) return Promise.resolve();
  if (hydratePromise) return hydratePromise;

  hydratePromise = readMemoriesFromDisk()
    .then((storedMemories) => {
      memories = storedMemories;
      hasHydrated = true;
      emit();
    })
    .catch((error) => {
      hasHydrated = true;
      console.warn("[Echo Memory] Failed to hydrate memories", error);
      emit();
    });

  return hydratePromise;
}

export function addMemory(memory: EchoMemory) {
  memories = [memory, ...memories];
  emit();
  void persistMemories();
}

export function getMemories() {
  return memories;
}

export function getRecentMemories(limit = 8) {
  return memories.slice(0, limit);
}

export function clearMemories() {
  memories = [];
  emit();
  void persistMemories();
}

export function useMemories() {
  useEffect(() => {
    void hydrateMemories();
  }, []);

  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => memories,
    () => memories
  );
}
