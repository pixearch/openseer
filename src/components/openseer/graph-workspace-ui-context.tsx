"use client";

import { createContext, useContext } from "react";

export const ShowNodeTypeHeadingContext = createContext(true);

export function useShowNodeTypeHeading(): boolean {
  return useContext(ShowNodeTypeHeadingContext);
}

export const GridSnapEnabledContext = createContext(false);

export function useGridSnapEnabled(): boolean {
  return useContext(GridSnapEnabledContext);
}
