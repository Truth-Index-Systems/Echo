export type MemoryCategory =
  | "task"
  | "idea"
  | "event"
  | "person"
  | "reflection"
  | "question"
  | "general";

export type EchoTask = {
  title: string;
  due?: string | null;
  linkedPeople?: string[];
  linkedPlaces?: string[];
  linkedIdeas?: string[];
  linkedEvents?: string[];
};

export type EchoTaskStatus = "open" | "postponed" | "closed";

export type EchoTaskTimelineEntry = {
  id: string;
  at: string;
  type: "created" | "mentioned" | "postponed" | "closed" | "reminded";
  note: string;
  memoryId?: string;
};

export type EchoTaskEntity = {
  id: string;
  title: string;
  status: EchoTaskStatus;
  createdAt: string;
  updatedAt: string;
  dueAt?: string | null;
  dueLabel?: string | null;
  relatedMemoryIds: string[];
  relatedPeople: string[];
  relatedPlaces: string[];
  relatedIdeas: string[];
  relatedEvents: string[];
  reminderEnabled: boolean;
  energy: number;
  timesMentioned: number;
  reminderCount: number;
  lastMentionedAt: string;
  closedAt?: string | null;
  closedReason?: string | null;
  timeline: EchoTaskTimelineEntry[];
};

export type TaskConversationUpdate = {
  action: "create" | "close" | "postpone" | "keep_open" | "ignore";
  taskId?: string;
  taskTitle?: string;
  confidence: number;
  reason: string;
};


export type ConversationReferenceType =
  | "people"
  | "places"
  | "ideas"
  | "events"
  | "tasks";

export type ConversationReferenceResolution = {
  token: string;
  type: ConversationReferenceType;
  resolved: string;
  confidence: number;
  reason: string;
};

export type ConversationContinuitySnapshot = {
  activePeople: string[];
  activePlaces: string[];
  activeIdeas: string[];
  activeEvents: string[];
  activeTasks: string[];
  activeTaskSummaries?: {
    id: string;
    title: string;
    status: EchoTaskStatus;
    dueLabel?: string | null;
    relatedPeople: string[];
    relatedPlaces: string[];
    relatedIdeas: string[];
    relatedEvents: string[];
    lastMentionedAt: string;
    energy: number;
  }[];
  recentMemorySummaries: {
    id: string;
    summary: string;
    transcript: string;
    resolvedTranscript?: string;
    people: string[];
    places: string[];
    ideas: string[];
    events: string[];
    tasks: string[];
  }[];
};

export type ConversationContinuityResult = {
  originalTranscript: string;
  resolvedTranscript: string;
  references: ConversationReferenceResolution[];
  taskUpdates?: TaskConversationUpdate[];
  confidence: number;
  snapshot: ConversationContinuitySnapshot;
};

export type EchoMemory = {
  id: string;
  createdAt: string;
  audioUri: string;
  durationMs: number;
  transcript: string;
  resolvedTranscript?: string;
  referenceResolutions?: ConversationReferenceResolution[];
  conversationTaskUpdates?: TaskConversationUpdate[];
  summary: string;
  category: MemoryCategory;
  people: string[];
  places: string[];
  tasks: EchoTask[];
  events: string[];
  ideas: string[];
  questions: string[];
  importance: number;
  linkedEntities: string[];
};
export type StableMemoryNodeType = "people" | "places" | "ideas" | "events";

export type MemorySearchIntent =
  | "recall"
  | "question"
  | "timeline"
  | "relationship"
  | "task"
  | "general";

export type MemorySearchTarget =
  | "people"
  | "places"
  | "ideas"
  | "events"
  | "tasks"
  | "memories";

export type MemorySearchQuery = {
  originalPrompt: string;
  intent: MemorySearchIntent;
  targetTypes: MemorySearchTarget[];
  people: string[];
  places: string[];
  ideas: string[];
  events: string[];
  tasks: string[];
  timeHints: string[];
  keywords: string[];
};

export type MemoryGroup = {
  id: string;
  title: string;
  summary: string;
  people: string[];
  places: string[];
  ideas: string[];
  events: string[];
  tasks: string[];
  memoryIds: string[];
  strength: number;
  lastUpdatedAt: string;
  firstMentionedAt: string;
  relationshipReasons: string[];
};

export type MemoryGroupMatch = {
  group: MemoryGroup;
  confidence: number;
  reasons: string[];
  matchedPeople: string[];
  matchedPlaces: string[];
  matchedIdeas: string[];
  matchedEvents: string[];
  matchedTasks: string[];
  matchedTimeHints: string[];
  matchedKeywords: string[];
};

export type PersonalMemoryAnswer = {
  answer: string;
  confidence: number;
  matches: MemoryGroupMatch[];
};

export type EchoReminderStyle = "quiet" | "balanced" | "active";

export type EchoReminderSettings = {
  enabled: boolean;
  permissionStatus: "unknown" | "granted" | "denied";
  style: EchoReminderStyle;
  morningBriefEnabled: boolean;
  eveningReflectionEnabled: boolean;
  taskRemindersEnabled: boolean;
  hasSeenReminderPrompt: boolean;
  lastScheduledAt?: string | null;
};

export type EchoReminderCandidate = {
  id: string;
  type: "morning_brief" | "evening_reflection" | "task" | "postponed_task";
  title: string;
  body: string;
  taskId?: string;
  scheduleLabel: string;
  priority: number;
};
