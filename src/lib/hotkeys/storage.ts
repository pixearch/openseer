import { chordEquals, type Chord } from "@/lib/hotkeys/chord";
import { type EditableHotkey, getDefaultChord, EDITABLE_KEYBOARD_IDS } from "@/lib/hotkeys/registry";

export const GRAPH_KEYBIND_STORAGE_KEY = "openseer-graph-keybind-overrides";

export function loadKeybindOverrides(): Partial<Record<EditableHotkey, Chord>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(GRAPH_KEYBIND_STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as unknown;
    if (p == null || typeof p !== "object") return {};
    const out: Partial<Record<EditableHotkey, Chord>> = {};
    for (const id of EDITABLE_KEYBOARD_IDS) {
      const c = (p as Record<string, Chord>)[id];
      if (c == null) continue;
      if (
        typeof c !== "object" ||
        typeof c.code !== "string" ||
        typeof c.usePrimary !== "boolean" ||
        typeof c.shift !== "boolean" ||
        typeof c.alt !== "boolean" ||
        typeof c.ctrl !== "boolean" ||
        typeof c.meta !== "boolean"
      ) {
        continue;
      }
      out[id] = c;
    }
    const eff = buildEffectiveMap(out);
    if (!isUniqueEffectiveMap(eff)) return {};
    return out;
  } catch {
    return {};
  }
}

export function buildEffectiveMap(over: Partial<Record<EditableHotkey, Chord | undefined>>) {
  const m = new Map<EditableHotkey, Chord>();
  for (const id of EDITABLE_KEYBOARD_IDS) {
    m.set(id, (over[id] as Chord | null | undefined) ?? getDefaultChord(id));
  }
  return m;
}

function isUniqueEffectiveMap(map: Map<EditableHotkey, Chord>): boolean {
  const list = [...map.entries()];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      if (chordEquals(list[i]![1], list[j]![1])) return false;
    }
  }
  return true;
}

export function findChordOwner(
  ch: Chord,
  effectives: Map<EditableHotkey, Chord>,
  exceptId?: EditableHotkey
): EditableHotkey | null {
  for (const [id, c] of effectives) {
    if (exceptId && id === exceptId) continue;
    if (chordEquals(ch, c)) return id;
  }
  return null;
}

export function saveKeybindOverrides(over: Partial<Record<EditableHotkey, Chord | undefined>>) {
  if (typeof window === "undefined") return;
  const toSave: Partial<Record<EditableHotkey, Chord>> = {};
  for (const id of EDITABLE_KEYBOARD_IDS) {
    const v = over[id];
    if (v == null) continue;
    if (chordEquals(v, getDefaultChord(id))) continue;
    toSave[id] = v;
  }
  try {
    if (Object.keys(toSave).length === 0) {
      localStorage.removeItem(GRAPH_KEYBIND_STORAGE_KEY);
    } else {
      localStorage.setItem(GRAPH_KEYBIND_STORAGE_KEY, JSON.stringify(toSave));
    }
  } catch {
    /* ignore */
  }
}