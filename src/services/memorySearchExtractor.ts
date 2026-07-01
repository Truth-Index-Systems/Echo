import type {
  MemorySearchIntent,
  MemorySearchQuery,
  MemorySearchTarget,
} from "../types/memory";
import { uniqueNormalised } from "../utils/memoryNormaliser";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

const validSearchIntents: MemorySearchIntent[] = [
  "recall",
  "question",
  "timeline",
  "relationship",
  "task",
  "general",
];

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return uniqueNormalised(
    value.filter((item): item is string => typeof item === "string")
  );
}

const validTargetTypes: MemorySearchTarget[] = [
  "people",
  "places",
  "ideas",
  "events",
  "tasks",
  "memories",
];

function inferTargetTypes(prompt: string): MemorySearchTarget[] {
  const lowerPrompt = prompt.toLowerCase();
  const targets: MemorySearchTarget[] = [];

  if (/\b(person|people|who|name|someone|somebody)\b/.test(lowerPrompt)) {
    targets.push("people");
  }

  if (/\b(place|where|location|shop|tesco|tip)\b/.test(lowerPrompt)) {
    targets.push("places");
  }

  if (/\b(idea|thought|concept|feature|improvement|build|product)\b/.test(lowerPrompt)) {
    targets.push("ideas");
  }

  if (/\b(event|appointment|meeting|call|visit|trip|deadline|birthday|shift)\b/.test(lowerPrompt)) {
    targets.push("events");
  }

  if (/\b(task|todo|to do|promise|promised|remind|chase|needed to|need to|forgot)\b/.test(lowerPrompt)) {
    targets.push("tasks");
  }

  return targets.length > 0 ? Array.from(new Set(targets)) : ["memories"];
}

function safeTargetArray(value: unknown, prompt: string): MemorySearchTarget[] {
  if (!Array.isArray(value)) return inferTargetTypes(prompt);

  const values = value.filter(
    (item): item is MemorySearchTarget =>
      typeof item === "string" &&
      validTargetTypes.includes(item.toLowerCase() as MemorySearchTarget)
  );

  return values.length > 0
    ? Array.from(new Set(values.map((item) => item.toLowerCase() as MemorySearchTarget)))
    : inferTargetTypes(prompt);
}

function fallbackSearchQuery(prompt: string): MemorySearchQuery {
  const words = prompt
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2)
    .slice(0, 12);

  const lowerPrompt = prompt.toLowerCase();
  const timelineWords = [
    "first",
    "earliest",
    "recent",
    "latest",
    "last",
    "newest",
    "most recent",
    "before",
    "after",
    "yesterday",
    "today",
    "tomorrow",
    "week",
    "month",
    "deadline",
    "soon",
  ];

  return {
    originalPrompt: prompt,
    intent: lowerPrompt.includes("connect")
      ? "relationship"
      : timelineWords.some((word) => lowerPrompt.includes(word))
      ? "timeline"
      : lowerPrompt.includes("task") || lowerPrompt.includes("remind")
      ? "task"
      : "general",
    targetTypes: inferTargetTypes(prompt),
    people: [],
    places: [],
    ideas: [],
    events: [],
    tasks: [],
    timeHints: timelineWords.filter((word) => lowerPrompt.includes(word)),
    keywords: words,
  };
}

