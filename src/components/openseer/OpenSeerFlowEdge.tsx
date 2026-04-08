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
import { getOpenSeerEdgePathResult, normalizeControlPoints, snapFlowPosition } from "@/lib/graph/edge-control-path";

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
  const controlPoints = useMemo(() => normalizeControlPoints(data?.controlPoints), [data?.controlPoints]);

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
      pathOptions,
    ]
  );

  const onAltPointerDownCapture = useCallback(
    (e: React.PointerEvent) => {
      if (!e.altKey || !ctx) return;
      e.preventDefault();
      e.stopPropagation();
      const p = ctx.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const s = snapFlowPosition(p.x, p.y, ctx.snapToGrid, ctx.snapGrid[0], ctx.snapGrid[1]);
      const pointId = ctx.addControlPointAtFlow(id, s.x, s.y);
      ctx.setSelectedControlPoint({ edgeId: id, pointId });
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

  const onHitPointerLeave = useCallback((pointId: string) => {
    if (dragRef.current?.pointId === pointId) return;
    setHoveredPointId((h) => (h === pointId ? null : h));
  }, []);

  return (
    <Fragment>
      <g className="nopan nodrag" onPointerDownCapture={onAltPointerDownCapture}>
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
        {showHandles
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
      {showHandles && controlPoints.length > 0 ? (
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
