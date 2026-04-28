import {
  getSimpleBezierPath,
  getSmoothStepPath,
  getStraightPath,
  Position,
} from "@xyflow/react";
import type {
  OpenSeerControlPointType,
  OpenSeerEdgeControlPoint,
  OpenSeerEdgeData,
  OpenSeerEdgeRouting,
  OpenSeerOrthogonalPathPoint,
} from "@/lib/types/graph";

const ORTHO_EPS = 1e-3;
/** Manhattan stub (flow units) when a single bend would collapse onto an endpoint. */
const ORTHO_HANDLE_STUB = 24;

export type FlowPoint = { x: number; y: number };

function newControlPointId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `cp-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `cp-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeOrthogonalPath(raw: unknown): OpenSeerOrthogonalPathPoint[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: OpenSeerOrthogonalPathPoint[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const x = typeof o.x === "number" && Number.isFinite(o.x) ? o.x : null;
    const y = typeof o.y === "number" && Number.isFinite(o.y) ? o.y : null;
    const id = typeof o.id === "string" && o.id.length > 0 ? o.id : null;
    if (x != null && y != null) out.push({ x, y, id: id ?? newControlPointId() });
  }
  return out.length > 0 ? out : undefined;
}

/**
 * Collapse duplicate consecutive points, zero-length segments, and collinear axis-aligned runs.
 * For **stored user orthogonal paths** (`orthogonalPath`), do not use this — it removes intentional
 * bends that lie on the same horizontal/vertical line; use `dedupeConsecutiveOrthoVertices` + align only.
 */
export function normalizeOrthogonalVertexChain(pts: FlowPoint[]): FlowPoint[] {
  const deduped = dedupeConsecutiveOrthoVertices(pts);
  if (deduped.length < 3) return deduped;
  const out: FlowPoint[] = [deduped[0]];
  for (let i = 1; i < deduped.length - 1; i++) {
    const a = out[out.length - 1];
    const b = deduped[i];
    const c = deduped[i + 1];
    const abH = Math.abs(a.y - b.y) < ORTHO_EPS && Math.abs(a.x - b.x) > ORTHO_EPS;
    const abV = Math.abs(a.x - b.x) < ORTHO_EPS && Math.abs(a.y - b.y) > ORTHO_EPS;
    const bcH = Math.abs(b.y - c.y) < ORTHO_EPS && Math.abs(b.x - c.x) > ORTHO_EPS;
    const bcV = Math.abs(b.x - c.x) < ORTHO_EPS && Math.abs(b.y - c.y) > ORTHO_EPS;
    const collinear =
      (abH && bcH && Math.abs(a.y - c.y) < ORTHO_EPS) || (abV && bcV && Math.abs(a.x - c.x) < ORTHO_EPS);
    if (collinear) continue;
    out.push(b);
  }
  out.push(deduped[deduped.length - 1]);
  return out;
}

/** Parse M/L/Q segments from a smooth-step path string (borderRadius 0) into vertices. */
export function parseSmoothStepPathToPoints(pathD: string): FlowPoint[] {
  const pts: FlowPoint[] = [];
  let i = 0;
  const n = pathD.length;
  const isSep = (c: string) => c === " " || c === "\t" || c === "\n" || c === ",";
  const skipWS = () => {
    while (i < n && isSep(pathD[i])) i++;
  };
  const readNum = (): number | null => {
    skipWS();
    if (i >= n) return null;
    const start = i;
    if (pathD[i] === "-") i++;
    while (i < n && /[0-9.]/.test(pathD[i])) i++;
    if (i === start) return null;
    return parseFloat(pathD.slice(start, i));
  };
  while (i < n) {
    skipWS();
    const cmd = pathD[i++];
    if (!cmd) break;
    const upper = cmd.toUpperCase();
    if (upper === "M" || upper === "L") {
      const x = readNum();
      const y = readNum();
      if (x !== null && y !== null) pts.push({ x, y });
    } else if (upper === "Q") {
      readNum();
      readNum();
      const x = readNum();
      const y = readNum();
      if (x !== null && y !== null) pts.push({ x, y });
    } else if (upper === "Z") {
      break;
    }
  }
  return dedupeConsecutiveOrthoVertices(pts);
}

export function bootstrapOrthogonalInteriorFromSmoothStep(params: {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  pathOptions?: { offset?: number; stepPosition?: number };
}): OpenSeerOrthogonalPathPoint[] {
  const [pathD] = getSmoothStepPath({
    sourceX: params.sourceX,
    sourceY: params.sourceY,
    targetX: params.targetX,
    targetY: params.targetY,
    sourcePosition: params.sourcePosition,
    targetPosition: params.targetPosition,
    borderRadius: 0,
    offset: params.pathOptions?.offset ?? 20,
    stepPosition: params.pathOptions?.stepPosition ?? 0.5,
  });
  const pts = normalizeOrthogonalVertexChain(parseSmoothStepPathToPoints(pathD));
  /** Do not persist handle-alignment stubs; render path applies {@link alignOrthogonalPolylineToHandles}. */
  const inner = pts.length > 2 ? pts.slice(1, -1) : [];
  return inner.map((p) => ({ x: p.x, y: p.y, id: newControlPointId() }));
}

/**
 * Map interior vertices to previous bend ids in **path order**: each prev[i] matches an earlier
 * subsequence of nextPts. Extra next vertices (insertions / handle stubs) get new ids.
 * `preferred` nudges the match so the dragged bend keeps its id at the closest output vertex.
 */
