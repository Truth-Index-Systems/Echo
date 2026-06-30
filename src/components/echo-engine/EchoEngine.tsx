import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";

import {
  baseLinks,
  baseNodes,
  getNode,
  neuralPalette,
} from "./engineConfig";
import {
  createInitialNodes,
  stepSimulation,
  type SimNode,
  type SimParticle,
} from "./simulation";
import type { EngineMode, NeuralNode } from "./types";

type EchoEngineProps = {
  mode?: EngineMode;
  savedMemoryCount?: number;
};

const { width, height } = Dimensions.get("window");

function buildTinyBranches(node: NeuralNode) {
  return Array.from({ length: node.branches }).map((_, index) => {
    const angle = (Math.PI * 2 * index) / node.branches + (node.x % 17) / 35;
    const length = 18 + ((index * 11 + node.y) % 34);

    return {
      id: `${node.id}-branch-${index}`,
      x1: node.x,
      y1: node.y,
      x2: node.x + Math.cos(angle) * length,
      y2: node.y + Math.sin(angle) * length,
      spark: index % 3 === 0,
      color: index % 2 === 0 ? node.color : neuralPalette.white,
    };
  });
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

export default function EchoEngine({
  mode = "idle",
  savedMemoryCount = 0,
}: EchoEngineProps) {
  const [simNodes, setSimNodes] = useState<SimNode[]>(() =>
    createInitialNodes(baseNodes.map((node) => node.id))
  );

  const [particles, setParticles] = useState<SimParticle[]>([]);
  const modeRef = useRef(mode);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const visibleNodes = useMemo(() => {
    const growthCount = Math.min(Math.floor(savedMemoryCount / 2), 4);
    return baseNodes.slice(0, 6 + growthCount);
  }, [savedMemoryCount]);

  const visibleNodeIds = useMemo(
    () => new Set(visibleNodes.map((node) => node.id)),
    [visibleNodes]
  );

  const tinyBranches = useMemo(
    () => visibleNodes.flatMap((node) => buildTinyBranches(node)),
    [visibleNodes]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setSimNodes((currentNodes) => {
        setParticles((currentParticles) => {
          const result = stepSimulation({
            nodes: currentNodes,
            particles: currentParticles,
            mode: modeRef.current,
          });

          setTimeout(() => {
            setSimNodes(result.nodes);
          }, 0);

          return result.particles;
        });

        return currentNodes;
      });
    }, 80);

    return () => clearInterval(interval);
  }, []);

  const nodeEnergyById = useMemo(() => {
    const map = new Map<string, number>();

    for (const node of simNodes) {
      map.set(node.id, node.energy);
    }

    return map;
  }, [simNodes]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Circle
          cx={width * 0.52}
          cy={height * 0.35}
          r={width * 0.82}
          fill={neuralPalette.cyan}
          opacity={mode === "idle" ? 0.025 : 0.08}
        />

        {baseLinks.map((link, index) => {
          if (!visibleNodeIds.has(link.from) || !visibleNodeIds.has(link.to)) {
            return null;
          }

          const from = getNode(link.from, baseNodes);
          const to = getNode(link.to, baseNodes);

          const fromEnergy = nodeEnergyById.get(from.id) ?? 0;
          const toEnergy = nodeEnergyById.get(to.id) ?? 0;
          const linkEnergy = clamp((fromEnergy + toEnergy) / 2);

          return (
            <Line
              key={`link-${index}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={from.color}
              strokeWidth={1}
              strokeOpacity={0.08 + linkEnergy * 0.34}
            />
          );
        })}

        {tinyBranches.map((branch) => {
          const parentId = branch.id.split("-branch-")[0];
          const energy = nodeEnergyById.get(parentId) ?? 0;

          return (
            <React.Fragment key={branch.id}>
              <Line
                x1={branch.x1}
                y1={branch.y1}
                x2={branch.x2}
                y2={branch.y2}
                stroke={branch.color}
                strokeWidth={branch.spark ? 0.5 : 0.3}
                strokeOpacity={0.035 + energy * 0.24}
              />

              {branch.spark && (
                <Circle
                  cx={branch.x2}
                  cy={branch.y2}
                  r={0.85 + energy * 0.65}
                  fill={branch.color}
                  opacity={0.05 + energy * 0.55}
                />
              )}
            </React.Fragment>
          );
        })}

        {particles
          .filter(
            (particle) =>
              visibleNodeIds.has(particle.from) && visibleNodeIds.has(particle.to)
          )
          .map((particle) => {
            const from = getNode(particle.from, baseNodes);
            const to = getNode(particle.to, baseNodes);

            const x = from.x + (to.x - from.x) * particle.progress;
            const y = from.y + (to.y - from.y) * particle.progress;

            return (
              <React.Fragment key={particle.id}>
                <Circle
                  cx={x}
                  cy={y}
                  r={1.4 + particle.energy * 1.4}
                  fill={neuralPalette.white}
                  opacity={0.25 + particle.energy * 0.65}
                />

                <Circle
                  cx={x}
                  cy={y}
                  r={4 + particle.energy * 5}
                  fill={from.color}
                  opacity={0.08 + particle.energy * 0.16}
                />
              </React.Fragment>
            );
          })}

        {visibleNodes.map((node) => {
          const energy = nodeEnergyById.get(node.id) ?? 0;

          return (
            <React.Fragment key={node.id}>
              <Circle
                cx={node.x}
                cy={node.y}
                r={node.r * (2.8 + energy * 2.8)}
                fill={node.color}
                opacity={0.04 + energy * 0.22}
              />

              <Circle
                cx={node.x}
                cy={node.y}
                r={node.r * (1.55 + energy)}
                fill={node.color}
                opacity={0.08 + energy * 0.3}
              />

              <Circle
                cx={node.x}
                cy={node.y}
                r={node.r * 0.95}
                fill={neuralPalette.white}
                opacity={0.84 + energy * 0.16}
              />

              <Circle
                cx={node.x}
                cy={node.y}
                r={node.r * 0.48}
                fill={node.color}
                opacity={1}
              />
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );}