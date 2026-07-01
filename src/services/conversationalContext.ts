import type {
  ConversationContinuityResult,
  ConversationContinuitySnapshot,
  EchoMemory,
  EchoTaskEntity,
  TaskConversationUpdate,
} from "../types/memory";
import { displayMemoryEntity, normaliseMemoryEntity } from "../utils/memoryNormaliser";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

function uniqueClean(values: string[], limit = 12) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const key = normaliseMemoryEntity(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(displayMemoryEntity(key));
    if (output.length >= limit) break;
  }

  return output;
}

export function buildRecentMemoryContext(memories: EchoMemory[], limit = 8) {
  return memories.slice(0, limit).map((memory, index) => {
    const tasks = memory.tasks.map((task) => task.title).join(", ") || "none";

    return [
      `Memory ${index + 1}`,
      `Summary: ${memory.summary}`,
      `Transcript: ${memory.transcript}`,
      memory.resolvedTranscript ? `Resolved transcript: ${memory.resolvedTranscript}` : null,
      `People: ${memory.people.join(", ") || "none"}`,
      `Places: ${memory.places.join(", ") || "none"}`,
      `Ideas: ${memory.ideas.join(", ") || "none"}`,
      `Events: ${memory.events.join(", ") || "none"}`,
      `Tasks: ${tasks}`,
    ]
      .filter(Boolean)
      .join("\n");
  });
}

export function buildConversationContinuitySnapshot(
  memories: EchoMemory[],
  existingTasks: EchoTaskEntity[] = [],
  limit = 8
): ConversationContinuitySnapshot {
  const recent = memories.slice(0, limit);
  const activeTaskSummaries = existingTasks
    .filter((task) => task.status !== "closed")
    .slice(0, 12)
    .map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      dueLabel: task.dueLabel,
      relatedPeople: task.relatedPeople,
      relatedPlaces: task.relatedPlaces,
      relatedIdeas: task.relatedIdeas,
      relatedEvents: task.relatedEvents,
      lastMentionedAt: task.lastMentionedAt,
      energy: task.energy,
    }));

  return {
    activePeople: uniqueClean(recent.flatMap((memory) => memory.people)),
    activePlaces: uniqueClean(recent.flatMap((memory) => memory.places)),
    activeIdeas: uniqueClean(recent.flatMap((memory) => memory.ideas)),
    activeEvents: uniqueClean(recent.flatMap((memory) => memory.events)),
    activeTasks: uniqueClean([
      ...recent.flatMap((memory) => memory.tasks.map((task) => task.title)),
      ...activeTaskSummaries.map((task) => task.title),
    ]),
    activeTaskSummaries,
    recentMemorySummaries: recent.map((memory) => ({
      id: memory.id,
      summary: memory.summary,
      transcript: memory.transcript,
      resolvedTranscript: memory.resolvedTranscript,
      people: memory.people,
      places: memory.places,
      ideas: memory.ideas,
      events: memory.events,
      tasks: memory.tasks.map((task) => task.title),
    })),
  };
}

const unresolvedContinuity = (
  transcript: string,
  snapshot: ConversationContinuitySnapshot
): ConversationContinuityResult => ({
  originalTranscript: transcript,
  resolvedTranscript: transcript,
  references: [],
  taskUpdates: [],
  confidence: 0,
  snapshot,
});

function safeReferences(value: unknown): ConversationContinuityResult["references"] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const ref = item as Record<string, unknown>;
      const type = ref.type;

      if (
        type !== "people" &&
        type !== "places" &&
        type !== "ideas" &&
        type !== "events" &&
        type !== "tasks"
      ) {
        return null;
      }

      return {
        token: typeof ref.token === "string" ? ref.token.trim() : "",
        type,
        resolved: typeof ref.resolved === "string" ? ref.resolved.trim() : "",
        confidence:
          typeof ref.confidence === "number"
            ? Math.max(0, Math.min(1, ref.confidence))
            : 0,
        reason: typeof ref.reason === "string" ? ref.reason.trim() : "",
      };
    })
    .filter(
      (item): item is ConversationContinuityResult["references"][number] =>
        Boolean(item && item.token && item.resolved)
    );
}

function safeTaskUpdates(value: unknown): TaskConversationUpdate[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const update = item as Record<string, unknown>;
      const action = update.action;

      if (
        action !== "create" &&
        action !== "close" &&
        action !== "postpone" &&
        action !== "keep_open" &&
        action !== "ignore"
      ) {
        return null;
      }

      const safeUpdate: TaskConversationUpdate = {        action,
        taskId: typeof update.taskId === "string" ? update.taskId.trim() : undefined,
        taskTitle:
          typeof update.taskTitle === "string" ? update.taskTitle.trim() : undefined,
        confidence:
          typeof update.confidence === "number"
            ? Math.max(0, Math.min(1, update.confidence))
            : 0,
        reason: typeof update.reason === "string" ? update.reason.trim() : "Most likely conversational task update.",
      };

      return safeUpdate;    })
    .filter(
      (item): item is TaskConversationUpdate =>
        Boolean(item && item.confidence > 0 && (item.taskId || item.taskTitle || item.action === "ignore"))
    );
}

