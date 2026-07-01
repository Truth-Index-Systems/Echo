import { useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Defs, Line, RadialGradient, Stop, Text as SvgText } from "react-native-svg";

import GlowingRecordButton from "../src/components/GlowingRecordButton";
import { EchoEngine } from "../src/components/echo-engine";
import { useEngineSequence } from "../src/components/echo-engine/useEngineSequence";
import {
  startRecording,
  stopRecording,
  type RecordingResult,
} from "../src/services/recordingService";
import { transcribeAudio } from "../src/services/transcriptionService";
import { extractMemory } from "../src/services/memoryExtractor";
import {
  buildRecentMemoryContext,
  resolveConversationContinuity,
} from "../src/services/conversationalContext";
import { addMemory, useMemories } from "../src/stores/memoryStore";
import { getTasks, upsertTasksFromMemory, useTasks } from "../src/stores/taskStore";
import type { EchoMemory } from "../src/types/memory";
import { requestEchoNotificationPermission } from "../src/services/notificationService";
import { syncEchoReminderNotifications } from "../src/services/reminderEngine";
import { updateReminderSettings, useReminderSettings } from "../src/stores/reminderSettingsStore";
import {
  displayMemoryEntity,
  normaliseMemoryEntity,
} from "../src/utils/memoryNormaliser";
import { colors } from "../src/theme/colors";
import { spacing } from "../src/theme/spacing";
import { typography } from "../src/theme/typography";

const { width, height } = Dimensions.get("window");

type ClusterType = "people" | "ideas" | "places" | "events";

type NetworkNode = {
  id: string;
  label: string;
  type: ClusterType;
  x: number;
  y: number;
  strength: number;
};

const clusterConfig: Record<
  ClusterType,
  { label: string; x: number; y: number; color: string }
> = {
  people: {
    label: "PEOPLE",
    x: width * 0.22,
    y: height * 0.22,
    color: "#FF3DFF",
  },
  ideas: {
    label: "IDEAS",
    x: width * 0.76,
    y: height * 0.32,
    color: "#A855FF",
  },
  places: {
    label: "PLACES",
    x: width * 0.2,
    y: height * 0.58,
    color: "#00E5FF",
  },
  events: {
    label: "EVENTS",
    x: width * 0.78,
    y: height * 0.58,
    color: "#2F6BFF",
  },
};

function addCount(map: Map<string, number>, value: string) {
  const key = normaliseMemoryEntity(value);
  if (!key) return;

  map.set(key, (map.get(key) ?? 0) + 1);
}

function buildClusterNodes(
  type: ClusterType,
  values: Map<string, number>
): NetworkNode[] {
  const cluster = clusterConfig[type];
  const entries = Array.from(values.entries()).slice(0, 6);

  return entries.map(([label, count], index) => {
    const angle =
      (Math.PI * 2 * index) / Math.max(entries.length, 1) +
      (label.length % 4) * 0.18;

    const radius = 34 + ((index * 19) % 32);

    return {
      id: `${type}-${label}`,
      label:
        displayMemoryEntity(label).length > 11
          ? `${displayMemoryEntity(label).slice(0, 10)}…`
          : displayMemoryEntity(label),
      type,
      x: cluster.x + Math.cos(angle) * radius,
      y: cluster.y + Math.sin(angle) * radius,
      strength: Math.min(1, 0.28 + count * 0.18),
    };
  });
}

