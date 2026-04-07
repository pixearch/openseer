import type { Node } from "@xyflow/react";
import {
  GROUP_STANDARD_HEIGHT,
  GROUP_STANDARD_WIDTH,
  NODE_STANDARD_HEIGHT,
  NODE_STANDARD_WIDTH,
} from "@/lib/default-node";
import type { OpenSeerNodeData } from "@/lib/types/graph";
import { sortParentsBeforeChildren } from "@/lib/graph/nested-graph";

export type AlignDirection = "up" | "down" | "left" | "right";

function sizeOf(n: Node<OpenSeerNodeData>): { w: number; h: number } {
  const w =
    typeof n.width === "number"
      ? n.width
      : n.data.nodeType === "group"
        ? GROUP_STANDARD_WIDTH
        : NODE_STANDARD_WIDTH;
  const h =
    typeof n.height === "number"
      ? n.height
      : n.data.nodeType === "group"
        ? GROUP_STANDARD_HEIGHT
        : NODE_STANDARD_HEIGHT;
  return { w, h };
}

function absTopLeft(
  nodes: Node<OpenSeerNodeData>[],
  n: Node<OpenSeerNodeData>,
  pendingAbsTL: Map<string, { x: number; y: number }>
): { x: number; y: number } {
  const hit = pendingAbsTL.get(n.id);
  if (hit) return hit;
  if (!n.parentId) return { x: n.position.x, y: n.position.y };
  const p = nodes.find((x) => x.id === n.parentId);
  if (!p) return { x: n.position.x, y: n.position.y };
  const pb = absTopLeft(nodes, p, pendingAbsTL);
  return { x: pb.x + n.position.x, y: pb.y + n.position.y };
}

function absCenterFor(
  nodes: Node<OpenSeerNodeData>[],
  n: Node<OpenSeerNodeData>,
  pendingAbsTL: Map<string, { x: number; y: number }>
): { cx: number; cy: number } {
  const tl = absTopLeft(nodes, n, pendingAbsTL);
  const { w, h } = sizeOf(n);
  return { cx: tl.x + w / 2, cy: tl.y + h / 2 };
}

/** New relative `position` from absolute top-left, using pending abs for updated ancestors. */
function relFromAbsTL(
  nodes: Node<OpenSeerNodeData>[],
  n: Node<OpenSeerNodeData>,
  absTL: { x: number; y: number },
  pendingAbsTL: Map<string, { x: number; y: number }>
): { x: number; y: number } {
  if (!n.parentId) return absTL;
  const p = nodes.find((x) => x.id === n.parentId);
  if (!p) return absTL;
  const pAbs = absTopLeft(nodes, p, pendingAbsTL);
  return { x: absTL.x - pAbs.x, y: absTL.y - pAbs.y };
}

function applyPendingAbsTL(
  viewNodes: Node<OpenSeerNodeData>[],
  pendingAbsTL: Map<string, { x: number; y: number }>
): Node<OpenSeerNodeData>[] {
  if (pendingAbsTL.size === 0) return viewNodes;
  const byId = new Map(viewNodes.map((n) => [n.id, n]));
  const ids = sortParentsBeforeChildren(
    [...pendingAbsTL.keys()].map((id) => byId.get(id)!).filter(Boolean)
  ).map((n) => n.id);
  const relById = new Map<string, { x: number; y: number }>();
  for (const id of ids) {
    const n = byId.get(id)!;
    const tl = pendingAbsTL.get(id)!;
    relById.set(id, relFromAbsTL(viewNodes, n, tl, pendingAbsTL));
  }
  return viewNodes.map((n) => (relById.has(n.id) ? { ...n, position: relById.get(n.id)! } : n));
}

function pickSelected(
  viewNodes: Node<OpenSeerNodeData>[],
  ids: string[]
): Node<OpenSeerNodeData>[] {
  const set = new Set(ids);
  return viewNodes.filter((n) => set.has(n.id));
}