export function remapOrthogonalInteriorPreservingIds(
  prev: OpenSeerOrthogonalPathPoint[],
  nextPts: FlowPoint[],
  preferred?: { id: string; x: number; y: number }
): OpenSeerOrthogonalPathPoint[] {
  const n = prev.length;
  const m = nextPts.length;
  if (m === 0) return [];
  if (n === 0) {
    return nextPts.map((p) => ({ x: p.x, y: p.y, id: newControlPointId() }));
  }

  const matchCost = (pi: number, nj: number) => {
    if (preferred && prev[pi].id === preferred.id) {
      return Math.hypot(preferred.x - nextPts[nj].x, preferred.y - nextPts[nj].y);
    }
    return Math.hypot(prev[pi].x - nextPts[nj].x, prev[pi].y - nextPts[nj].y);
  };

  const INF = 1e18;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(INF));
  const pickMatch: boolean[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(false));
  dp[0][0] = 0;
  for (let j = 1; j <= m; j++) {
    dp[0][j] = 0;
  }
  for (let i = 1; i <= n; i++) {
    for (let j = i; j <= m; j++) {
      const skip = j > i ? dp[i][j - 1]! : INF;
      const mat = dp[i - 1]![j - 1]! + matchCost(i - 1, j - 1);
      if (mat <= skip) {
        dp[i][j] = mat;
        pickMatch[i][j] = true;
      } else {
        dp[i][j] = skip;
        pickMatch[i][j] = false;
      }
    }
  }

  if (!Number.isFinite(dp[n][m])) {
    return nextPts.map((p) => ({ x: p.x, y: p.y, id: newControlPointId() }));
  }

  const prevForNext: (number | null)[] = Array(m).fill(null);
  let i = n;
  let j = m;
  while (j > 0) {
    if (i > 0 && pickMatch[i][j]) {
      prevForNext[j - 1] = i - 1;
      i--;
      j--;
    } else {
      j--;
    }
  }

  return nextPts.map((p, nj) => {
    const pi = prevForNext[nj];
    if (pi !== null) {
      return { x: p.x, y: p.y, id: prev[pi].id };
    }
    return { x: p.x, y: p.y, id: newControlPointId() };
  });
}

/** Full display polyline for an orthogonal edge (for hit-testing and nudging), bootstrapping auto-route when needed. */
export function getOrthogonalDisplayVertices(params: {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  pathOptions?: { offset?: number; stepPosition?: number };
  orthogonalPath?: OpenSeerOrthogonalPathPoint[] | undefined;
  controlPoints: OpenSeerEdgeControlPoint[];
}): FlowPoint[] {
  const explicit = getOrthogonalPolylineVertices({
    sourceX: params.sourceX,
    sourceY: params.sourceY,
    targetX: params.targetX,
    targetY: params.targetY,
    sourcePosition: params.sourcePosition,
    targetPosition: params.targetPosition,
    pathOptions: params.pathOptions,
    orthogonalPath: params.orthogonalPath,
    controlPoints: params.controlPoints,
  });
  if (explicit) return explicit;
  const bootInterior = bootstrapOrthogonalInteriorFromSmoothStep({
    sourceX: params.sourceX,
    sourceY: params.sourceY,
    targetX: params.targetX,
    targetY: params.targetY,
    sourcePosition: params.sourcePosition,
    targetPosition: params.targetPosition,
    pathOptions: params.pathOptions,
  });
  const raw: FlowPoint[] = [
    { x: params.sourceX, y: params.sourceY },
    ...bootInterior.map((p) => ({ x: p.x, y: p.y })),
    { x: params.targetX, y: params.targetY },
  ];
  return alignOrthogonalPolylineToHandles(
    normalizeOrthogonalVertexChain(raw),
    params.sourcePosition,
    params.targetPosition
  );
}

/** Split one axis-aligned segment at the projected click point; preserve all prior bend ids. */
export function insertOrthogonalBendOnDisplay(
  display: FlowPoint[],
  flowX: number,
  flowY: number,
  prevInterior: OpenSeerOrthogonalPathPoint[],
  sourcePosition: Position,
  targetPosition: Position
): OpenSeerOrthogonalPathPoint[] {
  const orthoDisplay = prepareOrthogonalDisplayPolylineForUserEdit(
    display,
    sourcePosition,
    targetPosition
  );
  const hit = closestPointOnOrthoPolyline(orthoDisplay, flowX, flowY);
  if (!hit) return prevInterior;
  const ins = { x: hit.x, y: hit.y };
  const nextDisplay = [
    ...orthoDisplay.slice(0, hit.segIndex + 1),
    ins,
    ...orthoDisplay.slice(hit.segIndex + 1),
  ];
  const elbowed = replaceDiagonalSegmentsWithOrthogonalElbows(nextDisplay);
  const deduped = dedupeConsecutiveOrthoVertices(elbowed);
  const minimal = normalizeOrthogonalVertexChain(deduped);
  const inner = minimal.length > 2 ? minimal.slice(1, -1) : [];
  return remapOrthogonalInteriorPreservingIds(prevInterior, inner);
}

/** Move one interior bend; keep all bends; do not collapse collinear runs. */
export function moveOrthogonalInteriorPoint(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  interior: OpenSeerOrthogonalPathPoint[],
  pointId: string,
  nx: number,
  ny: number,
  sourcePosition: Position,
  targetPosition: Position
): OpenSeerOrthogonalPathPoint[] {
  void sourcePosition;
  void targetPosition;
  const cur = interior.find((p) => p.id === pointId);
  let cx = nx;
  let cy = ny;
  if (cur) {
    const ix = interior.findIndex((p) => p.id === pointId);
    const prev =
      ix === 0
        ? { x: sourceX, y: sourceY }
        : { x: interior[ix - 1]!.x, y: interior[ix - 1]!.y };
    const next =
      ix === interior.length - 1
        ? { x: targetX, y: targetY }
        : { x: interior[ix + 1]!.x, y: interior[ix + 1]!.y };
    const curPt: FlowPoint = { x: cur.x, y: cur.y };
    const prevH = segmentIsHorizontal(prev, curPt);
    const prevV = segmentIsVertical(prev, curPt);
    const nextH = segmentIsHorizontal(curPt, next);
    const nextV = segmentIsVertical(curPt, next);
    if (prevH && nextH && Math.abs(prev.y - next.y) < ORTHO_EPS) {
      cy = prev.y;
      cx = nx;
    } else if (prevV && nextV && Math.abs(prev.x - next.x) < ORTHO_EPS) {
      cx = prev.x;
      cy = ny;
    } else {
      const dx = nx - cur.x;
      const dy = ny - cur.y;
      if (Math.abs(dx) >= Math.abs(dy)) {
        cy = cur.y;
        cx = nx;
      } else {
        cx = cur.x;
        cy = ny;
      }
    }
  }
  const replaced = interior.map((p) => (p.id === pointId ? { ...p, x: cx, y: cy } : p));
  let raw: FlowPoint[] = [
    { x: sourceX, y: sourceY },
    ...replaced.map((p) => ({ x: p.x, y: p.y })),
    { x: targetX, y: targetY },
  ];
  raw = replaceDiagonalSegmentsWithOrthogonalElbows(raw);
  let deduped = dedupeConsecutiveOrthoVertices(raw);
  deduped = ensureInsertedAxisVertex(deduped, { x: cx, y: cy });
  /** Persist minimal bends only; alignment stubs are display-only (see {@link getOrthogonalPolylineVertices}). */
  const minimal = normalizeOrthogonalVertexChain(deduped);
  const inner = minimal.length > 2 ? minimal.slice(1, -1) : [];
  return remapOrthogonalInteriorPreservingIds(replaced, inner, { id: pointId, x: cx, y: cy });
}

