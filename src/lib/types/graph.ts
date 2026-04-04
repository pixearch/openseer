/** Semantic node kinds shown in the graph (maps to business ontology). */
export const OPEN_SEER_NODE_TYPES = [
  "proposal",
  "program",
  "project",
  "epic",
  "sprint",
  "task",
  "step",
  "howto",
  "evidence",
  "risk",
  "cost",
  "decision",
] as const;

export type OpenSeerNodeType = (typeof OPEN_SEER_NODE_TYPES)[number];

export const OPEN_SEER_STATUSES = [
  "draft",
  "active",
  "blocked",
  "done",
  "archived",
] as const;

export type OpenSeerStatus = (typeof OPEN_SEER_STATUSES)[number];

/** Payload stored on each React Flow node (`data`). Neo4j-friendly flat fields. */
export interface OpenSeerNodeData {
  nodeType: OpenSeerNodeType;
  title: string;
  shortDescription: string;
  status: OpenSeerStatus;
  owner: string;
  tags: string[];
  notes: string;

  // Step
  commands?: string;
  expectedOutcome?: string;
  troubleshooting?: string;

  // HowTo
  howToSummary?: string;
  orderedSteps?: string;
  relatedLinks?: string;

  // Evidence
  imageUrl?: string;
  videoUrl?: string;
  sourceLink?: string;
  caption?: string;

  // Cost
  estimatedCost?: string;
  actualCost?: string;
  costType?: string;

  // Risk
  severity?: string;
  impact?: string;
  mitigation?: string;

  // Proposal
  objective?: string;
  scope?: string;
  expectedBenefit?: string;

  // Decision
  rationale?: string;
  decisionDate?: string;
  outcome?: string;

  /** Satisfies React Flow node data constraint */
  [key: string]: unknown;
}

export interface OpenSeerEdgeData {
  label: string;
  relationshipType: string;
  [key: string]: unknown;
}

/** Serializable graph document for storage or future API sync. */
export interface OpenSeerGraphDocument {
  version: 1;
  id: string;
  name: string;
  nodes: import("@xyflow/react").Node<OpenSeerNodeData>[];
  edges: import("@xyflow/react").Edge<OpenSeerEdgeData>[];
}
