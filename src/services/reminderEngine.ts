import type { EchoMemory, EchoReminderCandidate, EchoReminderSettings, EchoTaskEntity } from "../types/memory";
import { cancelEchoReminderNotifications, scheduleEchoNotification } from "./notificationService";

const REMINDER_CHANNEL_ID = "echo-reminders";

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

function dailyTrigger(hour: number, minute = 0) {
  return {
    type: "daily",
    hour,
    minute,
    channelId: REMINDER_CHANNEL_ID,
  } as any;
}

function dateTrigger(date: Date) {
  return {
    type: "date",
    date,
    channelId: REMINDER_CHANNEL_ID,
  } as any;
}

function nextDateAt(hour: number, minute = 0) {
  const now = new Date();
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  if (date <= now) date.setDate(date.getDate() + 1);
  return date;
}

function normalizeHourForReminder(rawHour: number, label: string) {
  const lower = label.toLowerCase();
  const hasPm = /\b(pm|p\.m\.|evening|tonight|afternoon)\b/.test(lower);
  const hasAm = /\b(am|a\.m\.|morning)\b/.test(lower);

  if (hasPm && rawHour < 12) return rawHour + 12;
  if (hasAm && rawHour === 12) return 0;

  if (!hasAm && !hasPm && rawHour >= 1 && rawHour <= 7) {
    return rawHour + 12;
  }

  return rawHour;
}

function parseHour(value: string) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  return NUMBER_WORDS[value.toLowerCase()] ?? null;
}

function parseDayOffset(label: string) {
  const lower = label.toLowerCase();
  if (/\btomorrow\b/.test(lower)) return 1;
  return 0;
}

function withDayOffset(date: Date, label: string) {
  const offset = parseDayOffset(label);
  if (offset > 0) date.setDate(date.getDate() + offset);
  return date;
}

export function parseExactReminderDate(label?: string | null) {
  if (!label) return null;

  const text = label
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return null;

  const halfMatch = text.match(/\bhalf\s+(?:past\s+)?(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d{1,2})\b/);
  if (halfMatch) {
    const parsedHour = parseHour(halfMatch[1]);
    if (parsedHour !== null && parsedHour >= 1 && parsedHour <= 23) {
      const hour = normalizeHourForReminder(parsedHour, text);
      const date = withDayOffset(nextDateAt(hour, 30), text);
      if (date.getTime() > Date.now() + 5000) return date;
    }
  }

  const colonMatch = text.match(/\b(?:at\s*)?(\d{1,2})[:.](\d{2})\s*(am|pm|a\.m\.|p\.m\.)?\b/);
  if (colonMatch) {
    const rawHour = Number(colonMatch[1]);
    const minute = Number(colonMatch[2]);
    if (rawHour >= 0 && rawHour <= 23 && minute >= 0 && minute <= 59) {
      const suffix = colonMatch[3] ? ` ${colonMatch[3]}` : "";
      const hour = normalizeHourForReminder(rawHour, `${text}${suffix}`);
      const date = withDayOffset(nextDateAt(hour, minute), text);
      if (date.getTime() > Date.now() + 5000) return date;
    }
  }

  const oclockMatch = text.match(/\b(?:at\s*)?(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d{1,2})\s*(am|pm|a\.m\.|p\.m\.|oclock|o clock)?\b/);
  if (oclockMatch && /\b(at|am|pm|a\.m\.|p\.m\.|oclock|o clock|morning|afternoon|evening|tonight|tomorrow)\b/.test(text)) {
    const parsedHour = parseHour(oclockMatch[1]);
    if (parsedHour !== null && parsedHour >= 0 && parsedHour <= 23) {
      const suffix = oclockMatch[2] ? ` ${oclockMatch[2]}` : "";
      const hour = normalizeHourForReminder(parsedHour, `${text}${suffix}`);
      const date = withDayOffset(nextDateAt(hour, 0), text);
      if (date.getTime() > Date.now() + 5000) return date;
    }
  }

  return null;
}

function styleDailyLimit(style: EchoReminderSettings["style"]) {
  if (style === "quiet") return 1;
  if (style === "active") return 4;
  return 3;
}

function shouldIncludeTask(task: EchoTaskEntity, settings: EchoReminderSettings) {
  if (!settings.taskRemindersEnabled) return false;
  if (!task.reminderEnabled) return false;
  if (task.status === "closed") return false;
  if (task.status === "postponed") return true;
  if (settings.style === "quiet") return task.energy >= 78 || Boolean(task.dueLabel);
  if (settings.style === "active") return task.energy >= 45;
  return task.energy >= 58 || Boolean(task.dueLabel);
}

function taskBody(task: EchoTaskEntity) {
  if (task.status === "postponed") {
    return task.dueLabel
      ? `Echo still remembers this for ${task.dueLabel.toLowerCase()}.`
      : "Echo still remembers this for later.";
  }

  if (task.dueLabel) {
    return `You asked Echo to remind you: ${task.title}.`;
  }

  if (task.timesMentioned > 1) {
    return `You mentioned this ${task.timesMentioned} times and it is still open.`;
  }

  return "You told Echo this mattered, and it is still open.";
}

