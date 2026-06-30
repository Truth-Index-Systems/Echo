import type { EchoMemory, EchoReminderCandidate, EchoReminderSettings, EchoTaskEntity } from "../types/memory";
import { cancelEchoReminderNotifications, scheduleEchoNotification } from "./notificationService";

const REMINDER_CHANNEL_ID = "echo-reminders";

function dailyTrigger(hour: number, minute = 0) {
  return {
    type: "daily",
    hour,
    minute,
    channelId: REMINDER_CHANNEL_ID,
  } as any;
}

function nextDateTrigger(hour: number, minute = 0) {
  const now = new Date();
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  if (date <= now) date.setDate(date.getDate() + 1);

  return {
    type: "date",
    date,
    channelId: REMINDER_CHANNEL_ID,
  } as any;
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

  if (task.timesMentioned > 1) {
    return `You mentioned this ${task.timesMentioned} times and it is still open.`;
  }

  return "You told Echo this mattered, and it is still open.";
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

  for (const [index, reminder] of taskReminders.entries()) {
    await scheduleEchoNotification({
      identifier: reminder.id,
      title: reminder.title,
      body: reminder.body,
      data: { type: reminder.type, taskId: reminder.taskId ?? "" },
      trigger: nextDateTrigger(10 + index * 2, 0),
    });
  }
}
