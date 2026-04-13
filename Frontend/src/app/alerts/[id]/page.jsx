"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Clock3,
  MapPin,
  Activity,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";
import {
  disasterVisualConfig,
  getDisasterTypeKey,
} from "@/lib/disasterVisualConfig";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const REFRESH_MS = 10000;

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSeverityBadgeClass(severity = "Medium") {
  const value = String(severity).toLowerCase();

  if (value === "low") return "border-yellow-300 bg-yellow-100 text-yellow-900";
  if (value === "medium") return "border-orange-300 bg-orange-100 text-orange-900";
  if (value === "high") return "border-red-300 bg-red-100 text-red-900";
  return "border-slate-300 bg-slate-100 text-slate-800";
}

function DangerMeter({
  value = 0,
  max = 100,
  unit = "",
  label = "Current Level",
  threshold = 70,
  thresholdLabel = "Danger Level",
  fillClass = "bg-cyan-400",
}) {
  const safeMax = max <= 0 ? 1 : max;
  const pct = Math.min((value / safeMax) * 100, 100);
  const thresholdPct = Math.min((threshold / safeMax) * 100, 100);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">{label}</p>
          <p className="text-3xl font-bold text-slate-900">
            {value}
            {unit ? ` ${unit}` : ""}
          </p>
        </div>
        <div className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
          LIVE
        </div>
      </div>

      <div className="relative mx-auto h-72 w-24 overflow-hidden rounded-full border-4 border-slate-200 bg-slate-100">
        <div
          className={`absolute bottom-0 left-0 right-0 transition-all duration-1000 ${fillClass}`}
          style={{ height: `${pct}%` }}
        />
        <div
          className="absolute left-0 right-0 border-t-4 border-red-400"
          style={{ bottom: `${thresholdPct}%` }}
        />
      </div>

      <div className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
        Danger line: {threshold} {unit} · {thresholdLabel}
      </div>
    </div>
  );
}

function ReadingCard({ label, value, unit }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900 break-words">
        {value}
        {unit ? ` ${unit}` : ""}
      </p>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-slate-900">{value || "—"}</p>
      </div>
    </div>
  );
}

function getRiskMessage(typeKey, currentValue, threshold) {
  if (currentValue >= threshold) {
    return "Current readings are above the danger threshold. People in the affected area should remain highly alert and follow official instructions immediately.";
  }

  if (currentValue >= threshold * 0.8) {
    return "Current readings are close to the danger threshold. The situation may worsen quickly, so people should stay prepared.";
  }

  if (typeKey === "flood") {
    return "Water-related conditions are being monitored. Flood risk remains active in this area.";
  }

  if (typeKey === "landslide") {
    return "Ground conditions are unstable enough to require caution in this area.";
  }

  if (typeKey === "storm" || typeKey === "cyclone") {
    return "Severe weather conditions remain active, and the area should stay alert for sudden changes.";
  }

  if (typeKey === "wildfire") {
    return "Heat and smoke conditions remain under active monitoring in this zone.";
  }

  return "Live hazard conditions are being monitored for this alert.";
}

