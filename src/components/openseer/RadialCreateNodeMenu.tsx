"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OpenSeerNodeType } from "@/lib/types/graph";
import { GRAPH_WORKSPACE_NODE_TYPE_LIST } from "@/lib/types/graph";

/** Outer radius of the ring (SVG units). */
const R_OUT = 152;
/** Inner radius of the selectable ring (donut hole for center label). */
const R_IN = 78;
/** Icon centers sit midway in the ring band. */
const R_ICON = (R_IN + R_OUT) / 2;

const SEGMENT_FILL = {
  base: "rgb(39 39 42)",
  active: "rgb(63 63 70)",
};

const EXIT_SEGMENT_FILL = {
  base: "rgb(48 48 52)",
  active: "rgb(72 72 78)",
};

function shortRadialLabel(t: OpenSeerNodeType): string {
  switch (t) {
    case "text":
      return "Text";
    case "code":
      return "Code";
    case "image":
      return "Image";
    case "video":
      return "Video";
    case "document":
      return "Docs";
    case "group":
      return "Group";
    case "hub":
      return "Hub";
    case "circle":
      return "Circle";
    default:
      return t;
  }
}

function sectorAt(
  dx: number,
  dy: number,
  segmentCount: number,
  aStart: number,
  rInner: number,
  rOuter: number
): number | null {
  const r = Math.hypot(dx, dy);
  if (r < rInner || r > rOuter) return null;
  const a = Math.atan2(dy, dx);
  let t = a - aStart;
  while (t < 0) t += 2 * Math.PI;
  while (t >= 2 * Math.PI) t -= 2 * Math.PI;
  const sweep = (2 * Math.PI) / segmentCount;
  const s = Math.floor(t / sweep);
  return Math.min(segmentCount - 1, Math.max(0, s));
}

function donutSectorPath(i: number, segmentCount: number, aStart: number, rInner: number, rOuter: number): string {
  const sweep = (2 * Math.PI) / segmentCount;
  const a0 = aStart + i * sweep;
  const a1 = a0 + sweep;
  const x0o = Math.cos(a0) * rOuter;
  const y0o = Math.sin(a0) * rOuter;
  const x1o = Math.cos(a1) * rOuter;
  const y1o = Math.sin(a1) * rOuter;
  const x0i = Math.cos(a0) * rInner;
  const y0i = Math.sin(a0) * rInner;
  const x1i = Math.cos(a1) * rInner;
  const y1i = Math.sin(a1) * rInner;
  const large = sweep > Math.PI ? 1 : 0;
  return `M ${x0o} ${y0o} A ${rOuter} ${rOuter} 0 ${large} 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${rInner} ${rInner} 0 ${large} 0 ${x0i} ${y0i} Z`;
}

