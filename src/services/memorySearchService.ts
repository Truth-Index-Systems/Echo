import type { EchoMemory, PersonalMemoryAnswer } from "../types/memory";
import { buildMemoryGroups } from "./memoryGroupBuilder";
import { getTopMemoryGroupMatches } from "./memoryGroupMatcher";
import { extractMemorySearchQuery } from "./memorySearchExtractor";
import { answerFromPersonalMemory } from "./personalMemoryAnswerEngine";
import { getTasks, matchTasksForPrompt } from "../stores/taskStore";

export async function searchPersonalMemory(
  prompt: string,
  memories: EchoMemory[]
): Promise<PersonalMemoryAnswer> {
  const query = await extractMemorySearchQuery(prompt);
  const groups = buildMemoryGroups(memories);
  const matches = getTopMemoryGroupMatches(query, groups, 5);
  const taskMatches =
    query.intent === "task" || query.targetTypes.includes("tasks")
      ? getTasks()
      : matchTasksForPrompt(prompt, 8);

  return answerFromPersonalMemory(query, matches, memories, taskMatches);
}