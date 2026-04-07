"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  ChevronDown,
  Gauge,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  BarChart3,
  Activity,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const DISTRICTS = [
  "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya",
  "Galle", "Matara", "Hambantota", "Jaffna", "Kilinochchi", "Mannar",
  "Vavuniya", "Mullaitivu", "Batticaloa", "Ampara", "Trincomalee",
  "Kurunegala", "Puttalam", "Anuradhapura", "Polonnaruwa", "Badulla",
  "Monaragala", "Ratnapura", "Kegalle",
];

function fmtYMD(d) {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "—";
  return x.toISOString().slice(0, 10);
}

function fmtYMDHM(d) {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "—";
  // YYYY-MM-DD HH:mm (UTC)
  return x.toISOString().slice(0, 16).replace("T", " ");
}

function getWeekday(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function getHour(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(11, 16);
}

function levelTone(level) {
  if (level === "high") return "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200";
  if (level === "medium") return "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200";
  if (level === "low") return "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200";
  return "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200";
}

function confBarTone(level) {
  if (level === "high") return "from-rose-500 to-fuchsia-500";
  if (level === "medium") return "from-orange-500 to-amber-500";
  if (level === "low") return "from-amber-400 to-yellow-400";
  return "from-emerald-500 to-teal-500";
}

function riskToNumber(level) {
  if (level === "high") return 3;
  if (level === "medium") return 2;
  if (level === "low") return 1;
  return 0;
}

function ConfidenceBar({ level, confidence }) {
  const c = Number(confidence ?? 0);
  const pct = Number.isFinite(c) ? Math.max(0, Math.min(100, Math.round(c * 100))) : 0;
  return (
    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700/60">
      <div 
        className={`h-full rounded-full bg-gradient-to-r ${confBarTone(level)} transition-all duration-500 ease-out`} 
        style={{ width: `${pct}%` }} 
      />
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, subtitle }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>
        <div className={`rounded-xl ${color} p-2 text-white shadow-lg`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-gradient-to-br from-white/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  );
}

export default function RiskPredictionPage() {
  const [district, setDistrict] = useState("Colombo");
  const [windowKey, setWindowKey] = useState("7d");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${API_BASE}/risk-predictions?district=${encodeURIComponent(district)}&window=${windowKey}`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to load predictions.");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setRows([]);
      setError(e?.message || "Failed to load predictions.");
    } finally {
      setLoading(false);
    }
  }, [district, windowKey]);

  useEffect(() => {
    load();
  }, [load]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [rows]);

  const summary = useMemo(() => {
    const counts = { safe: 0, low: 0, medium: 0, high: 0 };
    let totalConfidence = 0;
    for (const r of rows) {
      if (r?.level && r.level in counts) counts[r.level] += 1;
      totalConfidence += Number(r?.confidence ?? 0);
    }
    const avgConfidence = rows.length ? (totalConfidence / rows.length) * 100 : 0;
    const highestRisk = rows.reduce((max, r) => {
      const val = riskToNumber(r?.level);
      return val > max ? val : max;
    }, 0);
    const riskLevels = ["safe", "low", "medium", "high"];
    const peakRisk = riskLevels[highestRisk] || "safe";
    return { ...counts, avgConfidence: Math.round(avgConfidence), peakRisk, totalDays: rows.length };
  }, [rows]);

  // Sparkline data for risk trend
  const riskTrendData = useMemo(() => {
    if (sortedRows.length === 0) return [];
    return sortedRows.map(r => riskToNumber(r.level));
  }, [sortedRows]);

  const sparklinePath = useMemo(() => {
    if (riskTrendData.length < 2) return "";
    const width = 100;
    const height = 40;
    const step = width / (riskTrendData.length - 1);
    const maxRisk = 3;
    const points = riskTrendData.map((val, idx) => {
      const x = idx * step;
      const y = height - (val / maxRisk) * height;
      return `${x},${y}`;
    }).join(" ");
    return points;
  }, [riskTrendData]);

  const areaPoints = useMemo(() => {
    if (riskTrendData.length < 2) return "";
    const width = 100;
    const height = 40;
    const step = width / (riskTrendData.length - 1);
    const maxRisk = 3;
    let points = riskTrendData.map((val, idx) => {
      const x = idx * step;
      const y = height - (val / maxRisk) * height;
      return `${x},${y}`;
    }).join(" ");
    points += ` ${width},${height} 0,${height}`;
    return points;
  }, [riskTrendData]);

  const weeklyDailySummary = useMemo(() => {
    if (windowKey !== "7d" || sortedRows.length === 0) return [];
    const byDay = new Map();
    for (const r of sortedRows) {
      const key = fmtYMD(r.date);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(r);
    }
    return Array.from(byDay.entries()).map(([day, items]) => {
      const counts = { safe: 0, low: 0, medium: 0, high: 0 };
      let conf = 0;
      let peak = "safe";
      for (const it of items) {
        if (it.level in counts) counts[it.level] += 1;
        conf += Number(it.confidence ?? 0);
        if (riskToNumber(it.level) > riskToNumber(peak)) peak = it.level;
      }
      const avgConfidence = items.length ? Math.round((conf / items.length) * 100) : 0;
      return {
        day,
        weekday: getWeekday(day),
        peak,
        avgConfidence,
        counts,
        samples: items.length,
      };
    });
  }, [sortedRows, windowKey]);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-sky-200/20 blur-3xl dark:bg-sky-900/20" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-amber-200/20 blur-3xl dark:bg-amber-900/20" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm backdrop-blur-sm transition-all hover:bg-white hover:text-sky-600 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-sky-400"
          >
            ← Back to dashboard
          </Link>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full bg-white/70 px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition-all hover:bg-white hover:shadow-md disabled:opacity-50 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh Forecast
          </button>
        </div>

        {/* Main hero card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-sky-600 to-indigo-600 p-6 text-white shadow-xl mb-8">
          <div className="absolute right-0 top-0 -mr-16 -mt-16 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
          <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-yellow-200" />
                <h1 className="font-oswald text-3xl font-bold tracking-tight">Risk Prediction Engine</h1>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-sky-100">
                AI-powered flood & disaster risk forecasts using ensemble models. Confidence scores indicate prediction reliability.
              </p>
            </div>
            <div className="rounded-2xl bg-white/20 px-4 py-2 backdrop-blur-sm">
              <div className="text-xs font-medium uppercase tracking-wider">Live Demo</div>
              <div className="text-lg font-bold">{district}</div>
            </div>
          </div>
        </div>

        {/* Two column layout */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column - Controls & Stats */}
          <div className="space-y-6">
            {/* Controls card */}
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-lg backdrop-blur-sm transition-all dark:border-slate-800 dark:bg-slate-900/80">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <Gauge className="h-4 w-4 text-sky-500" />
                Forecast Controls
              </h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <MapPin className="mr-1 inline h-3 w-3" /> District
                  </label>
                  <div className="relative mt-1">
                    <select
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-10 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100"
                    >
                      {DISTRICTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <Calendar className="mr-1 inline h-3 w-3" /> Forecast Horizon
                  </label>
                  <div className="relative mt-1">
                    <select
                      value={windowKey}
                      onChange={(e) => setWindowKey(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-10 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100"
                    >
                      <option value="6h">Upcoming 6 hours</option>
                      <option value="1d">Upcoming day</option>
                      <option value="7d">Upcoming week</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard 
                title="Safe Days" 
                value={summary.safe} 
                icon={CheckCircle} 
                color="bg-emerald-500"
                subtitle="No risk expected"
              />
              <StatCard 
                title="High Risk" 
                value={summary.high} 
                icon={AlertTriangle} 
                color="bg-rose-500"
                subtitle="Urgent attention"
              />
              <StatCard 
                title="Avg Confidence" 
                value={`${summary.avgConfidence}%`} 
                icon={Activity} 
                color="bg-sky-500"
                subtitle="Model certainty"
              />
              <StatCard 
                title="Peak Risk" 
                value={summary.peakRisk.toUpperCase()} 
                icon={TrendingUp} 
                color="bg-amber-500"
                subtitle="Maximum level"
              />
            </div>

            {/* Risk Trend Sparkline */}
            {sortedRows.length > 0 && !loading && (
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-lg backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Risk Trend</h3>
                  <span className="flex gap-1 text-[10px]">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Safe
                    <span className="ml-1 h-2 w-2 rounded-full bg-amber-400" /> Low
                    <span className="ml-1 h-2 w-2 rounded-full bg-orange-500" /> Med
                    <span className="ml-1 h-2 w-2 rounded-full bg-rose-500" /> High
                  </span>
                </div>
                <div className="mt-2">
                  <svg viewBox="0 0 100 40" className="h-20 w-full">
                    <defs>
                      <linearGradient id="riskGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.6" />
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {areaPoints && (
                      <polygon points={areaPoints} fill="url(#riskGradient)" className="transition-all duration-500" />
                    )}
                    {sparklinePath && (
                      <polyline points={sparklinePath} fill="none" stroke="#f43f5e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    )}
                  </svg>
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                  <span>Now</span>
                  <span>{windowKey === "6h" ? "6h ahead" : windowKey === "1d" ? "1 day ahead" : "1 week ahead"}</span>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-lg backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <HelpCircle className="h-4 w-4 text-sky-500" />
                How to interpret
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Risk levels combine weather patterns, historical data, and real-time sensors. <br />
                <span className="font-medium">High confidence</span> = multiple models agree.
              </p>
            </div>
          </div>

          {/* Right column - Timeline table */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-slate-200 bg-white/80 shadow-lg backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80 overflow-hidden">
              <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <BarChart3 className="h-4 w-4 text-sky-500" />
                    Detailed Forecast Timeline
                  </h2>
                  <span className="text-xs text-slate-500">
                    {windowKey === "6h" ? "Upcoming 6 hours" : windowKey === "1d" ? "Upcoming day" : "Upcoming week"}
                  </span>
                </div>
              </div>

              {error ? (
                <div className="m-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                  <ShieldAlert className="mb-2 inline-block h-5 w-5" /> {error}
                </div>
              ) : null}

              {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="h-10 w-10 animate-spin text-sky-500" />
                  <p className="mt-3 text-sm text-slate-500">Fetching latest predictions...</p>
                </div>
              ) : sortedRows.length === 0 ? (
                <div className="m-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/30">
                  No predictions available. Run the seed script on the backend.
                </div>
              ) : windowKey === "7d" ? (
                <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                  {weeklyDailySummary.map((d) => (
                    <article
                      key={d.day}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-100">{d.day}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{d.weekday}</p>
                        </div>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${levelTone(d.peak)}`}>
                          Peak {String(d.peak).toUpperCase()}
                        </span>
                      </div>

                      <div className="mt-3">
                        <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          <span>Avg confidence</span>
                          <span>{d.avgConfidence}%</span>
                        </div>
                        <ConfidenceBar level={d.peak} confidence={d.avgConfidence / 100} />
                      </div>

                      <div className="mt-3 grid grid-cols-4 gap-1.5 text-[10px]">
                        <span className="rounded bg-emerald-100 px-1.5 py-1 text-center font-semibold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200">
                          S {d.counts.safe}
                        </span>
                        <span className="rounded bg-amber-100 px-1.5 py-1 text-center font-semibold text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
                          L {d.counts.low}
                        </span>
                        <span className="rounded bg-orange-100 px-1.5 py-1 text-center font-semibold text-orange-800 dark:bg-orange-500/20 dark:text-orange-200">
                          M {d.counts.medium}
                        </span>
                        <span className="rounded bg-rose-100 px-1.5 py-1 text-center font-semibold text-rose-800 dark:bg-rose-500/20 dark:text-rose-200">
                          H {d.counts.high}
                        </span>
                      </div>
                      <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
                        {d.samples} hourly samples
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                      <tr>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Risk Level</th>
                        <th className="px-6 py-4">Confidence</th>
                        <th className="px-6 py-4">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {sortedRows.map((r, idx) => (
                        <tr 
                          key={r.id} 
                          className="transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-slate-950/40 group"
                          style={{ animationDelay: `${idx * 20}ms` }}
                        >
                          <td className="px-6 py-4">
                            <div className="font-mono text-xs font-medium text-slate-700 dark:text-slate-200">
                              {fmtYMDHM(r.date)}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {getWeekday(r.date)} · {getHour(r.date)}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold shadow-sm ${levelTone(r.level)}`}>
                              {String(r.level || "safe").toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 w-40">
                            <div className="flex items-center justify-between text-xs font-semibold">
                              <span>{Math.round((Number(r.confidence ?? 0) || 0) * 100)}%</span>
                              <span className="text-[10px] text-slate-400">confidence</span>
                            </div>
                            <ConfidenceBar level={r.level} confidence={r.confidence} />
                          </td>
                          <td className="px-6 py-4 text-xs">
                            <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {r.source || "ensemble"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}