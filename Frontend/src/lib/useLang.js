"use client";

import { useCallback, useEffect, useState } from "react";

const LANG_KEY = "dmews_lang";

function normalizeLang(v) {
  if (v === "si" || v === "en") return v;
  return "en";
}

export function useLang() {
  const [lang, setLangState] = useState("en");

  const setLang = useCallback((nextLang) => {
    const normalized = normalizeLang(nextLang);
    setLangState(normalized);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANG_KEY, normalized);
      window.dispatchEvent(
        new CustomEvent("dmews-lang-changed", { detail: normalized })
      );
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = window.localStorage.getItem(LANG_KEY);
    setLangState(normalizeLang(saved));

    function onLangChanged(e) {
      const next = e?.detail;
      if (next === "si" || next === "en") setLangState(next);
    }

    window.addEventListener("dmews-lang-changed", onLangChanged);
    window.addEventListener("storage", (e) => {
      if (e.key !== LANG_KEY) return;
      setLangState(normalizeLang(e.newValue));
    });

    return () => {
      window.removeEventListener("dmews-lang-changed", onLangChanged);
    };
  }, []);

  return { lang, setLang };
}

