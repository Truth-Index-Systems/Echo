import { baseLinks } from "./engineConfig";
import type { EngineMode } from "./types";

export type SimNode = {
  id: string;
  energy: number;
};

export type SimParticle = {
  id: string;
  from: string;
  to: string;
  progress: number;
  speed: number;
  energy: number;
};

const modeFireChance: Record<EngineMode, number> = {
  idle: 0.006,
  wake: 0.08,
  listening: 0.04,
  thinking: 0.09,
  storing: 0.18,
  settling: 0.012,
};

const modeParticleSpeed: Record<EngineMode, number> = {
  idle: 0.008,
  wake: 0.028,
  listening: 0.018,
  thinking: 0.032,
  storing: 0.045,
  settling: 0.012,
};

export function createInitialNodes(nodeIds: string[]): SimNode[] {
  return nodeIds.map((id) => ({
    id,
    energy: Math.random() * 0.12,
  }));
}

export function stepSimulation(params: {
  nodes: SimNode[];
  particles: SimParticle[];
  mode: EngineMode;
}) {
  const { nodes, particles, mode } = params;

  const nextNodes = nodes.map((node) => ({
    ...node,
    energy: Math.max(0, node.energy * 0.92),
  }));

  const nextParticles: SimParticle[] = [];

  for (const particle of particles) {
    const progress = particle.progress + particle.speed;

    if (progress >= 1) {
      const targetNode = nextNodes.find((node) => node.id === particle.to);

      if (targetNode) {
        targetNode.energy = Math.min(1, targetNode.energy + particle.energy);
      }

      continue;
    }

    nextParticles.push({
      ...particle,
      progress,
      energy: particle.energy * 0.985,
    });
  }

  for (const node of nextNodes) {
    const chance = modeFireChance[mode] * (0.5 + node.energy);

    if (Math.random() < chance) {
      const outgoing = baseLinks.filter((link) => link.from === node.id || link.to === node.id);

      if (outgoing.length > 0) {
        const link = outgoing[Math.floor(Math.random() * outgoing.length)];
        const from = link.from === node.id ? link.from : link.to;
        const to = link.from === node.id ? link.to : link.from;

        nextParticles.push({
          id: `${Date.now()}-${Math.random()}`,
          from,
          to,
          progress: 0,
          speed: modeParticleSpeed[mode] + Math.random() * 0.01,
          energy: mode === "idle" ? 0.18 : 0.35 + Math.random() * 0.35,
        });

        node.energy = Math.min(1, node.energy + 0.24);
      }
    }
  }

  return {
    nodes: nextNodes,
    particles: nextParticles.slice(-30),
  };}