"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  clampStyleOpacity,
  formatHsl,
  parseHslTriplet,
} from "@/lib/node-style-chrome";
import type { OpenSeerNodeData } from "@/lib/types/graph";

const CANVAS_W = 200;
const CANVAS_H = 120;

function drawHslPlane(ctx: CanvasRenderingContext2D, hue: number) {
  const hh = ((hue % 360) + 360) % 360;
  const img = ctx.createImageData(CANVAS_W, CANVAS_H);
  const d = img.data;
  let p = 0;
  for (let y = 0; y < CANVAS_H; y++) {
    const l = 100 * (1 - y / (CANVAS_H - 1 || 1));
    for (let x = 0; x < CANVAS_W; x++) {
      const s = 100 * (x / (CANVAS_W - 1 || 1));
      const { r, g, b } = hslToRgb(hh, s, l);
      d[p] = r;
      d[p + 1] = g;
      d[p + 2] = b;
      d[p + 3] = 255;
      p += 4;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const ss = s / 100;
  const ll = l / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (hp >= 0 && hp < 1) {
    rp = c;
    gp = x;
  } else if (hp >= 1 && hp < 2) {
    rp = x;
    gp = c;
  } else if (hp >= 2 && hp < 3) {
    gp = c;
    bp = x;
  } else if (hp >= 3 && hp < 4) {
    gp = x;
    bp = c;
  } else if (hp >= 4 && hp < 5) {
    rp = x;
    bp = c;
  } else {
    rp = c;
    bp = x;
  }
  const m = ll - c / 2;
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

function initialTriplet(
  data: OpenSeerNodeData,
  mode: "header" | "body"
): { h: number; s: number; l: number } {
  const raw =
    mode === "header" ? data.styleHeaderColor : data.styleBodyColor;
  const p = parseHslTriplet(raw);
  if (p) return p;
  return { h: 220, s: 14, l: 18 };
}

export function NodeStyleColorPanel({
  mode,
  anchorData,
  targetIds,
  onLivePatch,
  onClose,
  position,
}: {
  mode: "header" | "body";
  anchorData: OpenSeerNodeData;
  targetIds: string[];
  onLivePatch: (ids: string[], patch: Partial<OpenSeerNodeData>) => void;
  onClose: () => void;
  position: { left: number; top: number };
}) {
  const [h, setH] = useState(() => initialTriplet(anchorData, mode).h);
  const [s, setS] = useState(() => initialTriplet(anchorData, mode).s);
  const [l, setL] = useState(() => initialTriplet(anchorData, mode).l);
  const [opacityPct, setOpacityPct] = useState(() =>
    mode === "body" ? Math.round(clampStyleOpacity(anchorData.styleBodyOpacity) * 100) : 100
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef(false);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!dirtyRef.current) return;
    const hsl = formatHsl(h, s, l);
    if (mode === "header") {
      onLivePatch(targetIds, { styleHeaderColor: hsl });
    } else {
      onLivePatch(targetIds, {
        styleBodyColor: hsl,
        styleBodyOpacity: Math.min(1, Math.max(0, opacityPct / 100)),
      });
    }
  }, [h, s, l, opacityPct, mode, onLivePatch, targetIds]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    drawHslPlane(ctx, h);
  }, [h]);

  function readCanvas(clientX: number, clientY: number) {
    const c = canvasRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const x = Math.min(CANVAS_W - 1, Math.max(0, ((clientX - r.left) / r.width) * CANVAS_W));
    const y = Math.min(CANVAS_H - 1, Math.max(0, ((clientY - r.top) / r.height) * CANVAS_H));
    const nextS = (x / (CANVAS_W - 1 || 1)) * 100;
    const nextL = (1 - y / (CANVAS_H - 1 || 1)) * 100;
    dirtyRef.current = true;
    setS(nextS);
    setL(nextL);
  }

  const onCanvasPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    readCanvas(e.clientX, e.clientY);
  };

  const onCanvasPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!dragging.current) return;
    readCanvas(e.clientX, e.clientY);
  };

  const onCanvasPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    dragging.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const markerLeft = `${(s / 100) * 100}%`;
  const markerTop = `${100 - (l / 100) * 100}%`;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[45] cursor-default bg-transparent"
        aria-label="Close color panel"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label={mode === "header" ? "Header color" : "Background color"}
        className="fixed z-[46] w-[min(92vw,240px)] rounded-md border border-zinc-600 bg-zinc-900 p-2.5 shadow-xl"
        style={{ left: position.left, top: position.top }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p className="mb-2 text-center text-xs font-medium text-zinc-300">
          {mode === "header" ? "Header color" : "Background color"}
        </p>
        <div className="relative rounded border border-zinc-700">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="block h-[120px] w-full cursor-crosshair rounded touch-none"
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            onPointerCancel={onCanvasPointerUp}
          />
          <span
            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
            style={{ left: markerLeft, top: markerTop }}
            aria-hidden
          />
        </div>
        <label className="mt-2 flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-zinc-500">Hue</span>
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={Math.round(h)}
            onChange={(e) => {
              dirtyRef.current = true;
              setH(Number(e.target.value));
            }}
            className="w-full accent-sky-500"
          />
        </label>
        <label className="mt-1 flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-zinc-500">Saturation</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(s)}
            onChange={(e) => {
              dirtyRef.current = true;
              setS(Number(e.target.value));
            }}
            className="w-full accent-sky-500"
          />
        </label>
        <label className="mt-1 flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-zinc-500">Lightness</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(l)}
            onChange={(e) => {
              dirtyRef.current = true;
              setL(Number(e.target.value));
            }}
            className="w-full accent-sky-500"
          />
        </label>
        {mode === "body" ? (
          <label className="mt-1 flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-zinc-500">Opacity</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={opacityPct}
              onChange={(e) => {
                dirtyRef.current = true;
                setOpacityPct(Number(e.target.value));
              }}
              className="w-full accent-sky-500"
            />
          </label>
        ) : null}
        <button
          type="button"
          className="mt-2 w-full rounded border border-zinc-600 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
          onClick={onClose}
        >
          Done
        </button>
      </div>
    </>
  );
}
