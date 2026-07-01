import type {
  EchoMemory,
  EchoTask,
  EchoTaskEntity,
  EchoTaskStatus,
  EchoTaskTimelineEntry,
  TaskConversationUpdate,
} from "../types/memory";
import { normaliseMemoryEntity } from "../utils/memoryNormaliser";

const CLOSE_WORDS = [
  "done",
  "finished",
  "completed",
  "finally",
  "sorted",
  "closed",
  "paid",
  "booked",
  "emailed",
  "called",
  "sent",
  "cancelled",
  "canceled",
  "got",
  "bought",
  "picked up",
  "collected",
  "managed to get",
  "managed to buy",
  "don't need",
  "do not need",
  "no longer need",
];

const KEEP_OPEN_WORDS = [
  "still need",
  "still haven't",
  "still have not",
  "not done",
  "haven't",
  "have not",
  "need to still",
  "didn't have",
  "did not have",
  "couldn't get",
  "could not get",
  "couldn't find",
  "could not find",
  "out of stock",
  "sold out",
];

const POSTPONE_WORDS = [
  "later",
  "tomorrow",
  "next week",
  "this weekend",
  "postpone",
  "delay",
  "move it",
  "do it later",
];

function nowIso() {
  return new Date().toISOString();
}

function makeTimeline(
  type: EchoTaskTimelineEntry["type"],
  note: string,
  memoryId?: string
): EchoTaskTimelineEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: nowIso(),
    type,
    note,
    memoryId,
  };
}

