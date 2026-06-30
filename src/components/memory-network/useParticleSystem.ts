import { useEffect, useRef, useState } from "react";
import type { MemoryLink, NetworkParticle } from "./types";

type ParticleMode = "idle" | "searching" | "focused";

export function useParticleSystem(
  links: MemoryLink[],
  mode: ParticleMode = "idle",
  focusedLinkIds: string[] = []
) {
  const [particles, setParticles] = useState<NetworkParticle[]>([]);
  const particleIdRef = useRef(0);

  useEffect(() => {
    const focusedLinkSet = new Set(focusedLinkIds);

    const interval = setInterval(() => {
      setParticles((current) => {
        const moved = current
          .map((particle) => ({
            ...particle,
            progress: particle.progress + particle.speed,
            energy: particle.energy * (mode === "searching" ? 0.992 : 0.985),
          }))
          .filter((particle) => {
            if (particle.progress >= 1) return false;
            if (mode === "focused" && focusedLinkSet.size > 0) {
              return focusedLinkSet.has(particle.linkId);
            }
            return true;
          });

        const activeLinks =
          mode === "focused" && focusedLinkSet.size > 0
            ? links.filter((link) => focusedLinkSet.has(link.id))
            : links;

        const spawnCount = mode === "searching" ? 7 : mode === "focused" ? 2 : 1;
        const spawnChance = mode === "idle" ? 0.28 : 0.92;

        if (activeLinks.length > 0 && Math.random() < spawnChance) {
          for (let index = 0; index < spawnCount; index += 1) {
            const link = activeLinks[Math.floor(Math.random() * activeLinks.length)];

            moved.push({
              id: `p-${particleIdRef.current++}`,
              linkId: link.id,
              progress: mode === "searching" ? Math.random() * 0.18 : 0,
              speed:
                mode === "searching"
                  ? 0.018 + Math.random() * 0.026
                  : mode === "focused"
                    ? 0.012 + Math.random() * 0.014
                    : 0.008 + Math.random() * 0.012,
              energy:
                mode === "searching"
                  ? 0.86 + Math.random() * 0.14
                  : 0.42 + link.strength * 0.55,
            });
          }
        }

        const particleLimit = mode === "searching" ? 180 : mode === "focused" ? 72 : 36;
        return moved.slice(-particleLimit);
      });
    }, 72);

    return () => clearInterval(interval);
  }, [links, mode, focusedLinkIds.join("|")]);

  return particles;
}
