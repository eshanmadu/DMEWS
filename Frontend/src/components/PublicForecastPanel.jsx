"use client";

import { useEffect, useState } from "react";
import Loader from "@/components/Loader";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function PublicForecastPanel() {
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeLang, setActiveLang] = useState("en"); // "en" | "si" | "ta"

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`${API_BASE}/public-forecast`);
        if (!res.ok) {
          throw new Error("Failed to load public forecast.");
        }
        const data = await res.json();
        if (!cancelled) {
          setRawText(data.text || "");
        }
      } catch (err) {
        console.error("Failed to load public forecast", err);
        if (!cancelled) {
          setError("Unable to load public weather forecast right now.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  function getLanguageChunks() {
    const text = rawText || "";
    if (!text) {
      return { si: "", en: "", ta: "" };
    }

    /** English block start (meteo.gov.lk uses this heading; casing may vary in markdown). */
    const enMatch = text.match(/WEATHER FORECAST FOR/i);
    const enIdx = enMatch ? enMatch.index : -1;

    /**
     * Start of Tamil block after the English heading. Meteo.gov.lk uses lines like
     * "2026 மார்ச் 29ஆம் …" — the line begins with ASCII digits, then Tamil script.
     * Splitting at the first Tamil *letter* leaves "2026 " on the English tab; matching
     * "newline(s) + optional year + Tamil" keeps the English tab free of Tamil lines.
     */
    function findTamilBlockStart(str, fromIdx) {
      const rest = str.slice(fromIdx);

      const yearTamilLine = /(?:^|[\n\r])\s*(\d{4}\s+[\u0B80-\u0BFF])/g;
      let best = -1;
      for (const m of rest.matchAll(yearTamilLine)) {
        const g = m[1];
        const lineStart = fromIdx + m.index + m[0].indexOf(g);
        if (best === -1 || lineStart < best) best = lineStart;
      }
      if (best !== -1) return best;

      const paraBreak = rest.match(/\n\s*\n\s*[\u0B80-\u0BFF]/);
      if (paraBreak) {
        const rel = paraBreak[0].search(/[\u0B80-\u0BFF]/);
        return fromIdx + paraBreak.index + rel;
      }
      const rel = rest.search(/[\u0B80-\u0BFF]/);
      return rel === -1 ? -1 : fromIdx + rel;
    }

    if (enIdx === -1) {
      return { si: text, en: text, ta: "" };
    }

    const taIdx = findTamilBlockStart(text, enIdx);
    const si = text.slice(0, enIdx).trim();
    const en =
      taIdx === -1 ? text.slice(enIdx).trim() : text.slice(enIdx, taIdx).trim();
    const ta = taIdx === -1 ? "" : text.slice(taIdx).trim();

    return { si, en, ta };
  }

  const chunks = getLanguageChunks();
  const currentText =
    activeLang === "si" ? chunks.si : activeLang === "en" ? chunks.en : chunks.ta;

  const title =
    activeLang === "si"
      ? "දෛනික කාලගුණ අනාවැකිය"
      : activeLang === "ta"
        ? "தினசரி வானிலை முன்னறிவிப்பு"
        : "Daily weather forecast";
  const subtitle =
    activeLang === "si"
      ? "ශ්‍රී ලංකා කාලගුණ දෙපාර්තමේන්තුවෙන් (සිංහල, ඉංග්‍රීසි සහ දෙමළ) — Firecrawl හරහා."
      : activeLang === "ta"
        ? "இலங்கை வானிலைத் துறை (සිංහල, English & Tamil) — Firecrawl வழியாக பெறப்பட்ட உரை."
        : "Text from Department of Meteorology Sri Lanka via Firecrawl (Sinhala, English & Tamil).";

  return (
    <section className="card flex h-full flex-col gap-2 p-4">
      <div className="mb-1">
        <h2 className="text-sm font-semibold text-slate-950">
          {title}
        </h2>
        <p className="text-[11px] text-slate-500">
          {subtitle}
        </p>
      </div>

      {loading && (
        <div className="flex flex-1 items-center justify-center py-6">
          <Loader size="sm" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="mb-1 inline-flex rounded-full bg-slate-100 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setActiveLang("si")}
              className={`rounded-full px-2 py-1 ${
                activeLang === "si"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              සිංහල
            </button>
            <button
              type="button"
              onClick={() => setActiveLang("en")}
              className={`rounded-full px-2 py-1 ${
                activeLang === "en"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setActiveLang("ta")}
              className={`rounded-full px-2 py-1 ${
                activeLang === "ta"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              தமிழ்
            </button>
          </div>

          <div className="mt-1 flex-1 overflow-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-800 whitespace-pre-wrap">
            {currentText ||
              (activeLang === "si"
                ? "අනාවැකි පෙළ ලබාගත නොහැක."
                : activeLang === "ta"
                  ? "முன்னறிவிப்பு உரை கிடைக்கவில்லை."
                  : "No forecast text available.")}
          </div>
        </>
      )}
    </section>
  );
}

