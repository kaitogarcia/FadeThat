"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createGame } from "./game";

export default function Emberfall() {
  const canvasRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const destroy = createGame(canvasRef.current, { onExit: () => router.push("/stuff") });
    return destroy;
  }, [router]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", width: "100vw", height: "100vh", cursor: "crosshair", background: "#0b0a10" }}
      aria-label="Emberfall game"
    />
  );
}