function textPartsForTask(task: Pick<EchoTaskEntity, "title" | "relatedPeople" | "relatedPlaces" | "relatedIdeas" | "relatedEvents">) {
  return [
    task.title,
    ...(task.relatedPeople ?? []),
    ...(task.relatedPlaces ?? []),
    ...(task.relatedIdeas ?? []),
    ...(task.relatedEvents ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

function normaliseTaskToken(word: string) {
  const clean = word.trim().toLowerCase();

  const aliases: Record<string, string> = {
    rang: "ring",
    called: "call",
    phoned: "call",
    phone: "call",
    telephoned: "call",
    mentioning: "mention",
    mentioned: "mention",
    told: "mention",
    discussed: "mention",
    spoke: "speak",
    spoken: "speak",
    got: "get",
    bought: "buy",
    purchased: "buy",
    picked: "pick",
    collected: "collect",
    emailed: "email",
    messaged: "message",
    sent: "send",
    sorted: "sort",
    completed: "complete",
    finished: "finish",
  };

  if (aliases[clean]) return aliases[clean];
  if (clean.endsWith("ing") && clean.length > 5) return clean.slice(0, -3);
  if (clean.endsWith("ed") && clean.length > 4) return clean.slice(0, -2);
  if (clean.endsWith("s") && clean.length > 4) return clean.slice(0, -1);

  return clean;
}

function taskTokens(value: string) {
  return normaliseMemoryEntity(value)
    .split(" ")
    .map(normaliseTaskToken)
    .filter((word) => word.length > 2 && !["after", "before", "when", "then", "also", "with", "that", "this", "they", "them", "have", "been", "from"].includes(word));
}

function overlapScore(a: string, b: string) {
  const aWords = new Set(taskTokens(a));
  const bWords = new Set(taskTokens(b));

  if (aWords.size === 0 || bWords.size === 0) return 0;

  let overlap = 0;
  aWords.forEach((word) => {
    if (bWords.has(word)) overlap += 1;
  });

  return overlap / Math.max(aWords.size, bWords.size);
}

export function createTaskFromMemoryTask(
  task: EchoTask,
  memory: EchoMemory
): EchoTaskEntity {
  const createdAt = nowIso();

  return {
    id: `task-${memory.id}-${normaliseMemoryEntity(task.title).replace(/\s+/g, "-")}-${Date.now()}`,
    title: task.title,
    status: "open",
    createdAt,
    updatedAt: createdAt,
    dueAt: task.due ?? null,
    dueLabel: task.due ?? null,
    relatedMemoryIds: [memory.id],
    relatedPeople: task.linkedPeople ?? [],
    relatedPlaces: task.linkedPlaces ?? [],
    relatedIdeas: task.linkedIdeas ?? [],
    relatedEvents: task.linkedEvents ?? [],
    reminderEnabled: true,
    energy: Math.min(100, 55 + Math.round(memory.importance * 35)),
    timesMentioned: 1,
    reminderCount: 0,
    lastMentionedAt: memory.createdAt,
    closedAt: null,
    closedReason: null,
    timeline: [
      makeTimeline("created", `Created from memory: ${memory.summary}`, memory.id),
    ],
  };
}

export function findClosestTask(
  text: string,
  tasks: EchoTaskEntity[],
  options: { includeClosed?: boolean } = {}
) {
  const candidates = tasks.filter((task) =>
    options.includeClosed ? true : task.status !== "closed"
  );

  let best: { task: EchoTaskEntity; confidence: number } | null = null;

  for (const task of candidates) {
    const score = overlapScore(text, textPartsForTask(task));
    if (!best || score > best.confidence) {
      best = { task, confidence: score };
    }
  }

  return best && best.confidence >= 0.18 ? best : null;
}

function inferConversationAction(transcript: string): TaskConversationUpdate["action"] {
  const text = transcript.toLowerCase();

  const hasKeepOpenSignal = KEEP_OPEN_WORDS.some((word) => text.includes(word));
  const hasCloseSignal = CLOSE_WORDS.some((word) => text.includes(word));

  if (hasKeepOpenSignal && hasCloseSignal) return "close";
  if (hasKeepOpenSignal) return "keep_open";
  if (hasCloseSignal) return "close";
  if (POSTPONE_WORDS.some((word) => text.includes(word))) return "postpone";

  return "create";
}

function actionConfidence(action: TaskConversationUpdate["action"], transcript: string, matchConfidence: number) {
  const text = transcript.toLowerCase();

  if (action === "close") {
    const strong = ["finally", "done", "finished", "completed", "sorted", "paid", "booked", "called", "emailed", "sent"];
    return Math.min(0.99, matchConfidence + (strong.some((word) => text.includes(word)) ? 0.45 : 0.28));
  }

  if (action === "keep_open") return Math.min(0.96, matchConfidence + 0.36);
  if (action === "postpone") return Math.min(0.92, matchConfidence + 0.28);

  return 0.75;
}

function isCollectiveTaskReference(transcript: string) {
  const text = transcript.toLowerCase();
  return [
    "both",
    "all of them",
    "all the tasks",
    "these tasks",
    "those tasks",
    "them",
    "they",
    "they are",
    "they're",
    "they have",
    "they had",
    "the tasks",
    "tasks are",
    "everything",
  ].some((phrase) => text.includes(phrase));
}

function uniqueTaskUpdates(updates: TaskConversationUpdate[]) {
  const seen = new Set<string>();
  const output: TaskConversationUpdate[] = [];

  for (const update of updates) {
    const key = [
      update.taskId ?? "no-id",
      update.action,
      normaliseMemoryEntity(update.taskTitle ?? ""),
    ].join(":");
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(update);
  }

  return output;
}

function findTaskActionMatches(
  transcript: string,
  extractedTasks: EchoTask[],
  existingTasks: EchoTaskEntity[]
) {
  const openTasks = existingTasks.filter((task) => task.status !== "closed");
  const extractedText = extractedTasks.map((task) => task.title).join(" ");
  const combinedText = [transcript, extractedText].filter(Boolean).join(" ");

  return openTasks
    .map((task) => {
      const directScore = overlapScore(combinedText, textPartsForTask(task));
      const extractedScore = extractedTasks.reduce((best, extractedTask) => {
        return Math.max(best, overlapScore(extractedTask.title, textPartsForTask(task)));
      }, 0);
      return {
        task,
        confidence: Math.max(directScore, extractedScore),
      };
    })
    .filter((match) => match.confidence >= 0.18)
    .sort((a, b) => b.confidence - a.confidence);
}

function resolveProposedTaskUpdates(
  proposedUpdates: TaskConversationUpdate[],
  existingTasks: EchoTaskEntity[]
): TaskConversationUpdate[] {
  const existingById = new Map(existingTasks.map((task) => [task.id, task]));
  const accepted: TaskConversationUpdate[] = [];

  for (const update of proposedUpdates) {
    if (update.action === "ignore" || update.confidence < 0.58) continue;

    if (update.taskId) {
      const existing = existingById.get(update.taskId);
      if (!existing) continue;

      accepted.push({
        ...update,
        taskTitle: update.taskTitle || existing.title,
      });
      continue;
    }

    if (update.taskTitle && update.action !== "create") {
      const match = findClosestTask(update.taskTitle, existingTasks);
      if (match && Math.max(match.confidence, update.confidence) >= 0.58) {
        accepted.push({
          ...update,
          taskId: match.task.id,
          taskTitle: match.task.title,
          confidence: Math.max(update.confidence, match.confidence),
        });
      }
      continue;
    }

    if (update.action === "create" && update.taskTitle) {
      accepted.push(update);
    }
  }

  return uniqueTaskUpdates(accepted);
}

function inferExtraLifecycleUpdates(
  transcript: string,
  extractedTasks: EchoTask[],
  existingTasks: EchoTaskEntity[],
  currentUpdates: TaskConversationUpdate[]
) {
  const action = inferConversationAction(transcript);
  if (action === "create") return [];

  const alreadyUpdatedIds = new Set(
    currentUpdates
      .filter((update) => update.action !== "create" && update.action !== "ignore" && update.taskId)
      .map((update) => update.taskId as string)
  );

  const collectiveReference = isCollectiveTaskReference(transcript);
  const matches = findTaskActionMatches(transcript, extractedTasks, existingTasks);
  const extraUpdates: TaskConversationUpdate[] = [];

  for (const match of matches) {
    if (alreadyUpdatedIds.has(match.task.id)) continue;

    const confidentEnough = collectiveReference
      ? match.confidence >= 0.18
      : match.confidence >= 0.22;

    if (!confidentEnough) continue;

    extraUpdates.push({
      action,
      taskId: match.task.id,
      taskTitle: match.task.title,
      confidence: actionConfidence(action, transcript, Math.max(match.confidence, 0.24)),
      reason:
        action === "close"
          ? "The transcript appears to satisfy this additional existing task as well."
          : action === "postpone"
            ? "The transcript appears to move this additional existing task later as well."
            : "The transcript appears to keep this additional existing task open as well.",
    });
  }

  return extraUpdates;
}

export function detectTaskConversationUpdates(
  transcript: string,
  extractedTasks: EchoTask[],
  existingTasks: EchoTaskEntity[],
  proposedUpdates: TaskConversationUpdate[] = []
): TaskConversationUpdate[] {
  const llmUpdates = resolveProposedTaskUpdates(proposedUpdates, existingTasks);
  const hasLifecycleUpdate = llmUpdates.some((update) => update.action !== "create");

  // The Conversation Understanding Engine gets first refusal, but it may satisfy
  // more than one task in a single sentence. Keep all AI lifecycle decisions and
  // add any other clearly matched active tasks instead of stopping after the
  // first closure.
  if (hasLifecycleUpdate) {
    return uniqueTaskUpdates([
      ...llmUpdates,
      ...inferExtraLifecycleUpdates(transcript, extractedTasks, existingTasks, llmUpdates),
    ]);
  }

  const action = inferConversationAction(transcript);
  const updates: TaskConversationUpdate[] = [...llmUpdates];

  // Important: completion/postpone/keep-open language must be handled before
  // new-task creation. LLM extraction may still return a task for phrases like
  // "I've called James" or "I've done them", but that should update existing
  // tasks rather than create duplicates.
  if (action !== "create") {
    const openTasks = existingTasks.filter((task) => task.status !== "closed");
    const collectiveReference = isCollectiveTaskReference(transcript);
    const matches = findTaskActionMatches(transcript, extractedTasks, existingTasks);

    if (collectiveReference && matches.length === 0 && openTasks.length > 0 && openTasks.length <= 5) {
      for (const task of openTasks) {
        updates.push({
          action,
          taskId: task.id,
          taskTitle: task.title,
          confidence: action === "close" ? 0.86 : 0.72,
          reason:
            action === "close"
              ? "The transcript refers collectively to outstanding tasks being completed or cancelled."
              : action === "postpone"
                ? "The transcript refers collectively to moving outstanding tasks later."
                : "The transcript refers collectively to tasks still being outstanding.",
        });
      }

      return uniqueTaskUpdates(updates);
    }

    const actionableMatches = matches.filter((match, index) => {
      if (collectiveReference) return match.confidence >= 0.18;
      if (index === 0 && match.confidence >= 0.18) return true;
      return match.confidence >= 0.42;
    });

    for (const match of actionableMatches) {
      updates.push({
        action,
        taskId: match.task.id,
        taskTitle: match.task.title,
        confidence: actionConfidence(action, transcript, match.confidence),
        reason:
          action === "close"
            ? "The transcript sounds like this existing task has been completed or cancelled."
            : action === "postpone"
              ? "The transcript moves this existing task to a later time."
              : "The transcript says this existing task is still outstanding.",
      });
    }

    return uniqueTaskUpdates(updates);
  }

  const proposedCreateTitles = new Set(
    llmUpdates
      .filter((update) => update.action === "create" && update.taskTitle)
      .map((update) => normaliseMemoryEntity(update.taskTitle ?? ""))
  );

  for (const task of extractedTasks) {
    if (proposedCreateTitles.has(normaliseMemoryEntity(task.title))) continue;

    const best = findClosestTask(task.title, existingTasks);
    if (best && best.confidence >= 0.55) {
      updates.push({
        action: "keep_open",
        taskId: best.task.id,
        taskTitle: best.task.title,
        confidence: Math.min(0.95, best.confidence + 0.25),
        reason: "This looks like another mention of an existing open task.",
      });
    } else {
      updates.push({
        action: "create",
        taskTitle: task.title,
        confidence: 0.82,
        reason: "The transcript contains a new task or reminder.",
      });
    }
  }

  return uniqueTaskUpdates(updates);
}

export function applyTaskAction(
  task: EchoTaskEntity,
  status: EchoTaskStatus,
  note: string,
  memoryId?: string,
  dueLabel?: string | null
): EchoTaskEntity {
  const updatedAt = nowIso();
  const timelineType: EchoTaskTimelineEntry["type"] =
    status === "closed" ? "closed" : status === "postponed" ? "postponed" : "mentioned";

  return {
    ...task,
    status,
    updatedAt,
    dueLabel: dueLabel ?? task.dueLabel,
    dueAt: dueLabel ?? task.dueAt,
    lastMentionedAt: updatedAt,
    closedAt: status === "closed" ? updatedAt : null,
    closedReason: status === "closed" ? note : null,
    timesMentioned: task.timesMentioned + 1,
    energy:
      status === "closed"
        ? 0
        : status === "postponed"
          ? Math.max(25, task.energy - 12)
          : Math.min(100, task.energy + 8),
    relatedMemoryIds: memoryId
      ? Array.from(new Set([...task.relatedMemoryIds, memoryId]))
      : task.relatedMemoryIds,
    timeline: [makeTimeline(timelineType, note, memoryId), ...task.timeline],
  };
}
