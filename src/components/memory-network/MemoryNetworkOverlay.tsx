import { router } from "expo-router";
import React from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";

type Props = {
  nodeCount: number;
};

export function MemoryNetworkOverlay({ nodeCount }: Props) {
  return (
    <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View>
          <Text style={styles.title}>My Memory Network</Text>
        </View>
      </View>

      <View style={styles.footerPanel}>
        <Text style={styles.footerStrong}>
          {nodeCount === 0 ? "No network yet" : `${nodeCount} active memories`}
        </Text>
        <Text style={styles.footerSoft}>
          Tasks quietly strengthen links between people, places, ideas and events.
        </Text>
      </View>

      {nodeCount === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Start speaking naturally</Text>
          <Text style={styles.emptyText}>
            Mention people, places, ideas or events and Echo will begin forming
            your memory network.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    zIndex: 10,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,12,38,0.72)",
  },
  backText: {
    color: colors.white,
    fontSize: 36,
    marginTop: -3,
  },
  title: {
    color: colors.white,
    fontSize: 27,
    fontWeight: "900",
  },
  footerPanel: {
    position: "absolute",
    left: spacing.xl,
    right: spacing.xl,
    bottom: 28,
    padding: spacing.lg,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(168,85,255,0.22)",
    backgroundColor: "rgba(6,12,34,0.64)",
  },
  footerStrong: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "900",
  },
  footerSoft: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  emptyState: {
    position: "absolute",
    left: spacing.xl,
    right: spacing.xl,
    bottom: 118,
    padding: spacing.xl,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.18)",
    backgroundColor: "rgba(6,12,34,0.62)",
  },
  emptyTitle: {
    color: colors.white,
    fontSize: 19,
    fontWeight: "900",
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
});
