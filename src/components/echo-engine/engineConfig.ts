import { Dimensions } from "react-native";
import type { NeuralLink, NeuralNode, EngineMode, EngineStateConfig } from "./types";

const { width } = Dimensions.get("window");

export const neuralPalette = {
  cyan: "#00E5FF",
  blue: "#2F6BFF",
  purple: "#A855FF",
  pink: "#FF3DFF",
  white: "#FFFFFF",
};

export const baseNodes: NeuralNode[] = [
  { id: "n1", x: width * 0.16, y: 120, r: 4.4, color: neuralPalette.cyan, branches: 12 },
  { id: "n2", x: width * 0.52, y: 92, r: 5.2, color: neuralPalette.white, branches: 15 },
  { id: "n3", x: width * 0.84, y: 158, r: 4.2, color: neuralPalette.pink, branches: 13 },
  { id: "n4", x: width * 0.28, y: 260, r: 5.8, color: neuralPalette.blue, branches: 16 },
  { id: "n5", x: width * 0.68, y: 320, r: 5.2, color: neuralPalette.purple, branches: 15 },
  { id: "n6", x: width * 0.14, y: 435, r: 5.4, color: neuralPalette.white, branches: 16 },
  { id: "n7", x: width * 0.86, y: 475, r: 5.4, color: neuralPalette.pink, branches: 15 },
  { id: "n8", x: width * 0.50, y: 590, r: 5.2, color: neuralPalette.cyan, branches: 15 },
  { id: "n9", x: width * 0.24, y: 715, r: 4.4, color: neuralPalette.blue, branches: 10 },
  { id: "n10", x: width * 0.74, y: 740, r: 4.8, color: neuralPalette.purple, branches: 11 },
];

export const baseLinks: NeuralLink[] = [
  { from: "n1", to: "n2" },
  { from: "n2", to: "n3" },
  { from: "n1", to: "n4" },
  { from: "n2", to: "n4" },
  { from: "n4", to: "n5" },
  { from: "n5", to: "n7" },
  { from: "n4", to: "n6" },
  { from: "n6", to: "n8" },
  { from: "n7", to: "n8" },
  { from: "n8", to: "n9" },
  { from: "n8", to: "n10" },
  { from: "n5", to: "n8" },
];

export function getNode(id: string, nodes: NeuralNode[]) {
  return nodes.find((node) => node.id === id)!;
}
export const engineStates: Record<EngineMode, EngineStateConfig> = {
  idle: {
    energy: 0.06,
    electricity: 0.02,
    glow: 0.12,
    transitionMs: 11,
  },
  wake: {
    energy: 0.42,
    electricity: 0.55,
    glow: 0.38,
    transitionMs: 11,
  },
  listening: {
    energy: 0.82,
    electricity: 0.9,
    glow: 0.68,
    transitionMs: 88,
  },
  thinking: {
    energy: 0.68,
    electricity: 1,
    glow: 0.58,
    transitionMs: 11,
  },
  storing: {
    energy: 1,
    electricity: 1,
    glow: 0.9,
    transitionMs: 33,
  },
  settling: {
    energy: 0.18,
    electricity: 0.12,
    glow: 0.22,
    transitionMs: 11,
  },};