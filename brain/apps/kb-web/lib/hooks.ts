"use client";

import { useState, useCallback, useEffect } from "react";

export function useResizableWidth(
  storageKey: string,
  defaultWidth: number,
  min: number,
  max: number
) {
  // Always initialise with defaultWidth so server and client first-render match.
  // The saved value is applied after hydration in useEffect.
  const [width, setWidth] = useState(defaultWidth);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const w = parseInt(saved, 10);
      if (!isNaN(w)) setWidth(Math.max(min, Math.min(max, w)));
    }
  }, [storageKey, min, max]);

  const startResize = useCallback(
    (e: React.MouseEvent, direction: "e" | "w") => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = width;
      let finalW = startW;

      const onMove = (ev: MouseEvent) => {
        const delta =
          direction === "e" ? ev.clientX - startX : startX - ev.clientX;
        finalW = Math.max(min, Math.min(max, startW + delta));
        setWidth(finalW);
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        localStorage.setItem(storageKey, String(finalW));
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [width, min, max, storageKey]
  );

  return { width, startResize };
}
