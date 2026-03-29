"use client";

import { useEffect, useState } from "react";
import i18n from "@/lib/i18n";

const LANG_KEY = "dmews_lang";

export function I18nInitializer({ children }) {
  // Avoid hydration mismatch: don't render app until language is applied.
  // Server renders with default `en`, but client might load `si` from localStorage.
  // Waiting until mount ensures the first client paint matches.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(LANG_KEY);
    if (saved) {
      const next = saved === "si" ? "si" : "en";
      if (saved === "ta") {
        window.localStorage.setItem(LANG_KEY, "en");
      }
      if (next === "en" || next === "si") {
        i18n.changeLanguage(next);
      }
    }
    setReady(true);
  }, []);

  return ready ? children : null;
}