/** Bottom-most by max bottom edge (Y-down). */
function bottomMost(nodes: Node<OpenSeerNodeData>[], sel: Node<OpenSeerNodeData>[]) {
  let best = sel[0];
  let bestB = -Infinity;
  const pend = new Map<string, { x: number; y: number }>();
  for (const n of sel) {
    const tl = absTopLeft(nodes, n, pend);
    const { h } = sizeOf(n);
    const b = tl.y + h;
    if (b > bestB) {
      bestB = b;
      best = n;
    }
  }
  return best;
}

function topMost(nodes: Node<OpenSeerNodeData>[], sel: Node<OpenSeerNodeData>[]) {
  let best = sel[0];
  let bestT = Infinity;
  const pend = new Map<string, { x: number; y: number }>();
  for (const n of sel) {
    const tl = absTopLeft(nodes, n, pend);
    if (tl.y < bestT) {
      bestT = tl.y;
      best = n;
    }
  }
  return best;
}

function rightMost(nodes: Node<OpenSeerNodeData>[], sel: Node<OpenSeerNodeData>[]) {
  let best = sel[0];
  let bestR = -Infinity;
  const pend = new Map<string, { x: number; y: number }>();
  for (const n of sel) {
    const tl = absTopLeft(nodes, n, pend);
    const { w } = sizeOf(n);
    const r = tl.x + w;
    if (r > bestR) {
      bestR = r;
      best = n;
    }
  }
  return best;
}

function leftMost(nodes: Node<OpenSeerNodeData>[], sel: Node<OpenSeerNodeData>[]) {
  let best = sel[0];
  let bestL = Infinity;
  const pend = new Map<string, { x: number; y: number }>();
  for (const n of sel) {
    const tl = absTopLeft(nodes, n, pend);
    if (tl.x < bestL) {
      bestL = tl.x;
      best = n;
    }
  }
  return best;
}

/**
 * Multi-node align: shared coordinate on perpendicular axis; order and spacing on active axis unchanged.
 */
export function applyMultiNodeAlign(
  viewNodes: Node<OpenSeerNodeData>[],
  ids: string[],
  dir: AlignDirection
): Node<OpenSeerNodeData>[] {
  const sel = pickSelected(viewNodes, ids);
  if (sel.length < 2) return viewNodes;

  const pend = new Map<string, { x: number; y: number }>();

  if (dir === "up") {
    const anchor = bottomMost(viewNodes, sel);
    const ac = absCenterFor(viewNodes, anchor, pend);
    for (const n of sel) {
      if (n.id === anchor.id) continue;
      const tl = absTopLeft(viewNodes, n, pend);
      const { w } = sizeOf(n);
      pend.set(n.id, { x: ac.cx - w / 2, y: tl.y });
    }
    return applyPendingAbsTL(viewNodes, pend);
  }
  if (dir === "down") {
    const anchor = topMost(viewNodes, sel);
    const ac = absCenterFor(viewNodes, anchor, pend);
    for (const n of sel) {
      if (n.id === anchor.id) continue;
      const tl = absTopLeft(viewNodes, n, pend);
      const { w } = sizeOf(n);
      pend.set(n.id, { x: ac.cx - w / 2, y: tl.y });
    }
    return applyPendingAbsTL(viewNodes, pend);
  }
  if (dir === "left") {
    const anchor = rightMost(viewNodes, sel);
    const ac = absCenterFor(viewNodes, anchor, pend);
    for (const n of sel) {
      if (n.id === anchor.id) continue;
      const tl = absTopLeft(viewNodes, n, pend);
      const { h } = sizeOf(n);
      pend.set(n.id, { x: tl.x, y: ac.cy - h / 2 });
    }
    return applyPendingAbsTL(viewNodes, pend);
  }
  const anchor = leftMost(viewNodes, sel);
  const ac = absCenterFor(viewNodes, anchor, pend);
  for (const n of sel) {
    if (n.id === anchor.id) continue;
    const tl = absTopLeft(viewNodes, n, pend);
    const { h } = sizeOf(n);
    pend.set(n.id, { x: tl.x, y: ac.cy - h / 2 });
  }
  return applyPendingAbsTL(viewNodes, pend);
}

