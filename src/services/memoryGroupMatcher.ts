import type {
  MemoryGroup,
  MemoryGroupMatch,
  MemorySearchQuery,
} from "../types/memory";
import { normaliseMemoryEntity } from "../utils/memoryNormaliser";

function normaliseArray(values: string[]) {
  return values.map(normaliseMemoryEntity).filter(Boolean);
}

function overlap(queryValues: string[], groupValues: string[]) {
  const querySet = new Set(normaliseArray(queryValues));
  const groupSet = new Set(normaliseArray(groupValues));

  return Array.from(querySet).filter((value) => groupSet.has(value));
}

function looseOverlap(queryValues: string[], groupValues: string[]) {
  const querySet = normaliseArray(queryValues);
  const groupSet = normaliseArray(groupValues);

  return querySet.filter((queryValue) =>
    groupSet.some(
      (groupValue) =>
        groupValue.includes(queryValue) || queryValue.includes(groupValue)
    )
  );
}

function keywordOverlap(queryKeywords: string[], group: MemoryGroup) {
  const haystack = [
    group.title,
    group.summary,
    ...group.people,
    ...group.places,
    ...group.ideas,
    ...group.events,
    ...group.tasks,
    ...group.relationshipReasons,
  ]
    .join(" ")
    .toLowerCase();

  return queryKeywords.filter((keyword) =>
    haystack.includes(keyword.toLowerCase())
  );
}

function timeHintOverlap(query: MemorySearchQuery, group: MemoryGroup) {
  const haystack = [group.firstMentionedAt, group.lastUpdatedAt]
    .join(" ")
    .toLowerCase();

  return query.timeHints.filter((hint) => haystack.includes(hint.toLowerCase()));
}

function hasRequestedTargetType(query: MemorySearchQuery, group: MemoryGroup) {
  if (query.targetTypes.includes("memories")) return true;

  return query.targetTypes.some((target) => {
    if (target === "people") return group.people.length > 0;
    if (target === "places") return group.places.length > 0;
    if (target === "ideas") return group.ideas.length > 0;
    if (target === "events") return group.events.length > 0;
    if (target === "tasks") return group.tasks.length > 0;
    return false;
  });
}

function wantsFirst(query: MemorySearchQuery) {
  return query.timeHints.some((hint) =>
    ["first", "earliest", "before"].includes(normaliseMemoryEntity(hint))
  );
}

function wantsRecent(query: MemorySearchQuery) {
  return query.timeHints.some((hint) =>
    ["recent", "latest", "last", "newest", "after", "most recent"].includes(
      normaliseMemoryEntity(hint)
    )
  );
}

function isOpenEndedTimelineLookup(query: MemorySearchQuery) {
  return (
    query.intent === "timeline" &&
    (wantsFirst(query) || wantsRecent(query)) &&
    query.targetTypes.length > 0
  );
}

function hasEntityConstraint(query: MemorySearchQuery) {
  return (
    query.people.length +
      query.places.length +
      query.ideas.length +
      query.events.length +
      query.tasks.length >
    0
  );
}

