/** Serializable keyboard chord for the graph. */
export type Chord = {
  code: string;
  /** (Ctrl|⌘) — matches (e.ctrlKey || e.metaKey) when true; `ctrl`/`meta` are ignored. */
  usePrimary: boolean;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
};

export const chordEquals = (a: Chord, b: Chord) =>
  a.code === b.code &&
  a.usePrimary === b.usePrimary &&
  a.ctrl === b.ctrl &&
  a.shift === b.shift &&
  a.alt === b.alt &&
  a.meta === b.meta;

export const chordToSignature = (c: Chord) => JSON.stringify(c);

export const primaryZ = (shift: boolean): Chord => ({
  code: "KeyZ",
  usePrimary: true,
  ctrl: false,
  shift,
  alt: false,
  meta: false,
});

export const keyChord = (
  code: string,
  opts: { shift?: boolean; usePrimary?: boolean; ctrl?: boolean; meta?: boolean; alt?: boolean } = {}
): Chord => ({
  code,
  usePrimary: opts.usePrimary === true,
  shift: opts.shift === true,
  alt: opts.alt === true,
  ctrl: opts.ctrl === true,
  meta: opts.meta === true,
});

/**
 * true when the chord is a non-modified key (arrows, letters, Space, no modifiers / primary).
 * Used for "simple" single-key graph shortcuts (no cmd/ctrl/shift/alt).
 */
const anyNonShiftModifiers = (e: KeyboardEvent) =>
  e.ctrlKey || e.metaKey || e.altKey;

const shiftOk = (c: Chord, e: KeyboardEvent) => c.shift === e.shiftKey;

export const chordMatches = (c: Chord, e: KeyboardEvent): boolean => {
  if (e.code !== c.code) return false;
  if (c.usePrimary) {
    if (!(e.ctrlKey || e.metaKey)) return false;
    if (!shiftOk(c, e)) return false;
    if (e.altKey) return false;
    return true;
  }
  if (e.altKey !== c.alt) return false;
  if (e.ctrlKey !== c.ctrl) return false;
  if (e.metaKey !== c.meta) return false;
  if (e.shiftKey !== c.shift) return false;
  if (!c.ctrl && !c.meta && !c.usePrimary) {
    if (c.shift) return e.shiftKey && !anyNonShiftModifiers(e);
    return !anyNonShiftModifiers(e) && !e.shiftKey;
  }
  return true;
};

/**
 * When capturing, normalize Cmd vs Ctrl to usePrimary (Ctrl+Z in UI sense).
 * Ignores unpaired Meta alone without another key? Caller filters.
 */
export function chordFromKeydown(e: KeyboardEvent, opts: { forPrimaryShortcut?: boolean } = {}): Chord | null {
  if (e.key === "Escape" || e.key === "Tab") return null;
  const code = e.code;
  if (code === "NumpadEnter") return null;
  if (!code) return null;

  const forPrimary = opts.forPrimaryShortcut === true;
  const hasPrimary = e.ctrlKey || e.metaKey;

  if (forPrimary) {
    if (!hasPrimary) return null;
    if (e.altKey) return null;
    return {
      code,
      usePrimary: true,
      shift: e.shiftKey,
      alt: false,
      ctrl: false,
      meta: false,
    };
  }

  if (e.altKey && (e.key === "Alt" || e.code === "AltLeft" || e.code === "AltRight")) return null;
  if (e.ctrlKey && (e.key === "Control" || e.code === "ControlLeft" || e.code === "ControlRight")) return null;
  if (e.metaKey && (e.key === "Meta" || e.code === "MetaLeft" || e.code === "MetaRight")) return null;
  if (e.shiftKey && (e.key === "Shift" || e.code === "ShiftLeft" || e.code === "ShiftRight")) return null;

  return {
    code,
    usePrimary: false,
    shift: e.shiftKey,
    alt: e.altKey,
    ctrl: e.ctrlKey,
    meta: e.metaKey,
  };
}

export function isEscapeChord(e: KeyboardEvent): boolean {
  return e.code === "Escape" && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey;
}
