"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Droplets, MapPinned, RefreshCw } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const BASIN_MONITORS = [
  { basin: "Kelani River", gauge: "Glencourse" },
  { basin: "Kalu River", gauge: "Rathnapura" },
  { basin: "Gin River", gauge: "Baddegama" },
  { basin: "Nilwala River", gauge: "Panadugama" },
  { basin: "Mahaweli River", gauge: "Peradeniya" },
  { basin: "Walawe River", gauge: "Thanamalwila" },
  { basin: "Kirindi Oya", gauge: "Wellawaya" },
  { basin: "Deduru Oya", gauge: "Giriulla" },
  { basin: "Kelani River (upper)", gauge: "Kithulgala" },
  { basin: "Kalu River (upper)", gauge: "Deraniyagala" },
];

function latestReading(payload, station) {
  const readings = Object.entries(payload?.event_data?.[station] || {})
    .flatMap(([date, values]) =>
      Object.entries(values).map(([time, value]) => ({
        date,
        time,
        level: Number(value),
      }))
    )
    .filter((reading) => Number.isFinite(reading.level))
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  return readings.at(-1) || null;
}

function formatObservedAt(reading) {
  if (!reading) return "No recent reading";
  const date = `${reading.date.slice(0, 4)}-${reading.date.slice(4, 6)}-${reading.date.slice(6)}`;
  const time = `${reading.time.slice(0, 2)}:${reading.time.slice(2, 4)}`;
  return `${date} ${time}`;
}

export function RoutingSystemDashboard() {
  const [river, setRiver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadRiverLevels() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/shelters/river-water-levels`, {
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Failed to load river water levels.");
      }
      setRiver(data);
    } catch (loadError) {
      setError(loadError?.message || "Failed to load river water levels.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRiverLevels();
  }, []);

  const rows = useMemo(
    () =>
      BASIN_MONITORS.map((monitor) => ({
        ...monitor,
        reading: latestReading(river, monitor.gauge),
      })),
    [river]
  );
  const reportingCount = rows.filter((row) => row.reading).length;
  const latestObservedAt = rows
    .filter((row) => row.reading)
    .map((row) => row.reading)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .at(-1);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">
            Water operations
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Routing system
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Monitor major Sri Lankan river basins and use the live map to support
            flood response routing decisions.
          </p>
        </div>
        <button
          type="button"
          onClick={loadRiverLevels}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh levels
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Basins in view</p>
            <MapPinned className="h-5 w-5 text-sky-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{BASIN_MONITORS.length}</p>
          <p className="mt-1 text-xs text-slate-500">Priority monitoring points</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Gauges reporting</p>
            <Droplets className="h-5 w-5 text-cyan-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{reportingCount}/{rows.length}</p>
          <p className="mt-1 text-xs text-slate-500">Latest available observations</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Latest update</p>
            <CalendarClock className="h-5 w-5 text-amber-600" />
          </div>
          <p className="mt-2 text-lg font-bold text-slate-900">
            {formatObservedAt(latestObservedAt)}
          </p>
          <p className="mt-1 text-xs text-slate-500">From supplied gauge observations</p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Sri Lanka flood monitoring</h2>
          <p className="text-sm text-slate-500">
            River-level monitoring based on DMC bulletins and gauge observations.
          </p>
        </div>
        <div className="flex aspect-[16/9] min-h-[320px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          <img
            src="https://raw.githubusercontent.com/nuuuwan/lk_dmc_vis/refs/heads/main/images/map.png"
            alt="Sri Lanka flood monitoring map"
            className="h-full w-full object-contain"
            loading="lazy"
          />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Map source: DMC river-level monitoring visualization.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Major basin water levels</h2>
          <p className="text-sm text-slate-500">
            Values are the latest reading available for the representative gauge.
            This table is informational and does not replace DMC alerts.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3 font-semibold">River basin</th>
                <th className="px-3 py-3 font-semibold">Representative gauge</th>
                <th className="px-3 py-3 font-semibold">Latest level</th>
                <th className="px-3 py-3 font-semibold">Observed at</th>
                <th className="px-3 py-3 font-semibold">Data status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={`${row.basin}-${row.gauge}`} className="text-slate-700">
                  <td className="px-3 py-3 font-semibold text-slate-900">{row.basin}</td>
                  <td className="px-3 py-3">{row.gauge}</td>
                  <td className="px-3 py-3 font-semibold text-sky-700">
                    {row.reading ? `${row.reading.level.toFixed(2)} m` : "—"}
                  </td>
                  <td className="px-3 py-3 text-slate-500">{formatObservedAt(row.reading)}</td>
                  <td className="px-3 py-3">
                    <span className={row.reading ? "text-emerald-700" : "text-amber-700"}>
                      {row.reading ? "Reporting" : "No recent reading"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
