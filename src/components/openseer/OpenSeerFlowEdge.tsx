"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import {
  createContext,
  Fragment,
  memo,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { OpenSeerEdgeData, OpenSeerEdgeRouting } from "@/lib/types/graph";
import {
  canNudgeOrthogonalSegment,
  getOpenSeerEdgePathResult,
  getOrthogonalDisplayVertices,
  normalizeControlPointsForRouting,
  normalizeOrthogonalPath,
  snapFlowPosition,
} from "@/lib/graph/edge-control-path";

export type SelectedControlPoint = { edgeId: string; pointId: string };

export type EdgeControlContextValue = {
  snapToGrid: boolean;
  snapGrid: readonly [number, number];
  screenToFlowPosition: (p: { x: number; y: number }) => { x: number; y: number };
  selectedControlPoint: SelectedControlPoint | null;
  setSelectedControlPoint: (v: SelectedControlPoint | null) => void;
  /** Inserts a control point (angled) at flow coordinates; returns the new point id. */
  addControlPointAtFlow: (edgeId: string, flowX: number, flowY: number) => string;
  updateControlPointPosition: (edgeId: string, pointId: string, flowX: number, flowY: number) => void;
  hoveredEdgeId: string | null;
  edgeAltInsertPreview: { edgeId: string; x: number; y: number } | null;
  applyOrthogonalSegmentDrag: (
    edgeId: string,
    flowX: number,
    flowY: number,
    vertical: boolean,
    delta: number,
    fallbackSegmentIndex: number
  ) => void;
  onEdgeGeometryDragStart: () => void;
  onEdgeGeometryDragEnd: () => void;
};

export const EdgeControlContext = createContext<EdgeControlContextValue | null>(null);

/** Flow-space size; scales with viewport zoom like nodes. Centered on cp.x / cp.y. */
const CONTROL_POINT_HIT_PX = 48;

function useEdgeControl(): EdgeControlContextValue | null {
  return useContext(EdgeControlContext);
}

type Props = EdgeProps<Edge<OpenSeerEdgeData, "openSeerEdge">>;

