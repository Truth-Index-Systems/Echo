export type ClusterType = "people" | "ideas" | "places" | "events";

export type MemoryClusterConfig = {
  label: string;
  x: number;
  y: number;
  radius: number;
  color: string;
};

export type NetworkNode = {
  id: string;
  key: string;
  label: string;
  type: ClusterType;
  x: number;
  y: number;
  strength: number;
};

export type MemoryLink = {
  id: string;
  from: NetworkNode;
  to: NetworkNode;
  strength: number;
};

export type NetworkParticle = {
  id: string;
  linkId: string;
  progress: number;
  speed: number;
  energy: number;
};

export type MemoryGraph = {
  nodes: NetworkNode[];
  links: MemoryLink[];
};

export type MemoryCamera = {
  x: number;
  y: number;
  scale: number;
};