import { useMemo, useState } from "react";import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";

import {
  closeTask,
  getTasks,
  keepTaskOpen,
  postponeTask,
  useTasks,
} from "../src/stores/taskStore";
import type {
  EchoReminderStyle,
  EchoTaskEntity,
  EchoTaskStatus,
} from "../src/types/memory";
import { useMemories } from "../src/stores/memoryStore";
import {
  getReminderSettings,
  setReminderStyle,
  useReminderSettings,
} from "../src/stores/reminderSettingsStore";import { syncEchoReminderNotifications } from "../src/services/reminderEngine";
import { colors } from "../src/theme/colors";
import { spacing } from "../src/theme/spacing";
import { typography } from "../src/theme/typography";

const postponeOptions = [
  "Tonight",
  "Tomorrow morning",
  "Tomorrow afternoon",
  "This weekend",
  "Next week",
];

type TaskFilter = "open" | "closed";
function statusLabel(status: EchoTaskStatus) {
  if (status === "postponed") return "Postponed";
  if (status === "closed") return "Closed";
  return "Open";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

async function resyncReminders(memories: ReturnType<typeof useMemories>) {
  await syncEchoReminderNotifications(memories, getTasks(), getReminderSettings());
}

function TaskRow({
  task,
  onChanged,
}: {
  task: EchoTaskEntity;
  onChanged: () => void;
}) {
  function handlePostpone() {
    Alert.alert("Postpone task", "When should Echo surface this again?", [
      ...postponeOptions.map((label) => ({
        text: label,
        onPress: () => {
          postponeTask(task.id, label);
          onChanged();
        },
      })),
      { text: "Cancel", style: "cancel" as const },
    ]);  }

  return (
    <View style={styles.taskRow}>
      <View style={styles.taskHeader}>
        <View style={styles.taskCopy}>
          <Text style={styles.taskTitle}>{task.title}</Text>
          <Text style={styles.taskMeta}>
            {statusLabel(task.status)} · Mentioned {formatDate(task.lastMentionedAt)}
            {task.dueLabel ? ` · ${task.dueLabel}` : ""}
          </Text>
        </View>

        <View style={styles.energyPill}>
          <Text style={styles.energyText}>{Math.round(task.energy)}</Text>
        </View>
      </View>

      {(task.relatedPeople.length > 0 ||
        task.relatedPlaces.length > 0 ||
        task.relatedEvents.length > 0 ||
        task.relatedIdeas.length > 0) && (
        <Text style={styles.links} numberOfLines={2}>
          {[
            ...task.relatedPeople,
            ...task.relatedPlaces,
            ...task.relatedEvents,
            ...task.relatedIdeas,
          ]            .slice(0, 5)
            .join(" · ")}
        </Text>
      )}

      {task.status !== "closed" && (
        <View style={styles.actions}>
          <Pressable
            style={styles.actionPrimary}
            onPress={() => {
              closeTask(task.id);
              onChanged();
            }}
          >            <Text style={styles.actionPrimaryText}>Done</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={handlePostpone}>
            <Text style={styles.actionText}>Postpone</Text>
          </Pressable>

          <Pressable
            style={styles.actionButton}
            onPress={() => {
              keepTaskOpen(task.id);
              onChanged();
            }}
          >            <Text style={styles.actionText}>Keep Open</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function TaskFilterButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.filterButton, active && styles.filterButtonActive]}
      onPress={onPress}
    >
      <Text style={[styles.filterText, active && styles.filterTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function TaskSection({
  tasks,
  onTaskChanged,
}: {  tasks: EchoTaskEntity[];
  onTaskChanged: () => void;
}) {
  if (tasks.length === 0) return null;

  return (
    <View style={styles.section}>
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} onChanged={onTaskChanged} />
      ))}
    </View>
  );
}

export default function TasksScreen() {
  const tasks = useTasks();
  const memories = useMemories();
  const reminderSettings = useReminderSettings();
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("open");
  const handleTaskChanged = () => {
    void resyncReminders(memories);
  };

  const handleStyleChange = (style: EchoReminderStyle) => {
    setReminderStyle(style);
    void syncEchoReminderNotifications(memories, getTasks(), {
      ...getReminderSettings(),
      style,
    });
  };

  const visibleTasks = useMemo(
    () =>
      tasks.filter((task) =>
        taskFilter === "open" ? task.status !== "closed" : task.status === "closed"
      ),
    [tasks, taskFilter]
  );

  const emptyTitle =
    taskFilter === "open" ? "No open tasks yet" : "No closed tasks yet";

  const emptyText =
    taskFilter === "open"
      ? "Try saying: “Remind me to call James tomorrow.” Later, “Finally called James” will close it automatically."
      : "Completed tasks will appear here once Echo closes them.";
  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backText}>‹</Text>
            </Pressable>
            <View>
              <Text style={styles.kicker}>Echo remembers</Text>
              <Text style={styles.title}>Outstanding Tasks</Text>
            </View>
          </View>

          <Text style={styles.subtitle}>
            Speak naturally to create, keep open, postpone or close tasks. Echo keeps the lifecycle connected to memory.
          </Text>

          <View style={styles.filterRow}>
            <TaskFilterButton
              label="Open"
              active={taskFilter === "open"}
              onPress={() => setTaskFilter("open")}
            />
            <TaskFilterButton
              label="Closed"
              active={taskFilter === "closed"}
              onPress={() => setTaskFilter("closed")}
            />
          </View>
          <View style={styles.reminderPanel}>
            <Text style={styles.reminderPanelTitle}>Reminder style</Text>
            <Text style={styles.reminderPanelText}>
              Echo should remind, not nag. Balanced is recommended.
            </Text>
            <View style={styles.styleRow}>
              {(["quiet", "balanced", "active"] as EchoReminderStyle[]).map(
                (style) => (
                  <Pressable
                    key={style}
                    style={[
                      styles.stylePill,
                      reminderSettings.style === style && styles.stylePillActive,
                    ]}
                    onPress={() => handleStyleChange(style)}
                  >
                    <Text style={styles.stylePillText}>{style}</Text>
                  </Pressable>
                )
              )}
            </View>
          </View>

          {visibleTasks.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{emptyTitle}</Text>
              <Text style={styles.emptyText}>{emptyText}</Text>
            </View>
          ) : (
            <TaskSection
              tasks={visibleTasks}
              onTaskChanged={handleTaskChanged}
            />          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.space900,
  },
  safe: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  backText: {
    color: colors.white,
    fontSize: 34,
    lineHeight: 36,
  },
  kicker: {
    color: colors.electricBlue,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    ...typography.h1,
    color: colors.white,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  filterRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  filterButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  filterButtonActive: {
    borderColor: "rgba(0,229,255,0.5)",
    backgroundColor: "rgba(0,229,255,0.16)",
  },
  filterText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "900",
  },
  filterTextActive: {
    color: colors.white,
  },  reminderPanel: {
    marginTop: spacing.lg,
    borderRadius: 24,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(185,199,255,0.2)",
    backgroundColor: "rgba(8,15,42,0.64)",
  },
  reminderPanelTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "900",
  },
  reminderPanelText: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  styleRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  stylePill: {
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.24)",
    backgroundColor: "rgba(0,229,255,0.06)",
  },
  stylePillActive: {
    borderColor: "rgba(168,85,255,0.5)",
    backgroundColor: "rgba(168,85,255,0.16)",
  },
  stylePillText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  emptyCard: {
    borderRadius: 28,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.2)",
    backgroundColor: "rgba(6,12,34,0.56)",
  },
  emptyTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "900",
  },
  emptyText: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  section: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  taskRow: {
    borderRadius: 24,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.18)",
    backgroundColor: "rgba(8,15,42,0.72)",
  },
  taskHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  taskCopy: {
    flex: 1,
  },
  taskTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "900",
  },
  taskMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  energyPill: {
    minWidth: 42,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(168,85,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(168,85,255,0.34)",
  },
  energyText: {
    color: colors.memoryPink,
    fontSize: 13,
    fontWeight: "900",
  },
  links: {
    color: colors.electricBlue,
    fontSize: 13,
    fontWeight: "700",
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionPrimary: {
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: "rgba(0,229,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.42)",
  },
  actionPrimaryText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "900",
  },
  actionButton: {
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  actionText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "800",
  },
});