export async function resolveConversationContinuity(
  transcript: string,
  memories: EchoMemory[],
  existingTasks: EchoTaskEntity[] = []
): Promise<ConversationContinuityResult> {
  const snapshot = buildConversationContinuitySnapshot(memories, existingTasks);
  const hasContext =
    snapshot.activePeople.length > 0 ||
    snapshot.activePlaces.length > 0 ||
    snapshot.activeIdeas.length > 0 ||
    snapshot.activeEvents.length > 0 ||
    snapshot.activeTasks.length > 0 ||
    (snapshot.activeTaskSummaries?.length ?? 0) > 0;

  if (!hasContext) return unresolvedContinuity(transcript, snapshot);

  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) return unresolvedContinuity(transcript, snapshot);

  try {
    const response = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are Echo's Conversation Understanding Engine. Decide the most likely meaning of the user's latest spoken memory using only the supplied active context. You propose reference resolutions and task lifecycle updates; the app will decide what to apply. Return valid JSON only.",
          },
          {
            role: "user",
            content: `
Current transcript:
"${transcript}"

Active context:
${JSON.stringify(snapshot, null, 2)}

Return exactly this JSON shape:
{
  "resolvedTranscript": "natural version of the transcript with implicit references clarified only when useful",
  "references": [
    {
      "token": "her | him | there | it | that | the meeting | the task | etc",
      "type": "people | places | ideas | events | tasks",
      "resolved": "canonical active entity name",
      "confidence": 0.95,
      "reason": "short explanation"
    }
  ],
  "taskUpdates": [
    {
      "action": "create | close | postpone | keep_open | ignore",
      "taskId": "existing task id when updating an active task",
      "taskTitle": "existing or new task title",
      "confidence": 0.95,
      "reason": "short explanation"
    }
  ],
  "confidence": 0.95
}

Core instruction:
- Do not follow rigid pronoun rules. Decide what the user most likely means in context.
- Use active context, open tasks and recent memories together.
- Do not invent old context. If uncertain, lower confidence or omit the update.

Reference behaviour:
- Resolve conversational references such as her, him, them, there, it, that, this, those, the first one, the second one, the meeting, the appointment, the idea, the task.
- If the user says "my wife" and an active person already represents that person, use the existing canonical name.
- If the user says "when I get there" and the active place is clearly the likely destination, resolve it.
- If the user says "that idea", resolve to the most likely active idea.

Task behaviour:
- taskUpdates is ONLY for existing active tasks.
- Never use taskUpdates to create a new task.
- New tasks/reminders must be returned only by the memory extraction JSON in memory.tasks.
- Allowed taskUpdates actions are: close, postpone, keep_open, ignore.
- If the transcript sounds like an existing open task was completed, return action "close" with that taskId.
- A single transcript can satisfy several active tasks. Return one taskUpdates entry per satisfied task; do not stop after the first match.
- Example: active tasks "Ring Mum" and "Mention charity football tournament idea to Mum". Transcript "I rang Mum and mentioned the tournament" must close BOTH tasks.
- If the transcript sounds like an existing open task is still outstanding, return "keep_open".
- If it moves an existing task later, return "postpone".
- If it is a brand-new reminder/task, return no taskUpdates here.
- Completion phrases may be indirect: "I rang her", "that's sorted", "I've done both", "finished that", "booked it", "paid it", "sent it over".
- For collective statements like "I've done them both" or "they're completed", update the most likely open tasks if context is clear.
- For mixed completion statements, split intent by item. Example: if active task is "Get milk, crisps" and transcript says "managed to get milk, they didn't have crisps", return TWO updates with the same existing taskId: close taskTitle "milk" and keep_open taskTitle "crisps".
- For partial task updates, taskTitle should name the specific item being changed, not the whole combined task.
- Never create a new task from completion language.
- If taskUpdates contains an existing taskId, it must be copied exactly from activeTaskSummaries.

Examples:
1. Open task: Call Wife. Transcript: "I rang her."
=> resolve her to Wife and close task Call Wife.

2. Open tasks: Call Wife, Take Paint To Tip. Transcript: "I've done both."
=> close both tasks if those are the clear active tasks.

3. Recent place: Tip. Transcript: "When I get there, remind me to take the paint."
=> resolve there to Tip and create task Take Paint To Tip.

4. Open task: Email Steve. Transcript: "Still haven't emailed him."
=> resolve him if clear and keep_open task Email Steve.
`,
          },
        ],
      }),
    });

    if (!response.ok) return unresolvedContinuity(transcript, snapshot);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return unresolvedContinuity(transcript, snapshot);

    const parsed = JSON.parse(content) as Partial<ConversationContinuityResult>;

    return {
      originalTranscript: transcript,
      resolvedTranscript:
        typeof parsed.resolvedTranscript === "string" &&
        parsed.resolvedTranscript.trim()
          ? parsed.resolvedTranscript.trim()
          : transcript,
      references: safeReferences(parsed.references),
      taskUpdates: safeTaskUpdates(parsed.taskUpdates),
      confidence:
        typeof parsed.confidence === "number"
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0,
      snapshot,
    };
  } catch {
    return unresolvedContinuity(transcript, snapshot);
  }
}
