import React, { useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { EchoMemory, PersonalMemoryAnswer } from "../../types/memory";
import { searchPersonalMemory } from "../../services/memorySearchService";

type Props = {
  memories: EchoMemory[];
  onSearchingChange?: (isSearching: boolean) => void;
  onResult?: (result: PersonalMemoryAnswer) => void;
  onClose?: () => void;
};

export function MemorySearchPanel({
  memories,
  onSearchingChange,
  onResult,
  onClose,
}: Props) {
  const [prompt, setPrompt] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [result, setResult] = useState<PersonalMemoryAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSearch = prompt.trim().length > 2 && !isSearching;

  async function handleSearch() {
    if (!canSearch) return;

    Keyboard.dismiss();
    setHasSubmitted(true);
    setIsSearching(true);
    setError(null);
    setResult(null);
    onSearchingChange?.(true);

    try {
      const answer = await searchPersonalMemory(prompt.trim(), memories);
      setResult(answer);
      onResult?.(answer);
    } catch {
      setError("Echo could not search your memory right now.");
      onSearchingChange?.(false);
    } finally {
      setIsSearching(false);
    }
  }

  if (hasSubmitted && isSearching) {
    return (
      <View style={styles.searchingPill}>
        <ActivityIndicator color="#FFFFFF" />
        <Text style={styles.searchingText}>Remembering...</Text>
      </View>
    );
  }

  if (hasSubmitted && result) {
    return (
      <View style={styles.answerShell}>
        <ScrollView style={styles.answerScroll} contentContainerStyle={styles.answerContent}>
          <Text style={styles.answerLabel}>Echo remembers</Text>
          <Text style={styles.answerText}>{result.answer}</Text>
        </ScrollView>

        <Pressable style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Close</Text>
        </Pressable>
      </View>
    );
  }

  if (hasSubmitted && error) {
    return (
      <View style={styles.answerShell}>
        <Text style={styles.error}>{error}</Text>

        <Pressable style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Close</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Remember</Text>
      <Text style={styles.subtitle}>Ask Echo what it remembers.</Text>

      <TextInput
        value={prompt}
        onChangeText={setPrompt}
        placeholder="What did I say about..."
        placeholderTextColor="rgba(220,230,255,0.42)"
        style={styles.input}
        multiline
        autoFocus
        returnKeyType="default"
        scrollEnabled
      />

      <View style={styles.actions}>
        <Pressable style={styles.secondaryButton} onPress={onClose}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </Pressable>

        <Pressable
          onPress={handleSearch}
          disabled={!canSearch}
          style={[styles.primaryButton, !canSearch && styles.buttonDisabled]}
        >
          <Text style={styles.primaryButtonText}>Remember</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "stretch",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(160,190,255,0.18)",
    backgroundColor: "rgba(8,14,34,0.94)",
    padding: 18,
    gap: 12,
    maxHeight: "70%",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
  },
  subtitle: {
    color: "rgba(220,230,255,0.64)",
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    minHeight: 96,
    maxHeight: 150,
    borderRadius: 20,
    padding: 14,
    color: "#FFFFFF",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(180,205,255,0.12)",
    fontSize: 15,
    textAlignVertical: "top",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  secondaryButtonText: {
    color: "rgba(235,242,255,0.82)",
    fontSize: 14,
    fontWeight: "900",
  },
  primaryButton: {
    flex: 1.3,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  buttonDisabled: {
    opacity: 0.38,
  },
  primaryButtonText: {
    color: "#071020",
    fontSize: 15,
    fontWeight: "900",
  },
  searchingPill: {
    alignSelf: "center",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(8,14,34,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  searchingText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  answerShell: {
    alignSelf: "stretch",
    maxHeight: 340,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(160,190,255,0.18)",
    backgroundColor: "rgba(8,14,34,0.9)",
    overflow: "hidden",
  },
  answerScroll: {
    maxHeight: 260,
  },
  answerContent: {
    padding: 18,
    gap: 10,
  },
  answerLabel: {
    color: "#9DB7FF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  answerText: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "600",
  },
  closeButton: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  closeButtonText: {
    color: "#071020",
    fontSize: 15,
    fontWeight: "900",
  },
  error: {
    color: "#FF8A8A",
    fontSize: 14,
    lineHeight: 20,
    padding: 18,
  },
});