function OpenSeerFlowEdgeInner(props: Props) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
    markerEnd,
    style,
    interactionWidth = 24,
    pathOptions,
  } = props;

  const ctx = useEdgeControl();
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const dragRef = useRef<{
    pointId: string;
    pointerId: number;
    edgeId: string;
  } | null>(null);

  useLayoutEffect(() => {
    if (!draggingPointId) return;
    const prev = document.body.style.cursor;
    document.body.style.cursor = "grabbing";
    return () => {
      document.body.style.cursor = prev;
    };
  }, [draggingPointId]);

  const routing: OpenSeerEdgeRouting = data?.type ?? "orthogonal";
  const controlPoints = useMemo(
    () => normalizeControlPointsForRouting(data?.controlPoints, routing),
    [data?.controlPoints, routing]
  );
  const orthogonalPathStored = useMemo(() => normalizeOrthogonalPath(data?.orthogonalPath), [data?.orthogonalPath]);

  const { path, labelX, labelY } = useMemo(
    () =>
      getOpenSeerEdgePathResult({
        routing,
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
        controlPoints,
        orthogonalPath: orthogonalPathStored,
        pathOptions: pathOptions as { offset?: number; stepPosition?: number } | undefined,
      }),
    [
      routing,
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      controlPoints,
      orthogonalPathStored,
      pathOptions,
    ]
  );

  const orthoVerts = useMemo(() => {
    if (routing !== "orthogonal") return null;
    return getOrthogonalDisplayVertices({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      pathOptions: pathOptions as { offset?: number; stepPosition?: number } | undefined,
      orthogonalPath: orthogonalPathStored,
      controlPoints,
    });
  }, [
    routing,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    pathOptions,
    orthogonalPathStored,
    controlPoints,
  ]);

  const orthogonalBendHandles =
    routing === "orthogonal" ? (orthogonalPathStored ?? []) : [];
  const useLegacyControlPointHandles =
    routing !== "orthogonal" || orthogonalBendHandles.length === 0;

  const edgeHovered = ctx?.hoveredEdgeId === id && !selected;
  const sw = Number(style && typeof style.strokeWidth === "number" ? style.strokeWidth : 1.5);

  const onAltPointerDownCapture = useCallback(
    (e: React.PointerEvent) => {
      if (!e.altKey || !ctx) return;
      e.preventDefault();
      e.stopPropagation();
      const p = ctx.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const s = snapFlowPosition(p.x, p.y, ctx.snapToGrid, ctx.snapGrid[0], ctx.snapGrid[1]);
      const pointId = ctx.addControlPointAtFlow(id, s.x, s.y);
      ctx.setSelectedControlPoint({ edgeId: id, pointId });
      ctx.onEdgeGeometryDragStart();
      dragRef.current = { pointId, pointerId: e.pointerId, edgeId: id };
      setDraggingPointId(pointId);

      const onMove = (ev: PointerEvent) => {
        const cur = dragRef.current;
        if (!cur || cur.pointerId !== ev.pointerId) return;
        const fp = ctx.screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
        const sn = snapFlowPosition(fp.x, fp.y, ctx.snapToGrid, ctx.snapGrid[0], ctx.snapGrid[1]);
        ctx.updateControlPointPosition(cur.edgeId, cur.pointId, sn.x, sn.y);
      };
      const onUp = (ev: PointerEvent) => {
        const cur = dragRef.current;
        if (!cur || cur.pointerId !== ev.pointerId) return;
        dragRef.current = null;
        setDraggingPointId(null);
        ctx.onEdgeGeometryDragEnd();
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [ctx, id]
  );

  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent, pointId: string) => {
      if (!ctx) return;
      e.preventDefault();
      e.stopPropagation();
      ctx.setSelectedControlPoint({ edgeId: id, pointId });
      ctx.onEdgeGeometryDragStart();
      dragRef.current = { pointId, pointerId: e.pointerId, edgeId: id };
      setDraggingPointId(pointId);

      const onMove = (ev: PointerEvent) => {
        const cur = dragRef.current;
        if (!cur || cur.pointerId !== ev.pointerId) return;
        const fp = ctx.screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
        const sn = snapFlowPosition(fp.x, fp.y, ctx.snapToGrid, ctx.snapGrid[0], ctx.snapGrid[1]);
        ctx.updateControlPointPosition(cur.edgeId, cur.pointId, sn.x, sn.y);
      };
      const onUp = (ev: PointerEvent) => {
        const cur = dragRef.current;
        if (!cur || cur.pointerId !== ev.pointerId) return;
        dragRef.current = null;
        setDraggingPointId(null);
        ctx.onEdgeGeometryDragEnd();
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [ctx, id]
  );

  const showHandles = selected === true;

  const onSegmentPointerDown = useCallback(
    (e: React.PointerEvent, segmentIndex: number, vertical: boolean) => {
      if (!ctx) return;
      e.preventDefault();
      e.stopPropagation();
      ctx.onEdgeGeometryDragStart();
      const target = e.currentTarget as SVGLineElement;
      target.setPointerCapture(e.pointerId);
      let last = ctx.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const onMove = (ev: PointerEvent) => {
        const cur = ctx.screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
        const delta = vertical ? cur.x - last.x : cur.y - last.y;
        last = cur;
        if (delta !== 0)
          ctx.applyOrthogonalSegmentDrag(id, cur.x, cur.y, vertical, delta, segmentIndex);
      };
      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        target.releasePointerCapture(e.pointerId);
        ctx.onEdgeGeometryDragEnd();
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [ctx, id]
  );

  const onHitPointerLeave = useCallback((pointId: string) => {
    if (dragRef.current?.pointId === pointId) return;
    setHoveredPointId((h) => (h === pointId ? null : h));
  }, []);

  const altPreview =
    ctx?.edgeAltInsertPreview?.edgeId === id ? ctx.edgeAltInsertPreview : null;

  return (
    <Fragment>
      <g className="nopan nodrag" onPointerDownCapture={onAltPointerDownCapture}>
        {selected || edgeHovered ? (
          <path
            d={path}
            fill="none"
            stroke={selected ? "rgba(56, 189, 248, 0.42)" : "rgba(148, 163, 184, 0.32)"}
            strokeWidth={sw + (selected ? 6 : 3.5)}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="react-flow__edge-path"
          />
        ) : null}
        <BaseEdge
          id={id}
          path={path}
          labelX={labelX}
          labelY={labelY}
          label={props.label}
          labelStyle={props.labelStyle}
          labelShowBg={props.labelShowBg}
          labelBgStyle={props.labelBgStyle}
          labelBgPadding={props.labelBgPadding}
          labelBgBorderRadius={props.labelBgBorderRadius}
          style={style}
          markerEnd={markerEnd}
          markerStart={props.markerStart}
          interactionWidth={interactionWidth}
        />
        {selected && orthoVerts && orthoVerts.length >= 3
          ? orthoVerts.slice(0, -1).map((va, i) => {
              if (!canNudgeOrthogonalSegment(orthoVerts, i)) return null;
              const vb = orthoVerts[i + 1];
              const vertical = Math.abs(va.x - vb.x) < 1e-3;
              return (
                <line
                  key={`os-seg-${i}`}
                  x1={va.x}
                  y1={va.y}
                  x2={vb.x}
                  y2={vb.y}
                  stroke="transparent"
                  strokeWidth={24}
                  style={{
                    pointerEvents: "stroke",
                    cursor: vertical ? "ew-resize" : "ns-resize",
                  }}
                  onPointerDown={(ev) => onSegmentPointerDown(ev, i, vertical)}
                />
              );
            })
          : null}
        {altPreview ? (
          <g pointerEvents="none">
            <circle
              cx={altPreview.x}
              cy={altPreview.y}
              r={7}
              fill="rgba(56, 189, 248, 0.15)"
              stroke="#38bdf8"
              strokeWidth={2}
              strokeDasharray="4 3"
            />
          </g>
        ) : null}
        {showHandles && !useLegacyControlPointHandles
          ? orthogonalBendHandles.map((bp) => {
              const sel = ctx?.selectedControlPoint;
              const isSel = sel?.edgeId === id && sel.pointId === bp.id;
              const isHov = hoveredPointId === bp.id;
              const stroke = isSel ? "#38bdf8" : isHov ? "#7dd3fc" : "#94a3b8";
              const strokeW = isSel ? 2.2 : isHov ? 1.85 : 1.4;
              const fill = "#0c0c0e";
              return (
                <g key={bp.id} className="nopan nodrag" pointerEvents="none">
                  <rect
                    x={bp.x - 5.5}
                    y={bp.y - 5.5}
                    width={11}
                    height={11}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeW}
                  />
                </g>
              );
            })
          : null}
        {showHandles && useLegacyControlPointHandles
          ? controlPoints.map((cp) => {
              const sel = ctx?.selectedControlPoint;
              const isSel = sel?.edgeId === id && sel.pointId === cp.id;
              const isHov = hoveredPointId === cp.id;
              const stroke = isSel ? "#38bdf8" : isHov ? "#7dd3fc" : "#94a3b8";
              const strokeW = isSel ? 2.2 : isHov ? 1.85 : 1.4;
              const fill = "#0c0c0e";
              if (cp.type === "bezier") {
                return (
                  <g key={cp.id} className="nopan nodrag" pointerEvents="none">
                    <circle cx={cp.x} cy={cp.y} r={6} fill={fill} stroke={stroke} strokeWidth={strokeW} />
                  </g>
                );
              }
              return (
                <g key={cp.id} className="nopan nodrag" pointerEvents="none">
                  <rect
                    x={cp.x - 5.5}
                    y={cp.y - 5.5}
                    width={11}
                    height={11}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeW}
                  />
                </g>
              );
            })
          : null}
      </g>
      {showHandles && !useLegacyControlPointHandles && orthogonalBendHandles.length > 0 ? (
        <EdgeLabelRenderer>
          {orthogonalBendHandles.map((bp) => {
            const grabbing = draggingPointId === bp.id;
            return (
              <div
                key={bp.id}
                role="presentation"
                className="nopan nodrag"
                style={{
                  position: "absolute",
                  transform: `translate(-50%, -50%) translate(${bp.x}px,${bp.y}px)`,
                  width: CONTROL_POINT_HIT_PX,
                  height: CONTROL_POINT_HIT_PX,
                  pointerEvents: "all",
                  touchAction: "none",
                  cursor: grabbing ? "grabbing" : "grab",
                  borderRadius: 9999,
                  background: "transparent",
                }}
                onPointerEnter={() => setHoveredPointId(bp.id)}
                onPointerLeave={() => onHitPointerLeave(bp.id)}
                onPointerDown={(ev) => onHandlePointerDown(ev, bp.id)}
                onClick={(ev) => ev.stopPropagation()}
              />
            );
          })}
        </EdgeLabelRenderer>
      ) : null}
      {showHandles && useLegacyControlPointHandles && controlPoints.length > 0 ? (
        <EdgeLabelRenderer>
          {controlPoints.map((cp) => {
            const grabbing = draggingPointId === cp.id;
            return (
              <div
                key={cp.id}
                role="presentation"
                className="nopan nodrag"
                style={{
                  position: "absolute",
                  transform: `translate(-50%, -50%) translate(${cp.x}px,${cp.y}px)`,
                  width: CONTROL_POINT_HIT_PX,
                  height: CONTROL_POINT_HIT_PX,
                  pointerEvents: "all",
                  touchAction: "none",
                  cursor: grabbing ? "grabbing" : "grab",
                  borderRadius: 9999,
                  background: "transparent",
                }}
                onPointerEnter={() => setHoveredPointId(cp.id)}
                onPointerLeave={() => onHitPointerLeave(cp.id)}
                onPointerDown={(ev) => onHandlePointerDown(ev, cp.id)}
                onClick={(ev) => ev.stopPropagation()}
              />
            );
          })}
        </EdgeLabelRenderer>
      ) : null}
    </Fragment>
  );
}

export const OpenSeerFlowEdge = memo(OpenSeerFlowEdgeInner);
