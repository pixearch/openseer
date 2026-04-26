import type { Node } from "@xyflow/react";
import { NODE_STANDARD_HEIGHT, NODE_STANDARD_WIDTH, GROUP_STANDARD_HEIGHT, GROUP_STANDARD_WIDTH } from "@/lib/default-node";
import type { OpenSeerNodeData, OpenSeerNodeType } from "@/lib/types/graph";

const X_TIE_PIXELS = 8;

export function isExcludedFromChainType(t: OpenSeerNodeType): boolean {
  return t === "hub" || t === "circle";
}

function nodeSize(n: Node<OpenSeerNodeData>): { w: number; h: number } {
  if (typeof n.width === "number" && typeof n.height === "number") {
    return { w: n.width, h: n.height };
  }
  if (n.data.nodeType === "group") {
    return { w: GROUP_STANDARD_WIDTH, h: GROUP_STANDARD_HEIGHT };
  }
  return { w: NODE_STANDARD_WIDTH, h: NODE_STANDARD_HEIGHT };
}

export function nodeFlowCenter(n: Node<OpenSeerNodeData>): { x: number; y: number } {
  const { w, h } = nodeSize(n);
  return { x: n.position.x + w / 2, y: n.position.y + h / 2 };
}

/**
 * Picks quadrilateral handle ids for a chain edge from `source` → `target` based on relative positions
 * (QuadrilateralHandles: `${id}__rs` etc. in OpenSeerNode).
 */
export function pickQuadrilateralChainHandles(
  sourceId: string,
  targetId: string,
  s: Node<OpenSeerNodeData>,
  t: Node<OpenSeerNodeData>
): { sourceHandle: string; targetHandle: string } {
  const sc = nodeFlowCenter(s);
  const tc = nodeFlowCenter(t);
  const dx = tc.x - sc.x;
  const dy = tc.y - sc.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx > 0) {
      return { sourceHandle: `${sourceId}__rs`, targetHandle: `${targetId}__lt` };
    }
    return { sourceHandle: `${sourceId}__ls`, targetHandle: `${targetId}__rt` };
  }
  if (dy > 0) {
    return { sourceHandle: `${sourceId}__bs`, targetHandle: `${targetId}__tt` };
  }
  return { sourceHandle: `${sourceId}__ts`, targetHandle: `${targetId}__bt` };
}

/**
 * Left-to-right, then top-to-bottom; if centers are within X_TIE_PIXELS, sort by Y only.
 */
export function sortNodesForChainLayout(nodes: Node<OpenSeerNodeData>[]): Node<OpenSeerNodeData>[] {
  const eligible = nodes.filter((n) => !isExcludedFromChainType(n.data.nodeType));
  return [...eligible].sort((a, b) => {
    const ac = nodeFlowCenter(a);
    const bc = nodeFlowCenter(b);
    if (Math.abs(ac.x - bc.x) < X_TIE_PIXELS) {
      return ac.y - bc.y;
    }
    if (ac.x !== bc.x) {
      return ac.x - bc.x;
    }
    return ac.y - bc.y;
  });
}

export function sizeForNewNodeType(nodeType: OpenSeerNodeType): { w: number; h: number } {
  if (nodeType === "group") {
    return { w: GROUP_STANDARD_WIDTH, h: GROUP_STANDARD_HEIGHT };
  }
  return { w: NODE_STANDARD_WIDTH, h: NODE_STANDARD_HEIGHT };
}
