"use client";

import { useEffect, useState } from "react";
import Loader from "@/components/Loader";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function formatDayLabel(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function formatDateLabel(isoDate) {
  if (!isoDate || typeof isoDate !== "string") return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function AdminRainfallTable() {
  const [districts, setDistricts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/weather/districts`);
        const data = await res.json();
        if (!res.ok) {
          setError(data?.message || "Failed to load rainfall data.");
          setLoading(false);
          return;
        }
        if (!cancelled) {
          setDistricts(Array.isArray(data) ? data : []);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || "Failed to load rainfall data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <section className="card p-4">
        <h2 className="text-sm font-semibold text-slate-950 mb-2">
          Rainfall (last 3 days)
        </h2>
        <div className="flex items-center justify-center py-8">
          <Loader />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="card p-4">
        <h2 className="text-sm font-semibold text-slate-950 mb-2">
          Rainfall (last 3 days)
        </h2>
        <p className="text-sm text-red-600">{error}</p>
      </section>
    );
  }

  // Last 3 days: 2 days ago, yesterday, today (from API or fallback labels)
  const firstWithTimes = districts.find((d) => Array.isArray(d?.daily?.time_last3days) && d.daily.time_last3days.length >= 3);
  const timeLabels = firstWithTimes?.daily?.time_last3days?.map(formatDateLabel) || [
    formatDayLabel(-2),
    formatDayLabel(-1),
    formatDayLabel(0),
  ];
  const dayLabels = [timeLabels[0] ?? "2 days ago", timeLabels[1] ?? "Yesterday", timeLabels[2] ?? "Today"];

  return (
    <section className="card overflow-hidden p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-950">
          Rainfall (last 3 days)
        </h2>
        <p className="text-[11px] text-slate-500">
          Use this to inform risk level updates. Values in mm.
        </p>
      </div>
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full min-w-[420px] text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="py-2 pr-4 font-medium text-slate-700">District</th>
              <th className="py-2 px-2 font-medium text-slate-700">{dayLabels[0]}</th>
              <th className="py-2 px-2 font-medium text-slate-700">{dayLabels[1]}</th>
              <th className="py-2 px-2 font-medium text-slate-700">{dayLabels[2]}</th>
            </tr>
          </thead>
          <tbody>
            {districts.map((d) => {
              const rain = d?.daily?.precipitation_sum_last3days;
              const r0 = Array.isArray(rain) ? rain[0] : null;
              const r1 = Array.isArray(rain) ? rain[1] : null;
              const r2 = Array.isArray(rain) ? rain[2] : null;
              const name = d?.name ?? "—";
              return (
                <tr key={name} className="border-b border-slate-100 hover:bg-slate-50/80">
                  <td className="py-2 pr-4 font-medium text-slate-800">{name}</td>
                  <td className="py-2 px-2 text-slate-600">
                    {typeof r0 === "number" ? `${r0.toFixed(1)} mm` : "—"}
                  </td>
                  <td className="py-2 px-2 text-slate-600">
                    {typeof r1 === "number" ? `${r1.toFixed(1)} mm` : "—"}
                  </td>
                  <td className="py-2 px-2 text-slate-600">
                    {typeof r2 === "number" ? `${r2.toFixed(1)} mm` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
