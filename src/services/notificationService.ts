import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function getNotificationPermissionStatus() {
  const permissions = await Notifications.getPermissionsAsync();
  return permissions.status === "granted" ? "granted" : permissions.status === "denied" ? "denied" : "unknown";
}

export async function requestEchoNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === "granted") return "granted" as const;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === "granted" ? "granted" as const : "denied" as const;
}

export async function configureAndroidNotificationChannel() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync("echo-reminders", {
    name: "Echo reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#00E5FF",
  });
}

export async function cancelEchoReminderNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

function normalizeEchoTrigger(trigger: Notifications.NotificationTriggerInput) {
  if (trigger instanceof Date || typeof trigger === "number") {
    return {
      type: "date",
      date: trigger,
      channelId: "echo-reminders",
    } as any;
  }

  if (trigger && typeof trigger === "object") {
    return {
      channelId: "echo-reminders",
      ...trigger,
    } as any;
  }

  return trigger;
}

export async function scheduleEchoNotification(args: {
  identifier?: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  trigger: Notifications.NotificationTriggerInput;
}) {
  await configureAndroidNotificationChannel();

  return Notifications.scheduleNotificationAsync({
    identifier: args.identifier,
    content: {
      title: args.title,
      body: args.body,
      data: args.data ?? {},
      sound: false,
    },
    trigger: normalizeEchoTrigger(args.trigger),
  });
}
