import type { EchoMemory } from "../../types/memory";
import {
  displayMemoryEntity,
  normaliseMemoryEntity,
} from "../../utils/memoryNormaliser";
import { clusterConfig } from "./world";
import type { ClusterType, MemoryGraph, MemoryLink, NetworkNode } from "./types";

function addCount(map: Map<string, number>, value: string) {
  const key = normaliseMemoryEntity(value);
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + 1);
}

function buildClusterNodes(
  type: ClusterType,
  values: Map<string, number>
): NetworkNode[] {
  const config = clusterConfig[type];
  const entries = Array.from(values.entries()).slice(0, 80);

  return entries.map(([key, count], index) => {
    const label = displayMemoryEntity(key);
    const ring = Math.floor(index / 12);
    const indexInRing = index % 12;
    const angle =
      (Math.PI * 2 * indexInRing) / 12 +
      (key.length % 9) * 0.07 +
      ring * 0.27;

    const radius = 110 + ring * 86 + ((index * 31) % 42);
    const wobble = (key.length % 11) * 7;

    return {
      id: `${type}-${key}`,
      key,
      label: label.length > 18 ? `${label.slice(0, 17)}…` : label,
      type,
      x: config.x + Math.cos(angle) * (radius + wobble),
      y: config.y + Math.sin(angle) * (radius - wobble),
      strength: Math.min(1, 0.28 + count * 0.13),
    };
  });
}

function findNode(
  nodes: NetworkNode[],
  type: ClusterType,
  value: string
): NetworkNode | undefined {
  const key = normaliseMemoryEntity(value);
  return nodes.find((node) => node.id === `${type}-${key}`);
}

export function buildMemoryGraph(memories: EchoMemory[]): MemoryGraph {
  const people = new Map<string, number>();
  const ideas = new Map<string, number>();
  const places = new Map<string, number>();
  const events = new Map<string, number>();

  for (const memory of memories) {
    memory.people.forEach((item) => addCount(people, item));
    memory.ideas.forEach((item) => addCount(ideas, item));
    memory.places.forEach((item) => addCount(places, item));
    memory.events.forEach((item) => addCount(events, item));
  }

  const nodes = [
    ...buildClusterNodes("people", people),
    ...buildClusterNodes("ideas", ideas),
    ...buildClusterNodes("places", places),
    ...buildClusterNodes("events", events),
  ];

  const linkMap = new Map<string, MemoryLink>();

  function addLink(from?: NetworkNode, to?: NetworkNode, boost = 1) {
    if (!from || !to || from.id === to.id) return;

    const sorted = [from.id, to.id].sort();
    const id = `${sorted[0]}--${sorted[1]}`;
    const existing = linkMap.get(id);

    if (existing) {
      existing.strength = Math.min(1, existing.strength + 0.12 * boost);
      return;
    }

    linkMap.set(id, {
      id,
      from,
      to,
      strength: Math.min(1, 0.24 + 0.12 * boost),
    });
  }

  for (const memory of memories) {
    const memoryPeople = memory.people
      .map((item) => findNode(nodes, "people", item))
      .filter(Boolean) as NetworkNode[];

    const memoryIdeas = memory.ideas
      .map((item) => findNode(nodes, "ideas", item))
      .filter(Boolean) as NetworkNode[];

    const memoryPlaces = memory.places
      .map((item) => findNode(nodes, "places", item))
      .filter(Boolean) as NetworkNode[];

    const memoryEvents = memory.events
      .map((item) => findNode(nodes, "events", item))
      .filter(Boolean) as NetworkNode[];

    const allMemoryNodes = [
      ...memoryPeople,
      ...memoryIdeas,
      ...memoryPlaces,
      ...memoryEvents,
    ];

    for (let i = 0; i < allMemoryNodes.length; i += 1) {
      for (let j = i + 1; j < allMemoryNodes.length; j += 1) {
        addLink(allMemoryNodes[i], allMemoryNodes[j], memory.importance);
      }
    }

    for (const task of memory.tasks) {
      const taskNodes = [
        ...(task.linkedPeople ?? [])
          .map((item) => findNode(nodes, "people", item))
          .filter(Boolean),
        ...(task.linkedPlaces ?? [])
          .map((item) => findNode(nodes, "places", item))
          .filter(Boolean),
        ...(task.linkedIdeas ?? [])
          .map((item) => findNode(nodes, "ideas", item))
          .filter(Boolean),
        ...(task.linkedEvents ?? [])
          .map((item) => findNode(nodes, "events", item))
          .filter(Boolean),
      ] as NetworkNode[];

      const relationshipNodes = taskNodes.length > 0 ? taskNodes : allMemoryNodes;

      for (let i = 0; i < relationshipNodes.length; i += 1) {
        for (let j = i + 1; j < relationshipNodes.length; j += 1) {
          addLink(relationshipNodes[i], relationshipNodes[j], 0.85);
        }
      }
    }
  }

  return {
    nodes,
    links: Array.from(linkMap.values()),
  };
}
