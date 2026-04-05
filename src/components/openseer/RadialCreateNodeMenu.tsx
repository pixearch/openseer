"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NODE_TYPE_LABEL } from "@/lib/node-type-meta";
import type { OpenSeerNodeType } from "@/lib/types/graph";
import { GRAPH_WORKSPACE_NODE_TYPE_LIST } from "@/lib/types/graph";

const R = 100;

const WEDGE_FILL: { base: string; active: string }[] = [
  { base: "rgb(39 39 42)", active: "rgb(63 63 70)" },
  { base: "rgb(91 33 182 / 0.28)", active: "rgb(91 33 182 / 0.55)" },
  { base: "rgb(14 165 233 / 0.22)", active: "rgb(14 165 233 / 0.45)" },
  { base: "rgb(245 158 11 / 0.22)", active: "rgb(245 158 11 / 0.45)" },
  { base: "rgb(20 184 166 / 0.25)", active: "rgb(20 184 166 / 0.5)" },
];

function sectorAt(dx: number, dy: number, n: number): number {
  const a = Math.atan2(dy, dx);
  let t = a + Math.PI / 2;
  while (t < 0) t += 2 * Math.PI;
  while (t >= 2 * Math.PI) t -= 2 * Math.PI;
  const sweep = (2 * Math.PI) / n;
  const s = Math.floor(t / sweep);
  return Math.min(n - 1, Math.max(0, s));
}

function wedgePath(i: number, n: number): string {
  const sweep = (2 * Math.PI) / n;
  const a0 = -Math.PI / 2 + i * sweep;
  const a1 = a0 + sweep;
  const x0 = Math.cos(a0) * R;
  const y0 = Math.sin(a0) * R;
  const x1 = Math.cos(a1) * R;
  const y1 = Math.sin(a1) * R;
  return `M 0 0 L ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1} Z`;
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
  const n = types.length;
  const labels = types.map((t) => NODE_TYPE_LABEL[t]);

  const paths = useMemo(
    () => types.map((_, i) => ({ i, d: wedgePath(i, n) })),
    [n, types]
  );

  const labelAngles = useMemo(() => {
    const sweep = (2 * Math.PI) / n;
    return types.map((_, i) => -Math.PI / 2 + (i + 0.5) * sweep);
  }, [n, types]);

  const updateHover = useCallback(
    (clientX: number, clientY: number) => {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      if (Math.hypot(dx, dy) < 18) {
        setHovered(null);
        return;
      }
      setHovered(sectorAt(dx, dy, n));
    },
    [n]
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

  const labelRadius = 62;

  return (
    <div
      ref={rootRef}
      data-radial-menu
      className="pointer-events-auto flex flex-col items-center"
      onMouseMove={(e) => updateHover(e.clientX, e.clientY)}
      onMouseLeave={() => setHovered(null)}
    >
      <div className="relative h-[200px] w-[200px]">
        <svg
          width={200}
          height={200}
          viewBox={`${-R} ${-R} ${R * 2} ${R * 2}`}
          className="overflow-visible"
          aria-label="Create node"
        >
          <defs>
            <filter id="radial-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {paths.map(({ i, d }) => {
            const active = hovered === i;
            const pal = WEDGE_FILL[i % WEDGE_FILL.length];
            const fill = active ? pal.active : pal.base;
            return (
              <path
                key={i}
                d={d}
                fill={fill}
                stroke={active ? "rgb(244 244 245)" : "rgb(63 63 70)"}
                strokeWidth={active ? 2.2 : 1}
                className="cursor-pointer transition-[fill,stroke-width] duration-100"
                style={{ filter: active ? "url(#radial-glow)" : undefined }}
                onClick={() => onPick(types[i])}
              />
            );
          })}
          <circle r={16} fill="rgb(24 24 27)" stroke="rgb(63 63 70)" strokeWidth={1} />
          {labelAngles.map((ang, i) => {
            const lx = Math.cos(ang) * labelRadius;
            const ly = Math.sin(ang) * labelRadius;
            return (
              <text
                key={i}
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                className="pointer-events-none select-none fill-zinc-200 text-[11px] font-semibold uppercase tracking-wide"
                style={{
                  opacity: hovered === null || hovered === i ? 1 : 0.35,
                }}
              >
                {labels[i]}
              </text>
            );
          })}
        </svg>
      </div>
      <button
        type="button"
        className="mt-1 min-w-[120px] rounded-md border border-zinc-600 bg-zinc-900 px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-300 shadow hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-100"
        onClick={onClose}
      >
        EXIT
      </button>
    </div>
  );
}