/**
 * Distribute evenly on one axis; shared perpendicular coordinate from anchor rules (same as align).
 */
export function applyMultiNodeDistribute(
  viewNodes: Node<OpenSeerNodeData>[],
  ids: string[],
  dir: AlignDirection
): Node<OpenSeerNodeData>[] {
  const sel = pickSelected(viewNodes, ids);
  if (sel.length < 2) return viewNodes;

  const pend = new Map<string, { x: number; y: number }>();

  if (dir === "up" || dir === "down") {
    const ordered = [...sel].sort((a, b) => {
      const ay = absTopLeft(viewNodes, a, pend).y;
      const by = absTopLeft(viewNodes, b, pend).y;
      if (ay !== by) return ay - by;
      return a.id.localeCompare(b.id);
    });
    const anchor =
      dir === "up" ? bottomMost(viewNodes, sel) : topMost(viewNodes, sel);
    const acx = absCenterFor(viewNodes, anchor, pend).cx;
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    const c0 = absCenterFor(viewNodes, first, pend).cy;
    const c1 = absCenterFor(viewNodes, last, pend).cy;
    const span = ordered.length - 1;
    for (let i = 0; i < ordered.length; i++) {
      const n = ordered[i];
      const cy = span === 0 ? c0 : c0 + ((c1 - c0) * i) / span;
      const { w, h } = sizeOf(n);
      pend.set(n.id, { x: acx - w / 2, y: cy - h / 2 });
    }
    return applyPendingAbsTL(viewNodes, pend);
  }

  const ordered = [...sel].sort((a, b) => {
    const ax = absTopLeft(viewNodes, a, pend).x;
    const bx = absTopLeft(viewNodes, b, pend).x;
    if (ax !== bx) return ax - bx;
    return a.id.localeCompare(b.id);
  });
  const anchor = dir === "left" ? rightMost(viewNodes, sel) : leftMost(viewNodes, sel);
  const acy = absCenterFor(viewNodes, anchor, pend).cy;
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const c0 = absCenterFor(viewNodes, first, pend).cx;
  const c1 = absCenterFor(viewNodes, last, pend).cx;
  const span = ordered.length - 1;
  for (let i = 0; i < ordered.length; i++) {
    const n = ordered[i];
    const cx = span === 0 ? c0 : c0 + ((c1 - c0) * i) / span;
    const { w, h } = sizeOf(n);
    pend.set(n.id, { x: cx - w / 2, y: acy - h / 2 });
  }
  return applyPendingAbsTL(viewNodes, pend);
}

export type ProportionalAxis = "x" | "y";

export type ProportionalLayoutState = {
  orderedIds: string[];
  axis: ProportionalAxis;
  /** t[0]=0, t[n-1]=1, linear parameter along axis */
  t: number[];
};

export function buildProportionalLayoutState(
  viewNodes: Node<OpenSeerNodeData>[],
  ids: string[]
): ProportionalLayoutState | null {
  const sel = pickSelected(viewNodes, ids);
  if (sel.length < 2) return null;
  const pend = new Map<string, { x: number; y: number }>();
  const centers = sel.map((n) => ({
    id: n.id,
    ...absCenterFor(viewNodes, n, pend),
  }));
  const minX = Math.min(...centers.map((c) => c.cx));
  const maxX = Math.max(...centers.map((c) => c.cx));
  const minY = Math.min(...centers.map((c) => c.cy));
  const maxY = Math.max(...centers.map((c) => c.cy));
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const axis: ProportionalAxis = spanX >= spanY ? "x" : "y";
  const ordered = [...centers].sort((a, b) => {
    const va = axis === "x" ? a.cx : a.cy;
    const vb = axis === "x" ? b.cx : b.cy;
    if (va !== vb) return va - vb;
    return a.id.localeCompare(b.id);
  });
  const orderedIds = ordered.map((o) => o.id);
  const v0 = axis === "x" ? ordered[0].cx : ordered[0].cy;
  const v1 = axis === "x" ? ordered[ordered.length - 1].cx : ordered[ordered.length - 1].cy;
  const span = v1 - v0;
  const t = ordered.map((o) => {
    const v = axis === "x" ? o.cx : o.cy;
    if (Math.abs(span) < 1e-6) {
      const i = orderedIds.indexOf(o.id);
      return ordered.length <= 1 ? 0 : i / (ordered.length - 1);
    }
    return (v - v0) / span;
  });
  return { orderedIds, axis, t };
}