function SegmentIcon({ kind, active }: { kind: OpenSeerNodeType | "exit"; active: boolean }) {
  const stroke = active ? "rgb(250 250 250)" : "rgb(161 161 170)";
  const sw = 1.75;
  const common = { fill: "none" as const, stroke, strokeWidth: sw, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  switch (kind) {
    case "text":
      return (
        <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden className="overflow-visible">
          <path {...common} d="M4 6h16M4 12h12M4 18h16" />
        </svg>
      );
    case "code":
      return (
        <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden className="overflow-visible">
          <path {...common} d="m16 18 4-4-4-4M8 6 4 4-4 4" />
        </svg>
      );
    case "image":
      return (
        <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden className="overflow-visible">
          <rect x={3} y={5} width={18} height={14} rx={2} {...common} />
          <path {...common} d="m3 17 5.5-5.5a1.5 1.5 0 0 1 2.1 0L15 17" />
          <circle cx={14.5} cy={9.5} r={1.25} fill={stroke} stroke="none" />
        </svg>
      );
    case "video":
      return (
        <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden className="overflow-visible">
          <rect x={3} y={6} width={14} height={12} rx={2} {...common} />
          <path {...common} fill={stroke} stroke="none" d="M17 10v4l3-2-3-2z" opacity={0.95} />
        </svg>
      );
    case "document":
      return (
        <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden className="overflow-visible">
          <path {...common} d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
          <path {...common} d="M14 2v6h6M8 13h8M8 17h8M8 9h2" />
        </svg>
      );
    case "group":
      return (
        <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden className="overflow-visible">
          <rect x={3} y={3} width={10} height={10} rx={1.5} {...common} />
          <rect x={11} y={11} width={10} height={10} rx={1.5} {...common} />
        </svg>
      );
    case "hub":
      return (
        <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden className="overflow-visible">
          <circle cx={12} cy={12} r={2.25} {...common} />
          <circle cx={5.5} cy={8} r={1.75} {...common} />
          <circle cx={18.5} cy={8} r={1.75} {...common} />
          <circle cx={12} cy={18} r={1.75} {...common} />
          <path {...common} d="M7.2 9.2 10.2 10.8M16.8 9.2 13.8 10.8M12 14.25V15.75" />
        </svg>
      );
    case "circle":
      return (
        <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden className="overflow-visible">
          <circle cx={12} cy={12} r={7.5} {...common} />
          <path {...common} d="M12 4.5V2M20 12h2.5M4 12H1.5" />
        </svg>
      );
    case "exit":
      return (
        <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden className="overflow-visible">
          <path {...common} d="M18 6 6 18M6 6l12 12" />
        </svg>
      );
    default:
      return null;
  }
}

export function RadialCreateNodeMenu({
  onPick,
  onClose,
}: {
  onPick: (nodeType: OpenSeerNodeType) => void;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const types = GRAPH_WORKSPACE_NODE_TYPE_LIST;
  const exitIndex = types.length;
  const segmentCount = exitIndex + 1;
  const sweep = (2 * Math.PI) / segmentCount;
  const aStart = Math.PI / 2 - (exitIndex + 0.5) * sweep;

  const paths = useMemo(
    () =>
      Array.from({ length: segmentCount }, (_, i) => ({
        i,
        d: donutSectorPath(i, segmentCount, aStart, R_IN, R_OUT),
      })),
    [aStart, segmentCount]
  );

  const iconAngles = useMemo(
    () => Array.from({ length: segmentCount }, (_, i) => aStart + (i + 0.5) * sweep),
    [aStart, segmentCount, sweep]
  );

  const updateHover = useCallback(
    (clientX: number, clientY: number) => {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      setHovered(sectorAt(dx, dy, segmentCount, aStart, R_IN, R_OUT));
    },
    [aStart, segmentCount]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sizePx = R_OUT * 2;

  const centerLabel =
    hovered === null
      ? ""
      : hovered === exitIndex
        ? "Exit"
        : shortRadialLabel(types[hovered]);

  return (
    <div
      ref={rootRef}
      data-radial-menu
      className="pointer-events-auto flex flex-col items-center"
      onMouseMove={(e) => updateHover(e.clientX, e.clientY)}
      onMouseLeave={() => setHovered(null)}
    >
      <div className="relative" style={{ width: sizePx, height: sizePx }}>
        <svg
          width={sizePx}
          height={sizePx}
          viewBox={`${-R_OUT} ${-R_OUT} ${R_OUT * 2} ${R_OUT * 2}`}
          className="overflow-visible"
          aria-label="Create node"
        >
          <circle r={R_IN - 1} fill="rgb(24 24 27)" stroke="rgb(52 52 58)" strokeWidth={1} />
          {paths.map(({ i, d }) => {
            const active = hovered === i;
            const isExit = i === exitIndex;
            const pal = isExit ? EXIT_SEGMENT_FILL : SEGMENT_FILL;
            const fill = active ? pal.active : pal.base;
            return (
              <path
                key={`seg-${i}`}
                d={d}
                fill={fill}
                stroke={active ? "rgb(228 228 231)" : "rgb(63 63 70)"}
                strokeWidth={active ? 2 : 1}
                className="cursor-pointer transition-[fill,stroke-width] duration-100"
                aria-label={isExit ? "Exit" : shortRadialLabel(types[i])}
                onClick={() => (isExit ? onClose() : onPick(types[i]))}
              />
            );
          })}
          {iconAngles.map((ang, i) => {
            const active = hovered === i;
            const isExit = i === exitIndex;
            const kind = isExit ? "exit" : types[i];
            const ax = Math.cos(ang) * R_ICON;
            const ay = Math.sin(ang) * R_ICON;
            return (
              <g key={`icon-${i}`} transform={`translate(${ax}, ${ay})`} className="pointer-events-none">
                <g transform="translate(-11, -11)">
                  <SegmentIcon kind={kind} active={active} />
                </g>
              </g>
            );
          })}
        </svg>
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center"
          style={{ padding: Math.max(8, R_IN - 56) }}
          aria-live="polite"
        >
          <span
            className={`text-lg font-semibold tracking-tight text-zinc-100 transition-opacity duration-150 ${
              centerLabel ? "opacity-100" : "opacity-0"
            }`}
          >
            {centerLabel || "\u00a0"}
          </span>
        </div>
      </div>
    </div>
  );
}
