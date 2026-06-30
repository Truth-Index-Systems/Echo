import { useSyncExternalStore } from "react";
import type { EchoMemory } from "../types/memory";

let memories: EchoMemory[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function addMemory(memory: EchoMemory) {
  memories = [memory, ...memories];
  emit();
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
}

export function useMemories() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => memories,
    () => memories
  );}