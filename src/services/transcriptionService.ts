type TranscriptionResponse = {
  text?: string;
};

const OPENAI_TRANSCRIPTION_URL =
  "https://api.openai.com/v1/audio/transcriptions";

export async function transcribeAudio(audioUri: string): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing EXPO_PUBLIC_OPENAI_API_KEY");
  }

  const formData = new FormData();

  formData.append("file", {
    uri: audioUri,
    name: "echo-memory.m4a",
    type: "audio/m4a",
  } as unknown as Blob);

  formData.append("model", "whisper-1");

  const response = await fetch(OPENAI_TRANSCRIPTION_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Transcription failed: ${errorText}`);
  }

  const data = (await response.json()) as TranscriptionResponse;

  if (!data.text) {
    throw new Error("No transcript returned");
  }

  return data.text.trim();}