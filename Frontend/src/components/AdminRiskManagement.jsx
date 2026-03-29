"use client";

import { useEffect, useState } from "react";
import Loader from "@/components/Loader";
import { RiskMap } from "@/components/RiskMap";
import Image from "next/image";
import { Droplets, ChevronDown, ChevronUp, MapPin, ImageIcon } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const LEVELS = [
  { value: "safe", label: "Safe", color: "bg-emerald-500/20 text-emerald-800 border-emerald-500/50" },
  { value: "low", label: "Low", color: "bg-yellow-300/30 text-yellow-900 border-yellow-400/60" },
  { value: "medium", label: "Medium", color: "bg-orange-400/25 text-orange-900 border-orange-500/60" },
  { value: "high", label: "High", color: "bg-red-500/25 text-red-50 border-red-500/60" },
];

const INITIAL_VISIBLE = 8;

function formatDateLabel(isoDate) {
  if (!isoDate || typeof isoDate !== "string") return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function formatDayLabel(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function AdminRiskManagement() {
  const [districts, setDistricts] = useState([]);
  const [levels, setLevels] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingDistrict, setSavingDistrict] = useState(null);
  const [pending, setPending] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [meteoMapUrl, setMeteoMapUrl] = useState(null);
  const [meteoMapLoading, setMeteoMapLoading] = useState(true);
  const [meteoMapNote, setMeteoMapNote] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMeteoMapLoading(true);
      setMeteoMapNote(null);
      try {
        const res = await fetch(`${API_BASE}/public-forecast/meteo-sl-map`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data?.url) {
          setMeteoMapUrl(data.url);
          if (data.message) setMeteoMapNote(data.message);
        }
      } catch {
        if (!cancelled) {
          setMeteoMapUrl("https://meteo.gov.lk/images/SLMap.jpg");
          setMeteoMapNote("Could not reach API; showing default map URL.");
        }
      } finally {
        if (!cancelled) setMeteoMapLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [weatherRes, riskRes] = await Promise.all([
          fetch(`${API_BASE}/weather/districts`),
          fetch(`${API_BASE}/risk-levels`),
        ]);
        const weatherData = await weatherRes.json();
        const riskData = await riskRes.json();
        if (!weatherRes.ok) {
          setError(weatherData?.message || "Failed to load weather.");
          setLoading(false);
          return;
        }
        if (!riskRes.ok) {
          setError(riskData?.message || "Failed to load risk levels.");
          setLoading(false);
          return;
        }
        if (cancelled) return;
        setDistricts(Array.isArray(weatherData) ? weatherData : []);
        const map = {};
        (riskData || []).forEach((item) => {
          if (item?.district && item?.level) map[item.district] = item.level;
        });
        setLevels(map);
      } catch (e) {
        if (!cancelled) setError(e?.message || "Failed to load data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function performSave(district, level) {
    try {
      setSavingDistrict(district);
      setError(null);
      const res = await fetch(`${API_BASE}/risk-levels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ district, level }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || "Failed to update risk level.");
        setSavingDistrict(null);
        return;
      }
      setLevels((prev) => ({ ...prev, [district]: data.level }));
      setSavingDistrict(null);
      setPending(null);
      try {
        window.dispatchEvent(new Event("dmews-risk-changed"));
      } catch {}
    } catch {
      setError("Network error.");
      setSavingDistrict(null);
    }
  }

  function saveLevel(district, level) {
    const human = level === "high" ? "High" : level === "medium" ? "Medium" : level === "low" ? "Low" : "Safe";
    setPending({ district, level, human });
  }

  const firstWithTimes = districts.find(
    (d) => Array.isArray(d?.daily?.time_last3days) && d.daily.time_last3days.length >= 3
  );
  const timeLabels = firstWithTimes?.daily?.time_last3days?.map(formatDateLabel) || [
    formatDayLabel(-2),
    formatDayLabel(-1),
    formatDayLabel(0),
  ];
  const dayLabels = [timeLabels[0] ?? "2d ago", timeLabels[1] ?? "Yesterday", timeLabels[2] ?? "Today"];

  const visibleDistricts = showAll ? districts : districts.slice(0, INITIAL_VISIBLE);
  const hasMore = districts.length > INITIAL_VISIBLE;
  const hiddenCount = districts.length - INITIAL_VISIBLE;

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-slate-200/80 bg-white/80 shadow-sm">
        <Loader />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Risk map + Met Dept. SL map (URL from Firecrawl scrape of meteo.gov.lk) */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
            <MapPin className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-800">Risk map</h2>
            <p className="text-xs text-slate-500">District colours = current risk levels</p>
          </div>
          <div className="min-h-[280px]">
            <RiskMap />
          </div>
        </section>

        <section className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-sky-50/80 px-4 py-3">
            <ImageIcon className="h-4 w-4 text-sky-600" />
            <h2 className="text-sm font-semibold text-slate-800">
              Sri Lanka map (Meteorology)
            </h2>
            <p className="text-xs text-slate-500">
              Image link resolved via Firecrawl from{" "}
              <span className="font-medium text-sky-800">meteo.gov.lk</span>
              {!meteoMapLoading && meteoMapUrl?.includes("SLMap.jpg") ? (
                <span className="text-slate-400"> · 24h map (SLMap.jpg)</span>
              ) : null}
            </p>
          </div>
          <div className="flex min-h-[280px] flex-1 items-center justify-center bg-slate-100/80 p-3">
            {meteoMapLoading || !meteoMapUrl ? (
              <Loader />
            ) : (
              <div className="relative aspect-[4/3] w-full max-w-xl">
                <Image
                  src={meteoMapUrl}
                  alt="Sri Lanka map — Department of Meteorology"
                  fill
                  className="object-contain object-center"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  unoptimized
                />
              </div>
            )}
          </div>
          {meteoMapNote && (
            <p className="border-t border-slate-100 bg-amber-50/60 px-4 py-2 text-[11px] text-amber-900/90">
              {meteoMapNote}
            </p>
          )}
        </section>
      </div>

      {/* Combined table */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
          <Droplets className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">Districts · rainfall & risk</h2>
          <p className="text-xs text-slate-500">Last 3 days rain (mm). Update risk level per row.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60">
                <th className="py-3 pl-4 pr-2 font-semibold text-slate-700">District</th>
                <th className="py-3 px-2 font-medium text-slate-600">{dayLabels[0]}</th>
                <th className="py-3 px-2 font-medium text-slate-600">{dayLabels[1]}</th>
                <th className="py-3 px-2 font-medium text-slate-600">{dayLabels[2]}</th>
                <th className="py-3 pl-2 pr-4 font-semibold text-slate-700">Risk level</th>
              </tr>
            </thead>
            <tbody>
              {visibleDistricts.map((d) => {
                const name = d?.name ?? "—";
                const rain = d?.daily?.precipitation_sum_last3days;
                const r0 = Array.isArray(rain) ? rain[0] : null;
                const r1 = Array.isArray(rain) ? rain[1] : null;
                const r2 = Array.isArray(rain) ? rain[2] : null;
                const current = levels[name] || "safe";
                return (
                  <tr
                    key={name}
                    className="border-b border-slate-100 transition hover:bg-amber-50/40"
                  >
                    <td className="py-2.5 pl-4 pr-2 font-medium text-slate-800">{name}</td>
                    <td className="py-2.5 px-2 text-slate-600 tabular-nums">
                      {typeof r0 === "number" ? `${r0.toFixed(1)}` : "—"}
                    </td>
                    <td className="py-2.5 px-2 text-slate-600 tabular-nums">
                      {typeof r1 === "number" ? `${r1.toFixed(1)}` : "—"}
                    </td>
                    <td className="py-2.5 px-2 text-slate-600 tabular-nums">
                      {typeof r2 === "number" ? `${r2.toFixed(1)}` : "—"}
                    </td>
                    <td className="py-2 pl-2 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {LEVELS.map((lvl) => {
                          const active = current === lvl.value;
                          return (
                            <button
                              key={lvl.value}
                              type="button"
                              onClick={() => saveLevel(name, lvl.value)}
                              disabled={savingDistrict === name}
                              className={`rounded-full border px-2 py-0.5 text-xs font-medium transition ${
                                active
                                  ? lvl.color
                                  : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-slate-100"
                              }`}
                            >
                              {lvl.label}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {hasMore && (
          <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3">
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-800"
            >
              {showAll ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  See more ({hiddenCount} districts)
                </>
              )}
            </button>
          </div>
        )}
      </section>

      {/* Confirm modal */}
      {pending && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-900">Confirm risk level</h3>
            <p className="mt-2 text-sm text-slate-600">
              Set <span className="font-semibold text-slate-900">{pending.district}</span> to{" "}
              <span className="font-semibold text-amber-700">{pending.human}</span>? High risk may trigger SMS alerts.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingDistrict === pending.district}
                onClick={() => performSave(pending.district, pending.level)}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-70"
              >
                {savingDistrict === pending.district && <Loader size="sm" />}
                {savingDistrict === pending.district ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
