import { useSyncExternalStore } from "react";
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
let tasks: EchoTaskEntity[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
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

function extendTaskWithExtractedTasks(task: EchoTaskEntity, extractedTasks: EchoTask[]) {
  const existingParts = task.title
    .split(",")
    .map((part) => normalisedTitle(part))
    .filter(Boolean);

  const additions = extractedTasks
    .map((extractedTask) => stripLeadingTaskVerb(extractedTask.title))
    .filter(Boolean)
    .filter((addition) => !existingParts.includes(normalisedTitle(addition)));

  if (additions.length === 0) return task;

  const updatedTask: EchoTaskEntity = {
    ...task,
    title: `${task.title}, ${additions.join(", ")}`,
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

  console.log("[Echo Tasks] Extended existing task", updatedTask);

  return updatedTask;
}

function createExtractedTask(extractedTask: EchoTask, memory: EchoMemory) {
  const task = createTaskFromMemoryTask(extractedTask, memory);
  tasks = [task, ...tasks];
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

  for (const update of updates) {
    if (!isValidLifecycleUpdate(update)) continue;

    const targetTask = findTaskById(update.taskId);
    if (!targetTask) continue;

    if (update.action === "close") {
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
}

export function useTasks() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}