export async function extractMemorySearchQuery(
  prompt: string
): Promise<MemorySearchQuery> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing EXPO_PUBLIC_OPENAI_API_KEY");
  }

  const response = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      temperature: 0.05,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You extract structured search intent from a user's personal memory prompt. Return valid JSON only. Stable nodes must be short, reusable, and clean.",
        },
        {
          role: "user",
          content: `
Extract this memory prompt into JSON.

Prompt:
"${prompt}"

Return exactly this shape:
{
  "originalPrompt": "${prompt}",
  "intent": "recall | question | timeline | relationship | task | general",
  "targetTypes": [],
  "people": [],
  "places": [],
  "ideas": [],
  "events": [],
  "tasks": [],
  "timeHints": [],
  "keywords": []
}

Rules:
- Extract people, places, ideas and events as stable memory node names.
- Extract targetTypes as the kind of thing the user wants returned: people, places, ideas, events, tasks, or memories.
- For prompts like "latest idea", targetTypes must include "ideas".
- For prompts like "last person I asked about X" or "who was the last person", targetTypes must include "people".
- For prompts like "last event I mentioned about Y", targetTypes must include "events".
- Extract tasks only as short action/commitment labels when the prompt asks about reminders, promises, things to do, chasing, completing, forgetting, or commitments.
- Extract timeHints such as first, earliest, recent, latest, yesterday, today, tomorrow, last week, next week, before, after, soon, overdue, deadline, morning, afternoon, evening, or any date phrase.
- Use the same naming style as stored memories.
- Prefer 1-3 word reusable labels.
- Use Title Case for people, places, ideas, events and task labels.
- Ideas should be short concept tags, max 3 words.
- Events should be short reusable event names.
- Keywords should include useful search words that may not fit people, places, ideas, events or tasks.
- Do not include filler words in keywords.
- Do not invent facts.
- If the prompt asks "when did I", "first", "last", "most recent", "latest", "before", "after", or about sequence, prefer intent "timeline".
- If the prompt asks "what was that", "what did I say about", "remind me what", or asks to remember information, prefer intent "recall".
- If the prompt asks about a relationship between things, prefer intent "relationship".
- If the prompt asks what the user needed to do, promised, chased, reminded themselves about, forgot, or completed, prefer intent "task".
- If the prompt asks a direct question about remembered information, prefer intent "question".

Examples:

Prompt:
"What was that idea I had about the memory network feeling alive?"

Return:
{
  "originalPrompt": "What was that idea I had about the memory network feeling alive?",
  "intent": "recall",
  "targetTypes": ["ideas"],
  "people": [],
  "places": [],
  "ideas": ["Living Memory", "Memory Network"],
  "events": [],
  "tasks": [],
  "timeHints": [],
  "keywords": ["memory", "network", "alive"]
}

Prompt:
"When did I first mention going to the tip?"

Return:
{
  "originalPrompt": "When did I first mention going to the tip?",
  "intent": "timeline",
  "targetTypes": ["places"],
  "people": [],
  "places": ["Tip"],
  "ideas": [],
  "events": [],
  "tasks": [],
  "timeHints": ["First"],
  "keywords": ["mention", "going"]
}

Prompt:
"What connects James and Echo?"

Return:
{
  "originalPrompt": "What connects James and Echo?",
  "intent": "relationship",
  "targetTypes": ["memories"],
  "people": ["James"],
  "places": [],
  "ideas": ["Echo"],
  "events": [],
  "tasks": [],
  "timeHints": [],
  "keywords": ["connects"]
}

Prompt:
"What was the latest idea I had?"

Return:
{
  "originalPrompt": "What was the latest idea I had?",
  "intent": "timeline",
  "targetTypes": ["ideas"],
  "people": [],
  "places": [],
  "ideas": [],
  "events": [],
  "tasks": [],
  "timeHints": ["Latest"],
  "keywords": ["idea"]
}

Prompt:
"Who was the last person I asked about Echo?"

Return:
{
  "originalPrompt": "Who was the last person I asked about Echo?",
  "intent": "timeline",
  "targetTypes": ["people"],
  "people": [],
  "places": [],
  "ideas": ["Echo"],
  "events": [],
  "tasks": [],
  "timeHints": ["Last"],
  "keywords": ["asked", "Echo"]
}

Prompt:
"What did I need to do before the dentist appointment?"

Return:
{
  "originalPrompt": "What did I need to do before the dentist appointment?",
  "intent": "task",
  "targetTypes": ["tasks"],
  "people": [],
  "places": [],
  "ideas": [],
  "events": ["Dentist Appointment"],
  "tasks": [],
  "timeHints": ["Before"],
  "keywords": ["dentist", "appointment"]
}
`,
        },
      ],
    }),
  });

  if (!response.ok) {
    return fallbackSearchQuery(prompt);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    return fallbackSearchQuery(prompt);
  }

  try {
    const parsed = JSON.parse(content) as Partial<MemorySearchQuery>;

    const intent = validSearchIntents.includes(
      parsed.intent as MemorySearchIntent
    )
      ? (parsed.intent as MemorySearchIntent)
      : "general";

    return {
      originalPrompt:
        typeof parsed.originalPrompt === "string" &&
        parsed.originalPrompt.trim()
          ? parsed.originalPrompt.trim()
          : prompt,
      intent,
      targetTypes: safeTargetArray(parsed.targetTypes, prompt),
      people: safeStringArray(parsed.people),
      places: safeStringArray(parsed.places),
      ideas: safeStringArray(parsed.ideas),
      events: safeStringArray(parsed.events),
      tasks: safeStringArray(parsed.tasks),
      timeHints: safeStringArray(parsed.timeHints),
      keywords: safeStringArray(parsed.keywords),
    };
  } catch {
    return fallbackSearchQuery(prompt);
  }
}
