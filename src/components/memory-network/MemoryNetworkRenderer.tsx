import React from "react";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  RadialGradient,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { clusterConfig, MEMORY_WORLD, worldCenter } from "./world";
import type { MemoryCamera, MemoryLink, NetworkNode, NetworkParticle } from "./types";

type SearchMode = "idle" | "searching" | "focused";

type Props = {
  nodes: NetworkNode[];
  links: MemoryLink[];
  particles: NetworkParticle[];
  tick: number;
  width: number;
  height: number;
  camera: MemoryCamera;
  searchMode?: SearchMode;
  focusedNodeIds?: string[];
  focusedLinkIds?: string[];
};

export function MemoryNetworkRenderer({
  nodes,
  links,
  particles,
  tick,
  width,
  height,
  camera,
  searchMode = "idle",
  focusedNodeIds = [],
  focusedLinkIds = [],
}: Props) {
  const visibleWidth = width / camera.scale;
  const visibleHeight = height / camera.scale;
  const viewBox = `${camera.x} ${camera.y} ${visibleWidth} ${visibleHeight}`;

  const zoom = camera.scale;
  const interactionGlow = 0.5 + Math.abs(Math.sin(tick * 0.045)) * 0.5;
  const searchPulse = 0.5 + Math.abs(Math.sin(tick * 0.16)) * 0.5;
  const searchSweep = (tick * 0.018) % 1;

  const focusedNodeSet = new Set(focusedNodeIds);
  const focusedLinkSet = new Set(focusedLinkIds);

  const isFocusedMode = searchMode === "focused" && focusedNodeIds.length > 0;
  const isSearching = searchMode === "searching";

  const labelOpacity = zoom < 0.9 ? 0 : Math.min(1, (zoom - 0.9) / 0.8);
  const clusterHeaderOpacity = Math.min(
    1,
    0.52 + zoom * 0.18 + interactionGlow * 0.28 + (isSearching ? 0.22 : 0)
  );

  function nodeOpacity(node: NetworkNode) {
    if (isSearching) return 0.78 + searchPulse * 0.18;
    if (!isFocusedMode) return 1;
    return focusedNodeSet.has(node.id) ? 1 : 0.09;
  }

  function linkOpacity(link: MemoryLink, base: number) {
    if (isSearching) return Math.min(1, base + searchPulse * 0.18);
    if (!isFocusedMode) return base;

    const isFocused =
      focusedLinkSet.has(link.id) ||
      focusedNodeSet.has(link.from.id) ||
      focusedNodeSet.has(link.to.id);

    return isFocused ? Math.min(1, base + 0.34) : 0.018;
  }

  return (
    <Svg width={width} height={height} viewBox={viewBox} preserveAspectRatio="xMidYMid slice">
      <Defs>
        <RadialGradient id="memoryCoreGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <Stop offset="45%" stopColor="#2F6BFF" stopOpacity={isSearching ? "0.46" : "0.26"} />
          <Stop offset="100%" stopColor="#00E5FF" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Circle cx={worldCenter.x} cy={worldCenter.y} r={MEMORY_WORLD.width * 0.42} fill="#00E5FF" opacity={isFocusedMode ? 0.012 : 0.035} />
      <Circle cx={worldCenter.x} cy={worldCenter.y} r={MEMORY_WORLD.width * 0.28} fill="#A855FF" opacity={isFocusedMode ? 0.01 : 0.025} />

      {Object.entries(clusterConfig).map(([key, cluster]) => {
        const headerY = cluster.y - cluster.radius * 0.72;

        return (
          <G key={`cluster-${key}`}>
            <Circle cx={cluster.x} cy={cluster.y} r={cluster.radius} fill={cluster.color} opacity={isFocusedMode ? 0.01 : 0.025} />
            <Circle cx={cluster.x} cy={cluster.y} r={cluster.radius * 0.48} fill={cluster.color} opacity={isFocusedMode ? 0.012 : 0.035} />

            <SvgText
              x={cluster.x}
              y={headerY}
              fill={cluster.color}
              opacity={clusterHeaderOpacity}
              fontSize="58"
              fontWeight="900"
              letterSpacing="12"
              textAnchor="middle"
            >
              {cluster.label}
            </SvgText>
          </G>
        );
      })}

      {nodes.map((node) => {
        const cluster = clusterConfig[node.type];
        const opacity = nodeOpacity(node);

        return (
          <Line
            key={`core-${node.id}`}
            x1={worldCenter.x}
            y1={worldCenter.y}
            x2={node.x}
            y2={node.y}
            stroke={cluster.color}
            strokeWidth={1 + node.strength * 1.4}
            strokeOpacity={(0.018 + node.strength * 0.055) * opacity}
          />
        );
      })}

      {links.map((link) => {
        const color = clusterConfig[link.from.type].color;
        const baseOpacity = 0.055 + link.strength * 0.17;

        return (
          <Line
            key={link.id}
            x1={link.from.x}
            y1={link.from.y}
            x2={link.to.x}
            y2={link.to.y}
            stroke={color}
            strokeWidth={0.8 + link.strength * 2.4}
            strokeOpacity={linkOpacity(link, baseOpacity)}
          />
        );
      })}

      {isSearching &&
        nodes.flatMap((node, nodeIndex) => {
          const cluster = clusterConfig[node.type];
          const streamsPerNode = Math.max(3, Math.min(6, Math.round(3 + node.strength * 3)));

          return Array.from({ length: streamsPerNode }).map((_, streamIndex) => {
            const streamOffset = (nodeIndex * 0.037 + streamIndex * 0.19) % 1;
            const progress = (searchSweep + streamOffset) % 1;
            const reverse = streamIndex % 3 === 0;
            const eased = progress * progress * (3 - 2 * progress);
            const travel = reverse ? 1 - eased : eased;
            const wobble = Math.sin(tick * 0.21 + nodeIndex * 1.7 + streamIndex * 2.4) * 18;
            const dx = node.x - worldCenter.x;
            const dy = node.y - worldCenter.y;
            const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
            const normalX = -dy / length;
            const normalY = dx / length;
            const x = worldCenter.x + dx * travel + normalX * wobble;
            const y = worldCenter.y + dy * travel + normalY * wobble;
            const sparkle = 0.45 + Math.abs(Math.sin(tick * 0.33 + nodeIndex + streamIndex)) * 0.55;

            return (
              <G key={`search-stream-${node.id}-${streamIndex}`}>
                <Circle
                  cx={x}
                  cy={y}
                  r={2.2 + sparkle * 3.4}
                  fill="#FFFFFF"
                  opacity={0.28 + sparkle * 0.42}
                />
                <Circle
                  cx={x}
                  cy={y}
                  r={10 + sparkle * 14}
                  fill={cluster.color}
                  opacity={0.045 + sparkle * 0.095}
                />
              </G>
            );
          });
        })}

      {particles.map((particle) => {
        const link = links.find((item) => item.id === particle.linkId);
        if (!link) return null;

        if (isFocusedMode && !focusedLinkSet.has(link.id)) {
          return null;
        }

        const color = clusterConfig[link.from.type].color;
        const x = link.from.x + (link.to.x - link.from.x) * particle.progress;
        const y = link.from.y + (link.to.y - link.from.y) * particle.progress;

        return (
          <G key={particle.id}>
            <Circle cx={x} cy={y} r={2.2 + particle.energy * 2.4} fill="#FFFFFF" opacity={0.35 + particle.energy * 0.4} />
            <Circle cx={x} cy={y} r={7 + particle.energy * 7} fill={color} opacity={0.06 + particle.energy * 0.12} />
          </G>
        );
      })}

      {nodes.map((node, index) => {
        const cluster = clusterConfig[node.type];
        const opacity = nodeOpacity(node);

        const phase = (tick * (isSearching ? 0.026 : isFocusedMode ? 0.012 : 0.006) + index * 0.17) % 1;
        const outward = isSearching ? true : index % 2 === 0;
        const progress = outward ? phase : 1 - phase;

        const x = worldCenter.x + (node.x - worldCenter.x) * progress;
        const y = worldCenter.y + (node.y - worldCenter.y) * progress;

        const energy = isSearching ? 1 : isFocusedMode ? 0.78 + node.strength * 0.35 : 0.45 + node.strength * 0.55;

        if (isFocusedMode && !focusedNodeSet.has(node.id)) {
          return null;
        }

        return (
          <G key={`you-flow-${node.id}`}>
            <Circle
              cx={x}
              cy={y}
              r={2.4 + energy * 2.8}
              fill="#FFFFFF"
              opacity={(0.25 + energy * 0.35) * opacity}
            />
            <Circle
              cx={x}
              cy={y}
              r={9 + energy * 8}
              fill={cluster.color}
              opacity={(0.045 + energy * 0.08) * opacity}
            />
          </G>
        );
      })}

      <Circle
        cx={worldCenter.x}
        cy={worldCenter.y}
        r={155 + Math.sin(tick * 0.05) * 8 + (isSearching ? searchPulse * 28 : 0)}
        fill="url(#memoryCoreGlow)"
      />
      <Circle cx={worldCenter.x} cy={worldCenter.y} r={74 + Math.sin(tick * 0.08) * 4} fill="#2F6BFF" opacity={isSearching ? 0.38 : 0.22} />
      <Circle cx={worldCenter.x} cy={worldCenter.y} r={46} fill="#FFFFFF" opacity={0.94} />

      <SvgText
        x={worldCenter.x}
        y={worldCenter.y + 10}
        fill="#0A1230"
        fontSize="26"
        fontWeight="900"
        textAnchor="middle"
      >
        YOU
      </SvgText>

      {nodes.map((node) => {
        const cluster = clusterConfig[node.type];
        const opacity = nodeOpacity(node);
        const isFocusedNode = focusedNodeSet.has(node.id);
        const pulseStrength = isFocusedNode ? 0.085 : 0.025;
        const pulse = 1 + Math.sin(tick * (isFocusedNode ? 0.13 : 0.07) + node.x * 0.01) * pulseStrength;

        const baseRadius = zoom < 0.75 ? 9 : zoom < 1.25 ? 13 : 19;
        const r =
          (baseRadius + node.strength * 16 + (isFocusedNode ? 13 : 0)) * pulse;

        return (
          <G key={node.id}>
            <Circle cx={node.x} cy={node.y} r={r * 2.15} fill={cluster.color} opacity={(0.035 + node.strength * 0.08) * opacity} />
            <Circle cx={node.x} cy={node.y} r={r * 1.35} fill={cluster.color} opacity={(0.08 + node.strength * 0.12) * opacity} />
            <Circle cx={node.x} cy={node.y} r={r} fill={cluster.color} opacity={(0.58 + node.strength * 0.22) * opacity} />
            <Circle cx={node.x} cy={node.y} r={Math.max(3, r * 0.22)} fill="#FFFFFF" opacity={0.74 * opacity} />

            {(labelOpacity > 0 || isFocusedNode) && (
              <SvgText
                x={node.x}
                y={node.y + r + 27}
                fill="#FFFFFF"
                opacity={(isFocusedNode ? 1 : 0.82 * labelOpacity) * opacity}
                fontSize={isFocusedNode ? "22" : "18"}
                fontWeight="800"
                textAnchor="middle"
              >
                {node.label}
              </SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
}