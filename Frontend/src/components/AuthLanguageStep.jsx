"use client";

import { useEffect, useState } from "react";
import i18n from "@/lib/i18n";
import { GB, LK } from "country-flag-icons/react/3x2";

/**
 * First step on login/signup: pick English or Sinhala (persists dmews_lang + i18n).
 */
export function AuthLanguageStep({ onContinue }) {
  const [flagsReady, setFlagsReady] = useState(false);

  useEffect(() => {
    setFlagsReady(true);
  }, []);

  function selectLang(code) {
    const normalized = code === "si" ? "si" : "en";
    i18n.changeLanguage(normalized);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("dmews_lang", normalized);
    }
    onContinue?.();
  }

  return (
    <div className="flex flex-col items-stretch justify-center space-y-6 py-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-slate-950">
          Choose your language
        </h1>
        <p className="mt-1 text-sm text-slate-600">භාෂාව තෝරන්න</p>
        <p className="mt-2 text-xs text-slate-500">
          You can change this anytime in the site footer.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => selectLang("en")}
          className="flex flex-col items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-6 py-8 text-center shadow-sm transition hover:border-sky-400 hover:bg-sky-50/80 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
        >
          {flagsReady ? (
            <GB title="" className="h-10 w-16 rounded-md shadow-sm" />
          ) : (
            <span className="h-10 w-16 rounded-md bg-slate-100" aria-hidden />
          )}
          <span className="text-lg font-semibold text-slate-900">English</span>
        </button>
        <button
          type="button"
          onClick={() => selectLang("si")}
          className="flex flex-col items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-6 py-8 text-center shadow-sm transition hover:border-sky-400 hover:bg-sky-50/80 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
        >
          {flagsReady ? (
            <LK title="" className="h-10 w-16 rounded-md shadow-sm" />
          ) : (
            <span className="h-10 w-16 rounded-md bg-slate-100" aria-hidden />
          )}
          <span className="text-lg font-semibold text-slate-900">සිංහල</span>
        </button>
      </div>
    </div>
  );
}
