import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";

type Props = {
  nodeCount: number;
};

export function MemoryNetworkOverlay({ nodeCount }: Props) {
  return (
    <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
      <View style={styles.header}>
        <Pressable style={styles.circleButton} onPress={() => router.back()}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View style={styles.titleWrap}>
          <Text style={styles.kicker}>ECHO</Text>
          <Text style={styles.title}>Memory Network</Text>
        </View>
      </View>

      <LinearGradient
        pointerEvents="box-none"
        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.62)", "rgba(0,0,0,0.92)"]}
        locations={[0, 0.55, 1]}
        style={styles.bottomFade}
      />

      <View style={styles.footerPanel}>
        <Text style={styles.footerStrong}>
          {nodeCount === 0 ? "No network yet" : `${nodeCount} active memories`}
        </Text>
        <Text style={styles.footerSoft}>
          Pinch and drag through your living memory. Search makes the right links light up.
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
    gap: spacing.md,
  },
  circleButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,12,33,0.72)",
    shadowColor: colors.neuralPurple,
    shadowOpacity: 0.36,
    shadowRadius: 16,
  },
  backText: {
    color: colors.white,
    fontSize: 38,
    marginTop: -4,
  },
  titleWrap: {
    flex: 1,
  },
  kicker: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 5,
  },
  title: {
    color: colors.white,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  bottomFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 250,
  },
  footerPanel: {
    position: "absolute",
    left: spacing.xl,
    right: spacing.xl,
    bottom: 28,
    padding: spacing.lg,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(185,199,255,0.2)",
    backgroundColor: "rgba(3,6,20,0.72)",
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
    bottom: 126,
    padding: spacing.xl,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(38,216,255,0.18)",
    backgroundColor: "rgba(3,6,20,0.72)",
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