function exactReminderCandidates(tasks: EchoTaskEntity[], settings: EchoReminderSettings): Array<EchoReminderCandidate & { scheduledFor: Date }> {
  if (!settings.taskRemindersEnabled) return [];

  return tasks
    .filter((task) => task.status !== "closed" && task.reminderEnabled)
    .map((task) => {
      const scheduledFor = parseExactReminderDate(task.dueAt ?? task.dueLabel);
      if (!scheduledFor) return null;

      return {
        id: `echo-exact-task-${task.id}`,
        type: "task" as const,
        title: `Echo reminder: ${task.title}`,
        body: taskBody(task),
        taskId: task.id,
        scheduleLabel: task.dueLabel ?? "Scheduled reminder",
        priority: 100,
        scheduledFor,
      };
    })
    .filter(Boolean) as Array<EchoReminderCandidate & { scheduledFor: Date }>;
}

export function buildReminderCandidates(
  memories: EchoMemory[],
  tasks: EchoTaskEntity[],
  settings: EchoReminderSettings
): EchoReminderCandidate[] {
  const candidates: EchoReminderCandidate[] = [];
  const openTasks = tasks
    .filter((task) => shouldIncludeTask(task, settings))
    .sort((a, b) => b.energy - a.energy);

  if (settings.morningBriefEnabled) {
    const top = openTasks.slice(0, 3).map((task) => `• ${task.title}`).join("\n");
    candidates.push({
      id: "echo-morning-brief",
      type: "morning_brief",
      title: "Good morning.",
      body: top ? `Echo remembers:\n${top}` : "Echo is ready when something is worth remembering.",
      scheduleLabel: "Every morning",
      priority: 80,
    });
  }

  if (settings.eveningReflectionEnabled) {
    candidates.push({
      id: "echo-evening-reflection",
      type: "evening_reflection",
      title: "Anything worth remembering from today?",
      body: memories.length > 0
        ? "One quick thought can keep your memory complete."
        : "Speak naturally and Echo will remember it.",
      scheduleLabel: "Every evening",
      priority: 60,
    });
  }

  for (const task of openTasks.slice(0, styleDailyLimit(settings.style))) {
    if (parseExactReminderDate(task.dueAt ?? task.dueLabel)) continue;

    candidates.push({
      id: `echo-task-${task.id}`,
      type: task.status === "postponed" ? "postponed_task" : "task",
      title: `Echo remembers: ${task.title}`,
      body: taskBody(task),
      taskId: task.id,
      scheduleLabel: task.dueLabel ?? "Gentle reminder",
      priority: task.energy,
    });
  }

  return candidates.sort((a, b) => b.priority - a.priority);
}

export function hasExactReminderTask(tasks: EchoTaskEntity[]) {
  return tasks.some(
    (task) => task.status !== "closed" && task.reminderEnabled && Boolean(parseExactReminderDate(task.dueAt ?? task.dueLabel))
  );
}

export async function syncEchoReminderNotifications(
  memories: EchoMemory[],
  tasks: EchoTaskEntity[],
  settings: EchoReminderSettings
) {
  if (!settings.enabled || settings.permissionStatus !== "granted") {
    await cancelEchoReminderNotifications();
    return;
  }

  await cancelEchoReminderNotifications();

  const exactTaskReminders = exactReminderCandidates(tasks, settings);
  const candidates = buildReminderCandidates(memories, tasks, settings);
  const morning = candidates.find((candidate) => candidate.type === "morning_brief");
  const evening = candidates.find((candidate) => candidate.type === "evening_reflection");
  const taskReminders = candidates
    .filter((candidate) => candidate.type === "task" || candidate.type === "postponed_task")
    .slice(0, styleDailyLimit(settings.style));

  if (morning) {
    await scheduleEchoNotification({
      identifier: morning.id,
      title: morning.title,
      body: morning.body,
      data: { type: morning.type },
      trigger: dailyTrigger(8, 15),
    });
  }

  if (evening) {
    await scheduleEchoNotification({
      identifier: evening.id,
      title: evening.title,
      body: evening.body,
      data: { type: evening.type },
      trigger: dailyTrigger(20, 30),
    });
  }

  for (const reminder of exactTaskReminders) {
    await scheduleEchoNotification({
      identifier: reminder.id,
      title: reminder.title,
      body: reminder.body,
      data: { type: reminder.type, taskId: reminder.taskId ?? "" },
      trigger: dateTrigger(reminder.scheduledFor),
    });

    console.log("[Echo Reminders] Scheduled exact reminder", {
      taskId: reminder.taskId,
      title: reminder.title,
      due: reminder.scheduleLabel,
      scheduledFor: reminder.scheduledFor.toISOString(),
    });
  }

  for (const [index, reminder] of taskReminders.entries()) {
    await scheduleEchoNotification({
      identifier: reminder.id,
      title: reminder.title,
      body: reminder.body,
      data: { type: reminder.type, taskId: reminder.taskId ?? "" },
      trigger: dateTrigger(nextDateAt(10 + index * 2, 0)),
    });
  }
}
