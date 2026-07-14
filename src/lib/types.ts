export type NodeRecord = {
  id: string;
  label: string;
  x: number;
  y: number;
  parentId?: string;
  children: string[];
  neighbors: string[];
};

export interface EdgeRecord {
  from: string;
  to: string;
  type: "normal" | "thick" | "dotted";
  label?: string;
  arrow: boolean;
  points: { x: number; y: number }[];
}

export type GraphData = {
  nodes: NodeRecord[];
  edges: EdgeRecord[];
};
