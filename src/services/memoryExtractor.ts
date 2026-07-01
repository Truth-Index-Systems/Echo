import type {
  ConversationContinuityResult,
  EchoMemory,
  EchoTask,
  MemoryCategory,
} from "../types/memory";
import { uniqueNormalised } from "../utils/memoryNormaliser";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

type ExtractedMemory = Omit<
  EchoMemory,
  "id" | "createdAt" | "audioUri" | "durationMs" | "transcript"
>;

const validCategories: MemoryCategory[] = [
  "task",
  "idea",
  "event",
  "person",
  "reflection",
  "question",
  "general",
];

const fallbackMemory = (transcript: string): ExtractedMemory => ({
  summary: transcript,
  category: "general",
  people: [],
  places: [],
  tasks: [],
  events: [],
  ideas: [],
  questions: [],
  importance: 0.5,
  linkedEntities: [],
});


const blockedStableNodes = new Set([
  "her",
  "him",
  "them",
  "they",
  "there",
  "it",
  "that",
  "this",
  "someone",
  "somebody",
  "something",
  "somewhere",
  "place",
  "person",
  "thing",
]);


function normaliseForBlock(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
}

function applyContinuityToArray(
  values: string[],
  continuity: ConversationContinuityResult | undefined,
  type: "people" | "places" | "ideas" | "events"
) {
  const replacements = new Map<string, string>();

  for (const reference of continuity?.references ?? []) {
    if (reference.type !== type || reference.confidence < 0.6) continue;
    replacements.set(normaliseForBlock(reference.token), reference.resolved);
  }

  return uniqueNormalised(
    values
      .map((value) => replacements.get(normaliseForBlock(value)) ?? value)
      .filter((value) => !blockedStableNodes.has(normaliseForBlock(value)))
  );
}

function applyContinuityToTasks(
  tasks: EchoTask[],
  continuity: ConversationContinuityResult | undefined
): EchoTask[] {
  return tasks.map((task) => ({
    ...task,
    linkedPeople: applyContinuityToArray(task.linkedPeople ?? [], continuity, "people"),
    linkedPlaces: applyContinuityToArray(task.linkedPlaces ?? [], continuity, "places"),
    linkedIdeas: applyContinuityToArray(task.linkedIdeas ?? [], continuity, "ideas"),
    linkedEvents: applyContinuityToArray(task.linkedEvents ?? [], continuity, "events"),
  }));
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return uniqueNormalised(
    value.filter((item): item is string => typeof item === "string")
  );
}

function safeTasks(value: unknown): EchoTask[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const task = item as EchoTask;

      return {
        title: typeof task.title === "string" ? task.title.trim() : "",
        due:
          typeof task.due === "string" || task.due === null
            ? task.due
            : null,
        linkedPeople: safeStringArray(task.linkedPeople),
        linkedPlaces: safeStringArray(task.linkedPlaces),
        linkedIdeas: safeStringArray(task.linkedIdeas),
        linkedEvents: safeStringArray(task.linkedEvents),
      };
    })
    .filter((task) => task.title.length > 0);
}