/**
 * Expand user waypoints into an orthogonal polyline (same elbow rules as appendOrthogonalSegment).
 */
export function expandOrthogonalFromWaypoints(
  sx: number,
  sy: number,
  cps: OpenSeerEdgeControlPoint[],
  tx: number,
  ty: number
): FlowPoint[] {
  const xs = [sx, ...cps.map((c) => c.x), tx];
  const ys = [sy, ...cps.map((c) => c.y), ty];
  const out: FlowPoint[] = [{ x: xs[0], y: ys[0] }];
  for (let i = 0; i < xs.length - 1; i++) {
    const ax = out[out.length - 1].x;
    const ay = out[out.length - 1].y;
    const bx = xs[i + 1];
    const by = ys[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    if (Math.abs(dx) < ORTHO_EPS) {
      if (Math.abs(ay - by) > ORTHO_EPS) out.push({ x: bx, y: by });
    } else if (Math.abs(dy) < ORTHO_EPS) {
      if (Math.abs(ax - bx) > ORTHO_EPS) out.push({ x: bx, y: by });
    } else if (Math.abs(dx) >= Math.abs(dy)) {
      const p1 = { x: bx, y: ay };
      if (Math.abs(ax - p1.x) > ORTHO_EPS || Math.abs(ay - p1.y) > ORTHO_EPS) out.push(p1);
      if (Math.abs(p1.x - bx) > ORTHO_EPS || Math.abs(p1.y - by) > ORTHO_EPS) out.push({ x: bx, y: by });
    } else {
      const p1 = { x: ax, y: by };
      if (Math.abs(ax - p1.x) > ORTHO_EPS || Math.abs(ay - p1.y) > ORTHO_EPS) out.push(p1);
      if (Math.abs(p1.x - bx) > ORTHO_EPS || Math.abs(p1.y - by) > ORTHO_EPS) out.push({ x: bx, y: by });
    }
  }
  return out;
}

function segmentIsVertical(a: FlowPoint, b: FlowPoint): boolean {
  return Math.abs(a.x - b.x) < ORTHO_EPS && Math.abs(a.y - b.y) > ORTHO_EPS;
}

function segmentIsHorizontal(a: FlowPoint, b: FlowPoint): boolean {
  return Math.abs(a.y - b.y) < ORTHO_EPS && Math.abs(a.x - b.x) > ORTHO_EPS;
}

function segmentLength(a: FlowPoint, b: FlowPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * After collinear-collapse normalization, re-insert an axis-aligned bend that was removed.
 * User-inserted orthogonal bends can lie on a straight segment and must stay addressable.
 */
function ensureInsertedAxisVertex(vertices: FlowPoint[], ins: FlowPoint): FlowPoint[] {
  if (vertices.some((p) => Math.hypot(p.x - ins.x, p.y - ins.y) < ORTHO_EPS)) {
    return vertices;
  }
  for (let i = 0; i < vertices.length - 1; i++) {
    const a = vertices[i];
    const b = vertices[i + 1];
    if (segmentIsHorizontal(a, b) && Math.abs(ins.y - a.y) < ORTHO_EPS) {
      const lo = Math.min(a.x, b.x);
      const hi = Math.max(a.x, b.x);
      if (ins.x < lo - ORTHO_EPS || ins.x > hi + ORTHO_EPS) continue;
      const atA = Math.hypot(ins.x - a.x, ins.y - a.y) < ORTHO_EPS;
      const atB = Math.hypot(ins.x - b.x, ins.y - b.y) < ORTHO_EPS;
      if (atA || atB) return vertices;
      if (ins.x > lo + ORTHO_EPS && ins.x < hi - ORTHO_EPS) {
        return [...vertices.slice(0, i + 1), { x: ins.x, y: ins.y }, ...vertices.slice(i + 1)];
      }
    }
    if (segmentIsVertical(a, b) && Math.abs(ins.x - a.x) < ORTHO_EPS) {
      const lo = Math.min(a.y, b.y);
      const hi = Math.max(a.y, b.y);
      if (ins.y < lo - ORTHO_EPS || ins.y > hi + ORTHO_EPS) continue;
      const atA = Math.hypot(ins.x - a.x, ins.y - a.y) < ORTHO_EPS;
      const atB = Math.hypot(ins.x - b.x, ins.y - b.y) < ORTHO_EPS;
      if (atA || atB) return vertices;
      if (ins.y > lo + ORTHO_EPS && ins.y < hi - ORTHO_EPS) {
        return [...vertices.slice(0, i + 1), { x: ins.x, y: ins.y }, ...vertices.slice(i + 1)];
      }
    }
  }
  return vertices;
}

/**
 * Replace each diagonal segment with an axis-aligned elbow so the polyline is Manhattan-only.
 * Picks the shorter two-segment route; skips zero-length elbows.
 */
function replaceDiagonalSegmentsWithOrthogonalElbows(verts: FlowPoint[]): FlowPoint[] {
  if (verts.length < 2) return verts;
  const out: FlowPoint[] = [{ x: verts[0].x, y: verts[0].y }];
  for (let i = 0; i < verts.length - 1; i++) {
    const a = out[out.length - 1];
    const b = verts[i + 1];
    if (segmentLength(a, b) < ORTHO_EPS) continue;
    if (segmentIsVertical(a, b) || segmentIsHorizontal(a, b)) {
      out.push({ x: b.x, y: b.y });
      continue;
    }
    const e1: FlowPoint = { x: b.x, y: a.y };
    const e2: FlowPoint = { x: a.x, y: b.y };
    const leg = (u: FlowPoint, v: FlowPoint) => segmentLength(u, v);
    const ok1 = leg(a, e1) >= ORTHO_EPS && leg(e1, b) >= ORTHO_EPS;
    const ok2 = leg(a, e2) >= ORTHO_EPS && leg(e2, b) >= ORTHO_EPS;
    let elbow = e1;
    if (ok1 && ok2) {
      const d1 = leg(a, e1) + leg(e1, b);
      const d2 = leg(a, e2) + leg(e2, b);
      elbow = d1 <= d2 ? e1 : e2;
    } else if (ok2) elbow = e2;
    else if (!ok1) {
      out.push({ x: b.x, y: b.y });
      continue;
    }
    if (leg(a, elbow) >= ORTHO_EPS) out.push({ x: elbow.x, y: elbow.y });
    if (leg(out[out.length - 1], b) >= ORTHO_EPS) out.push({ x: b.x, y: b.y });
  }
  return dedupeConsecutiveOrthoVertices(out);
}

/**
 * Prepare a display polyline for user editing: fix diagonals, remove only duplicate consecutive
 * vertices, align to handles. Does **not** collapse collinear runs — intentional bends on one line stay.
 */
function prepareOrthogonalDisplayPolylineForUserEdit(
  verts: FlowPoint[],
  sourcePosition: Position,
  targetPosition: Position
): FlowPoint[] {
  if (verts.length < 2) return verts;
  const elbowed = replaceDiagonalSegmentsWithOrthogonalElbows(verts);
  const deduped = dedupeConsecutiveOrthoVertices(elbowed);
  return alignOrthogonalPolylineToHandles(deduped, sourcePosition, targetPosition);
}

/** Full orthogonal polyline [source … target], or null if segment editing is not available. */
export function getOrthogonalPolylineVertices(params: {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  pathOptions?: { offset?: number; stepPosition?: number };
  orthogonalPath?: OpenSeerOrthogonalPathPoint[] | undefined;
  controlPoints: OpenSeerEdgeControlPoint[];
}): FlowPoint[] | null {
  const {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    pathOptions,
    orthogonalPath,
    controlPoints,
  } = params;
  if (orthogonalPath !== undefined && orthogonalPath.length > 0) {
    const raw: FlowPoint[] = [
      { x: sourceX, y: sourceY },
      ...orthogonalPath.map((p) => ({ x: p.x, y: p.y })),
      { x: targetX, y: targetY },
    ];
    const deduped = dedupeConsecutiveOrthoVertices(raw);
    return alignOrthogonalPolylineToHandles(deduped, sourcePosition, targetPosition);
  }
  if (!controlPoints.length) return null;
  const baselineD = getBaselinePathD(
    "orthogonal",
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    pathOptions
  );
  const sorted = sortControlPointsAlongPath(baselineD, controlPoints);
  const expanded = expandOrthogonalFromWaypoints(sourceX, sourceY, sorted, targetX, targetY);
  const normalized = normalizeOrthogonalVertexChain(expanded);
  return alignOrthogonalPolylineToHandles(normalized, sourcePosition, targetPosition);
}

/**
 * Nudge one axis-aligned run (perpendicular drag). Returns new full vertex list, or null if blocked.
 * Source (index 0) and target (last) are fixed; only interior vertices on the moved run are shifted.
 */
export function nudgeOrthogonalSegment(
  vertices: FlowPoint[],
  segmentIndex: number,
  delta: number
): FlowPoint[] | null {
  const n = vertices.length;
  if (segmentIndex < 0 || segmentIndex >= n - 1) return null;
  const a = vertices[segmentIndex];
  const b = vertices[segmentIndex + 1];
  const vertical = segmentIsVertical(a, b);
  const horizontal = segmentIsHorizontal(a, b);
  if (!vertical && !horizontal) return null;

  const next = vertices.map((v) => ({ x: v.x, y: v.y }));

  if (vertical) {
    const xLine = a.x;
    let lo = segmentIndex;
    let hi = segmentIndex + 1;
    while (
      lo > 0 &&
      segmentIsVertical(next[lo - 1], next[lo]) &&
      Math.abs(next[lo - 1].x - xLine) < ORTHO_EPS &&
      Math.abs(next[lo].x - xLine) < ORTHO_EPS
    ) {
      lo--;
    }
    while (
      hi < n - 1 &&
      segmentIsVertical(next[hi], next[hi + 1]) &&
      Math.abs(next[hi].x - xLine) < ORTHO_EPS &&
      Math.abs(next[hi + 1].x - xLine) < ORTHO_EPS
    ) {
      hi++;
    }
    let j0 = lo;
    let j1 = hi;
    if (j0 === 0) j0 = 1;
    if (j1 === n - 1) j1 = n - 2;
    if (j0 > j1) return null;
    for (let j = j0; j <= j1; j++) next[j] = { x: next[j].x + delta, y: next[j].y };
    return next;
  }

  const yLine = a.y;
  let lo = segmentIndex;
  let hi = segmentIndex + 1;
  while (
    lo > 0 &&
    segmentIsHorizontal(next[lo - 1], next[lo]) &&
    Math.abs(next[lo - 1].y - yLine) < ORTHO_EPS &&
    Math.abs(next[lo].y - yLine) < ORTHO_EPS
  ) {
    lo--;
  }
  while (
    hi < n - 1 &&
    segmentIsHorizontal(next[hi], next[hi + 1]) &&
    Math.abs(next[hi].y - yLine) < ORTHO_EPS &&
    Math.abs(next[hi + 1].y - yLine) < ORTHO_EPS
  ) {
    hi++;
  }
  let j0 = lo;
  let j1 = hi;
  if (j0 === 0) j0 = 1;
  if (j1 === n - 1) j1 = n - 2;
  if (j0 > j1) return null;
  for (let j = j0; j <= j1; j++) next[j] = { x: next[j].x, y: next[j].y + delta };
  return next;
}

export function canNudgeOrthogonalSegment(vertices: FlowPoint[], segmentIndex: number): boolean {
  return nudgeOrthogonalSegment(vertices, segmentIndex, 0) !== null;
}

export function fullVerticesToOrthogonalPath(
  full: FlowPoint[],
  prevInterior: OpenSeerOrthogonalPathPoint[],
  sourcePosition: Position,
  targetPosition: Position
): OpenSeerOrthogonalPathPoint[] {
  void sourcePosition;
  void targetPosition;
  if (full.length <= 2) return [];
  const deduped = dedupeConsecutiveOrthoVertices(full);
  const minimal = normalizeOrthogonalVertexChain(deduped);
  if (minimal.length <= 2) return [];
  return remapOrthogonalInteriorPreservingIds(prevInterior, minimal.slice(1, -1));
}

/**
 * After segment nudge: collapse duplicate/collinear vertices into a minimal orthogonal chain, then
 * map to stored interior bends. Does **not** call {@link alignOrthogonalPolylineToHandles} — handle
 * stubs belong only in display/render, not in persisted `orthogonalPath`.
 */
export function orthogonalInteriorFromSegmentDragPolyline(
  full: FlowPoint[],
  prevInterior: OpenSeerOrthogonalPathPoint[]
): OpenSeerOrthogonalPathPoint[] {
  if (full.length <= 2) return [];
  const deduped = dedupeConsecutiveOrthoVertices(full);
  const minimal = normalizeOrthogonalVertexChain(deduped);
  if (minimal.length <= 2) return [];
  const innerPts = minimal.slice(1, -1);
  return remapOrthogonalInteriorPreservingIds(prevInterior, innerPts);
}

/**
 * While dragging an orthogonal segment, resolve which segment index matches the pointer so indices
 * stay valid as the polyline is shortened or merged.
 */
export function findOrthoSegmentIndexForPointer(
  vertices: FlowPoint[],
  px: number,
  py: number,
  vertical: boolean,
  fallbackSegmentIndex: number
): number {
  if (vertices.length < 2) return Math.max(0, fallbackSegmentIndex);
  let bestI = -1;
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = 0; i < vertices.length - 1; i++) {
    const va = vertices[i];
    const vb = vertices[i + 1];
    const segV = segmentIsVertical(va, vb);
    const segH = segmentIsHorizontal(va, vb);
    if (vertical && !segV) continue;
    if (!vertical && !segH) continue;
    let qx: number;
    let qy: number;
    if (segV) {
      qx = va.x;
      qy = clamp(py, Math.min(va.y, vb.y), Math.max(va.y, vb.y));
    } else {
      qy = va.y;
      qx = clamp(px, Math.min(va.x, vb.x), Math.max(va.x, vb.x));
    }
    const d = Math.hypot(px - qx, py - qy);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  if (bestI < 0) {
    return Math.min(Math.max(0, fallbackSegmentIndex), Math.max(0, vertices.length - 2));
  }
  return bestI;
}

function polylinePathD(vertices: FlowPoint[]): string {
  if (vertices.length === 0) return "";
  let d = `M ${vertices[0].x} ${vertices[0].y}`;
  for (let i = 1; i < vertices.length; i++) {
    d += ` L ${vertices[i].x} ${vertices[i].y}`;
  }
  return d;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Closest projection of (px,py) onto axis-aligned segments; for Alt+insert preview. */
export function closestPointOnOrthoPolyline(
  vertices: FlowPoint[],
  px: number,
  py: number
): { dist: number; segIndex: number; x: number; y: number } | null {
  if (vertices.length < 2) return null;
  let best: { dist: number; segIndex: number; x: number; y: number } | null = null;
  for (let i = 0; i < vertices.length - 1; i++) {
    const a = vertices[i];
    const b = vertices[i + 1];
    let qx: number;
    let qy: number;
    if (segmentIsVertical(a, b)) {
      qx = a.x;
      qy = clamp(py, Math.min(a.y, b.y), Math.max(a.y, b.y));
    } else if (segmentIsHorizontal(a, b)) {
      qy = a.y;
      qx = clamp(px, Math.min(a.x, b.x), Math.max(a.x, b.x));
    } else {
      continue;
    }
    const dx = px - qx;
    const dy = py - qy;
    const dist = Math.hypot(dx, dy);
    if (!best || dist < best.dist) {
      best = { dist, segIndex: i, x: qx, y: qy };
    }
  }
  return best;
}

export function snapFlowPosition(
  x: number,
  y: number,
  enabled: boolean,
  gridX: number,
  gridY: number
): { x: number; y: number } {
  if (!enabled) return { x, y };
  return {
    x: Math.round(x / gridX) * gridX,
    y: Math.round(y / gridY) * gridY,
  };
}

export function normalizeControlPoints(raw: unknown): OpenSeerEdgeControlPoint[] {
  if (!Array.isArray(raw)) return [];
  const out: OpenSeerEdgeControlPoint[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : null;
    const x = typeof o.x === "number" && Number.isFinite(o.x) ? o.x : null;
    const y = typeof o.y === "number" && Number.isFinite(o.y) ? o.y : null;
    const t = o.type === "bezier" || o.type === "angled" ? o.type : "angled";
    if (id != null && x != null && y != null) out.push({ id, x, y, type: t });
  }
  return out;
}

/** Interpret stored control points with types that match active routing (fixes stale CP mode in UI). */
export function normalizeControlPointsForRouting(
  raw: unknown,
  routing: OpenSeerEdgeRouting
): OpenSeerEdgeControlPoint[] {
  const pts = normalizeControlPoints(raw);
  if (routing === "orthogonal") {
    return pts.map((p) => ({ ...p, type: "angled" as const }));
  }
  if (routing === "bezier") {
    return pts.map((p) => ({ ...p, type: "bezier" as const }));
  }
  return pts.map((p) => ({ ...p, type: "angled" as const }));
}

function dedupeConsecutiveOrthoVertices(verts: FlowPoint[]): FlowPoint[] {
  const out: FlowPoint[] = [];
  for (const p of verts) {
    const prev = out[out.length - 1];
    if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > ORTHO_EPS) {
      out.push(p);
    }
  }
  return out;
}

/**
 * Insert at most one bend after the source and before the target so the first/last
 * axis-aligned run matches handle direction (horizontal for Left/Right, vertical for Top/Bottom).
 */
export function alignOrthogonalPolylineToHandles(
  verts: FlowPoint[],
  sourcePosition: Position,
  targetPosition: Position
): FlowPoint[] {
  if (verts.length < 2) return verts;
  const v = verts.map((p) => ({ x: p.x, y: p.y }));

  const sourceHorizontal =
    sourcePosition === Position.Left || sourcePosition === Position.Right;
  if (v.length >= 2) {
    const a = v[0];
    const b = v[1];
    const horiz = segmentIsHorizontal(a, b);
    const vert = segmentIsVertical(a, b);
    const firstSegOk =
      (sourceHorizontal && horiz) ||
      (!sourceHorizontal &&
        vert &&
        (sourcePosition === Position.Top || sourcePosition === Position.Bottom));
    if (firstSegOk) {
      /* already leaves source along handle direction */
    } else if (sourceHorizontal && vert) {
      if (Math.abs(a.x - b.x) < ORTHO_EPS) {
        const stub = ORTHO_HANDLE_STUB;
        const px =
          sourcePosition === Position.Right
            ? a.x + stub
            : sourcePosition === Position.Left
              ? a.x - stub
              : a.x + stub;
        v.splice(1, 0, { x: px, y: a.y }, { x: px, y: b.y });
      } else {
        v.splice(1, 0, { x: b.x, y: a.y });
      }
    } else if (!sourceHorizontal && (sourcePosition === Position.Top || sourcePosition === Position.Bottom) && horiz) {
      if (Math.abs(a.y - b.y) < ORTHO_EPS) {
        const stub = ORTHO_HANDLE_STUB;
        const py =
          sourcePosition === Position.Bottom
            ? a.y + stub
            : sourcePosition === Position.Top
              ? a.y - stub
              : a.y + stub;
        v.splice(1, 0, { x: a.x, y: py }, { x: b.x, y: py });
      } else {
        v.splice(1, 0, { x: a.x, y: b.y });
      }
    }
  }

  let n = v.length;
  if (n >= 2) {
    const targetHorizontal =
      targetPosition === Position.Left || targetPosition === Position.Right;
    const a = v[n - 2];
    const b = v[n - 1];
    const horiz = segmentIsHorizontal(a, b);
    const vert = segmentIsVertical(a, b);
    const lastSegOk =
      (targetHorizontal && horiz) ||
      (!targetHorizontal &&
        vert &&
        (targetPosition === Position.Top || targetPosition === Position.Bottom));
    if (lastSegOk) {
      /* target approach already axis-aligned */
    } else if (targetHorizontal && vert) {
      if (Math.abs(a.x - b.x) < ORTHO_EPS) {
        const stub = ORTHO_HANDLE_STUB;
        const px =
          targetPosition === Position.Right
            ? b.x - stub
            : targetPosition === Position.Left
              ? b.x + stub
              : b.x - stub;
        v.splice(n - 1, 0, { x: px, y: a.y }, { x: px, y: b.y });
      } else {
        v.splice(n - 1, 0, { x: a.x, y: b.y });
      }
      n = v.length;
    } else if (!targetHorizontal && (targetPosition === Position.Top || targetPosition === Position.Bottom) && horiz) {
      if (Math.abs(a.y - b.y) < ORTHO_EPS) {
        const stub = ORTHO_HANDLE_STUB;
        const py =
          targetPosition === Position.Bottom
            ? b.y - stub
            : targetPosition === Position.Top
              ? b.y + stub
              : b.y - stub;
        v.splice(n - 1, 0, { x: a.x, y: py }, { x: b.x, y: py });
      } else {
        v.splice(n - 1, 0, { x: b.x, y: a.y });
      }
    }
  }

  return dedupeConsecutiveOrthoVertices(v);
}

/**
 * When edge routing mode changes, rewrite `controlPoints` / `orthogonalPath` so geometry and CP
 * semantics match the new mode (no mixed bezier handles on orthogonal paths, etc.).
 */
export function migrateEdgeGeometryForRouting(
  nextRouting: OpenSeerEdgeRouting,
  data: OpenSeerEdgeData,
  geom: {
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    sourcePosition: Position;
    targetPosition: Position;
    pathOptions?: { offset?: number; stepPosition?: number };
  },
  /** Routing before this patch; used when switching to orthogonal so bezier vs straight sort baselines stay correct. */
  prevRouting?: OpenSeerEdgeRouting
): Pick<OpenSeerEdgeData, "controlPoints" | "orthogonalPath"> {
  const orthoStored = normalizeOrthogonalPath(data.orthogonalPath);
  const cps = normalizeControlPoints(data.controlPoints);

  if (nextRouting === "orthogonal") {
    if (orthoStored !== undefined && orthoStored.length > 0) {
      const raw: FlowPoint[] = [
        { x: geom.sourceX, y: geom.sourceY },
        ...orthoStored.map((p) => ({ x: p.x, y: p.y })),
        { x: geom.targetX, y: geom.targetY },
      ];
      const repairedMinimal = normalizeOrthogonalVertexChain(
        dedupeConsecutiveOrthoVertices(replaceDiagonalSegmentsWithOrthogonalElbows(raw))
      );
      const repairedInterior = repairedMinimal.length > 2 ? repairedMinimal.slice(1, -1) : [];
      const normalizedPath = remapOrthogonalInteriorPreservingIds(orthoStored, repairedInterior);
      return { orthogonalPath: normalizedPath.length > 0 ? normalizedPath : undefined, controlPoints: [] };
    }

    const fromRouting: OpenSeerEdgeRouting =
      prevRouting ??
      (cps.some((p) => p.type === "bezier")
        ? "bezier"
        : cps.length > 0
          ? "straight"
          : "orthogonal");
    const pathOpts = geom.pathOptions;
    let interiorPts: FlowPoint[] = [];

    if (cps.length > 0) {
      const sortBaseline = getBaselinePathD(
        fromRouting,
        geom.sourceX,
        geom.sourceY,
        geom.targetX,
        geom.targetY,
        geom.sourcePosition,
        geom.targetPosition,
        pathOpts
      );
      const sorted = sortControlPointsAlongPath(sortBaseline, cps);
      const angledSorted = sorted.map((p) => ({ ...p, type: "angled" as const }));
      const expanded = expandOrthogonalFromWaypoints(
        geom.sourceX,
        geom.sourceY,
        angledSorted,
        geom.targetX,
        geom.targetY
      );
      interiorPts = normalizeOrthogonalVertexChain(expanded).slice(1, -1);
    }

    if (interiorPts.length === 0) {
      const boot = bootstrapOrthogonalInteriorFromSmoothStep(geom);
      return { orthogonalPath: boot.length > 0 ? boot : undefined, controlPoints: [] };
    }

    const orthPath: OpenSeerOrthogonalPathPoint[] = interiorPts.map((p) => ({
      x: p.x,
      y: p.y,
      id: newControlPointId(),
    }));
    return { orthogonalPath: orthPath, controlPoints: [] };
  }

  let interior: FlowPoint[] = [];
  const pathOpts = geom.pathOptions;

  if (orthoStored !== undefined && orthoStored.length > 0) {
    const rawVerts: FlowPoint[] = [
      { x: geom.sourceX, y: geom.sourceY },
      ...orthoStored.map((p) => ({ x: p.x, y: p.y })),
      { x: geom.targetX, y: geom.targetY },
    ];
    interior = normalizeOrthogonalVertexChain(rawVerts).slice(1, -1);
  } else if (cps.length > 0) {
    const baselineD = getBaselinePathD(
      "orthogonal",
      geom.sourceX,
      geom.sourceY,
      geom.targetX,
      geom.targetY,
      geom.sourcePosition,
      geom.targetPosition,
      pathOpts
    );
    const sorted = sortControlPointsAlongPath(
      baselineD,
      cps.map((p) => ({ ...p, type: "angled" as const }))
    );
    const expanded = expandOrthogonalFromWaypoints(
      geom.sourceX,
      geom.sourceY,
      sorted,
      geom.targetX,
      geom.targetY
    );
    interior = normalizeOrthogonalVertexChain(expanded).slice(1, -1);
  }

  const cpType: OpenSeerControlPointType = nextRouting === "bezier" ? "bezier" : "angled";
  const newCps: OpenSeerEdgeControlPoint[] = interior.map((p) => ({
    id: newControlPointId(),
    x: p.x,
    y: p.y,
    type: cpType,
  }));

  return { orthogonalPath: undefined, controlPoints: newCps };
}

function pathDom(): SVGPathElement | null {
  if (typeof document === "undefined") return null;
  return document.createElementNS("http://www.w3.org/2000/svg", "path");
}

/** Arc length along `pathD` to the closest point to (x, y). */
export function arcLengthAtClosestPoint(pathD: string, x: number, y: number): number {
  const p = pathDom();
  if (!p) return 0;
  p.setAttribute("d", pathD);
  try {
    const len = p.getTotalLength();
    if (!Number.isFinite(len) || len <= 0) return 0;
    const steps = Math.min(80, Math.max(16, Math.ceil(len / 4)));
    let best = Number.POSITIVE_INFINITY;
    let bestS = 0;
    for (let i = 0; i <= steps; i++) {
      const s = (len * i) / steps;
      const pt = p.getPointAtLength(s);
      const dx = pt.x - x;
      const dy = pt.y - y;
      const d = Math.hypot(dx, dy);
      if (d < best) {
        best = d;
        bestS = s;
      }
    }
    return bestS;
  } catch {
    return 0;
  }
}

export function sortControlPointsAlongPath(
  baselinePathD: string,
  points: OpenSeerEdgeControlPoint[]
): OpenSeerEdgeControlPoint[] {
  if (points.length <= 1) return [...points];
  return [...points].sort(
    (a, b) =>
      arcLengthAtClosestPoint(baselinePathD, a.x, a.y) -
      arcLengthAtClosestPoint(baselinePathD, b.x, b.y)
  );
}

export function getBaselinePathD(
  routing: OpenSeerEdgeRouting,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: Position,
  targetPosition: Position,
  pathOptions?: { offset?: number; stepPosition?: number }
): string {
  if (routing === "straight") {
    const [d] = getStraightPath({ sourceX, sourceY, targetX, targetY });
    return d;
  }
  if (routing === "bezier") {
    const [d] = getSimpleBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
    return d;
  }
  const [d] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: undefined,
    offset: pathOptions?.offset,
    stepPosition: pathOptions?.stepPosition,
  });
  return d;
}