export default function AlertLiveDetailsPage() {
  const params = useParams();
  const id = params?.id;

  const [alert, setAlert] = useState(null);
  const [sensorData, setSensorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sensorLoading, setSensorLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  async function loadAlert() {
    const res = await fetch(`${API_BASE}/alerts/${id}`, { cache: "no-store" });
    const text = await res.text();
    let data;

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error("Expected JSON from backend.");
    }

    if (!res.ok) {
      throw new Error(data?.message || "Failed to load alert.");
    }

    return data?.alert || data;
  }

  async function loadSensorData() {
    const res = await fetch(`${API_BASE}/sensors/by-alert/${id}`, {
      cache: "no-store",
    });

    const text = await res.text();
    let data;

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error("Expected JSON from backend.");
    }

    if (!res.ok) {
      throw new Error(data?.message || "Failed to load live sensor data.");
    }

    return data;
  }

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        setError("");

        const alertData = await loadAlert();
        setAlert(alertData);

        try {
          setSensorLoading(true);
          const sensor = await loadSensorData();
          setSensorData(sensor);
          setLastUpdated(new Date().toISOString());
        } catch (sensorErr) {
          console.error(sensorErr);
        }
      } catch (err) {
        setError(err?.message || "Failed to load alert details.");
      } finally {
        setLoading(false);
        setSensorLoading(false);
      }
    }

    if (id) init();
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const timer = setInterval(async () => {
      try {
        setSensorLoading(true);
        const sensor = await loadSensorData();
        setSensorData(sensor);
        setLastUpdated(new Date().toISOString());
      } catch (err) {
        console.error("Sensor refresh failed:", err);
      } finally {
        setSensorLoading(false);
      }
    }, REFRESH_MS);

    return () => clearInterval(timer);
  }, [id]);

  const typeKey = useMemo(() => {
    return getDisasterTypeKey(alert?.disasterType || alert?.type || "");
  }, [alert]);

  const visual = disasterVisualConfig[typeKey] || disasterVisualConfig.default;
  const VisualIcon = visual.icon;

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-slate-600">Loading live alert details...</p>
        </div>
      </div>
    );
  }

  if (error || !alert) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800 shadow-sm">
          {error || "Alert not found."}
        </div>
      </div>
    );
  }

  const currentReading = sensorData?.currentValue ?? 0;
  const threshold = sensorData?.dangerThreshold ?? 100;
  const max = sensorData?.maxValue ?? Math.max(threshold + 20, currentReading + 20);
  const title = alert?.disasterType || alert?.type || visual.title;

  return (
    <div className={`min-h-screen ${visual.pageBg}`}>
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link
            href="/alerts"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Alerts
          </Link>
        </div>

        <section
          className={`overflow-hidden rounded-[2rem] bg-gradient-to-br ${visual.heroGradient} shadow-2xl`}
        >
          <div className="grid gap-8 p-6 lg:grid-cols-[1.2fr,0.8fr] lg:p-8">
            <div className="rounded-[2rem] border border-white/20 bg-white/92 p-6 shadow-xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-800">
                <VisualIcon className="h-4 w-4" />
                {visual.title}
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                {title}
              </h1>

              <p className="mt-3 text-sm font-medium text-slate-700">
                {visual.headline}
              </p>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                {visual.description}
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <ReadingCard
                  label={visual.primaryReading}
                  value={sensorData?.primaryValue ?? 0}
                  unit={visual.primaryUnit}
                />
                <ReadingCard
                  label={visual.secondaryReading}
                  value={sensorData?.secondaryValue ?? 0}
                  unit={visual.secondaryUnit}
                />
                <ReadingCard
                  label="Last Updated"
                  value={lastUpdated ? formatDateTime(lastUpdated) : "—"}
                />
                <ReadingCard
                  label="Status"
                  value={sensorLoading ? "Refreshing..." : "Live"}
                />
              </div>
            </div>

            <DangerMeter
              value={currentReading}
              max={max}
              unit={visual.meterUnit}
              label={visual.meterLabel}
              threshold={threshold}
              thresholdLabel={visual.thresholdLabel}
              fillClass={visual.meterColor}
            />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <InfoRow icon={MapPin} label="Affected Area" value={alert?.affectedArea} />
          <InfoRow icon={Clock3} label="Start Time" value={formatDateTime(alert?.startTime)} />
          <InfoRow
            icon={Clock3}
            label="Expected End Time"
            value={formatDateTime(alert?.expectedEndTime)}
          />
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Severity</p>
            <span
              className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getSeverityBadgeClass(
                alert?.severity
              )}`}
            >
              {alert?.severity || "—"} severity
            </span>
          </div>
        </section>

        <section
          className={`rounded-2xl border p-4 shadow-sm ${visual.infoStripBorder} ${visual.infoStripBg}`}
        >
          <p className={`text-sm font-medium ${visual.infoStripText}`}>
            {title} • {alert?.affectedArea || "Affected area"} • Current reading {currentReading}{" "}
            {visual.meterUnit} • Danger threshold {threshold} {visual.meterUnit}
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-4">
              <Activity className="h-5 w-5 text-slate-600" />
              <h2 className="text-lg font-semibold text-slate-900">Current Situation</h2>
            </div>
            <div className="space-y-4 p-5">
              <div className={`rounded-xl border p-4 ${visual.sectionBorder} ${visual.sectionTint}`}>
                <p className="text-sm leading-6 text-slate-700">
                  {getRiskMessage(typeKey, currentReading, threshold)}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Current Reading
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {currentReading} {visual.meterUnit}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Danger Threshold
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {threshold} {visual.meterUnit}
                  </p>
                </div>
              </div>

              <div className={`rounded-xl border p-4 ${visual.sectionBorder} ${visual.sectionTint}`}>
                <p className="text-sm font-semibold text-slate-900">Alert Description</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {alert?.description || "No description available."}
                </p>
              </div>
            </div>
          </div>

          <div className={`rounded-2xl border shadow-sm ${visual.sectionBorder} ${visual.sectionTint}`}>
            <div className={`flex items-center gap-2 border-b px-5 py-4 ${visual.sectionBorder}`}>
              <ShieldAlert className="h-5 w-5 text-emerald-700" />
              <h2 className="text-lg font-semibold text-slate-900">What You Should Do</h2>
            </div>
            <div className="space-y-3 p-5">
              {visual.publicTips.map((tip, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-white bg-white p-4 text-sm leading-6 text-slate-800 shadow-sm"
                >
                  {tip}
                </div>
              ))}

              <div className="rounded-xl border border-white bg-white p-4 text-sm leading-6 text-slate-800 shadow-sm">
                {alert?.safetyInstructions || "Follow official instructions carefully."}
              </div>
            </div>
          </div>
        </section>

        <section className={`rounded-2xl border shadow-sm ${visual.sectionBorder} ${visual.sectionTint}`}>
          <div className={`flex items-center gap-2 border-b px-5 py-4 ${visual.sectionBorder}`}>
            <AlertTriangle className="h-5 w-5 text-amber-700" />
            <h2 className="text-lg font-semibold text-slate-900">Live Monitoring Notes</h2>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-3">
            <div className="rounded-xl border border-white bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Reading Source</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {sensorData?.sourceName || "Local Detector Network"}
              </p>
            </div>

            <div className="rounded-xl border border-white bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Trend</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {sensorData?.trend || "Monitoring"}
              </p>
            </div>

            <div className="rounded-xl border border-white bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Detector Status</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {sensorLoading ? "Refreshing..." : sensorData?.status || "Active"}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}