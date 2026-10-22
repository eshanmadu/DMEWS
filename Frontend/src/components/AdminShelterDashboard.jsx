"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Building2,
  Droplets,
  Users,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function toChartRows(payload, station) {
  const days = payload?.event_data?.[station] || {};
  return Object.entries(days)
    .flatMap(([date, readings]) =>
      Object.entries(readings).map(([time, value]) => ({
        timestamp: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)} ${time.slice(0, 2)}:${time.slice(2, 4)}`,
        level: Number(value),
      }))
    )
    .filter((row) => Number.isFinite(row.level))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .slice(-48);
}

function StatCard({ icon: Icon, label, value, detail, tone = "sky" }) {
  const toneClasses = {
    sky: "bg-sky-100 text-sky-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    violet: "bg-violet-100 text-violet-700",
  };
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className={`rounded-xl p-2 ${toneClasses[tone] || toneClasses.sky}`}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-2xl font-bold text-slate-900">{value}</span>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-700">{label}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

export function AdminShelterDashboard() {
  const [shelters, setShelters] = useState([]);
  const [river, setRiver] = useState(null);
  const [district, setDistrict] = useState("Badulla");
  const [station, setStation] = useState("Wellawaya");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const [sheltersResponse, riverResponse] = await Promise.all([
        fetch(`${API_BASE}/shelters`, { cache: "no-store" }),
        fetch(`${API_BASE}/shelters/river-water-levels`, { cache: "no-store" }),
      ]);
      const sheltersData = await sheltersResponse.json().catch(() => []);
      const riverData = await riverResponse.json().catch(() => ({}));
      if (!sheltersResponse.ok) throw new Error(sheltersData?.message || "Failed to load shelters.");
      if (!riverResponse.ok) throw new Error(riverData?.message || "Failed to load river levels.");
      setShelters(Array.isArray(sheltersData) ? sheltersData : []);
      setRiver(riverData);
    } catch (loadError) {
      setError(loadError?.message || "Failed to load shelter dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const districts = useMemo(
    () => [...new Set(shelters.map((item) => item.district).filter(Boolean))].sort(),
    [shelters]
  );
  const stations = useMemo(
    () => Object.keys(river?.event_data || {}).sort(),
    [river]
  );
  const visibleShelters = useMemo(
    () => shelters.filter((item) => !district || item.district === district),
    [district, shelters]
  );
  const chartRows = useMemo(() => toChartRows(river, station), [river, station]);
  const latestLevel = chartRows.at(-1)?.level;
  const totalCapacity = visibleShelters.reduce((sum, item) => sum + (Number(item.capacity) || 0), 0);
  const occupied = visibleShelters.reduce((sum, item) => sum + (Number(item.occupied) || 0), 0);
  const openShelters = visibleShelters.filter((item) => item.availability !== "closed" && item.status !== "inactive").length;
  const utilization = totalCapacity ? Math.round((occupied / totalCapacity) * 100) : 0;

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading shelter intelligence…</div>;
  }

  return (
    <section className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">Operational overview</p>
          <h2 className="text-xl font-bold text-slate-900">Shelter readiness dashboard</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="text-xs font-medium text-slate-600">
            District
            <select value={district} onChange={(event) => setDistrict(event.target.value)} className="ml-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800">
              <option value="">All districts</option>
              {districts.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <button type="button" onClick={loadDashboard} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Building2} label="Shelters in view" value={visibleShelters.length} detail={`${openShelters} currently open`} />
        <StatCard icon={Users} label="Available capacity" value={Math.max(0, totalCapacity - occupied)} detail={`${utilization}% occupied`} tone="emerald" />
        <StatCard icon={Droplets} label="Latest river level" value={latestLevel == null ? "—" : `${latestLevel.toFixed(2)} m`} detail={station || "No gauge selected"} tone="amber" />
        <StatCard icon={Activity} label="River observations" value={chartRows.length} detail="Most recent 48 readings" tone="violet" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-slate-800">River water level trend</h3>
              <p className="text-xs text-slate-500">Source: supplied river gauge observations</p>
            </div>
            <select value={station} onChange={(event) => setStation(event.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
              {stations.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div className="h-64">
            {chartRows.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartRows}>
                  <defs><linearGradient id="riverFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0284c7" stopOpacity={0.3} /><stop offset="95%" stopColor="#0284c7" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="timestamp" tick={{ fontSize: 10 }} minTickGap={32} />
                  <YAxis unit=" m" tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} m`, "Water level"]} />
                  <Area type="monotone" dataKey="level" stroke="#0284c7" fill="url(#riverFill)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="flex h-full items-center justify-center text-sm text-slate-500">No observations for this gauge.</div>}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <h3 className="font-semibold text-slate-800">Capacity utilization</h3>
          <p className="mt-1 text-xs text-slate-500">{district || "All districts"} shelter network</p>
          <div className="mt-8 flex items-center justify-center">
            <div className="relative flex h-40 w-40 items-center justify-center rounded-full" style={{ background: `conic-gradient(#0284c7 ${utilization}%, #e2e8f0 ${utilization}% 100%)` }}>
              <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white"><span className="text-3xl font-bold text-slate-900">{utilization}%</span><span className="text-xs text-slate-500">occupied</span></div>
            </div>
          </div>
          <div className="mt-6 flex justify-between text-sm"><span className="text-slate-500">Occupied <strong className="text-slate-800">{occupied}</strong></span><span className="text-slate-500">Capacity <strong className="text-slate-800">{totalCapacity}</strong></span></div>
        </div>
      </div>
    </section>
  );
}
