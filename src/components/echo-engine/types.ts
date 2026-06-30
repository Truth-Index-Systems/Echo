export type EngineMode =
  | "idle"
  | "wake"
  | "listening"
  | "thinking"
  | "storing"
  | "settling";

export type EngineStateConfig = {
  energy: number;
  electricity: number;
  glow: number;
  transitionMs: number;
};

export type NeuralNode = {
  id: string;
  x: number;
  y: number;
  r: number;
  color: string;
  branches: number;
};

export type NeuralLink = {
  from: string;
  to: string;};