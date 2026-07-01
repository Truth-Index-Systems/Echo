import type {
  EchoMemory,
  EchoTaskEntity,
  MemoryGroupMatch,
  MemorySearchQuery,
  PersonalMemoryAnswer,
} from "../types/memory";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

function memoriesForMatches(
  memories: EchoMemory[],
  matches: MemoryGroupMatch[]
): EchoMemory[] {
  const wantedIds = new Set(
    matches.flatMap((match) => match.group.memoryIds)
  );

  return memories.filter((memory) => wantedIds.has(memory.id));
}

function compactMemory(memory: EchoMemory) {
  return {
    id: memory.id,
    createdAt: memory.createdAt,
    summary: memory.summary,
    category: memory.category,
    people: memory.people,
    places: memory.places,
    ideas: memory.ideas,
    events: memory.events,
    tasks: memory.tasks,
    questions: memory.questions,
    importance: memory.importance,
    linkedEntities: memory.linkedEntities,
    transcript: memory.transcript,
  };
}

function fallbackAnswer(
  query: MemorySearchQuery,
  matches: MemoryGroupMatch[]
): PersonalMemoryAnswer {
  if (matches.length === 0) {
    return {
      answer:
        "I couldn't find a strong memory match for that yet. It may not have been captured, or it may be stored under different wording.",
      confidence: 0,
      matches,
    };
  }

  const best = matches[0];

  return {
    answer: `Most likely, I remember this as "${best.group.title}". ${best.group.summary}`,
    confidence: best.confidence,
    matches,
  };
}

export async function answerFromPersonalMemory(
  query: MemorySearchQuery,
  matches: MemoryGroupMatch[],
  memories: EchoMemory[],
  taskMatches: EchoTaskEntity[] = []
): Promise<PersonalMemoryAnswer> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing EXPO_PUBLIC_OPENAI_API_KEY");
  }

  const relevantMemories = memoriesForMatches(memories, matches)
    .sort((a, b) => {
      if (query.intent !== "timeline") return 0;

      const wantsFirst = query.timeHints.some((hint) =>
        ["first", "earliest", "before"].includes(hint.toLowerCase())
      );

      const wantsRecent = query.timeHints.some((hint) =>
        ["recent", "latest", "last", "newest", "most recent", "after"].includes(
          hint.toLowerCase()
        )
      );

      if (wantsFirst) {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }

      if (wantsRecent) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }

      return 0;
    })
    .map(compactMemory);

  if ((matches.length === 0 || relevantMemories.length === 0) && taskMatches.length === 0) {
    return fallbackAnswer(query, matches);
  }

  const response = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You answer questions using only the user's stored personal memory JSON. You are warm, personal and careful. Return valid JSON only.",
        },
        {
          role: "user",
          content: `
The user asked:
"${query.originalPrompt}"

Structured search query:
${JSON.stringify(query, null, 2)}

Ranked memory group matches:
${JSON.stringify(
  matches.map((match) => ({
    group: match.group,
    confidence: match.confidence,
    reasons: match.reasons,
    matchedPeople: match.matchedPeople,
    matchedPlaces: match.matchedPlaces,
    matchedIdeas: match.matchedIdeas,
    matchedEvents: match.matchedEvents,
    matchedTasks: match.matchedTasks,
    matchedTimeHints: match.matchedTimeHints,
    matchedKeywords: match.matchedKeywords,
  })),
  null,
  2
)}

Relevant stored memories:
${JSON.stringify(relevantMemories, null, 2)}

Relevant outstanding/closed tasks:
${JSON.stringify(
  taskMatches.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    dueAt: task.dueAt,
    dueLabel: task.dueLabel,
    relatedPeople: task.relatedPeople,
    relatedPlaces: task.relatedPlaces,
    relatedIdeas: task.relatedIdeas,
    relatedEvents: task.relatedEvents,
    energy: task.energy,
    timesMentioned: task.timesMentioned,
    lastMentionedAt: task.lastMentionedAt,
    closedAt: task.closedAt,
    closedReason: task.closedReason,
    recentTimeline: task.timeline.slice(0, 5),
  })),
  null,
  2
)}

Return exactly this JSON shape:
{
  "answer": "",
  "confidence": 0.5
}

Rules:
- Answer only from the provided memory JSON.
- Do not invent details.
- If the strongest match is clear, answer it first.
- Then include other possible related memories in confidence order.
- Use phrases like "Most likely", "Also possibly related", and "Lower confidence" when there are multiple plausible matches.
- If dates are available in createdAt, use them.
- If the user asks about relationships, explain what connects the people, places, ideas or events using relationshipReasons and relevant memory summaries.
- If the user asks about tasks or reminders, prioritise the task objects first, especially open and postponed tasks.
- If the user asks what is outstanding, answer from open and postponed task objects.
- If the user asks what has been finished, answer from closed task objects and closedAt/timeline.
- If the user asks what they are putting off, prioritise postponed tasks and high-energy open tasks.
- If task objects and memory JSON disagree, treat task object status as the current lifecycle state.
- If the user asks "first", prioritise the earliest relevant memory and mention the date if available.
- If the user asks "latest", "last", "newest", or "most recent", prioritise the newest relevant memory and mention the date if available.
- If targetTypes says ideas, answer with the latest/first idea from the relevant memories, not just the broad group title.
- If targetTypes says people, answer with the latest/first person linked to the requested topic.
- If targetTypes says events, answer with the latest/first event linked to the requested topic.
- If targetTypes says tasks, answer with the latest/first task or promise linked to the requested topic.
- If the user asks what happened before/after an event, use task due fields, event names, createdAt and summaries carefully.
- If confidence is weak, say so clearly.
- Do not mention JSON, extraction, groups, scoring, or implementation details to the user.
- Sound like Echo is remembering personally, not searching a database.
- Keep the answer concise but useful.
- Use natural wording like "I remember you mentioning..." or "Most likely, that was...".
- Never show confidence numbers.
`,
        },
      ],
    }),
  });

  if (!response.ok) {
    return fallbackAnswer(query, matches);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    return fallbackAnswer(query, matches);
  }

  try {
    const parsed = JSON.parse(content) as Partial<PersonalMemoryAnswer>;

    return {
      answer:
        typeof parsed.answer === "string" && parsed.answer.trim()
          ? parsed.answer.trim()
          : fallbackAnswer(query, matches).answer,
      confidence:
        typeof parsed.confidence === "number"
          ? Math.max(0, Math.min(1, parsed.confidence))
          : matches[0]?.confidence ?? 0,
      matches,
    };
  } catch {
    return fallbackAnswer(query, matches);
  }
}