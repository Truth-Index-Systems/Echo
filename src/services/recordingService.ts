import { Audio } from "expo-av";

let activeRecording: Audio.Recording | null = null;

export type RecordingResult = {
  uri: string;
  durationMs: number;
};

export async function startRecording() {
  const permission = await Audio.requestPermissionsAsync();

  if (!permission.granted) {
    throw new Error("Microphone permission denied");
  }

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const recording = new Audio.Recording();

  await recording.prepareToRecordAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY
  );

  await recording.startAsync();

  activeRecording = recording;
}

export async function stopRecording(): Promise<RecordingResult> {
  if (!activeRecording) {
    throw new Error("No active recording");
  }

  const recording = activeRecording;
  activeRecording = null;

  await recording.stopAndUnloadAsync();

  const uri = recording.getURI();

  if (!uri) {
    throw new Error("Recording URI missing");
  }

  const status = await recording.getStatusAsync();

  return {
    uri,
    durationMs: status.durationMillis ?? 0,
  };
}

export async function cancelRecording() {
  if (!activeRecording) return;

  const recording = activeRecording;
  activeRecording = null;

  try {
    await recording.stopAndUnloadAsync();
  } catch {
    // Safe cancel.
  }}