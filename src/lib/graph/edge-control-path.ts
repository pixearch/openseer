import {
  getSimpleBezierPath,
  getSmoothStepPath,
  getStraightPath,
  type Position,
} from "@xyflow/react";
import type { OpenSeerEdgeControlPoint, OpenSeerEdgeRouting } from "@/lib/types/graph";

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
  sortedControlPoints: OpenSeerEdgeControlPoint[]
): string {
  const xs = [sourceX, ...sortedControlPoints.map((c) => c.x), targetX];
  const ys = [sourceY, ...sortedControlPoints.map((c) => c.y), targetY];
  let d = `M ${xs[0]} ${ys[0]}`;
  for (let i = 0; i < xs.length - 1; i++) {
    d = appendOrthogonalSegment(d, xs[i], ys[i], xs[i + 1], ys[i + 1]);
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
    pathOptions,
  } = params;
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
    path = buildOrthogonalPathThroughControlPoints(
      sourceX,
      sourceY,
      targetX,
      targetY,
      cps
    );
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