export function matchMemoryGroups(
  query: MemorySearchQuery,
  groups: MemoryGroup[]
): MemoryGroupMatch[] {
  const matches = groups
    .map((group) => {
      const matchedPeople = overlap(query.people, group.people);
      const matchedPlaces = overlap(query.places, group.places);
      const matchedIdeas = [
        ...overlap(query.ideas, group.ideas),
        ...looseOverlap(query.ideas, group.ideas),
      ];
      const matchedEvents = [
        ...overlap(query.events, group.events),
        ...looseOverlap(query.events, group.events),
      ];
      const matchedTasks = [
        ...overlap(query.tasks, group.tasks),
        ...looseOverlap(query.tasks, group.tasks),
      ];
      const matchedTimeHints = timeHintOverlap(query, group);
      const matchedKeywords = keywordOverlap(query.keywords, group);
      const targetTypeMatch = hasRequestedTargetType(query, group);
      const explicitEntityMatch =
        matchedPeople.length +
          matchedPlaces.length +
          matchedIdeas.length +
          matchedEvents.length +
          matchedTasks.length >
        0;
      const openEndedTimelineMatch =
        isOpenEndedTimelineLookup(query) &&
        targetTypeMatch &&
        (!hasEntityConstraint(query) || explicitEntityMatch);

      const relationshipBoost = query.intent === "relationship" ? 0.06 : 0;
      const timelineBoost =
        query.intent === "timeline" &&
        (openEndedTimelineMatch ||
          matchedPeople.length +
            matchedPlaces.length +
            matchedIdeas.length +
            matchedEvents.length +
            matchedKeywords.length >
            0)
          ? 0.08
          : 0;
      const taskBoost =
        query.intent === "task" && (matchedTasks.length > 0 || group.tasks.length > 0)
          ? 0.08
          : 0;

      const score =
        matchedPeople.length * 0.22 +
        matchedPlaces.length * 0.18 +
        matchedIdeas.length * 0.3 +
        matchedEvents.length * 0.28 +
        matchedTasks.length * 0.2 +
        matchedTimeHints.length * 0.06 +
        matchedKeywords.length * 0.055 +
        (targetTypeMatch ? 0.07 : 0) +
        (openEndedTimelineMatch ? 0.12 : 0) +
        group.strength * 0.08 +
        relationshipBoost +
        timelineBoost +
        taskBoost;

      const confidence = Math.min(1, score);

      const reasons: string[] = [];

      if (matchedPeople.length > 0) {
        reasons.push(`matched people: ${Array.from(new Set(matchedPeople)).join(", ")}`);
      }

      if (matchedPlaces.length > 0) {
        reasons.push(`matched places: ${Array.from(new Set(matchedPlaces)).join(", ")}`);
      }

      if (matchedIdeas.length > 0) {
        reasons.push(`matched ideas: ${Array.from(new Set(matchedIdeas)).join(", ")}`);
      }

      if (matchedEvents.length > 0) {
        reasons.push(`matched events: ${Array.from(new Set(matchedEvents)).join(", ")}`);
      }

      if (matchedTasks.length > 0) {
        reasons.push(`matched tasks: ${Array.from(new Set(matchedTasks)).join(", ")}`);
      }

      if (matchedKeywords.length > 0) {
        reasons.push(`matched words: ${Array.from(new Set(matchedKeywords)).join(", ")}`);
      }

      if (openEndedTimelineMatch) {
        reasons.push(`matched latest/first ${query.targetTypes.join(", ")} request`);
      }

      return {
        group,
        confidence,
        reasons,
        matchedPeople: Array.from(new Set(matchedPeople)),
        matchedPlaces: Array.from(new Set(matchedPlaces)),
        matchedIdeas: Array.from(new Set(matchedIdeas)),
        matchedEvents: Array.from(new Set(matchedEvents)),
        matchedTasks: Array.from(new Set(matchedTasks)),
        matchedTimeHints,
        matchedKeywords: Array.from(new Set(matchedKeywords)),
      };
    })
    .filter((match) => {
      if (match.confidence <= 0.08 || !hasRequestedTargetType(query, match.group)) {
        return false;
      }

      if (query.intent !== "timeline" || !hasEntityConstraint(query)) {
        return true;
      }

      return (
        match.matchedPeople.length +
          match.matchedPlaces.length +
          match.matchedIdeas.length +
          match.matchedEvents.length +
          match.matchedTasks.length >
        0
      );
    })
    .sort((a, b) => {
      if (query.intent === "timeline") {
        if (wantsFirst(query)) {
          return (
            new Date(a.group.firstMentionedAt).getTime() -
            new Date(b.group.firstMentionedAt).getTime()
          );
        }

        if (wantsRecent(query)) {
          return (
            new Date(b.group.lastUpdatedAt).getTime() -
            new Date(a.group.lastUpdatedAt).getTime()
          );
        }
      }

      return b.confidence - a.confidence;
    });

  return matches;
}

export function getTopMemoryGroupMatches(
  query: MemorySearchQuery,
  groups: MemoryGroup[],
  limit = 5
): MemoryGroupMatch[] {
  return matchMemoryGroups(query, groups).slice(0, limit);
}
