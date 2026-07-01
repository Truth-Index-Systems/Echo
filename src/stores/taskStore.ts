import { useEffect, useSyncExternalStore } from "react";
import * as FileSystem from "expo-file-system/legacy";
import type {
  EchoMemory,
  EchoTask,
  EchoTaskEntity,
  EchoTaskStatus,
  TaskConversationUpdate,
} from "../types/memory";
import {
  applyTaskAction,
  createTaskFromMemoryTask,
  findClosestTask,
} from "../services/taskIntelligence";
import { normaliseMemoryEntity } from "../utils/memoryNormaliser";
const STORE_DIR = `${FileSystem.documentDirectory ?? ""}echo-store/`;
const TASK_FILE = `${STORE_DIR}tasks.json`;

let tasks: EchoTaskEntity[] = [];
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

async function readTasksFromDisk() {
  if (!(await ensureStoreDir())) return [];

  const fileInfo = await FileSystem.getInfoAsync(TASK_FILE);
  if (!fileInfo.exists) return [];

  const raw = await FileSystem.readAsStringAsync(TASK_FILE);
  const parsed = JSON.parse(raw);

  return Array.isArray(parsed) ? (parsed as EchoTaskEntity[]) : [];
}

function persistTasks() {
  const snapshot = tasks;

  persistPromise = persistPromise
    .catch(() => undefined)
    .then(async () => {
      if (!(await ensureStoreDir())) return;
      await FileSystem.writeAsStringAsync(TASK_FILE, JSON.stringify(snapshot));
    })
    .catch((error) => {
      console.warn("[Echo Tasks] Failed to persist tasks", error);
    });

  return persistPromise;
}

export function hydrateTasks() {
  if (hasHydrated) return Promise.resolve();
  if (hydratePromise) return hydratePromise;

  hydratePromise = readTasksFromDisk()
    .then((storedTasks) => {
      tasks = storedTasks;
      hasHydrated = true;
      emit();
    })
    .catch((error) => {
      hasHydrated = true;
      console.warn("[Echo Tasks] Failed to hydrate tasks", error);
      emit();
    });

  return hydratePromise;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return tasks;
}

function normalisedTitle(value?: string | null) {
  return normaliseMemoryEntity(value ?? "");
}

function isOutstanding(task: EchoTaskEntity) {
  return task.status !== "closed";
}

function findTaskById(taskId?: string | null) {
  if (!taskId) return undefined;
  return tasks.find((task) => task.id === taskId);
}

function hasExactOutstandingDuplicate(title: string) {
  const key = normalisedTitle(title);
  if (!key) return false;

  return tasks.some(
    (task) => isOutstanding(task) && normalisedTitle(task.title) === key
  );
}

function isValidLifecycleUpdate(update: TaskConversationUpdate) {
  if (update.action === "ignore") return false;
  if (update.action === "create") return false;
  if (!update.taskId || update.confidence < 0.58) return false;
  if (update.action === "close" && update.confidence < 0.72) return false;

  return (
    update.action === "close" ||
    update.action === "postpone" ||
    update.action === "keep_open"
  );
}

function stripLeadingTaskVerb(title: string) {
  return title
    .trim()
    .replace(
      /^(remind me to|remember to|i need to|need to|i have to|have to|must|todo:?|to do:?|get|buy|pick up|pickup|collect|grab|bring|take|send|call|email|message|purchase|ring)\s+/i,
      ""
    )
    .trim();
}

