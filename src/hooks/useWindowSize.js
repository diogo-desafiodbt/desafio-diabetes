import { useEffect, useState } from "react";

function readWidth() {
  if (typeof window === "undefined") return 1200;
  return window.innerWidth;
}

/**
 * Largura atual da janela e flag mobile (largura < breakpoint).
 * @param {number} [breakpoint=768]
 */
export function useWindowSize(breakpoint = 768) {
  const [width, setWidth] = useState(readWidth);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return {
    width,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
    isMobile: width < breakpoint,
  };
}
