"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { OpenSeerNodeData } from "@/lib/types/graph";

/** Merges partial node patches and applies after `delayMs`, or flushes when `activeKey` changes / unmount. */
export function useDebouncedPatchNode(
  activeKey: string | null,
  onPatchNode: (id: string, patch: Partial<OpenSeerNodeData>) => void,
  delayMs = 300
) {
  const pending = useRef<Partial<OpenSeerNodeData>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeKeyRef = useRef(activeKey);

  useLayoutEffect(() => {
    activeKeyRef.current = activeKey;
  }, [activeKey]);

  const flushTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const schedule = useCallback(
    (patch: Partial<OpenSeerNodeData>) => {
      pending.current = { ...pending.current, ...patch };
      flushTimer();
      timer.current = setTimeout(() => {
        timer.current = null;
        const id = activeKeyRef.current;
        const p = pending.current;
        pending.current = {};
        if (id && Object.keys(p).length > 0) {
          onPatchNode(id, p);
        }
      }, delayMs);
    },
    [onPatchNode, delayMs, flushTimer]
  );

  useEffect(() => {
    const mountedAs = activeKey;
    return () => {
      flushTimer();
      const p = pending.current;
      pending.current = {};
      if (mountedAs && Object.keys(p).length > 0) {
        onPatchNode(mountedAs, p);
      }
    };
  }, [activeKey, onPatchNode, flushTimer]);

  return schedule;
}
