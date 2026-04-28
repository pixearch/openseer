import type { Chord } from "@/lib/hotkeys/chord";
import { keyChord, primaryZ } from "@/lib/hotkeys/chord";

export type HotkeyCategory = string;

export type HotkeyId =
  | "panUp"
  | "panDown"
  | "panLeft"
  | "panRight"
  | "panFaster"
  | "panSlower"
  | "zoomToSelection"
  | "fitAll"
  | "focusMode"
  | "gridSnap"
  | "overview"
  | "moveNode"
  | "shiftMultiSelect"
  | "dragBoxSelect"
  | "rightClickCanvasMenu"
  | "radialFromSpace"
  | "alignNodes"
  | "evenSpacing"
  | "proportionalMove"
  | "clickEdge"
  | "dragOrthogonalSegment"
  | "doubleClickEdge"
  | "removeControlPoint"
  | "grabControlPoint"
  | "chainToggle"
  | "chainConnect"
  | "chainExit"
  | "breakFromChain"
  | "duplicate"
  | "duplicateExact"
  | "undo"
  | "redo";

export const EDITABLE_KEYBOARD_IDS = [
  "panUp",
  "panDown",
  "panLeft",
  "panRight",
  "panFaster",
  "panSlower",
  "zoomToSelection",
  "fitAll",
  "focusMode",
  "gridSnap",
  "overview",
  "radialFromSpace",
  "alignNodes",
  "evenSpacing",
  "proportionalMove",
  "grabControlPoint",
  "chainToggle",
  "chainConnect",
  "breakFromChain",
  "duplicate",
  "duplicateExact",
  "undo",
  "redo",
] as const satisfies readonly HotkeyId[];

export type EditableHotkey = (typeof EDITABLE_KEYBOARD_IDS)[number];

export type HotkeyRow =
  | {
      id: EditableHotkey;
      category: HotkeyCategory;
      label: string;
      kind: "keyboard";
      defaultChord: Chord;
      /** User can rebind; match still only runs when handler allows. */
      editable: boolean;
    }
  | {
      id: HotkeyId;
      category: HotkeyCategory;
      label: string;
      kind: "static";
      rightLabel: string;
    };

const KEY_DEFAULTS: { [K in EditableHotkey]: Chord } = {
  panUp: keyChord("ArrowUp", {}),
  panDown: keyChord("ArrowDown", {}),
  panLeft: keyChord("ArrowLeft", {}),
  panRight: keyChord("ArrowRight", {}),
  panFaster: keyChord("ArrowUp", { shift: true }),
  panSlower: keyChord("ArrowDown", { shift: true }),
  zoomToSelection: keyChord("KeyZ", {}),
  fitAll: keyChord("KeyE", {}),
  focusMode: keyChord("KeyF", {}),
  gridSnap: keyChord("KeyS", {}),
  overview: keyChord("KeyH", {}),
  radialFromSpace: keyChord("Space", {}),
  alignNodes: keyChord("KeyA", { shift: false }),
  evenSpacing: keyChord("KeyA", { shift: true }),
  proportionalMove: keyChord("KeyM", {}),
  grabControlPoint: keyChord("KeyG", {}),
  chainToggle: keyChord("KeyC", {}),
  chainConnect: keyChord("Enter", {}),
  breakFromChain: keyChord("KeyB", {}),
  duplicate: { code: "KeyD", usePrimary: false, ctrl: true, shift: false, alt: false, meta: false },
  duplicateExact: { code: "KeyD", usePrimary: false, ctrl: true, shift: true, alt: false, meta: false },
  undo: primaryZ(false),
  redo: primaryZ(true),
};

export function getDefaultChord(id: EditableHotkey): Chord {
  return { ...KEY_DEFAULTS[id] };
}

