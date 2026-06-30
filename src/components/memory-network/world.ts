import type { ClusterType, MemoryClusterConfig } from "./types";

export const MEMORY_WORLD = {
  width: 3200,
  height: 3200,

  minScale: 0.15,
  maxScale: 10,

  initialScale: 0.22,
};

export const worldCenter = {
  x: MEMORY_WORLD.width * 0.5,
  y: MEMORY_WORLD.height * 0.5,
};

export const clusterConfig: Record<ClusterType, MemoryClusterConfig> = {
  people: {
    label: "PEOPLE",
    x: MEMORY_WORLD.width * 0.34,
    y: MEMORY_WORLD.height * 0.39,
    radius: 520,
    color: "#FF3DFF",
  },
  ideas: {
    label: "IDEAS",
    x: MEMORY_WORLD.width * 0.64,
    y: MEMORY_WORLD.height * 0.33,
    radius: 610,
    color: "#A855FF",
  },
  places: {
    label: "PLACES",
    x: MEMORY_WORLD.width * 0.42,
    y: MEMORY_WORLD.height * 0.67,
    radius: 470,
    color: "#00E5FF",
  },
  events: {
    label: "EVENTS",
    x: MEMORY_WORLD.width * 0.69,
    y: MEMORY_WORLD.height * 0.63,
    radius: 560,
    color: "#2F6BFF",
  },
};