const EPS = 1e-4;
const MIN_AXIS_SPAN = 1;

/**
 * Given the leader node's new flow position (from drag), compute new positions for all nodes in proportional mode.
 */
export function computeProportionalPositions(
  viewNodes: Node<OpenSeerNodeData>[],
  state: ProportionalLayoutState,
  leaderId: string,
  leaderNewFlowPos: { x: number; y: number }
): Map<string, { x: number; y: number }> {
  const byId = new Map(viewNodes.map((n) => [n.id, n]));
  const nLeader = byId.get(leaderId);
  if (!nLeader) return new Map();

  const k = state.orderedIds.indexOf(leaderId);
  if (k < 0) return new Map();

  const empty = new Map<string, { x: number; y: number }>();
  const leaderCopy = { ...nLeader, position: leaderNewFlowPos };
  const nodesForLeader = viewNodes.map((n) => (n.id === leaderId ? leaderCopy : n));

  const newLeaderCenter = absCenterFor(nodesForLeader, leaderCopy, empty);
  const coord = (node: Node<OpenSeerNodeData>) => {
    const c = absCenterFor(viewNodes, node, empty);
    return state.axis === "x" ? c.cx : c.cy;
  };

  const n0 = byId.get(state.orderedIds[0])!;
  const nLast = byId.get(state.orderedIds[state.orderedIds.length - 1])!;
  const c0Old = coord(n0);
  const cLastOld = coord(nLast);
  const tk = state.t[k];
  const n = state.orderedIds.length;

  let v0: number;
  let v1: number;

  if (k === 0) {
    v0 = state.axis === "x" ? newLeaderCenter.cx : newLeaderCenter.cy;
    v1 = cLastOld;
  } else if (k === n - 1) {
    v0 = c0Old;
    v1 = state.axis === "x" ? newLeaderCenter.cx : newLeaderCenter.cy;
  } else {
    const vNew = state.axis === "x" ? newLeaderCenter.cx : newLeaderCenter.cy;
    v0 = c0Old;
    if (Math.abs(tk) < EPS) {
      v1 = cLastOld;
    } else if (Math.abs(1 - tk) < EPS) {
      v1 = vNew;
    } else {
      const L = (vNew - v0) / tk;
      v1 = v0 + L;
    }
  }

  if (v1 < v0) {
    const tmp = v0;
    v0 = v1;
    v1 = tmp;
  }

  const minSpan = MIN_AXIS_SPAN * Math.max(0, n - 1);
  if (v1 - v0 < minSpan) {
    const mid = (v0 + v1) / 2;
    v0 = mid - minSpan / 2;
    v1 = mid + minSpan / 2;
  }

  const pendingAbsTL = new Map<string, { x: number; y: number }>();
  for (let i = 0; i < state.orderedIds.length; i++) {
    const id = state.orderedIds[i];
    const node = byId.get(id);
    if (!node) continue;
    const ti = state.t[i];
    const v = n === 1 ? v0 : v0 + ti * (v1 - v0);
    const cOld = absCenterFor(viewNodes, node, empty);
    const { w, h } = sizeOf(node);
    let cx = cOld.cx;
    let cy = cOld.cy;
    if (state.axis === "x") cx = v;
    else cy = v;
    pendingAbsTL.set(id, { x: cx - w / 2, y: cy - h / 2 });
  }

  const out = new Map<string, { x: number; y: number }>();
  for (const id of state.orderedIds) {
    const node = byId.get(id)!;
    const tl = pendingAbsTL.get(id)!;
    out.set(id, relFromAbsTL(viewNodes, node, tl, pendingAbsTL));
  }
  return out;
}
