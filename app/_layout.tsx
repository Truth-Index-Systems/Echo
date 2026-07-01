import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { EchoLoadingScreen } from "../src/components/EchoLoadingScreen";
import { syncEchoReminderNotifications } from "../src/services/reminderEngine";
import { getMemories, hydrateMemories } from "../src/stores/memoryStore";
import { getReminderSettings, hydrateReminderSettings } from "../src/stores/reminderSettingsStore";
import { getTasks, hydrateTasks } from "../src/stores/taskStore";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function RootLayout() {
  const [isRestored, setIsRestored] = useState(false);
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restoreEcho() {
      await Promise.all([
        hydrateMemories(),
        hydrateTasks(),
        hydrateReminderSettings(),
        delay(650),
      ]);

      await syncEchoReminderNotifications(
        getMemories(),
        getTasks(),
        getReminderSettings()
      ).catch((error) => {
        console.warn("[Echo Reminders] Failed to resync on launch", error);
      });

      if (cancelled) return;

      setIsRestored(true);
      await SplashScreen.hideAsync().catch(() => undefined);

      setTimeout(() => {
        if (!cancelled) setShowIntro(false);
      }, 1150);
    }

    void restoreEcho();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      {!isRestored || showIntro ? (
        <EchoLoadingScreen ready={isRestored} />
      ) : (
        <Stack screenOptions={{ headerShown: false, contentStyle: styles.stack }} />
      )}
      <StatusBar style="light" />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  stack: {
    backgroundColor: "#000000",
  },
});