export async function extractMemory(
  transcript: string,
  recentContext: string[] = [],
  continuity?: ConversationContinuityResult
): Promise<ExtractedMemory> {
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
            "You extract structured personal memories from voice transcripts. You understand conversational context. Return valid JSON only. Stable memory nodes must be short, clean, reusable names.",
        },
        {
          role: "user",
          content: `
Extract this transcript into JSON.

Original transcript:
"${transcript}"

Continuity resolved transcript:
"${continuity?.resolvedTranscript ?? transcript}"

Recent memory context:
${recentContext.length > 0 ? recentContext.join("\n\n") : "None"}

Conversation reference map:
${continuity ? JSON.stringify(continuity.references, null, 2) : "None"}

Conversation task updates from the intent engine:
${continuity?.taskUpdates && continuity.taskUpdates.length > 0 ? JSON.stringify(continuity.taskUpdates, null, 2) : "None"}
Return exactly this shape:
{
  "summary": "short natural memory summary",
  "category": "task | idea | event | person | reflection | question | general",
  "people": ["short person node names"],
  "places": ["short place node names"],
  "tasks": [
    {
      "title": "",
      "due": null,
      "linkedPeople": [],
      "linkedPlaces": [],
      "linkedIdeas": [],
      "linkedEvents": []
    }
  ],
  "events": ["short event node names"],
  "ideas": ["short idea node tags, max 3 words each"],
  "questions": [],
  "importance": 0.5,
  "linkedEntities": []
}

Example:
Current transcript:
"Remind me to call Sarah tomorrow, email Tom tonight, and buy milk later."

Return:
{
  "summary": "Call Sarah tomorrow, email Tom tonight, and buy milk later.",
  "category": "task",
  "people": ["Sarah", "Tom"],
  "places": [],
  "tasks": [
    {
      "title": "Call Sarah",
      "due": "tomorrow",
      "linkedPeople": ["Sarah"],
      "linkedPlaces": [],
      "linkedIdeas": [],
      "linkedEvents": []
    },
    {
      "title": "Email Tom",
      "due": "tonight",
      "linkedPeople": ["Tom"],
      "linkedPlaces": [],
      "linkedIdeas": [],
      "linkedEvents": []
    },
    {
      "title": "Buy milk",
      "due": "later",
      "linkedPeople": [],
      "linkedPlaces": [],
      "linkedIdeas": [],
      "linkedEvents": []
    }
  ],
  "events": [],
  "ideas": [],
  "questions": [],
  "importance": 0.8,
  "linkedEntities": ["Sarah", "Tom"]
}

Event example:
Current transcript:
"Remind me to call Sarah before the DHL meeting tomorrow."

Return:
{
  "summary": "Call Sarah before the DHL meeting tomorrow.",
  "category": "task",
  "people": ["Sarah"],
  "places": ["DHL"],
  "tasks": [
    {
      "title": "Call Sarah before the DHL meeting",
      "due": "tomorrow",
      "linkedPeople": ["Sarah"],
      "linkedPlaces": ["DHL"],
      "linkedIdeas": [],
      "linkedEvents": ["DHL Meeting"]
    }
  ],
  "events": ["DHL Meeting"],
  "ideas": [],
  "questions": [],
  "importance": 0.82,
  "linkedEntities": ["Sarah", "DHL", "DHL Meeting"]
}

Event example:
Current transcript:
"I have a dentist appointment Friday morning and need to buy toothpaste before then."

Return:
{
  "summary": "Dentist appointment Friday morning and buy toothpaste before then.",
  "category": "task",
  "people": [],
  "places": [],
  "tasks": [
    {
      "title": "Buy toothpaste before the dentist appointment",
      "due": "before Friday morning",
      "linkedPeople": [],
      "linkedPlaces": [],
      "linkedIdeas": [],
      "linkedEvents": ["Dentist Appointment"]
    }
  ],
  "events": ["Dentist Appointment"],
  "ideas": [],
  "questions": [],
  "importance": 0.78,
  "linkedEntities": ["Dentist Appointment"]
}

Conversational example:
Recent memory:
Summary: Go to the tip later.
Places: Tip
Tasks: Go to the tip.

Current transcript:
"When I'm out at the tip, remind me I need to go shopping too for milk."

Return:
{
  "summary": "When at the tip, remember to go shopping for milk.",
  "category": "task",
  "people": [],
  "places": ["Tip"],
  "tasks": [
    {
      "title": "Go shopping for milk",
      "due": "when at the tip",
      "linkedPeople": [],
      "linkedPlaces": ["Tip"],
      "linkedIdeas": [],
      "linkedEvents": []
    }
  ],
  "events": [],
  "ideas": [],
  "questions": [],
  "importance": 0.78,
  "linkedEntities": ["Tip"]
}

Idea example:
Current transcript:
"I think Echo should make the memory network feel more alive, like energy flows through me and connects different memories."

Return:
{
  "summary": "Echo should make the memory network feel alive by routing energy through the user.",
  "category": "idea",
  "people": [],
  "places": [],
  "tasks": [],
  "events": [],
  "ideas": ["Living Memory", "Self Energy Flow"],
  "questions": [],
  "importance": 0.86,
  "linkedEntities": ["Living Memory", "Self Energy Flow"]
}

Mixed memory example:
Current transcript:
"James mentioned that the Echo app should have location reminders when I'm near Tesco."

Return:
{
  "summary": "James suggested Echo should support location reminders near Tesco.",
  "category": "idea",
  "people": ["James"],
  "places": ["Tesco"],
  "tasks": [],
  "events": [],
  "ideas": ["Location Reminders"],
  "questions": [],
  "importance": 0.82,
  "linkedEntities": ["James", "Tesco", "Location Reminders"]
}

Rules:
- Extract ALL people mentioned.
- Extract ALL newly requested tasks mentioned.
- Extract ALL places mentioned.
- Extract ALL ideas mentioned.
- Extract ALL events mentioned.
- Task JSON must be normalised by you before returning it. The app will not infer task meaning later.
- Task titles must be clean imperative action labels, not raw transcript fragments. Good: "Get milk", "Buy chocolate", "Call Sarah". Bad: "I also need crisps", "Whilst I'm there", "Managed to get everything".
- If there are multiple separate new tasks or add-on items, return multiple task objects.
- Do not merge separate extracted tasks into one inside memory.tasks. Add-ons are merged later only when taskUpdates says keep_open for an existing task.
- Use the continuity resolved transcript and reference map to understand references like "there", "that", "when I get there", "at the tip", "him", "her", "that idea", or "the meeting".
- If the new transcript references an existing memory, do not duplicate the old task unless the user clearly creates it again as a new task.
- If the transcript is a completion/status update for an existing task, return no new tasks unless the user also clearly asks for a new task.
- Completion phrases such as "I managed to get everything", "I've done it", "sorted that", "finished them", "called her", or "sent it" should normally produce tasks: [] because lifecycle intent belongs in conversationTaskUpdates.- Extract the new information and link it to the old context.
- Tasks are actions, not stable memory nodes.
- People, places, ideas and events are stable memory nodes.
- If a task depends on a place/person/idea/event, put that entity in the relevant linked array.

Stable entity naming rules:
- People, places, ideas and events are stable memory nodes.
- Every stable node name must be short, reusable and clean.
- Do not return long phrases as stable nodes.
- Prefer 13 words.
- Use Title Case.
- Reuse the same name for the same entity across recordings. If the reference map resolves a token to an active entity, use that exact resolved entity name.
- If the transcript is vague, infer the clearest useful node name without inventing facts.

People naming rules:
- Return real person names only where possible.
- Use first name unless surname is needed to distinguish people.
- Do not include relationship descriptions unless no name is given.
- Examples: "Sarah", "Tom", "James".

Place naming rules:
- Return short place names.
- Use common reusable place labels.
- Do not include full sentence context.
- Examples: "Tip", "DHL", "Home", "Dentist", "Tesco".

Idea extraction rules:
- Ideas must be returned as short reusable concept tags.
- Maximum 3 words per idea.
- Use Title Case.
- Do not return full transcript sentences as ideas.
- Do not use filler words like "idea", "maybe", "thing", "stuff", "something".
- Name the concept, not the wording.
- If the user expresses a vague idea, infer the clearest useful idea tag.
- If the idea relates to Echo, memory, AI, app behaviour, product design or future features, extract it as an idea.
- If multiple recordings discuss the same concept, reuse the same idea tag so the existing node strengthens.
- Examples: "Living Memory", "Memory Map", "Location Reminders", "Relationship Memory".

Event extraction rules:
- Extract events whenever the transcript mentions a meeting, appointment, birthday, trip, holiday, consultation, call, school run, interview, visit, shift, deadline, reminder around a scheduled activity, or planned activity.
- Events are not only formal calendar events.
- If something happens at a time, date, place, or with people, it can be an event.
- If the user says "meeting", "appointment", "birthday", "holiday", "trip", "consultation", "interview", "school run", "visit", "shift", or "deadline", strongly prefer extracting an event.
- A task can be linked to an event, but do not replace the event with only a task.
- If the user says "remind me about the meeting", extract both an event and a task.
- If a place and time are mentioned together, consider whether this is an event.
- Keep event names short and reusable.
- Use Title Case.
- Examples: "DHL Meeting", "Dentist Appointment", "Sarah Birthday", "Echo Consultation".
- Do not put ordinary shopping or buying something in events unless it is clearly scheduled as a planned outing.

Linked entity rules:
- linkedEntities should include every stable node that matters to the memory.
- Include people, places, ideas and events that are central to the memory.
- Do not include task titles in linkedEntities unless they also name a stable event or idea.
- linkedEntities should use the exact same names used in people, places, ideas and events.

- Do not extract pronouns or vague placeholders as stable nodes. Never create nodes named Her, Him, There, It, That, This, Someone, Something, Somewhere, or Place.
- If continuity resolves a pronoun/place reference, use the resolved canonical entity instead.
- Do not invent details.
- importance must be between 0 and 1.
- summary should sound like a memory, not a transcript.
`,
        },
      ],
    }),
  });

  if (!response.ok) {
    return fallbackMemory(transcript);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    return fallbackMemory(transcript);
  }

  try {
    const parsed = JSON.parse(content) as Partial<ExtractedMemory>;
    const category = validCategories.includes(parsed.category as MemoryCategory)
      ? (parsed.category as MemoryCategory)
      : "general";

    return {
      summary:
        typeof parsed.summary === "string" && parsed.summary.trim()
          ? parsed.summary.trim()
          : transcript,
      category,
      people: applyContinuityToArray(safeStringArray(parsed.people), continuity, "people"),
      places: applyContinuityToArray(safeStringArray(parsed.places), continuity, "places"),
      tasks: applyContinuityToTasks(safeTasks(parsed.tasks), continuity),
      events: applyContinuityToArray(safeStringArray(parsed.events), continuity, "events"),
      ideas: applyContinuityToArray(safeStringArray(parsed.ideas), continuity, "ideas"),
      questions: safeStringArray(parsed.questions),
      importance:
        typeof parsed.importance === "number"
          ? Math.max(0, Math.min(1, parsed.importance))
          : 0.5,
      linkedEntities: safeStringArray(parsed.linkedEntities),
    };
  } catch {
    return fallbackMemory(transcript);
  }
}