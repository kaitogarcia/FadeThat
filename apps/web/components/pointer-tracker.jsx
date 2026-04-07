"use client";

import { useEffect } from "react";

export default function PointerTracker() {
  useEffect(() => {
    const root = document.documentElement;
    let rafId = 0;
    let pointerX = 50;
    let pointerY = 50;

    const paintMotion = () => {
      root.style.setProperty("--px", `${pointerX}%`);
      root.style.setProperty("--py", `${pointerY}%`);
      rafId = 0;
    };

    const queuePaint = () => {
      if (!rafId) {
        rafId = requestAnimationFrame(paintMotion);
      }
    };

    const handlePointerMove = (event) => {
      pointerX = (event.clientX / window.innerWidth) * 100;
      pointerY = (event.clientY / window.innerHeight) * 100;
      queuePaint();
    };

    const handleBlur = () => {
      pointerX = 50;
      pointerY = 50;
      queuePaint();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("blur", handleBlur);

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  return null;
}
