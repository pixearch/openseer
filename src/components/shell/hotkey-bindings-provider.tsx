"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Chord } from "@/lib/hotkeys/chord";
import { type EditableHotkey, getDefaultChord } from "@/lib/hotkeys/registry";
import { GRAPH_KEYBIND_STORAGE_KEY, buildEffectiveMap, loadKeybindOverrides, saveKeybindOverrides } from "@/lib/hotkeys/storage";

type HotkeyBindingsContextValue = {
  tick: number;
  chord: (id: EditableHotkey) => Chord;
  getEffectiveMap: () => Map<EditableHotkey, Chord>;
  applyOverrides: (over: Partial<Record<EditableHotkey, Chord | undefined>>) => void;
  clearAllOverrides: () => void;
  overrides: Partial<Record<EditableHotkey, Chord>>;
  hydrated: boolean;
};

const Ctx = createContext<HotkeyBindingsContextValue | null>(null);

export function HotkeyBindingsProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Partial<Record<EditableHotkey, Chord>>>(() => {
    if (typeof window === "undefined") return {};
    return loadKeybindOverrides();
  });
  const [tick, setTick] = useState(0);

  const clearAllOverrides = useCallback(() => {
    setOverrides({});
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(GRAPH_KEYBIND_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
    setTick((n) => n + 1);
  }, []);

  const applyOverrides = useCallback(
    (over: Partial<Record<EditableHotkey, Chord | undefined>>) => {
      setOverrides((prev) => {
        const n: Partial<Record<EditableHotkey, Chord>> = { ...prev };
        for (const k of Object.keys(over) as EditableHotkey[]) {
          const val = over[k];
          if (val == null) delete n[k];
          else n[k] = val;
        }
        saveKeybindOverrides(n);
        return n;
      });
      setTick((x) => x + 1);
    },
    []
  );

  const v = useMemo<HotkeyBindingsContextValue>(
    () => ({
      tick,
      chord: (id) => (overrides[id] != null ? { ...overrides[id]! } : getDefaultChord(id)),
      getEffectiveMap: () => buildEffectiveMap(overrides),
      applyOverrides,
      clearAllOverrides,
      overrides,
      hydrated: true,
    }),
    [overrides, tick, applyOverrides, clearAllOverrides]
  );

  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export function useHotkeyBindings() {
  const c = useContext(Ctx);
  if (!c) {
    return null;
  }
  return c;
}
