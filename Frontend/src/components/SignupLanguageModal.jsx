"use client";

import { useEffect, useState } from "react";
import { Globe2, Sparkles } from "lucide-react";
import i18n from "@/lib/i18n";
import { GB, LK } from "country-flag-icons/react/3x2";

/**
 * Full-screen signup language picker: always shown until the user chooses.
 */
export function SignupLanguageModal({ open, onSelected }) {
  const [flagsReady, setFlagsReady] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    setFlagsReady(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function selectLang(code) {
    const normalized = code === "si" ? "si" : "en";
    i18n.changeLanguage(normalized);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("dmews_lang", normalized);
    }
    onSelected?.(normalized);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signup-lang-title"
      aria-describedby="signup-lang-desc"
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-gradient-to-br from-slate-950/85 via-sky-950/80 to-slate-900/90 backdrop-blur-md transition-opacity duration-500 ${
          entered ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden
      />

      {/* Modal card */}
      <div
        className={`relative w-full max-w-lg transform transition-all duration-500 ease-out ${
          entered ? "translate-y-0 scale-100 opacity-100" : "translate-y-6 scale-[0.97] opacity-0"
        }`}
      >
        {/* Glow ring */}
        <div className="absolute -inset-px rounded-[1.75rem] bg-gradient-to-br from-sky-400 via-cyan-300 to-emerald-400 opacity-90 blur-[1px]" />
        <div className="relative overflow-hidden rounded-3xl bg-white shadow-2xl shadow-sky-900/40 ring-1 ring-white/60">
          {/* Header band */}
          <div className="relative bg-gradient-to-r from-sky-700 via-sky-600 to-cyan-600 px-8 pb-10 pt-8 text-white">
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-4 left-1/4 h-24 w-24 rounded-full bg-cyan-300/20 blur-xl" />
            <div className="relative flex items-center justify-center gap-2">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 shadow-inner ring-1 ring-white/20">
                <Globe2 className="h-6 w-6 text-white" strokeWidth={1.75} />
              </span>
              <Sparkles className="h-5 w-5 text-amber-200/90" aria-hidden />
            </div>
            <h2
              id="signup-lang-title"
              className="relative mt-5 text-center font-oswald text-2xl font-semibold tracking-wide sm:text-3xl"
            >
              Choose your language
            </h2>
            <p className="relative mt-2 text-center text-sm font-medium text-sky-100/95">
              භාෂාව තෝරන්න
            </p>
            <p
              id="signup-lang-desc"
              className="relative mt-3 text-center text-xs leading-relaxed text-sky-100/80"
            >
              Pick how you’d like to use DisasterWatch. You can change this anytime in the footer.
            </p>
          </div>

          <div className="px-6 pb-8 pt-6 sm:px-10 sm:pb-10 sm:pt-8">
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
              <button
                type="button"
                onClick={() => selectLang("en")}
                className="group relative flex flex-col items-center gap-4 overflow-hidden rounded-2xl border-2 border-slate-200/90 bg-gradient-to-b from-white to-slate-50/90 px-5 py-7 text-center shadow-md shadow-slate-200/50 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-lg hover:shadow-sky-200/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
              >
                <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-cyan-500 to-teal-400 opacity-0 transition-opacity group-hover:opacity-100" />
                {flagsReady ? (
                  <GB
                    title=""
                    className="h-12 w-[4.5rem] rounded-lg shadow-md ring-2 ring-white transition-transform duration-200 group-hover:scale-105"
                  />
                ) : (
                  <span className="h-12 w-[4.5rem] rounded-lg bg-slate-200" aria-hidden />
                )}
                <span className="text-lg font-bold text-slate-800">English</span>
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  Continue in English
                </span>
              </button>

              <button
                type="button"
                onClick={() => selectLang("si")}
                className="group relative flex flex-col items-center gap-4 overflow-hidden rounded-2xl border-2 border-slate-200/90 bg-gradient-to-b from-white to-slate-50/90 px-5 py-7 text-center shadow-md shadow-slate-200/50 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-200/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 opacity-0 transition-opacity group-hover:opacity-100" />
                {flagsReady ? (
                  <LK
                    title=""
                    className="h-12 w-[4.5rem] rounded-lg shadow-md ring-2 ring-white transition-transform duration-200 group-hover:scale-105"
                  />
                ) : (
                  <span className="h-12 w-[4.5rem] rounded-lg bg-slate-200" aria-hidden />
                )}
                <span className="text-lg font-bold text-slate-800">සිංහල</span>
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  සිංහලෙන් ඉදිරියට
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
