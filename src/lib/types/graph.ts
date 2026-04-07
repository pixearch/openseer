/** All node kinds (workspace + legacy stored graphs). */
export const OPEN_SEER_NODE_TYPES = [
  "text",
  "code",
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
  "image",
  "video",
  "document",
  "frame",
  "group",
  "hub",
] as const;

export type OpenSeerNodeType = (typeof OPEN_SEER_NODE_TYPES)[number];

/** Creation menu + visibility toggles in the graph workspace. */
export const GRAPH_WORKSPACE_NODE_TYPE_LIST: OpenSeerNodeType[] = [
  "text",
  "code",
  "image",
  "video",
  "document",
  "group",
  "hub",
];

export const OPEN_SEER_STATUSES = [
  "draft",
  "active",
  "blocked",
  "done",
  "archived",
] as const;

export type OpenSeerStatus = (typeof OPEN_SEER_STATUSES)[number];

export interface CodeBlockEntry {
  id: string;
  content: string;
}

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
  /** Document node: URL or data URL from a linked file */
  documentUrl?: string;
  sourceLink?: string;
  caption?: string;

  /** Video node: publish date (YYYY-MM-DD), duration label — editable; not from oEmbed */
  videoPublishedAt?: string;
  videoDurationLabel?: string;

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

  /** Code node: ordered editable blocks */
  codeBlocks?: CodeBlockEntry[];

  /** Nested graph for `group` nodes */
  nestedGraph?: {
    nodes: import("@xyflow/react").Node<OpenSeerNodeData>[];
    edges: import("@xyflow/react").Edge<OpenSeerEdgeData>[];
  };

  /** Hub node: regular polygon side count (3–16), default 6 */
  hubSides?: number;

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
