import type { EchoMemory, EchoTask, MemoryGroup } from "../types/memory";
import {
  displayMemoryEntity,
  normaliseMemoryEntity,
} from "../utils/memoryNormaliser";

type GroupSeed = {
  people: Set<string>;
  places: Set<string>;
  ideas: Set<string>;
  events: Set<string>;
  tasks: Set<string>;
  memoryIds: Set<string>;
  strength: number;
  lastUpdatedAt: string;
  firstMentionedAt: string;
  relationshipReasons: string[];
};

function addValues(target: Set<string>, values: string[]) {
  for (const value of values) {
    const key = normaliseMemoryEntity(value);
    if (key) target.add(key);
  }
}

function taskTitles(tasks: EchoTask[]) {
  return tasks.map((task) => task.title).filter(Boolean);
}

function memoryStableEntities(memory: EchoMemory) {
  return [
    ...memory.people,
    ...memory.places,
    ...memory.ideas,
    ...memory.events,
  ].filter(Boolean);
}

function overlapScore(group: GroupSeed, memory: EchoMemory) {
  const people = memory.people.filter((item) =>
    group.people.has(normaliseMemoryEntity(item))
  ).length;

  const places = memory.places.filter((item) =>
    group.places.has(normaliseMemoryEntity(item))
  ).length;

  const ideas = memory.ideas.filter((item) =>
    group.ideas.has(normaliseMemoryEntity(item))
  ).length;

  const events = memory.events.filter((item) =>
    group.events.has(normaliseMemoryEntity(item))
  ).length;

  const tasks = taskTitles(memory.tasks).filter((item) =>
    group.tasks.has(normaliseMemoryEntity(item))
  ).length;

  const linkedEntities = memory.linkedEntities.filter((item) => {
    const key = normaliseMemoryEntity(item);
    return (
      group.people.has(key) ||
      group.places.has(key) ||
      group.ideas.has(key) ||
      group.events.has(key)
    );
  }).length;

  return (
    people * 3 +
    places * 2 +
    ideas * 5 +
    events * 5 +
    tasks * 2 +
    linkedEntities * 3
  );
}

function titleForGroup(group: GroupSeed) {
  const candidates = [
    ...Array.from(group.ideas),
    ...Array.from(group.events),
    ...Array.from(group.people),
    ...Array.from(group.places),
    ...Array.from(group.tasks),
  ];

  return candidates.length > 0 ? displayMemoryEntity(candidates[0]) : "Memory Group";
}

function summaryForGroup(group: GroupSeed) {
  const parts = [
    ...Array.from(group.people).slice(0, 2).map(displayMemoryEntity),
    ...Array.from(group.places).slice(0, 2).map(displayMemoryEntity),
    ...Array.from(group.ideas).slice(0, 2).map(displayMemoryEntity),
    ...Array.from(group.events).slice(0, 2).map(displayMemoryEntity),
  ];

  return parts.length > 0
    ? `Memories connected by ${parts.join(", ")}.`
    : "Related memories grouped by overlapping context.";
}

function relationshipReasonForMemory(memory: EchoMemory) {
  const entities = memoryStableEntities(memory).slice(0, 5);

  if (entities.length === 0) return null;

  const actionParts = taskTitles(memory.tasks).slice(0, 2);
  const actionText =
    actionParts.length > 0 ? ` Tasks: ${actionParts.join("; ")}.` : "";

  return `${memory.summary} Linked: ${entities.join(", ")}.${actionText}`;
}

function olderDate(a: string, b: string) {
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
}

function newerDate(a: string, b: string) {
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

function serialiseGroup(group: GroupSeed, index: number): MemoryGroup {
  return {
    id: `group-${index}`,
    title: titleForGroup(group),
    summary: summaryForGroup(group),
    people: Array.from(group.people).map(displayMemoryEntity),
    places: Array.from(group.places).map(displayMemoryEntity),
    ideas: Array.from(group.ideas).map(displayMemoryEntity),
    events: Array.from(group.events).map(displayMemoryEntity),
    tasks: Array.from(group.tasks).map(displayMemoryEntity),
    memoryIds: Array.from(group.memoryIds),
    strength: Math.min(1, group.strength),
    lastUpdatedAt: group.lastUpdatedAt,
    firstMentionedAt: group.firstMentionedAt,
    relationshipReasons: group.relationshipReasons.slice(0, 8),
  };
}

export function buildMemoryGroups(memories: EchoMemory[]): MemoryGroup[] {
  const groups: GroupSeed[] = [];

  for (const memory of memories) {
    let bestGroup: GroupSeed | null = null;
    let bestScore = 0;

    for (const group of groups) {
      const score = overlapScore(group, memory);

      if (score > bestScore) {
        bestScore = score;
        bestGroup = group;
      }
    }

    const targetGroup =
      bestGroup && bestScore >= 3
        ? bestGroup
        : {
            people: new Set<string>(),
            places: new Set<string>(),
            ideas: new Set<string>(),
            events: new Set<string>(),
            tasks: new Set<string>(),
            memoryIds: new Set<string>(),
            strength: 0.35,
            lastUpdatedAt: memory.createdAt,
            firstMentionedAt: memory.createdAt,
            relationshipReasons: [],
          };

    addValues(targetGroup.people, memory.people);
    addValues(targetGroup.places, memory.places);
    addValues(targetGroup.ideas, memory.ideas);
    addValues(targetGroup.events, memory.events);
    addValues(targetGroup.tasks, taskTitles(memory.tasks));

    targetGroup.memoryIds.add(memory.id);
    targetGroup.strength = Math.min(1, targetGroup.strength + 0.08 + memory.importance * 0.04);
    targetGroup.lastUpdatedAt = newerDate(targetGroup.lastUpdatedAt, memory.createdAt);
    targetGroup.firstMentionedAt = olderDate(targetGroup.firstMentionedAt, memory.createdAt);

    const reason = relationshipReasonForMemory(memory);
    if (reason && !targetGroup.relationshipReasons.includes(reason)) {
      targetGroup.relationshipReasons.unshift(reason);
    }

    if (!groups.includes(targetGroup)) {
      groups.push(targetGroup);
    }
  }

  return groups.map(serialiseGroup);
}