function MemoryNetworkBackground({ memories }: { memories: EchoMemory[] }) {
  const nodes = useMemo(() => {
    const people = new Map<string, number>();
    const ideas = new Map<string, number>();
    const places = new Map<string, number>();
    const events = new Map<string, number>();

    for (const memory of memories) {
      memory.people.forEach((item) => addCount(people, item));
      memory.ideas.forEach((item) => addCount(ideas, item));
      memory.places.forEach((item) => addCount(places, item));
      memory.events.forEach((item) => addCount(events, item));
    }

    return [
      ...buildClusterNodes("people", people),
      ...buildClusterNodes("ideas", ideas),
      ...buildClusterNodes("places", places),
      ...buildClusterNodes("events", events),
    ];
  }, [memories]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="homeNebula" cx="50%" cy="45%" r="70%">
            <Stop offset="0%" stopColor="#8A5CFF" stopOpacity="0.24" />
            <Stop offset="42%" stopColor="#148CFF" stopOpacity="0.09" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={width * 0.52} cy={height * 0.34} r={width * 0.86} fill="url(#homeNebula)" />
        {Array.from({ length: 32 }).map((_, index) => (
          <Circle
            key={`home-star-${index}`}
            cx={((index * 67) % 100) * width / 100}
            cy={((index * 41) % 78) * height / 100}
            r={0.7 + ((index * 11) % 18) / 10}
            fill="#FFFFFF"
            opacity={0.05 + ((index * 19) % 40) / 100}
          />
        ))}
        <Circle
          cx={width * 0.5}
          cy={height * 0.48}
          r={width * 0.92}
          fill="#00E5FF"
          opacity={0.018}
        />

        {Object.entries(clusterConfig).map(([key, cluster]) => (
          <SvgText
            key={key}
            x={cluster.x}
            y={cluster.y - 52}
            fill="#B9C7FF"
            opacity={memories.length === 0 ? 0.08 : 0.16}
            fontSize="10"
            letterSpacing="4"
            textAnchor="middle"
          >
            {cluster.label}
          </SvgText>
        ))}

        <Circle
          cx={width * 0.5}
          cy={height * 0.47}
          r={24}
          fill="#FFFFFF"
          opacity={0.08}
        />

        <SvgText
          x={width * 0.5}
          y={height * 0.47 + 4}
          fill="#FFFFFF"
          opacity={0.16}
          fontSize="10"
          fontWeight="900"
          textAnchor="middle"
        >
          YOU
        </SvgText>

        {nodes.map((node) => {
          const cluster = clusterConfig[node.type];

          return (
            <Line
              key={`line-${node.id}`}
              x1={width * 0.5}
              y1={height * 0.47}
              x2={node.x}
              y2={node.y}
              stroke={cluster.color}
              strokeWidth={0.6 + node.strength}
              strokeOpacity={0.035 + node.strength * 0.08}
            />
          );
        })}

        {nodes.map((node) => {
          const cluster = clusterConfig[node.type];
          const r = 8 + node.strength * 10;

          return (
            <Circle
              key={node.id}
              cx={node.x}
              cy={node.y}
              r={r}
              fill={cluster.color}
              opacity={0.08 + node.strength * 0.12}
            />
          );
        })}
      </Svg>
    </View>
  );
}