function labelAtPathMidpoint(pathD: string): { labelX: number; labelY: number } {
  const p = pathDom();
  if (!p) {
    return { labelX: 0, labelY: 0 };
  }
  p.setAttribute("d", pathD);
  try {
    const len = p.getTotalLength();
    if (!Number.isFinite(len) || len <= 0) return { labelX: 0, labelY: 0 };
    const pt = p.getPointAtLength(len * 0.5);
    return { labelX: pt.x, labelY: pt.y };
  } catch {
    return { labelX: 0, labelY: 0 };
  }
}

function appendOrthogonalSegment(
  d: string,
  ax: number,
  ay: number,
  bx: number,
  by: number
): string {
  const dx = bx - ax;
  const dy = by - ay;
  if (Math.abs(dx) < 1e-6) return `${d} L ${bx} ${by}`;
  if (Math.abs(dy) < 1e-6) return `${d} L ${bx} ${by}`;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return `${d} L ${bx} ${ay} L ${bx} ${by}`;
  }
  return `${d} L ${ax} ${by} L ${bx} ${by}`;
}

/** Straight polyline source → control points → target. */
function buildStraightPathThroughControlPoints(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sortedControlPoints: OpenSeerEdgeControlPoint[]
): string {
  let d = `M ${sourceX} ${sourceY}`;
  for (const c of sortedControlPoints) {
    d += ` L ${c.x} ${c.y}`;
  }
  d += ` L ${targetX} ${targetY}`;
  return d;
}

