import type { Edge, Node } from "@xyflow/react";
import type { OpenSeerEdgeData, OpenSeerGraphDocument, OpenSeerNodeData } from "@/lib/types/graph";

const STORAGE_KEY = "openseer-graph-doc-v1";

export function loadGraphDocument(): OpenSeerGraphDocument | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OpenSeerGraphDocument;
    if (parsed?.version !== 1 || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveGraphDocument(doc: OpenSeerGraphDocument): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
  } catch {
    /* quota or private mode */
  }
}

/** Shape used by the canvas before wrapping in a named document. */
export function documentFromState(
  name: string,
  id: string,
  nodes: Node<OpenSeerNodeData>[],
  edges: Edge<OpenSeerEdgeData>[]
): OpenSeerGraphDocument {
  return { version: 1, id, name, nodes, edges };
}

export function stateFromDocument(doc: OpenSeerGraphDocument): {
  nodes: Node<OpenSeerNodeData>[];
  edges: Edge<OpenSeerEdgeData>[];
} {
  return { nodes: doc.nodes, edges: doc.edges };
}