export default function HomeScreen() {
  const { mode, isListening, start, stop } = useEngineSequence();
  const memories = useMemories();
  const tasks = useTasks();
  const reminderSettings = useReminderSettings();
  const outstandingTasks = tasks.filter((task) => task.status !== "closed");
  const [isBusy, setIsBusy] = useState(false);

  async function handleRecordPress() {
    if (isBusy) return;

    try {
      if (!isListening) {
        setIsBusy(true);
        await startRecording();
        start();
        setIsBusy(false);
        return;
      }

      setIsBusy(true);

      const result: RecordingResult = await stopRecording();
      stop();

      const transcript = await transcribeAudio(result.uri);
      const recentContext = buildRecentMemoryContext(memories);
      const continuity = await resolveConversationContinuity(transcript, memories, tasks);
      const extracted = await extractMemory(transcript, recentContext, continuity);

      const memory: EchoMemory = {
        id: `${Date.now()}`,
        createdAt: new Date().toISOString(),
        audioUri: result.uri,
        durationMs: result.durationMs,
        transcript,
        resolvedTranscript: continuity.resolvedTranscript,
        referenceResolutions: continuity.references,
        conversationTaskUpdates: continuity.taskUpdates,
        ...extracted,
      };

      addMemory(memory);
      upsertTasksFromMemory(memory);
      await syncEchoReminderNotifications(memories, getTasks(), reminderSettings);
      setIsBusy(false);
    } catch (error) {
      setIsBusy(false);

      Alert.alert(
        "Recording issue",
        error instanceof Error ? error.message : "Something went wrong."
      );
    }
  }


  async function handleEnableReminders() {
    const permissionStatus = await requestEchoNotificationPermission();
    const enabled = permissionStatus === "granted";

    updateReminderSettings({
      enabled,
      permissionStatus,
      hasSeenReminderPrompt: true,
      lastScheduledAt: enabled ? new Date().toISOString() : null,
    });

    if (enabled) {
      await syncEchoReminderNotifications(memories, tasks, {
        ...reminderSettings,
        enabled: true,
        permissionStatus: "granted",
        hasSeenReminderPrompt: true,
      });
    } else {
      Alert.alert(
        "Reminders are off",
        "You can enable notifications later from your phone settings."
      );
    }
  }

  const memoryCountLabel =
    memories.length === 1 ? "1 memory" : `${memories.length} memories`;

  return (
    <View style={styles.screen}>
      <EchoEngine mode={mode} savedMemoryCount={memories.length} />
      <MemoryNetworkBackground memories={memories} />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.54)", "rgba(0,0,0,0.92)"]}
        locations={[0, 0.52, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <LinearGradient
              colors={[
                "rgba(255,255,255,0.16)",
                "rgba(21,31,75,0.62)",
                "rgba(0,0,0,0.42)",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoPanel}
            >
              <View style={styles.logoPanelGlow} />
              <Image
                source={require("../assets/images/echo-logo.png")}
                style={styles.headerLogo}
                resizeMode="contain"
              />
            </LinearGradient>
            <View style={styles.headerCopy}>
              <Text style={styles.logo}>ECHO</Text>
              <Text style={styles.subtitle}>Your AI Memory</Text>
            </View>
          </View>

          <Text style={styles.promise}>
            Capture what matters.{"\n"}Echo remembers the rest.
          </Text>

          <LinearGradient
            colors={["rgba(16,25,67,0.88)", "rgba(7,9,28,0.94)", "rgba(0,0,0,0.9)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.captureCard}
          >
            <View style={styles.cardSheen} />
            <Text style={styles.captureTitle}>{"What's on your mind?"}</Text>

            <Text style={styles.captureHint}>
              {isBusy
                ? "Remembering..."
                : isListening
                  ? "Listening..."
                  : "Tap to record"}
            </Text>

            <GlowingRecordButton
              active={isListening}
              disabled={isBusy}
              processing={isBusy && !isListening}
              onPress={handleRecordPress}
            />

            <Text style={styles.recordState}>
              {isBusy
                ? "Echo is remembering"
                : isListening
                  ? "Echo is listening"
                  : "Speak naturally"}
            </Text>

            <Text style={styles.smallText}>
              {isBusy
                ? "Transcribing, understanding and saving your memory."
                : isListening
                  ? "Tap stop when you're finished."
                  : "Echo quietly remembers so you don't have to."}
            </Text>
          </LinearGradient>

          <Pressable
            style={styles.quoteCard}
            onPress={() => router.push("/memory-network")}
          >
            <Text style={styles.brainIcon}>🧠</Text>

            <View style={styles.quoteCopy}>
              <Text style={styles.quoteStrong}>View my Memory Network</Text>
              <Text style={styles.quoteSoft}>Your thoughts. Connected.</Text>
            </View>

            <Text style={styles.chevron}>›</Text>
          </Pressable>

          <Pressable
            style={styles.taskCard}
            onPress={() => router.push("/tasks" as any)}
          >
            <Text style={styles.taskIcon}>✓</Text>

            <View style={styles.quoteCopy}>
              <Text style={styles.taskStrong}>Outstanding Tasks</Text>
              <Text style={styles.quoteSoft}>
                {outstandingTasks.length === 0
                  ? "Nothing open right now"
                  : `${outstandingTasks.length} open or postponed`}
              </Text>
            </View>

            <Text style={styles.chevron}>›</Text>
          </Pressable>

          <View style={styles.reminderCard}>
            <View style={styles.reminderCopy}>
              <Text style={styles.reminderTitle}>Gentle reminders</Text>
              <Text style={styles.reminderText}>
                {reminderSettings.enabled
                  ? `On · ${reminderSettings.style}`
                  : outstandingTasks.length > 0
                    ? "Echo can remind you without nagging."
                    : "Enable when you want Echo to tap you on the shoulder."}
              </Text>
            </View>

            <Pressable
              style={[
                styles.reminderButton,
                reminderSettings.enabled && styles.reminderButtonEnabled,
              ]}
              onPress={handleEnableReminders}
            >
              <Text style={styles.reminderButtonText}>
                {reminderSettings.enabled ? "Enabled" : "Enable"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.timelineHeader}>
            <Text style={styles.timelineTitle}>{"Today's Timeline"}</Text>
            <Text style={styles.memoryCount}>{memoryCountLabel}</Text>
          </View>

          {memories.length === 0 ? (
            <View style={styles.emptyTimeline}>
              <View style={styles.memoryOrb} />

              <View style={styles.emptyCopy}>
                <Text style={styles.emptyTitle}>
                  Your day is waiting to be remembered
                </Text>
                <Text style={styles.emptyText}>
                  Every conversation, idea and commitment becomes part of your
                  personal memory network.
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.memoryList}>
              {memories.map((memory) => (
                <View key={memory.id} style={styles.memoryItem}>
                  <View style={styles.memoryOrbSmall} />

                  <View style={styles.emptyCopy}>
                    <Text style={styles.emptyTitle} numberOfLines={2}>
                      {memory.summary}
                    </Text>

                    <Text style={styles.emptyText}>
                      {memory.category.toUpperCase()} ·{" "}
                      {new Date(memory.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {Math.max(1, Math.round(memory.durationMs / 1000))}s
                    </Text>

                    {memory.tasks.slice(0, 2).map((task) => (
                      <Text key={task.title} style={styles.memoryMeta}>
                        ✓ {task.title}
                      </Text>
                    ))}

                    {memory.people.length > 0 && (
                      <Text style={styles.memoryMeta}>
                        👤 {memory.people.join(", ")}
                      </Text>
                    )}

                    {memory.places.length > 0 && (
                      <Text style={styles.memoryMeta}>
                        📍 {memory.places.join(", ")}
                      </Text>
                    )}

                    {memory.ideas.length > 0 && (
                      <Text style={styles.memoryMeta}>
                        💡 {memory.ideas.slice(0, 2).join(", ")}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  header: {
    marginBottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
  },
  logoPanel: {
    width: 92,
    height: 92,
    borderRadius: 30,
    marginRight: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(185,199,255,0.34)",
    overflow: "hidden",
    shadowColor: colors.neuralPurple,
    shadowOpacity: 0.78,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
    elevation: 18,
  },
  logoPanelGlow: {
    position: "absolute",
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: "rgba(0,229,255,0.10)",
  },
  headerLogo: {
    width: 72,
    height: 72,
    shadowColor: colors.neuralPurple,
    shadowOpacity: 0.9,
    shadowRadius: 18,
  },
  headerCopy: {
    flex: 1,
  },
  logo: {
    color: colors.white,
    fontSize: 34,
    fontWeight: "300",
    letterSpacing: 11,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 2,
    letterSpacing: 0.6,
  },
  promise: {
    color: colors.white,
    fontSize: 31,
    fontWeight: "900",
    lineHeight: 38,
    letterSpacing: -0.7,
    marginBottom: spacing.xl,
  },
  captureCard: {
    borderRadius: 38,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(185,199,255,0.22)",
    overflow: "hidden",
    shadowColor: colors.neuralPurple,
    shadowOpacity: 0.42,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 0 },
    elevation: 15,
  },
  cardSheen: {
    position: "absolute",
    top: -80,
    right: -70,
    width: 180,
    height: 180,
    borderRadius: 100,
    backgroundColor: "rgba(138,92,255,0.16)",
  },
  captureTitle: {
    color: colors.white,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.4,
  },
  captureHint: {
    color: colors.textSecondary,
    fontSize: 17,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  recordState: {
    color: colors.memoryPink,
    fontSize: 22,
    fontWeight: "900",
    marginTop: spacing.xl,
    textShadowColor: "rgba(255,82,246,0.58)",
    textShadowRadius: 14,
  },
  smallText: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  quoteCard: {
    marginTop: spacing.xl,
    borderRadius: 28,
    padding: spacing.lg,
    backgroundColor: "rgba(7,11,32,0.78)",
    borderWidth: 1,
    borderColor: "rgba(168,85,255,0.42)",
    flexDirection: "row",
    alignItems: "center",
    shadowColor: colors.memoryPink,
    shadowOpacity: 0.16,
    shadowRadius: 20,
  },
  taskCard: {
    marginTop: spacing.md,
    borderRadius: 28,
    padding: spacing.lg,
    backgroundColor: "rgba(4,17,36,0.78)",
    borderWidth: 1,
    borderColor: "rgba(38,216,255,0.28)",
    flexDirection: "row",
    alignItems: "center",
  },
  brainIcon: {
    fontSize: 38,
    marginRight: spacing.lg,
  },
  taskIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    color: colors.white,
    backgroundColor: "rgba(0,229,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.38)",
    textAlign: "center",
    lineHeight: 36,
    fontSize: 22,
    fontWeight: "900",
    marginRight: spacing.lg,
  },
  quoteCopy: {
    flex: 1,
  },
  quoteStrong: {
    color: colors.memoryPink,
    fontSize: 18,
    fontWeight: "900",
  },
  taskStrong: {
    color: colors.electricBlue,
    fontSize: 18,
    fontWeight: "900",
  },
  quoteSoft: {
    color: colors.textSecondary,
    fontSize: 17,
    marginTop: 2,
  },
  chevron: {
    color: colors.textSecondary,
    fontSize: 34,
  },

  reminderCard: {
    marginTop: spacing.md,
    borderRadius: 24,
    padding: spacing.lg,
    backgroundColor: "rgba(8,18,42,0.72)",
    borderWidth: 1,
    borderColor: "rgba(185,199,255,0.22)",
    flexDirection: "row",
    alignItems: "center",
  },
  reminderCopy: {
    flex: 1,
  },
  reminderTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "900",
  },
  reminderText: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 3,
  },
  reminderButton: {
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.34)",
    backgroundColor: "rgba(0,229,255,0.08)",
  },
  reminderButtonEnabled: {
    borderColor: "rgba(168,85,255,0.42)",
    backgroundColor: "rgba(168,85,255,0.12)",
  },
  reminderButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "900",
  },
  timelineHeader: {
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timelineTitle: {
    ...typography.h2,
    color: colors.white,
  },
  memoryCount: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  emptyTimeline: {
    borderRadius: 28,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.18)",
    backgroundColor: "rgba(6,12,34,0.46)",
    flexDirection: "row",
    alignItems: "center",
  },
  memoryOrb: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.neuralPurple,
    marginRight: spacing.lg,
    shadowColor: colors.cyan,
    shadowOpacity: 0.72,
    shadowRadius: 18,
  },
  memoryList: {
    gap: spacing.md,
  },
  memoryItem: {
    borderRadius: 24,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.18)",
    backgroundColor: "rgba(6,12,34,0.5)",
    flexDirection: "row",
    alignItems: "center",
  },
  memoryOrbSmall: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.neuralPurple,
    marginRight: spacing.lg,
    shadowColor: colors.cyan,
    shadowOpacity: 0.52,
    shadowRadius: 12,
  },
  emptyCopy: {
    flex: 1,
  },
  emptyTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "800",
  },
  emptyText: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  memoryMeta: {
    color: colors.memoryPink,
    fontSize: 13,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
});