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
  PieChart as PieChartIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

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

const LEVEL_COLORS = {
  safe: "#10b981",
  low: "#fbbf24",
  medium: "#f97316",
  high: "#e11d48",
};

const SOURCE_PALETTE = [
  "#0ea5e9",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f59e0b",
  "#64748b",
];

function ChartCard({ title, subtitle, icon: Icon, children, emptyHint, chartHeightClass = "h-[280px]", className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-lg backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80 ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {Icon ? <Icon className="h-3.5 w-3.5 text-sky-500" /> : null}
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <div className={`relative mt-3 w-full min-h-[200px] ${chartHeightClass}`}>
        {emptyHint ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/80 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
            {emptyHint}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

const axisStroke = "#94a3b8";

function ForecastDataTable({ rows }) {
  return (
    <table className="w-full min-w-[280px] text-left text-sm">
      <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
        <tr>
          <th className="px-3 py-3">Date</th>
          <th className="px-3 py-3">Risk</th>
          <th className="px-3 py-3">Confidence</th>
          <th className="px-3 py-3">Source</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((r, idx) => (
          <tr
            key={r.id}
            className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-950/40"
            style={{ animationDelay: `${idx * 15}ms` }}
          >
            <td className="px-3 py-3">
              <div className="font-mono text-[11px] font-medium text-slate-700 dark:text-slate-200">
                {fmtYMDHM(r.date)}
              </div>
              <div className="text-[10px] text-slate-400">
                {getWeekday(r.date)} · {getHour(r.date)}
              </div>
            </td>
            <td className="px-3 py-3">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm ${levelTone(r.level)}`}>
                {String(r.level || "safe").toUpperCase()}
              </span>
            </td>
            <td className="px-3 py-3 w-36">
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span>{Math.round((Number(r.confidence ?? 0) || 0) * 100)}%</span>
              </div>
              <ConfidenceBar level={r.level} confidence={r.confidence} />
            </td>
            <td className="px-3 py-3 text-[11px]">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {r.source || "ensemble"}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RiskTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg dark:border-slate-600 dark:bg-slate-900/95">
      {p.at ? (
        <p className="font-mono font-semibold text-slate-800 dark:text-slate-100">{p.at}</p>
      ) : null}
      <p className="mt-1 text-rose-600 dark:text-rose-400">
        Risk index: <span className="font-bold">{p.risk}</span>{" "}
        <span className="text-slate-500 dark:text-slate-400">(0–3)</span>
      </p>
      <p className="text-sky-600 dark:text-sky-400">
        Confidence: <span className="font-bold">{p.confidence}%</span>
      </p>
      {p.levelLabel ? (
        <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">
          Level: {p.levelLabel}
        </p>
      ) : null}
    </div>
  );
}

function DistributionTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg dark:border-slate-600 dark:bg-slate-900/95">
      <span className="font-semibold text-slate-800 dark:text-slate-100">{item.name}</span>
      <span className="ml-2 text-slate-600 dark:text-slate-300">{item.value} slots</span>
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
  const [timelineExpanded, setTimelineExpanded] = useState(false);

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

  useEffect(() => {
    setTimelineExpanded(false);
  }, [district, windowKey]);

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

  const dominantMixLevel = useMemo(() => {
    const pairs = [
      ["safe", summary.safe],
      ["low", summary.low],
      ["medium", summary.medium],
      ["high", summary.high],
    ];
    pairs.sort((a, b) => b[1] - a[1]);
    return pairs[0]?.[0] || "safe";
  }, [summary]);

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

  const lineComposedData = useMemo(() => {
    return sortedRows.map((r, idx) => ({
      idx: idx + 1,
      shortLabel:
        sortedRows.length > 32
          ? String(idx + 1)
          : `${getHour(r.date)}`,
      at: fmtYMDHM(r.date),
      risk: riskToNumber(r.level),
      confidence: Math.round((Number(r.confidence) || 0) * 100),
      levelLabel: String(r.level || "safe").toUpperCase(),
    }));
  }, [sortedRows]);

  const distributionPieData = useMemo(() => {
    const d = [
      { name: "Safe", value: summary.safe, fill: LEVEL_COLORS.safe },
      { name: "Low", value: summary.low, fill: LEVEL_COLORS.low },
      { name: "Medium", value: summary.medium, fill: LEVEL_COLORS.medium },
      { name: "High", value: summary.high, fill: LEVEL_COLORS.high },
    ];
    return d.filter((x) => x.value > 0);
  }, [summary]);

  const sourceBarData = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      const s = (r.source && String(r.source).trim()) || "ensemble";
      m.set(s, (m.get(s) || 0) + 1);
    }
    return Array.from(m.entries())
      .map(([name, count]) => ({
        name: name.length > 18 ? `${name.slice(0, 16)}…` : name,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [rows]);

  const dailyPeakBarData = useMemo(() => {
    if (sortedRows.length === 0) return [];
    const byDay = new Map();
    for (const r of sortedRows) {
      const key = fmtYMD(r.date);
      const val = riskToNumber(r.level);
      const prev = byDay.get(key);
      if (!prev || val > prev.peak) {
        const wd = getWeekday(key);
        byDay.set(key, {
          day: key,
          label: key.slice(5),
          tickLabel: wd ? `${wd} ${key.slice(5)}` : key.slice(5),
          weekday: wd,
          peak: val,
          peakLevel: String(r.level || "safe").toUpperCase(),
        });
      }
    }
    return Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day));
  }, [sortedRows]);

  const confidenceBandData = useMemo(() => {
    return sortedRows.map((r, idx) => ({
      slot: sortedRows.length > 24 ? `#${idx + 1}` : getHour(r.date),
      confidence: Math.round((Number(r.confidence) || 0) * 100),
      fill:
        r.level === "high"
          ? LEVEL_COLORS.high
          : r.level === "medium"
            ? LEVEL_COLORS.medium
            : r.level === "low"
              ? LEVEL_COLORS.low
              : LEVEL_COLORS.safe,
    }));
  }, [sortedRows]);

  const xAxisDense =
    lineComposedData.length > 16
      ? {
          angle: -40,
          textAnchor: "end",
          height: 52,
          interval: Math.max(0, Math.floor(lineComposedData.length / 7) - 1),
        }
      : {
          angle: 0,
          textAnchor: "middle",
          height: 28,
          interval: 0,
        };

  const timelinePreviewLimit = windowKey === "7d" ? 6 : 10;
  const timelineTotalItems = windowKey === "7d" ? weeklyDailySummary.length : sortedRows.length;
  const timelineHiddenCount = Math.max(0, timelineTotalItems - timelinePreviewLimit);
  const visibleWeeklyCards = timelineExpanded
    ? weeklyDailySummary
    : weeklyDailySummary.slice(0, timelinePreviewLimit);
  const visibleTableRows = timelineExpanded
    ? sortedRows
    : sortedRows.slice(0, timelinePreviewLimit);

  const timelineTableHalves = useMemo(() => {
    const r = visibleTableRows;
    const mid = Math.ceil(r.length / 2);
    return [r.slice(0, mid), r.slice(mid)];
  }, [visibleTableRows]);

  const composedChartBottomMargin = xAxisDense.angle ? xAxisDense.height + 16 : 40;
  const confidenceChartBottomMargin = confidenceBandData.length > 14 ? 56 : 40;

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-sky-200/20 blur-3xl dark:bg-sky-900/20" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-amber-200/20 blur-3xl dark:bg-amber-900/20" />
      </div>

      <div className="relative mx-auto w-full max-w-[min(100%,88rem)] px-4 py-6 sm:px-6 lg:px-8">
        {/* Header bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm backdrop-blur-sm transition-all hover:bg-white hover:text-sky-600 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-sky-400"
          >
            ← Admin dashboard
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
              <div className="text-xs font-medium uppercase tracking-wider">District</div>
              <div className="text-lg font-bold">{district}</div>
            </div>
          </div>
        </div>

        <div className="mb-8 rounded-2xl border border-indigo-200/80 bg-indigo-50/90 p-4 shadow-sm dark:border-indigo-900/50 dark:bg-indigo-950/40">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-900 dark:text-indigo-200">
            Power BI and REST
          </p>
          <p className="mt-1 text-xs text-indigo-800/90 dark:text-indigo-300/90">
            Each URL returns exactly 25 rows (one per district): peak risk within the time window; if levels tie, the latest hour is used.
          </p>
          <ul className="mt-3 space-y-1.5 font-mono text-[11px] text-slate-800 break-all dark:text-slate-200">
            <li>{`GET ${API_BASE}/api/predict?range=6h`}</li>
            <li>{`GET ${API_BASE}/api/predict?range=24h`}</li>
            <li>{`GET ${API_BASE}/api/predict?range=7d`}</li>
          </ul>
        </div>

        <div className="space-y-10">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-md backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <Gauge className="h-4 w-4 text-sky-500" />
                  Forecast scope
                </h2>
                <div className="mt-3 flex flex-wrap gap-3">
                  <div className="min-w-[140px] flex-1 sm:max-w-xs">
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
                  <div className="min-w-[140px] flex-1 sm:max-w-xs">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <Calendar className="mr-1 inline h-3 w-3" /> Forecast horizon
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
              {!loading && sortedRows.length > 0 ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-2 text-[11px] dark:border-slate-800 dark:bg-slate-950/50">
                  <span className="text-slate-500 dark:text-slate-400">Samples</span>
                  <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{sortedRows.length}</span>
                  <span className="hidden text-slate-300 sm:inline dark:text-slate-600" aria-hidden>|</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{fmtYMDHM(sortedRows[0]?.date)}</span>
                  <span className="text-slate-400">→</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{fmtYMDHM(sortedRows[sortedRows.length - 1]?.date)}</span>
                  <span className="hidden text-slate-300 sm:inline dark:text-slate-600" aria-hidden>|</span>
                  <span className="text-slate-500 dark:text-slate-400">Common</span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${levelTone(dominantMixLevel)}`}>
                    {String(dominantMixLevel).toUpperCase()}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
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
          </div>

          {!loading && sortedRows.length > 0 ? (
            <section aria-labelledby="viz-heading" className="space-y-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2
                    id="viz-heading"
                    className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100"
                  >
                    <PieChartIcon className="h-4 w-4 text-sky-500" />
                    Forecast visualizations
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Risk trend and main series share one row (30% / 70%). More charts follow below.
                  </p>
                </div>
              </div>

              <div className="grid min-w-0 grid-cols-[minmax(0,3fr)_minmax(0,7fr)] items-stretch gap-3">
                <div className="flex min-h-[140px] min-w-0 flex-col justify-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-2 py-2 shadow-md backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80 sm:min-h-[180px] sm:px-3 sm:py-3">
                  <div className="flex min-w-0 items-center gap-x-1.5 overflow-x-auto whitespace-nowrap text-[8px] text-slate-600 dark:text-slate-400 sm:text-[9px]">
                    <span className="shrink-0 font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Risk Trend
                    </span>
                    <span className="shrink-0 text-slate-300 dark:text-slate-600" aria-hidden>
                      ·
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /> S
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" /> L
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" /> M
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" /> H
                    </span>
                  </div>
                  <div className="flex min-h-0 min-w-0 flex-1 items-center gap-1">
                    <span className="w-5 shrink-0 text-[7px] leading-none text-slate-400 sm:w-6 sm:text-[8px] dark:text-slate-500">
                      Now
                    </span>
                    <svg
                      viewBox="0 0 100 40"
                      className="h-11 min-h-[44px] w-0 min-w-0 flex-1 sm:h-14 sm:min-h-[52px]"
                      aria-hidden
                    >
                      <defs>
                        <linearGradient id="riskGradientSpark" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.55" />
                          <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {areaPoints ? (
                        <polygon points={areaPoints} fill="url(#riskGradientSpark)" className="transition-all duration-500" />
                      ) : null}
                      {sparklinePath ? (
                        <polyline
                          points={sparklinePath}
                          fill="none"
                          stroke="#f43f5e"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ) : null}
                    </svg>
                    <span className="w-7 shrink-0 text-right text-[7px] leading-none text-slate-400 sm:w-8 sm:text-[8px] dark:text-slate-500">
                      {windowKey === "6h" ? "6h" : windowKey === "1d" ? "1d" : "1wk"}
                    </span>
                  </div>
                </div>

                <ChartCard
                  className="min-h-0 min-w-0"
                  title="Risk & confidence over time"
                  subtitle="Left: risk 0–3 · Right: confidence %"
                  icon={Activity}
                  chartHeightClass="h-[200px] sm:h-[220px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={lineComposedData}
                      margin={{
                        top: 8,
                        right: 18,
                        left: 4,
                        bottom: composedChartBottomMargin,
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e2e8f0"
                        className="dark:stroke-slate-700"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="shortLabel"
                        tick={{ fontSize: 9, fill: "#64748b" }}
                        axisLine={{ stroke: axisStroke }}
                        tickLine={{ stroke: axisStroke }}
                        {...xAxisDense}
                      />
                      <YAxis
                        yAxisId="risk"
                        domain={[0, 3]}
                        tick={{ fontSize: 10, fill: "#64748b" }}
                        axisLine={{ stroke: axisStroke }}
                        tickLine={{ stroke: axisStroke }}
                        width={32}
                        tickCount={4}
                      />
                      <YAxis
                        yAxisId="conf"
                        orientation="right"
                        domain={[0, 100]}
                        tick={{ fontSize: 10, fill: "#64748b" }}
                        axisLine={{ stroke: axisStroke }}
                        tickLine={{ stroke: axisStroke }}
                        width={36}
                        unit="%"
                      />
                      <Tooltip content={<RiskTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: 10 }}
                        formatter={(value) =>
                          value === "risk" ? "Risk index" : "Confidence %"
                        }
                      />
                      <Area
                        yAxisId="conf"
                        type="monotone"
                        dataKey="confidence"
                        name="confidence"
                        fill="#38bdf8"
                        fillOpacity={0.2}
                        stroke="#0ea5e9"
                        strokeWidth={1}
                      />
                      <Line
                        yAxisId="risk"
                        type="stepAfter"
                        dataKey="risk"
                        name="risk"
                        stroke="#e11d48"
                        strokeWidth={2}
                        dot={{ r: 2, strokeWidth: 1, fill: "#fff" }}
                        activeDot={{ r: 4 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <div
                className={`grid gap-4 sm:grid-cols-2 ${sourceBarData.length > 1 ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}
              >
                <ChartCard
                  title="Risk level mix"
                  subtitle="Share of forecast slots."
                  icon={PieChartIcon}
                  chartHeightClass="h-[260px]"
                  emptyHint={
                    distributionPieData.length === 0
                      ? "No level breakdown for this range."
                      : null
                  }
                >
                  {distributionPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 0, right: 8, bottom: 8, left: 8 }}>
                        <Pie
                          data={distributionPieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={82}
                          paddingAngle={2}
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                          labelLine={{ stroke: "#94a3b8", strokeWidth: 1 }}
                        >
                          {distributionPieData.map((entry, i) => (
                            <Cell key={`pie-${i}`} fill={entry.fill} stroke="rgba(255,255,255,0.65)" />
                          ))}
                        </Pie>
                        <Tooltip content={<DistributionTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : null}
                </ChartCard>

                <ChartCard
                  title={dailyPeakBarData.length > 1 ? "Daily peak risk" : "Peak risk by day"}
                  subtitle="Max risk index per day."
                  icon={TrendingUp}
                  chartHeightClass="h-[260px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dailyPeakBarData}
                      margin={{ top: 12, right: 12, left: 8, bottom: 28 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e2e8f0"
                        className="dark:stroke-slate-700"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="tickLabel"
                        tick={{ fontSize: 10, fill: "#64748b" }}
                        axisLine={{ stroke: axisStroke }}
                        tickLine={{ stroke: axisStroke }}
                      />
                      <YAxis
                        domain={[0, 3]}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        axisLine={{ stroke: axisStroke }}
                        tickLine={{ stroke: axisStroke }}
                        width={40}
                        label={{ value: "Peak", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 10 }}
                      />
                      <Tooltip
                        formatter={(val, _n, props) => [
                          `${val} (${props?.payload?.peakLevel ?? ""})`,
                          "Peak index",
                        ]}
                        labelFormatter={(label, payload) => {
                          const p = payload?.[0]?.payload;
                          return p ? `${p.day}${p.weekday ? ` (${p.weekday})` : ""}` : label;
                        }}
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                          fontSize: 12,
                        }}
                      />
                      <Bar
                        dataKey="peak"
                        name="Peak risk"
                        radius={[6, 6, 0, 0]}
                        fill="#6366f1"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Confidence by time slot"
                  subtitle="Bar color = risk level."
                  icon={BarChart3}
                  chartHeightClass="h-[260px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={confidenceBandData}
                      margin={{
                        top: 12,
                        right: 12,
                        left: 8,
                        bottom: confidenceChartBottomMargin,
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e2e8f0"
                        className="dark:stroke-slate-700"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="slot"
                        tick={{ fontSize: 9, fill: "#64748b" }}
                        axisLine={{ stroke: axisStroke }}
                        tickLine={{ stroke: axisStroke }}
                        interval={confidenceBandData.length > 18 ? Math.floor(confidenceBandData.length / 8) : 0}
                        angle={confidenceBandData.length > 14 ? -35 : 0}
                        textAnchor={confidenceBandData.length > 14 ? "end" : "middle"}
                        height={confidenceBandData.length > 14 ? 48 : 28}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        axisLine={{ stroke: axisStroke }}
                        tickLine={{ stroke: axisStroke }}
                        width={44}
                        unit="%"
                        label={{ value: "%", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 10 }}
                      />
                      <Tooltip
                        formatter={(v) => [`${v}%`, "Confidence"]}
                        labelFormatter={(l) => `Slot ${l}`}
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="confidence" radius={[4, 4, 0, 0]} maxBarSize={32}>
                        {confidenceBandData.map((entry, i) => (
                          <Cell key={`cb-${i}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                {sourceBarData.length > 1 ? (
                  <ChartCard
                    title="Predictions by source"
                    subtitle="Row count per source."
                    icon={BarChart3}
                    chartHeightClass="h-[260px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={sourceBarData}
                        layout="vertical"
                        margin={{ top: 12, right: 20, left: 16, bottom: 12 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#e2e8f0"
                          className="dark:stroke-slate-700"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 10, fill: "#64748b" }}
                          axisLine={{ stroke: axisStroke }}
                          tickLine={{ stroke: axisStroke }}
                          allowDecimals={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={112}
                          tick={{ fontSize: 10, fill: "#64748b" }}
                          axisLine={{ stroke: axisStroke }}
                          tickLine={{ stroke: axisStroke }}
                        />
                        <Tooltip
                          formatter={(v) => [v, "Rows"]}
                          contentStyle={{
                            borderRadius: 8,
                            border: "1px solid #e2e8f0",
                            fontSize: 12,
                          }}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
                          {sourceBarData.map((_, i) => (
                            <Cell key={`src-${i}`} fill={SOURCE_PALETTE[i % SOURCE_PALETTE.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                ) : null}
              </div>
            </section>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-white/80 shadow-lg backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80 overflow-hidden">
              <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <BarChart3 className="h-4 w-4 text-sky-500" />
                    Detailed Forecast Timeline
                  </h2>
                  <div className="text-right">
                    <span className="text-xs text-slate-500">
                      {windowKey === "6h" ? "Upcoming 6 hours" : windowKey === "1d" ? "Upcoming day" : "Upcoming week"}
                    </span>
                    {timelineHiddenCount > 0 ? (
                      <div>
                        <button
                          type="button"
                          onClick={() => setTimelineExpanded((v) => !v)}
                          className="mt-1 text-xs font-semibold text-sky-700 hover:text-sky-600 dark:text-sky-400 dark:hover:text-sky-300"
                        >
                          {timelineExpanded
                            ? "Show less"
                            : `Show all (${timelineTotalItems})`}
                        </button>
                      </div>
                    ) : null}
                  </div>
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
                <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
                  {visibleWeeklyCards.map((d) => (
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
                <div
                  className={`grid gap-4 p-4 ${timelineTableHalves[1].length > 0 ? "lg:grid-cols-2" : ""}`}
                >
                  <div className="min-w-0 overflow-x-auto rounded-xl border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-950/30">
                    <ForecastDataTable rows={timelineTableHalves[0]} />
                  </div>
                  {timelineTableHalves[1].length > 0 ? (
                    <div className="min-w-0 overflow-x-auto rounded-xl border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-950/30">
                      <ForecastDataTable rows={timelineTableHalves[1]} />
                    </div>
                  ) : null}
                </div>
              )}
            </div>

          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-md backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <HelpCircle className="h-4 w-4 text-sky-500" />
              How to interpret
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Risk levels combine weather patterns, historical data, and real-time sensors.{" "}
              <span className="font-medium text-slate-700 dark:text-slate-300">High confidence</span> means multiple models agree.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
