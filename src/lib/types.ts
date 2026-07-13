export type NodeRecord = {
  id: string;
  label: string;
  x: number;
  y: number;
  parentId?: string;
  children: string[];
  neighbors: string[];
};

export type EdgeRecord = {
  from: string;
  to: string;
};

export type GraphData = {
  nodes: NodeRecord[];
  edges: EdgeRecord[];
};
