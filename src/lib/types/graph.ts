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
  "circle",
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
  "circle",
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

  /** Circle node: number of evenly spaced connection points (1–24), 360/n degrees apart, default 1 */
  circlePointCount?: number;
  /** Circle node: rotation in degrees, 0 at 12 o’clock; persisted */
  circleRotationDeg?: number;

  /** Custom header strip color (`hsl(H S% L%)`); independent from body */
  styleHeaderColor?: string;
  /** Custom body/card fill color (`hsl(H S% L%)`); alpha from styleBodyOpacity */
  styleBodyColor?: string;
  /** Body fill opacity 0–1; only affects styleBodyColor */
  styleBodyOpacity?: number;

  /** Header title text color (CSS color string) */
  styleHeaderFontColor?: string;
  /** Header title font size in CSS px */
  styleHeaderFontSizePx?: number;
  /** Header title stroke color (CSS color string); used with `styleHeaderStrokeWidthPx` */
  styleHeaderStrokeColor?: string;
  /** Header title stroke width in px */
  styleHeaderStrokeWidthPx?: number;
  /** Primary body / short description text color (CSS color string) */
  styleBodyFontColor?: string;
  /** Primary body / short description font size in CSS px */
  styleBodyFontSizePx?: number;

  /** Satisfies React Flow node data constraint */
  [key: string]: unknown;
}

/** Stored edge routing (maps to React Flow edge `type` when rendering). */
export type OpenSeerEdgeRouting = "straight" | "orthogonal" | "bezier";

/** Arrow decoration; `both` reserved for future start+end arrows. */
export type OpenSeerEdgeArrowStyle = "none" | "end" | "both";

export type OpenSeerControlPointType = "angled" | "bezier";

export interface OpenSeerEdgeControlPoint {
  id: string;
  x: number;
  y: number;
  type: OpenSeerControlPointType;
}

/**
 * Interior orthogonal bend vertices (flow space), excluding source/target.
 * Each bend has a stable `id` for selection and editing; persisted on the edge.
 */
export type OpenSeerOrthogonalPathPoint = { x: number; y: number; id: string };

export interface OpenSeerEdgeData {
  label: string;
  relationshipType: string;
  /** Path style; omitted means orthogonal. */
  type?: OpenSeerEdgeRouting;
  /** Manual routing waypoints in flow coordinates. */
  controlPoints?: OpenSeerEdgeControlPoint[];
  /**
   * Ordered interior bends for orthogonal routing (flow space). Each point has a stable `id` for
   * editing. Geometry uses this path; `controlPoints` stay empty once bends are stored here.
   */
  orthogonalPath?: OpenSeerOrthogonalPathPoint[];
  /** Stroke color (CSS); default palette when omitted. */
  strokeColor?: string;
  /** Stroke width in CSS pixels / SVG user units. */
  strokeWidthPx?: number;
  /** Arrowheads; default `end`. */
  arrowStyle?: OpenSeerEdgeArrowStyle;
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
