import type { CSSProperties } from "react";
import type { OpenSeerNodeData } from "@/lib/types/graph";

export type NodeHeaderLayoutVariant = "standardCard" | "code" | "compactToolbar";

const DEFAULT_TITLE_FS: Record<NodeHeaderLayoutVariant, number> = {
  standardCard: 16,
  code: 14,
  compactToolbar: 14,
};

export function resolveHeaderTitleStyle(data: OpenSeerNodeData): CSSProperties {
  const o: CSSProperties = {};
  const c = typeof data.styleHeaderFontColor === "string" ? data.styleHeaderFontColor.trim() : "";
  if (c) o.color = c;
  const fs = data.styleHeaderFontSizePx;
  if (typeof fs === "number" && Number.isFinite(fs) && fs > 0) {
    o.fontSize = `${fs}px`;
  }
  const sw = data.styleHeaderStrokeWidthPx;
  const strokeC =
    typeof data.styleHeaderStrokeColor === "string" ? data.styleHeaderStrokeColor.trim() : "";
  if (typeof sw === "number" && Number.isFinite(sw) && sw > 0 && strokeC) {
    o.WebkitTextStroke = `${sw}px ${strokeC}`;
    o.paintOrder = "stroke fill";
  }
  return o;
}

export function resolveBodyTextStyle(data: OpenSeerNodeData): CSSProperties {
  const o: CSSProperties = {};
  const c = typeof data.styleBodyFontColor === "string" ? data.styleBodyFontColor.trim() : "";
  if (c) o.color = c;
  const fs = data.styleBodyFontSizePx;
  if (typeof fs === "number" && Number.isFinite(fs) && fs > 0) {
    o.fontSize = `${fs}px`;
  }
  return o;
}

/** Minimum header strip height; grows when `styleHeaderFontSizePx` is large. */
export function nodeHeaderContainerMinHeightPx(
  variant: NodeHeaderLayoutVariant,
  data: OpenSeerNodeData,
  showTypeHeading: boolean
): number {
  const baseFs = DEFAULT_TITLE_FS[variant];
  const fs =
    typeof data.styleHeaderFontSizePx === "number" &&
    Number.isFinite(data.styleHeaderFontSizePx) &&
    data.styleHeaderFontSizePx > 0
      ? data.styleHeaderFontSizePx
      : baseFs;

  if (variant === "standardCard") {
    const pad = 16;
    const row1 = showTypeHeading ? 14 : 10;
    const titleH = 4 + fs * 1.375;
    return Math.max(56, Math.ceil(pad + row1 + titleH));
  }
  if (variant === "code") {
    const pad = 12;
    const titleRow = Math.max(22, fs * 1.3);
    const subtitle = 14;
    return Math.max(80, Math.ceil(pad + titleRow + 4 + subtitle));
  }
  const pad = 8;
  const row = Math.max(26, fs * 1.35);
  return Math.max(42, Math.ceil(pad + row));
}

export function colorInputHex6(value: string | undefined, fallback: string): string {
  const t = typeof value === "string" ? value.trim() : "";
  return /^#[0-9A-Fa-f]{6}$/.test(t) ? t : fallback;
}
