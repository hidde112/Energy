"use client";

import { useEffect, type PropsWithChildren } from "react";

export function ThemeProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    const storedTheme = window.localStorage.getItem("energydex-theme");
    const theme = storedTheme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
  }, []);

  return children;
}