function uniqueMerge(existing: string[], incoming: string[]) {
  const seen = new Set(existing.map((value) => normaliseMemoryEntity(value)));
  const output = [...existing];

  for (const value of incoming) {
    const key = normaliseMemoryEntity(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }

  return output;
}

function splitTaskItems(value: string) {
  return stripLeadingTaskVerb(value)
    .replace(/\b(also|as well|too)\b/gi, " ")
    .replace(/\b(whilst|while)\s+(getting|buying|picking up|collecting|grabbing)\b/gi, " ")
    .split(/,|\band\b|&|\+|\balso need\b|\bi also need\b/gi)
    .map((part) => stripLeadingTaskVerb(part))
    .map((part) => part.replace(/^the\s+/i, "").trim())
    .filter(Boolean);
}

function normalisedTaskItemSet(value: string) {
  return new Set(splitTaskItems(value).map((part) => normalisedTitle(part)).filter(Boolean));
}

function titleVerbPrefix(title: string) {
  const match = title.trim().match(/^(remind me to|remember to|get|buy|pick up|pickup|collect|grab|bring|take|send|call|email|message|purchase|ring)\b/i);
  if (!match) return "";

  const raw = match[1].toLowerCase();
  if (raw === "pickup") return "Pick up";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function composeTaskTitle(originalTitle: string, items: string[]) {
  const cleanItems = items.map((item) => item.trim()).filter(Boolean);
  if (cleanItems.length === 0) return originalTitle;

  const prefix = titleVerbPrefix(originalTitle);
  const body = cleanItems.join(", ");

  return prefix ? `${prefix} ${body}` : body;
}

function taskItemMatches(updateTitle: string | undefined, item: string) {
  const updateKey = normalisedTitle(updateTitle);
  const itemKey = normalisedTitle(item);
  if (!updateKey || !itemKey) return false;
  if (updateKey === itemKey) return true;
  if (updateKey.includes(itemKey) || itemKey.includes(updateKey)) return true;

  const updateWords = new Set(updateKey.split(" ").filter((word) => word.length > 2));
  const itemWords = itemKey.split(" ").filter((word) => word.length > 2);
  return itemWords.length > 0 && itemWords.every((word) => updateWords.has(word));
}

function cloneTaskPart(
  source: EchoTaskEntity,
  title: string,
  status: EchoTaskStatus,
  note: string,
  memoryId?: string
): EchoTaskEntity {
  const updatedAt = new Date().toISOString();

  return {
    ...source,
    id: `${source.id}-${status}-${normalisedTitle(title).replace(/\s+/g, "-")}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    status,
    updatedAt,
    lastMentionedAt: updatedAt,
    closedAt: status === "closed" ? updatedAt : null,
    closedReason: status === "closed" ? note : null,
    energy: status === "closed" ? 0 : Math.max(25, source.energy),
    relatedMemoryIds: memoryId
      ? Array.from(new Set([...source.relatedMemoryIds, memoryId]))
      : source.relatedMemoryIds,
    timeline: [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        at: updatedAt,
        type: status === "closed" ? "closed" : "mentioned",
        note,
        memoryId,
      },
      ...source.timeline,
    ],
  };
}

function transcriptMarksItemStillOpen(transcriptKey: string, itemKey: string) {
  return [
    `didnt have ${itemKey}`,
    `did not have ${itemKey}`,
    `dont have ${itemKey}`,
    `do not have ${itemKey}`,
    `couldnt get ${itemKey}`,
    `could not get ${itemKey}`,
    `couldnt find ${itemKey}`,
    `could not find ${itemKey}`,
    `no ${itemKey}`,
    `${itemKey} was out of stock`,
    `${itemKey} were out of stock`,
    `${itemKey} sold out`,
    `still need ${itemKey}`,
    `need ${itemKey} still`,
  ].some((phrase) => transcriptKey.includes(phrase));
}

function transcriptMentionsItem(transcriptKey: string, itemKey: string) {
  return itemKey.split(" ").filter(Boolean).every((word) => transcriptKey.includes(word));
}

function inferPartiallyClosedItemsFromTranscript(
  targetTask: EchoTaskEntity,
  memory: EchoMemory
) {
  const transcriptKey = normalisedTitle(
    [memory.resolvedTranscript, memory.transcript].filter(Boolean).join(" ")
  ).replace(/'/g, "");

  if (!transcriptKey) return [];

  const hasCompletionSignal = [
    "managed to get",
    "managed to buy",
    "got",
    "bought",
    "picked up",
    "collected",
    "done",
    "sorted",
  ].some((phrase) => transcriptKey.includes(phrase));

  if (!hasCompletionSignal) return [];

  return splitTaskItems(targetTask.title).filter((item) => {
    const itemKey = normalisedTitle(item);
    if (!itemKey || !transcriptMentionsItem(transcriptKey, itemKey)) return false;
    return !transcriptMarksItemStillOpen(transcriptKey, itemKey);
  });
}

function applyPartialCloseToCombinedTask(
  targetTask: EchoTaskEntity,
  update: TaskConversationUpdate,
  memory: EchoMemory
) {
  const items = splitTaskItems(targetTask.title);
  if (items.length <= 1) return false;

  const wholeTaskKey = normalisedTitle(targetTask.title);
  const updateKey = normalisedTitle(update.taskTitle);
  if (!updateKey) return false;

  let closedItems = updateKey === wholeTaskKey
    ? inferPartiallyClosedItemsFromTranscript(targetTask, memory)
    : items.filter((item) => taskItemMatches(update.taskTitle, item));

  if (closedItems.length === 0 || closedItems.length === items.length) return false;

  const closedKeys = new Set(closedItems.map((item) => normalisedTitle(item)));
  const remainingItems = items.filter((item) => !closedKeys.has(normalisedTitle(item)));
  const note = update.reason || "Closed part of a combined task from natural voice update.";
  const updatedAt = new Date().toISOString();

  const openRemainder: EchoTaskEntity = {
    ...targetTask,
    title: composeTaskTitle(targetTask.title, remainingItems),
    status: "open",
    updatedAt,
    lastMentionedAt: updatedAt,
    closedAt: null,
    closedReason: null,
    timesMentioned: targetTask.timesMentioned + 1,
    energy: Math.min(100, targetTask.energy + 4),
    relatedMemoryIds: Array.from(new Set([...targetTask.relatedMemoryIds, memory.id])),
    timeline: [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        at: updatedAt,
        type: "mentioned",
        note: `Split task: still open after partial completion.`,
        memoryId: memory.id,
      },
      ...targetTask.timeline,
    ],
  };

  const closedParts = closedItems.map((item) =>
    cloneTaskPart(
      targetTask,
      composeTaskTitle(targetTask.title, [item]),
      "closed",
      note,
      memory.id
    )
  );

  tasks = [
    ...closedParts,
    ...tasks.map((task) => (task.id === targetTask.id ? openRemainder : task)),
  ];

  console.log("[Echo Tasks] Split combined task from partial completion", {
    original: targetTask.title,
    closed: closedParts.map((task) => task.title),
    remaining: openRemainder.title,
  });

  return true;
}


function itemKeysFromTitle(title?: string | null) {
  return new Set(splitTaskItems(title ?? "").map((item) => normalisedTitle(item)).filter(Boolean));
}

function applyExplicitPartialTaskSplit(
  targetTask: EchoTaskEntity,
  closeUpdate: TaskConversationUpdate,
  keepOpenUpdate: TaskConversationUpdate,
  memory: EchoMemory
) {
  const allItems = splitTaskItems(targetTask.title);
  if (allItems.length <= 1 || !keepOpenUpdate.taskTitle) return false;

  const remainingKeys = itemKeysFromTitle(keepOpenUpdate.taskTitle);
  if (remainingKeys.size === 0) return false;

  const remainingItems = allItems.filter((item) => remainingKeys.has(normalisedTitle(item)));
  const closedItems = allItems.filter((item) => !remainingKeys.has(normalisedTitle(item)));

  if (remainingItems.length === 0 || closedItems.length === 0) return false;

  const updatedAt = new Date().toISOString();
  const openRemainder: EchoTaskEntity = {
    ...targetTask,
    title: composeTaskTitle(targetTask.title, remainingItems),
    status: "open",
    updatedAt,
    lastMentionedAt: updatedAt,
    closedAt: null,
    closedReason: null,
    timesMentioned: targetTask.timesMentioned + 1,
    energy: Math.min(100, targetTask.energy + 4),
    relatedMemoryIds: Array.from(new Set([...targetTask.relatedMemoryIds, memory.id])),
    timeline: [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        at: updatedAt,
        type: "mentioned",
        note: keepOpenUpdate.reason || "Kept remaining part open after partial completion.",
        memoryId: memory.id,
      },
      ...targetTask.timeline,
    ],
  };

  const closedPart = cloneTaskPart(
    targetTask,
    composeTaskTitle(targetTask.title, closedItems),
    "closed",
    closeUpdate.reason || "Closed completed part of a combined task from natural voice update.",
    memory.id
  );

  tasks = [
    closedPart,
    ...tasks.map((task) => (task.id === targetTask.id ? openRemainder : task)),
  ];

  console.log("[Echo Tasks] Split combined task from paired AI lifecycle updates", {
    original: targetTask.title,
    closed: closedPart.title,
    remaining: openRemainder.title,
  });

  return true;
}

function buildTaskTitleWithAdditions(task: EchoTaskEntity, extractedTasks: EchoTask[]) {
  const existingItemKeys = normalisedTaskItemSet(task.title);
  const additions: string[] = [];
  const seenAdditionKeys = new Set<string>();

  for (const extractedTask of extractedTasks) {
    for (const item of splitTaskItems(extractedTask.title)) {
      const key = normalisedTitle(item);
      if (!key || existingItemKeys.has(key) || seenAdditionKeys.has(key)) continue;

      seenAdditionKeys.add(key);
      additions.push(item);
    }
  }

  if (additions.length === 0) return null;
  return `${task.title}, ${additions.join(", ")}`;
}

function extendTaskWithExtractedTasks(task: EchoTaskEntity, extractedTasks: EchoTask[]) {
  const mergedTitle = buildTaskTitleWithAdditions(task, extractedTasks);

  if (!mergedTitle) return task;

  const updatedTask: EchoTaskEntity = {
    ...task,
    title: mergedTitle,
    updatedAt: new Date().toISOString(),
    relatedPeople: uniqueMerge(
      task.relatedPeople,
      extractedTasks.flatMap((extractedTask) => extractedTask.linkedPeople ?? [])
    ),
    relatedPlaces: uniqueMerge(
      task.relatedPlaces,
      extractedTasks.flatMap((extractedTask) => extractedTask.linkedPlaces ?? [])
    ),
    relatedIdeas: uniqueMerge(
      task.relatedIdeas,
      extractedTasks.flatMap((extractedTask) => extractedTask.linkedIdeas ?? [])
    ),
    relatedEvents: uniqueMerge(
      task.relatedEvents,
      extractedTasks.flatMap((extractedTask) => extractedTask.linkedEvents ?? [])
    ),
  };

  tasks = tasks.map((existingTask) =>
    existingTask.id === task.id ? updatedTask : existingTask
  );
  void persistTasks();

  console.log("[Echo Tasks] Extended existing task", updatedTask);

  return updatedTask;
}

function createExtractedTask(extractedTask: EchoTask, memory: EchoMemory) {
  const task = createTaskFromMemoryTask(extractedTask, memory);
  tasks = [task, ...tasks];
  void persistTasks();
  console.log("[Echo Tasks] Created task from extracted task", task);
  return task;
}
export function getTasks() {
  return tasks;
}

export function getOutstandingTasks() {
  return tasks.filter(isOutstanding);
}

export function upsertTasksFromMemory(memory: EchoMemory) {
  console.log("[Echo Tasks] Upsert start", memory);

  const extractedTasks = memory.tasks ?? [];
  const updates = memory.conversationTaskUpdates ?? [];

  const keepOpenTargetIds = new Set<string>();
  const terminalTargetIds = new Set<string>();
  const consumedExtractedTaskTitles = new Set<string>();
  const handledUpdateKeys = new Set<string>();

  const validUpdates = updates.filter(isValidLifecycleUpdate);

  for (const closeUpdate of validUpdates.filter((update) => update.action === "close")) {
    const matchingKeepOpen = validUpdates.find(
      (update) =>
        update.action === "keep_open" &&
        update.taskId === closeUpdate.taskId &&
        Boolean(update.taskTitle)
    );

    if (!matchingKeepOpen || !closeUpdate.taskId) continue;

    const targetTask = findTaskById(closeUpdate.taskId);
    if (!targetTask) continue;

    if (applyExplicitPartialTaskSplit(targetTask, closeUpdate, matchingKeepOpen, memory)) {
      handledUpdateKeys.add(`${closeUpdate.action}:${closeUpdate.taskId}:${normalisedTitle(closeUpdate.taskTitle)}`);
      handledUpdateKeys.add(`${matchingKeepOpen.action}:${matchingKeepOpen.taskId}:${normalisedTitle(matchingKeepOpen.taskTitle)}`);
      keepOpenTargetIds.add(targetTask.id);
      terminalTargetIds.add(targetTask.id);
      console.log("[Echo Tasks] Applied paired partial lifecycle updates", { closeUpdate, matchingKeepOpen });
    }
  }

  for (const update of validUpdates) {
    const updateKey = `${update.action}:${update.taskId}:${normalisedTitle(update.taskTitle)}`;
    if (handledUpdateKeys.has(updateKey)) continue;
    const targetTask = findTaskById(update.taskId);
    if (!targetTask) continue;

    if (update.action === "close") {
      const wasPartialClose = applyPartialCloseToCombinedTask(targetTask, update, memory);

      if (!wasPartialClose) {
        tasks = tasks.map((task) =>
          task.id === targetTask.id
            ? applyTaskAction(
                task,
                "closed",
                update.reason || "Closed from natural voice update.",
                memory.id
              )
            : task
        );
      }

      terminalTargetIds.add(targetTask.id);
    }

    if (update.action === "postpone") {
      const dueLabel = extractedTasks[0]?.due ?? targetTask.dueLabel ?? "later";

      tasks = tasks.map((task) =>
        task.id === targetTask.id
          ? applyTaskAction(
              task,
              "postponed",
              update.reason || "Postponed from natural voice update.",
              memory.id,
              dueLabel
            )
          : task
      );
      terminalTargetIds.add(targetTask.id);
    }

    if (update.action === "keep_open") {
      tasks = tasks.map((task) =>
        task.id === targetTask.id
          ? applyTaskAction(
              task,
              "open",
              update.reason || "Mentioned again and kept open.",
              memory.id
            )
          : task
      );
      keepOpenTargetIds.add(targetTask.id);
    }

    console.log("[Echo Tasks] Applied AI lifecycle update", update);
  }

  if (terminalTargetIds.size > 0) {
    for (const extractedTask of extractedTasks) {
      consumedExtractedTaskTitles.add(normalisedTitle(extractedTask.title));
    }
  }

  if (keepOpenTargetIds.size > 0 && extractedTasks.length > 0) {
    for (const taskId of keepOpenTargetIds) {
      const targetTask = findTaskById(taskId);
      if (!targetTask || !isOutstanding(targetTask)) continue;

      extendTaskWithExtractedTasks(targetTask, extractedTasks);

      for (const extractedTask of extractedTasks) {
        consumedExtractedTaskTitles.add(normalisedTitle(extractedTask.title));
      }
    }
  }

  for (const extractedTask of extractedTasks) {
    const title = extractedTask.title?.trim();
    if (!title) continue;

    const key = normalisedTitle(title);

    if (consumedExtractedTaskTitles.has(key)) {
      console.log("[Echo Tasks] Skipped consumed extracted task", extractedTask);
      continue;
    }

    if (hasExactOutstandingDuplicate(title)) {
      console.log("[Echo Tasks] Skipped exact duplicate extracted task", extractedTask);
      continue;
    }

    createExtractedTask(extractedTask, memory);
  }

  console.log("[Echo Tasks] Upsert complete", tasks);
  void persistTasks();
  emit();
}

export function setTaskStatus(
  taskId: string,
  status: EchoTaskStatus,
  note?: string,
  dueLabel?: string | null
) {  tasks = tasks.map((task) =>
    task.id === taskId
      ? applyTaskAction(task, status, note ?? `Marked ${status}.`, undefined, dueLabel)
      : task
  );
  void persistTasks();
  emit();
}

export function postponeTask(taskId: string, dueLabel = "later") {  setTaskStatus(taskId, "postponed", `Postponed until ${dueLabel}.`, dueLabel);
}

export function keepTaskOpen(taskId: string) {
  setTaskStatus(taskId, "open", "Kept open.");
}

export function closeTask(taskId: string) {
  setTaskStatus(taskId, "closed", "Marked done.");
}

export function matchTasksForPrompt(prompt: string, limit = 6) {
  const scored = tasks
    .map((task) => {
      const match = findClosestTask(prompt, [task], { includeClosed: true });
      return { task, confidence: match?.confidence ?? 0 };
    })
    .filter((item) => item.confidence > 0.08)
    .sort((a, b) => b.confidence - a.confidence);

  return scored.slice(0, limit).map((item) => item.task);
}

export function clearTasks() {
  tasks = [];
  emit();
  void persistTasks();
}

export function useTasks() {
  useEffect(() => {
    void hydrateTasks();
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