const ROWS: HotkeyRow[] = [
  { id: "panUp", category: "Core navigation", label: "Pan up", kind: "keyboard", defaultChord: getDefaultChord("panUp"), editable: true },
  { id: "panDown", category: "Core navigation", label: "Pan down", kind: "keyboard", defaultChord: getDefaultChord("panDown"), editable: true },
  { id: "panLeft", category: "Core navigation", label: "Pan left", kind: "keyboard", defaultChord: getDefaultChord("panLeft"), editable: true },
  { id: "panRight", category: "Core navigation", label: "Pan right", kind: "keyboard", defaultChord: getDefaultChord("panRight"), editable: true },
  { id: "panFaster", category: "Core navigation", label: "Increase pan speed", kind: "keyboard", defaultChord: getDefaultChord("panFaster"), editable: true },
  { id: "panSlower", category: "Core navigation", label: "Decrease pan speed", kind: "keyboard", defaultChord: getDefaultChord("panSlower"), editable: true },
  { id: "zoomToSelection", category: "Core navigation", label: "Zoom to selected node", kind: "keyboard", defaultChord: getDefaultChord("zoomToSelection"), editable: true },
  { id: "fitAll", category: "Core navigation", label: "Zoom to fit all nodes", kind: "keyboard", defaultChord: getDefaultChord("fitAll"), editable: true },
  { id: "focusMode", category: "Core navigation", label: "Focus mode", kind: "keyboard", defaultChord: getDefaultChord("focusMode"), editable: true },
  { id: "gridSnap", category: "Core navigation", label: "Toggle grid snapping", kind: "keyboard", defaultChord: getDefaultChord("gridSnap"), editable: true },
  { id: "overview", category: "Core navigation", label: "Toggle overview window", kind: "keyboard", defaultChord: getDefaultChord("overview"), editable: true },
  { id: "moveNode", category: "Node / selection", kind: "static", label: "Move node", rightLabel: "Left click + drag" },
  { id: "shiftMultiSelect", category: "Node / selection", kind: "static", label: "Multi-select", rightLabel: "Shift + click / drag" },
  { id: "dragBoxSelect", category: "Node / selection", kind: "static", label: "Select multiple nodes", rightLabel: "Drag box" },
  { id: "rightClickCanvasMenu", category: "Node / selection", kind: "static", label: "Radial node menu", rightLabel: "Right click canvas" },
  { id: "radialFromSpace", category: "Node creation", label: "Open radial node menu", kind: "keyboard", defaultChord: getDefaultChord("radialFromSpace"), editable: true },
  { id: "alignNodes", category: "Layout / positioning", label: "Align nodes", kind: "keyboard", defaultChord: getDefaultChord("alignNodes"), editable: true },
  { id: "evenSpacing", category: "Layout / positioning", label: "Even spacing", kind: "keyboard", defaultChord: getDefaultChord("evenSpacing"), editable: true },
  { id: "proportionalMove", category: "Layout / positioning", label: "Proportional move mode", kind: "keyboard", defaultChord: getDefaultChord("proportionalMove"), editable: true },
  { id: "clickEdge", category: "Edge / connection editing", kind: "static", label: "Select edge", rightLabel: "Click edge" },
  { id: "dragOrthogonalSegment", category: "Edge / connection editing", kind: "static", label: "Adjust orthogonal segment", rightLabel: "Drag segment" },
  { id: "doubleClickEdge", category: "Edge / connection editing", kind: "static", label: "Add control point", rightLabel: "Double-click edge" },
  { id: "removeControlPoint", category: "Edge / connection editing", kind: "static", label: "Remove control point", rightLabel: "Delete" },
  { id: "grabControlPoint", category: "Edge / connection editing", label: "Grab selected control point", kind: "keyboard", defaultChord: getDefaultChord("grabControlPoint"), editable: true },
  { id: "chainToggle", category: "Chain mode", label: "Toggle chain mode", kind: "keyboard", defaultChord: getDefaultChord("chainToggle"), editable: true },
  { id: "chainConnect", category: "Chain mode", label: "Auto-chain selected nodes", kind: "keyboard", defaultChord: getDefaultChord("chainConnect"), editable: true },
  { id: "chainExit", category: "Chain mode", kind: "static", label: "Exit chain mode", rightLabel: "Esc" },
  { id: "breakFromChain", category: "Node editing", label: "Break node out of chain", kind: "keyboard", defaultChord: getDefaultChord("breakFromChain"), editable: true },
  { id: "duplicate", category: "Duplication", label: "Duplicate default node", kind: "keyboard", defaultChord: getDefaultChord("duplicate"), editable: true },
  { id: "duplicateExact", category: "Duplication", label: "Exact duplicate", kind: "keyboard", defaultChord: getDefaultChord("duplicateExact"), editable: true },
  { id: "undo", category: "System", label: "Undo", kind: "keyboard", defaultChord: getDefaultChord("undo"), editable: true },
  { id: "redo", category: "System", label: "Redo", kind: "keyboard", defaultChord: getDefaultChord("redo"), editable: true },
];

export const HOTKEY_ROWS: Readonly<HotkeyRow[]> = ROWS;

export const CATEGORY_ORDER: string[] = [
  "Core navigation",
  "Node / selection",
  "Node creation",
  "Layout / positioning",
  "Edge / connection editing",
  "Chain mode",
  "Node editing",
  "Duplication",
  "System",
];

export function isEditableId(id: HotkeyId): id is EditableHotkey {
  return (EDITABLE_KEYBOARD_IDS as readonly string[]).includes(id);
}
