import type { InternalNode, Node } from "@xyflow/react";
import { getNodeDimensions } from "@xyflow/system";

export type AlignBounds = { x: number; y: number; w: number; h: number };

type FlowInternalNode = InternalNode<Node>;

function near(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

export function boundsFromInternalNode(n: FlowInternalNode): AlignBounds | null {
  const { width: w, height: h } = getNodeDimensions(n);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  const { x, y } = n.internals.positionAbsolute;
  return { x, y, w, h };
}

export function unionBoundsFromInternals(nodes: FlowInternalNode[]): AlignBounds | null {
  let acc: AlignBounds | null = null;
  for (const n of nodes) {
    const b = boundsFromInternalNode(n);
    if (!b) continue;
    if (!acc) {
      acc = { ...b };
      continue;
    }
    const r = Math.max(acc.x + acc.w, b.x + b.w);
    const bot = Math.max(acc.y + acc.h, b.y + b.h);
    acc.x = Math.min(acc.x, b.x);
    acc.y = Math.min(acc.y, b.y);
    acc.w = r - acc.x;
    acc.h = bot - acc.y;
  }
  return acc;
}

/**
 * Detect vertical guide x-positions and horizontal guide y-positions when `d` aligns
 * with any box in `others` (edges and centers). `tol` is in flow coordinates.
 */
export function collectAlignmentGuidesForBounds(
  d: AlignBounds,
  others: AlignBounds[],
  tol: number
): { verticalXs: number[]; horizontalYs: number[] } {
  const vx = new Set<number>();
  const hy = new Set<number>();
  const dl = d.x;
  const dr = d.x + d.w;
  const dt = d.y;
  const db = d.y + d.h;
  const dcx = d.x + d.w / 2;
  const dcy = d.y + d.h / 2;

  for (const o of others) {
    const ol = o.x;
    const or = o.x + o.w;
    const ot = o.y;
    const ob = o.y + o.h;
    const ocx = o.x + o.w / 2;
    const ocy = o.y + o.h / 2;

    if (near(dl, ol, tol)) vx.add(dl);
    if (near(dr, or, tol)) vx.add(dr);
    if (near(dcx, ocx, tol)) vx.add(dcx);

    if (near(dt, ot, tol)) hy.add(dt);
    if (near(db, ob, tol)) hy.add(db);
    if (near(dcy, ocy, tol)) hy.add(dcy);
  }

  return { verticalXs: [...vx], horizontalYs: [...hy] };
}
