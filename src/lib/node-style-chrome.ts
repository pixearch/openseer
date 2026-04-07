import type { CSSProperties } from "react";
import type { OpenSeerNodeData } from "@/lib/types/graph";

/** Append alpha to stored `hsl(H S% L%)` for backgrounds. */
export function hslWithAlpha(hsl: string, alpha: number): string {
  const t = hsl.trim();
  const a = Math.min(1, Math.max(0, alpha));
  if (t.endsWith(")")) return `${t.slice(0, -1)} / ${a})`;
  return t;
}

export function clampStyleOpacity(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 1;
  return Math.min(1, Math.max(0, raw));
}

export function parseHslTriplet(css: string | undefined): { h: number; s: number; l: number } | null {
  if (!css || typeof css !== "string") return null;
  const m = css.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/i);
  if (!m) return null;
  return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
}

export function formatHsl(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.min(100, Math.max(0, s));
  const ll = Math.min(100, Math.max(0, l));
  return `hsl(${hh} ${ss}% ${ll}%)`;
}

export type NodeChromeComputed = {
  useTransparentOuter: boolean;
  headerStyle: CSSProperties | undefined;
  bodyStyle: CSSProperties | undefined;
  hubFill: string | undefined;
};

export function getNodeChromeStyles(data: OpenSeerNodeData): NodeChromeComputed {
  const header =
    typeof data.styleHeaderColor === "string" && data.styleHeaderColor.trim() !== ""
      ? data.styleHeaderColor.trim()
      : "";
  const body =
    typeof data.styleBodyColor === "string" && data.styleBodyColor.trim() !== ""
      ? data.styleBodyColor.trim()
      : "";
  const op = clampStyleOpacity(data.styleBodyOpacity);
  const useTransparentOuter = Boolean(header || body);
  return {
    useTransparentOuter,
    headerStyle: header ? { backgroundColor: header } : undefined,
    bodyStyle: body ? { backgroundColor: hslWithAlpha(body, op) } : undefined,
    hubFill: body ? hslWithAlpha(body, op) : undefined,
  };
}