/** Axis-aligned segments between consecutive vertices (orthogonal routing). */
function buildOrthogonalPathThroughControlPoints(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sortedControlPoints: OpenSeerEdgeControlPoint[],
  sourcePosition: Position,
  targetPosition: Position
): string {
  const raw: FlowPoint[] = [
    { x: sourceX, y: sourceY },
    ...sortedControlPoints.map((c) => ({ x: c.x, y: c.y })),
    { x: targetX, y: targetY },
  ];
  const points = alignOrthogonalPolylineToHandles(
    normalizeOrthogonalVertexChain(raw),
    sourcePosition,
    targetPosition
  );
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    d = appendOrthogonalSegment(d, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
  }
  return d;
}

/** Catmull–Rom → cubic Béziers; pen starts at points[0]. */
function catmullRomSuffix(points: { x: number; y: number }[]): string {
  const n = points.length;
  if (n < 2) return "";
  if (n === 2) {
    return ` L ${points[1].x} ${points[1].y}`;
  }
  let s = "";
  for (let i = 0; i < n - 1; i++) {
    const p0 =
      i > 0
        ? points[i - 1]
        : {
            x: points[0].x - (points[1].x - points[0].x),
            y: points[0].y - (points[1].y - points[0].y),
          };
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 =
      i < n - 2
        ? points[i + 2]
        : {
            x: points[i + 1].x + (points[i + 1].x - points[i].x),
            y: points[i + 1].y + (points[i + 1].y - points[i].y),
          };
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    s += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return s;
}

/**
 * Smooth curved path; breaks into straight corners only at **angled** control points.
 * Bézier-type points are passed through smoothly.
 */
function buildCurvedPathThroughControlPoints(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sortedControlPoints: OpenSeerEdgeControlPoint[]
): string {
  type V = { x: number; y: number; angled?: boolean };
  const verts: V[] = [{ x: sourceX, y: sourceY }];
  for (const c of sortedControlPoints) {
    verts.push({ x: c.x, y: c.y, angled: c.type === "angled" });
  }
  verts.push({ x: targetX, y: targetY });

  const breaks: number[] = [0];
  for (let i = 1; i < verts.length - 1; i++) {
    if (verts[i].angled) breaks.push(i);
  }
  breaks.push(verts.length - 1);

  let d = `M ${verts[0].x} ${verts[0].y}`;
  for (let b = 0; b < breaks.length - 1; b++) {
    const i0 = breaks[b];
    const i1 = breaks[b + 1];
    const chunk = verts.slice(i0, i1 + 1).map((v) => ({ x: v.x, y: v.y }));
    d += catmullRomSuffix(chunk);
  }
  return d;
}

export function getOpenSeerEdgePathResult(params: {
  routing: OpenSeerEdgeRouting;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  controlPoints?: OpenSeerEdgeControlPoint[] | undefined;
  /** When non-empty, orthogonal geometry uses this polyline (ignores control points). */
  orthogonalPath?: OpenSeerOrthogonalPathPoint[] | undefined;
  pathOptions?: { offset?: number; stepPosition?: number };
}): { path: string; labelX: number; labelY: number } {
  const {
    routing,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    controlPoints,
    orthogonalPath,
    pathOptions,
  } = params;
  const op = orthogonalPath !== undefined && orthogonalPath.length > 0 ? orthogonalPath : undefined;

  const cpsRaw = controlPoints?.length ? controlPoints : [];
  if (cpsRaw.length === 0) {
    if (routing === "straight") {
      const [path, labelX, labelY] = getStraightPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
      });
      return { path, labelX, labelY };
    }
    if (routing === "bezier") {
      const [path, labelX, labelY] = getSimpleBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      });
      return { path, labelX, labelY };
    }
    if (routing === "orthogonal" && op) {
      const verts: FlowPoint[] = [
        { x: sourceX, y: sourceY },
        ...op.map((p) => ({ x: p.x, y: p.y })),
        { x: targetX, y: targetY },
      ];
      const aligned = alignOrthogonalPolylineToHandles(
        dedupeConsecutiveOrthoVertices(verts),
        sourcePosition,
        targetPosition
      );
      const path = polylinePathD(aligned);
      const { labelX, labelY } = labelAtPathMidpoint(path);
      return { path, labelX, labelY };
    }
    const [path, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      borderRadius: undefined,
      offset: pathOptions?.offset,
      stepPosition: pathOptions?.stepPosition,
    });
    return { path, labelX, labelY };
  }
  const baselineD = getBaselinePathD(
    routing,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    pathOptions
  );
  const cps = sortControlPointsAlongPath(baselineD, cpsRaw);
  let path: string;
  if (routing === "straight") {
    path = buildStraightPathThroughControlPoints(
      sourceX,
      sourceY,
      targetX,
      targetY,
      cps
    );
  } else if (routing === "orthogonal") {
    if (op) {
      const verts: FlowPoint[] = [
        { x: sourceX, y: sourceY },
        ...op.map((p) => ({ x: p.x, y: p.y })),
        { x: targetX, y: targetY },
      ];
      path = polylinePathD(
        alignOrthogonalPolylineToHandles(
          dedupeConsecutiveOrthoVertices(verts),
          sourcePosition,
          targetPosition
        )
      );
    } else {
      path = buildOrthogonalPathThroughControlPoints(
        sourceX,
        sourceY,
        targetX,
        targetY,
        cps,
        sourcePosition,
        targetPosition
      );
    }
  } else {
    path = buildCurvedPathThroughControlPoints(
      sourceX,
      sourceY,
      targetX,
      targetY,
      cps
    );
  }
  const { labelX, labelY } = labelAtPathMidpoint(path);
  return { path, labelX, labelY };
}
