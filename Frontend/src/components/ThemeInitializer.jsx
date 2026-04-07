"use client";

import { useEffect } from "react";

const STORAGE_KEY = "dmews_theme"; // "dark" | "light"

function applyTheme(theme) {
  const t = theme === "dark" ? "dark" : "light";
  document.documentElement.classList.toggle("dark", t === "dark");
  try {
    window.localStorage.setItem(STORAGE_KEY, t);
  } catch {
    // ignore
  }
}

export function ThemeInitializer() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    let stored = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }

    const prefersDark =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    const theme = stored === "dark" || stored === "light" ? stored : prefersDark ? "dark" : "light";
    applyTheme(theme);

    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY) return;
      if (e.newValue === "dark" || e.newValue === "light") {
        document.documentElement.classList.toggle("dark", e.newValue === "dark");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return null;
}

export function toggleTheme() {
  if (typeof window === "undefined") return;
  const isDark = document.documentElement.classList.contains("dark");
  applyTheme(isDark ? "light" : "dark");
}

export function getCurrentTheme() {
  if (typeof window === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

