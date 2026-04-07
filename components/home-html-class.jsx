"use client";

import { useEffect } from "react";

export default function HomeHtmlClass() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("infinite");

    return () => {
      root.classList.remove("infinite");
    };
  }, []);

  return null;
}
