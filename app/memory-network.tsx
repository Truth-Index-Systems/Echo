import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { MemorySearchPanel } from "../src/components/memory-search/MemorySearchPanel";
import {
  buildMemoryGraph,
  MemoryNetworkOverlay,
  MemoryNetworkRenderer,
  useMemoryCamera,
  useParticleSystem,
} from "../src/components/memory-network";
import { useMemories } from "../src/stores/memoryStore";
import { colors } from "../src/theme/colors";
import type { PersonalMemoryAnswer } from "../src/types/memory";
import { normaliseMemoryEntity } from "../src/utils/memoryNormaliser";

type SearchMode = "idle" | "searching" | "focused";

export default function MemoryNetworkScreen() {
  const memories = useMemories();
  const { width, height } = useWindowDimensions();
  const [tick, setTick] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>("idle");
  const [searchResult, setSearchResult] = useState<PersonalMemoryAnswer | null>(null);

  const graph = useMemo(() => buildMemoryGraph(memories), [memories]);
  const { camera, panHandlers } = useMemoryCamera(width, height);

  const focusedNodeIds = useMemo(() => {
    if (!searchResult) return [];

    const people = new Set<string>();
    const places = new Set<string>();
    const ideas = new Set<string>();
    const events = new Set<string>();

    for (const match of searchResult.matches) {
      match.group.people.forEach((item) => people.add(normaliseMemoryEntity(item)));
      match.group.places.forEach((item) => places.add(normaliseMemoryEntity(item)));
      match.group.ideas.forEach((item) => ideas.add(normaliseMemoryEntity(item)));
      match.group.events.forEach((item) => events.add(normaliseMemoryEntity(item)));
    }

    return graph.nodes
      .filter((node) => {
        if (node.type === "people") return people.has(node.key);
        if (node.type === "places") return places.has(node.key);
        if (node.type === "ideas") return ideas.has(node.key);
        if (node.type === "events") return events.has(node.key);
        return false;
      })
      .map((node) => node.id);
  }, [graph.nodes, searchResult]);

  const focusedLinkIds = useMemo(() => {
    const focused = new Set(focusedNodeIds);

    return graph.links
      .filter((link) => focused.has(link.from.id) && focused.has(link.to.id))
      .map((link) => link.id);
  }, [graph.links, focusedNodeIds]);

  const particles = useParticleSystem(graph.links, searchMode, focusedLinkIds);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((current) => current + 1);
    }, 96);

    return () => clearInterval(interval);
  }, []);

  function openSearch() {
    setSearchResult(null);
    setSearchMode("idle");
    setShowSearch(true);
  }

  function closeSearch() {
    setShowSearch(false);
    setSearchMode("idle");
    setSearchResult(null);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.networkLayer} {...panHandlers}>
        <MemoryNetworkRenderer
          nodes={graph.nodes}
          links={graph.links}
          particles={particles}
          tick={tick}
          width={width}
          height={height}
          camera={camera}
          searchMode={searchMode}
          focusedNodeIds={focusedNodeIds}
          focusedLinkIds={focusedLinkIds}
        />
      </View>

      <MemoryNetworkOverlay nodeCount={graph.nodes.length} />

      {!showSearch && (
        <View pointerEvents="box-none" style={styles.rememberLayer}>
          <Pressable style={styles.rememberButton} onPress={openSearch}>
            <Text style={styles.rememberButtonText}>Remember</Text>
          </Pressable>
        </View>
      )}

      {showSearch && (
        <KeyboardAvoidingView
          style={styles.searchLayer}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 16 : 0}
        >
          <MemorySearchPanel
            memories={memories}
            onSearchingChange={(isSearching) => {
              setSearchMode(isSearching ? "searching" : "idle");
            }}
            onResult={(result) => {
              setSearchResult(result);
              setSearchMode("focused");
            }}
            onClose={closeSearch}
          />
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: colors.space900,
  },
  networkLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  rememberLayer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 104 : 86,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 20,
  },
  rememberButton: {
    height: 46,
    minWidth: 154,
    paddingHorizontal: 26,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(160,190,255,0.26)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,14,34,0.72)",
    shadowColor: "#8FB7FF",
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  rememberButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.35,
  },
  searchLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 28,
    zIndex: 30,
  },
});
