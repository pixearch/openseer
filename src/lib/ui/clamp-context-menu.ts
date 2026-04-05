/** Keep fixed-position context menus inside the viewport (with margin). */
export function clampFixedMenuPosition(
  clientX: number,
  clientY: number,
  menuWidth: number,
  menuHeight: number,
  margin = 8
): { left: number; top: number } {
  if (typeof window === "undefined") {
    return { left: clientX, top: clientY };
  }
  const maxLeft = Math.max(margin, window.innerWidth - menuWidth - margin);
  const maxTop = Math.max(margin, window.innerHeight - menuHeight - margin);
  return {
    left: Math.min(Math.max(margin, clientX), maxLeft),
    top: Math.min(Math.max(margin, clientY), maxTop),
  };
}
