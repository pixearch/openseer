import { chordEquals, type Chord } from "@/lib/hotkeys/chord";
import { type EditableHotkey, getDefaultChord, EDITABLE_KEYBOARD_IDS } from "@/lib/hotkeys/registry";
import { buildEffectiveMap, findChordOwner } from "@/lib/hotkeys/storage";

function isUnique(
  m: Map<EditableHotkey, Chord>
): { ok: true } | { ok: false; a: EditableHotkey; b: EditableHotkey } {
  const list = [...m.entries()];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const [ia, ca] = list[i]!;
      const [ib, cb] = list[j]!;
      if (chordEquals(ca, cb)) {
        return { ok: false, a: ia, b: ib };
      }
    }
  }
  return { ok: true };
}

/**
 * If `newChord` is already the effective binding for `targetId`, not a conflict.
 * Otherwise the owner of `newChord` (if any) must be cleared to default, then uniqueness must hold.
 */
export function previewReassignAnyway(
  targetId: EditableHotkey,
  newChord: Chord,
  currentOverrides: Partial<Record<EditableHotkey, Chord>>
):
  | { status: "ok"; nextOverrides: Partial<Record<EditableHotkey, Chord | undefined>> }
  | { status: "blocked"; message: string; conflictingId?: EditableHotkey } {
  const before = buildEffectiveMap(currentOverrides);
  const selfBefore = before.get(targetId);
  if (selfBefore && chordEquals(selfBefore, newChord)) {
    return { status: "ok", nextOverrides: { ...currentOverrides } };
  }

  const other = findChordOwner(newChord, before, targetId);
  const next: Partial<Record<EditableHotkey, Chord | undefined>> = { ...currentOverrides };

  if (chordEquals(newChord, getDefaultChord(targetId))) {
    next[targetId] = undefined;
  } else {
    next[targetId] = newChord;
  }

  if (other == null) {
    const eff = buildEffectiveMap(next);
    const u = isUnique(eff);
    if (u.ok) return { status: "ok", nextOverrides: next };
    return { status: "blocked", message: "That binding is already in use. Choose a different key or reassign the other action first." };
  }

  next[other] = undefined;

  const defVictim = getDefaultChord(other);
  if (chordEquals(defVictim, newChord)) {
    return {
      status: "blocked",
      message: "Cannot safely reassign: the other action’s default is the key you are assigning. Resolve the overlap manually in Hotkeys.",
    };
  }

  const eff2 = new Map<EditableHotkey, Chord>();
  for (const id of EDITABLE_KEYBOARD_IDS) {
    const o = id === other ? defVictim : next[id] ?? getDefaultChord(id);
    eff2.set(id, o);
  }

  const u2 = isUnique(eff2);
  if (u2.ok) {
    return { status: "ok", nextOverrides: next };
  }
  return {
    status: "blocked",
    message: `Reassigning would require "${labelForId(other)}" to use its default binding, but that would overlap another action. Change one of those keys manually, or choose Cancel.`,
  };
}

function labelForId(id: EditableHotkey): string {
  const m: Record<EditableHotkey, string> = {
    panUp: "Pan up",
    panDown: "Pan down",
    panLeft: "Pan left",
    panRight: "Pan right",
    panFaster: "Increase pan speed",
    panSlower: "Decrease pan speed",
    zoomToSelection: "Zoom to selected node",
    fitAll: "Zoom to fit all nodes",
    focusMode: "Focus mode",
    gridSnap: "Grid snapping",
    overview: "Overview",
    radialFromSpace: "Radial from Space",
    alignNodes: "Align",
    evenSpacing: "Even spacing",
    proportionalMove: "Proportional move",
    grabControlPoint: "Grab control point",
    chainToggle: "Chain mode",
    chainConnect: "Auto-chain",
    breakFromChain: "Break from chain",
    duplicate: "Duplicate",
    duplicateExact: "Exact duplicate",
    undo: "Undo",
    redo: "Redo",
  };
  return m[id] ?? id;
}

/**
 * Shallow conflict check: `newChord` is already used by a different id (and not the same as target’s current if replacing).
 */
export function findDisplayConflictName(
  targetId: EditableHotkey,
  newChord: Chord,
  currentOverrides: Partial<Record<EditableHotkey, Chord>>
): EditableHotkey | null {
  const before = buildEffectiveMap(currentOverrides);
  const self = before.get(targetId);
  if (self && chordEquals(self, newChord)) return null;
  return findChordOwner(newChord, before, targetId);
}
