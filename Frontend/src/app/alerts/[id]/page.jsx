"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Clock3,
  MapPin,
  Activity,
  ShieldAlert,
  AlertTriangle,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  disasterSceneConfig,
  getDisasterTypeKey,
} from "@/lib/disasterSceneConfig";

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

function SoundButton({ soundSrc }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (!soundSrc || !audioRef.current) return;

    audioRef.current.volume = 0.35;
    audioRef.current.loop = true;

    audioRef.current.play().catch(() => {});
  }, [soundSrc]);

  function toggleSound() {
    if (!soundSrc || !audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }

  if (!soundSrc) return null;

  return (
    <>
      <audio ref={audioRef} src={soundSrc} preload="auto" />
      <button
        type="button"
        onClick={toggleSound}
        className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/95 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-white"
      >
        {isPlaying ? (
          <>
            <Volume2 className="h-4 w-4" />
            Mute Sound
          </>
        ) : (
          <>
            <VolumeX className="h-4 w-4" />
            Enable Sound
          </>
        )}
      </button>
    </>
  );
}

function ReadingCard({ label, value, unit }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/95 p-4 shadow-sm backdrop-blur-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 break-words text-2xl font-bold text-slate-900">
        {value}
        {unit ? ` ${unit}` : ""}
      </p>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/95 p-4 shadow-sm backdrop-blur-sm">
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

  if (typeKey === "flood") return "Water-related conditions are being monitored. Flood risk remains active in this area.";
  if (typeKey === "landslide") return "Ground conditions are unstable enough to require caution in this area.";
  if (typeKey === "storm" || typeKey === "cyclone") return "Severe weather conditions remain active, and the area should stay alert for sudden changes.";
  if (typeKey === "wildfire") return "Heat and smoke conditions remain under active monitoring in this zone.";

  return "Live hazard conditions are being monitored for this alert.";
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getDangerStatus(distanceKm) {
  if (distanceKm <= 5) {
    return {
      level: "danger",
      title: "You are in the danger zone",
      message:
        "Your live location appears to be very close to the affected disaster area. Please follow safety instructions immediately.",
      classes: "border-red-200 bg-red-50 text-red-800",
    };
  }

  if (distanceKm <= 15) {
    return {
      level: "warning",
      title: "You are near the affected area",
      message:
        "You are close to the disaster zone. Stay alert, avoid unnecessary travel, and monitor official updates.",
      classes: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }

  return {
    level: "safe",
    title: "You appear to be currently safe",
    message:
      "Your live location appears to be outside the immediate danger area for this alert. Continue monitoring updates if conditions change.",
    classes: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
}

function DetectMeAnimationStyles() {
  return (
    <style jsx global>{`
      @keyframes safePulse {
        0% { transform: scale(1); opacity: 0.85; }
        50% { transform: scale(1.08); opacity: 1; }
        100% { transform: scale(1); opacity: 0.85; }
      }

      @keyframes rippleSafe {
        0% { transform: scale(0.8); opacity: 0.45; }
        100% { transform: scale(1.8); opacity: 0; }
      }

      @keyframes dangerPulse {
        0% { transform: scale(1); opacity: 0.9; }
        50% { transform: scale(1.12); opacity: 1; }
        100% { transform: scale(1); opacity: 0.9; }
      }

      @keyframes dangerRing {
        0% { transform: scale(0.85); opacity: 0.5; }
        100% { transform: scale(1.7); opacity: 0; }
      }

      @keyframes modalIn {
        0% { opacity: 0; transform: scale(0.96) translateY(8px); }
        100% { opacity: 1; transform: scale(1) translateY(0); }
      }

      @keyframes warningBlink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.35; }
      }
    `}</style>
  );
}

function SafeVisual() {
  return (
    <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
      <div className="absolute h-24 w-24 rounded-full bg-emerald-400/20 animate-[safePulse_2.4s_ease-in-out_infinite]" />
      <div className="absolute h-32 w-32 rounded-full border-2 border-emerald-300/60 animate-[rippleSafe_2.2s_linear_infinite]" />
      <div className="absolute h-40 w-40 rounded-full border-2 border-emerald-200/40 animate-[rippleSafe_2.8s_linear_infinite]" />
      <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30">
        <svg
          viewBox="0 0 24 24"
          className="h-12 w-12 text-white"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
    </div>
  );
}

function DangerVisual({ warning = false }) {
  return (
    <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
      <div className="absolute h-24 w-24 rounded-full bg-red-500/20 animate-[dangerPulse_1.5s_ease-in-out_infinite]" />
      <div className="absolute h-32 w-32 rounded-full border-2 border-red-300/60 animate-[dangerRing_1.8s_linear_infinite]" />
      <div className="absolute h-40 w-40 rounded-full border-2 border-red-200/40 animate-[dangerRing_2.3s_linear_infinite]" />
      <div className={`relative flex h-24 w-24 items-center justify-center rounded-full ${warning ? "bg-amber-500" : "bg-red-600"} shadow-lg ${warning ? "shadow-amber-500/30" : "shadow-red-600/30"}`}>
        <svg
          viewBox="0 0 24 24"
          className={`h-12 w-12 text-white ${warning ? "animate-[warningBlink_1.2s_linear_infinite]" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 8v5" />
          <path d="M12 16h.01" />
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        </svg>
      </div>
    </div>
  );
}

function DetectResultModal({
  open,
  onClose,
  dangerStatus,
  distanceKm,
  userCoords,
  alertTitle,
  alertArea,
}) {
  if (!open || !dangerStatus) return null;

  const isSafe = dangerStatus.level === "safe";
  const isWarning = dangerStatus.level === "warning";

  const instructionList = isSafe
    ? [
        "Keep monitoring official updates for this alert.",
        "Avoid unnecessary travel toward the affected area.",
        "Stay prepared in case conditions change.",
      ]
    : isWarning
    ? [
        "Stay alert and avoid the affected area if possible.",
        "Keep your phone charged and follow official alerts.",
        "Prepare essentials in case evacuation becomes necessary.",
      ]
    : [
        "Move away from the danger zone immediately if it is safe to do so.",
        "Follow official evacuation and public safety instructions now.",
        "Avoid affected roads, floodwater, unstable ground, or restricted zones.",
      ];

  const statusTheme = isSafe
    ? {
        shell: "border-emerald-200",
        header: "bg-emerald-600",
        badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
        panel: "bg-emerald-50 border-emerald-200",
        iconWrap: "bg-emerald-100",
        iconColor: "text-emerald-700",
        title: "SAFE STATUS",
      }
    : isWarning
    ? {
        shell: "border-amber-200",
        header: "bg-amber-500",
        badge: "bg-amber-100 text-amber-800 border-amber-200",
        panel: "bg-amber-50 border-amber-200",
        iconWrap: "bg-amber-100",
        iconColor: "text-amber-700",
        title: "WARNING STATUS",
      }
    : {
        shell: "border-red-200",
        header: "bg-red-600",
        badge: "bg-red-100 text-red-800 border-red-200",
        panel: "bg-red-50 border-red-200",
        iconWrap: "bg-red-100",
        iconColor: "text-red-700",
        title: "DANGER STATUS",
      };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
      <div
        className={`w-full max-w-md overflow-hidden rounded-3xl border bg-white shadow-2xl ${statusTheme.shell} animate-[modalIn_0.22s_ease-out]`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detect-me-result-title"
      >
        <div className={`flex items-center justify-between px-5 py-4 text-white ${statusTheme.header}`}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85">
              Emergency Location Check
            </p>
            <h2 id="detect-me-result-title" className="mt-1 text-lg font-bold">
              {dangerStatus.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/20"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex items-center gap-4">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${statusTheme.iconWrap}`}>
              {isSafe ? (
                <svg
                  viewBox="0 0 24 24"
                  className={`h-7 w-7 ${statusTheme.iconColor}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  className={`h-7 w-7 ${statusTheme.iconColor}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 8v5" />
                  <path d="M12 16h.01" />
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                </svg>
              )}
            </div>

            <div className="min-w-0">
              <div className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusTheme.badge}`}>
                {statusTheme.title}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {dangerStatus.message}
              </p>
            </div>
          </div>

          <div className={`rounded-2xl border p-4 ${statusTheme.panel}`}>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/70 bg-white/80 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Distance
                </p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {distanceKm?.toFixed(2)} km
                </p>
              </div>

              <div className="rounded-xl border border-white/70 bg-white/80 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Area
                </p>
                <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">
                  {alertArea}
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-white/70 bg-white/80 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Alert Type
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {alertTitle}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">
              Recommended Action
            </p>

            <div className="mt-3 space-y-2">
              {instructionList.map((item, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3"
                >
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>

          {userCoords && (
            <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Your detected location:</span>{" "}
              {userCoords.lat?.toFixed(5)}, {userCoords.lng?.toFixed(5)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RiskMeter({
  currentReading = 0,
  threshold = 70,
  unit = "%",
}) {
  const safeMax = Math.max(threshold * 1.4, currentReading, 1);
  const currentPct = Math.min((currentReading / safeMax) * 100, 100);
  const thresholdPct = Math.min((threshold / safeMax) * 100, 100);

  const status =
    currentReading >= threshold
      ? "danger"
      : currentReading >= threshold * 0.8
      ? "warning"
      : "safe";

  const statusStyles =
    status === "danger"
      ? {
          pill: "bg-red-100 text-red-800 border-red-200",
          glow: "shadow-red-200/60",
          marker: "bg-red-600",
        }
      : status === "warning"
      ? {
          pill: "bg-amber-100 text-amber-800 border-amber-200",
          glow: "shadow-amber-200/60",
          marker: "bg-amber-500",
        }
      : {
          pill: "bg-emerald-100 text-emerald-800 border-emerald-200",
          glow: "shadow-emerald-200/60",
          marker: "bg-emerald-600",
        };

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Risk Meter
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Current level compared with danger threshold
          </p>
        </div>

        <span
          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles.pill}`}
        >
          {status === "danger"
            ? "Danger zone"
            : status === "warning"
            ? "Near threshold"
            : "Safe zone"}
        </span>
      </div>

      <div className="relative">
        <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-slate-200 text-[11px] font-semibold uppercase tracking-wide">
        <div className="bg-emerald-500/90 py-2 text-center text-white">
          Safe
        </div>
        <div className="bg-amber-500/90 py-2 text-center text-white">
          Caution
        </div>
        <div className="bg-red-600 py-2 text-center text-white">
          Danger
        </div>
      </div>

        <div className="relative mt-3 h-5 overflow-hidden rounded-full bg-slate-200">
          <div className="absolute inset-y-0 left-0 w-1/2 bg-emerald-400/60" />
          <div className="absolute inset-y-0 left-1/2 w-1/4 bg-amber-400/70" />
          <div className="absolute inset-y-0 right-0 w-1/4 bg-red-500/75" />

          <div
            className="absolute top-1/2 z-20 h-8 w-8 -translate-y-1/2 -translate-x-1/2 rounded-full border-4 border-white shadow-lg transition-all duration-700"
            style={{ left: `${currentPct}%` }}
          >
            <div
              className={`h-full w-full rounded-full ${statusStyles.marker} ${statusStyles.glow}`}
            />
          </div>

          <div
            className="absolute top-1/2 z-10 h-10 -translate-y-1/2 -translate-x-1/2"
            style={{ left: `${thresholdPct}%` }}
          >
            <div className="flex h-full flex-col items-center">
              
              <div className="h-full w-0.5 bg-slate-900/80" />
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              Current
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {currentReading} {unit}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              Threshold
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {threshold} {unit}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              Difference
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {(currentReading - threshold).toFixed(1)} {unit}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              Status
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {status === "danger"
                ? "Critical"
                : status === "warning"
                ? "Watch"
                : "Normal"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
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
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [userCoords, setUserCoords] = useState(null);
  const [distanceKm, setDistanceKm] = useState(null);
  const [dangerStatus, setDangerStatus] = useState(null);
  const [showDetectModal, setShowDetectModal] = useState(false);

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

  function handleDetectMe() {
  setLocationError("");
  setDetectingLocation(true);

  const alertLat = alert?.latitude ?? alert?.location?.lat;
  const alertLng = alert?.longitude ?? alert?.location?.lng;

  if (
    typeof alertLat !== "number" ||
    typeof alertLng !== "number"
  ) {
    setLocationError("This alert does not have location coordinates yet.");
    setDetectingLocation(false);
    return;
  }

  if (!navigator.geolocation) {
    setLocationError("Geolocation is not supported by your browser.");
    setDetectingLocation(false);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;

      const distance = calculateDistanceKm(userLat, userLng, alertLat, alertLng);
      const status = getDangerStatus(distance);

      setUserCoords({ lat: userLat, lng: userLng });
      setDistanceKm(distance);
      setDangerStatus(status);
      setShowDetectModal(true);
      setDetectingLocation(false);
    },
    (error) => {
      let message = "Unable to detect your location.";

      if (error.code === 1) {
        message = "Location permission was denied.";
      } else if (error.code === 2) {
        message = "Location information is unavailable.";
      } else if (error.code === 3) {
        message = "Location request timed out.";
      }

      setLocationError(message);
      setDetectingLocation(false);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }
  );
}

  const typeKey = useMemo(() => {
    return getDisasterTypeKey(alert?.disasterType || alert?.type || "");
  }, [alert]);

  const scene = disasterSceneConfig[typeKey] || disasterSceneConfig.default;
  const currentReading = sensorData?.currentValue ?? 0;
  const threshold = sensorData?.dangerThreshold ?? 100;
  const title = alert?.disasterType || alert?.type || scene.title;

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

  return (
  <div className="relative min-h-screen">
    <DetectMeAnimationStyles />
    <DetectResultModal
      open={showDetectModal}
      onClose={() => setShowDetectModal(false)}
      dangerStatus={dangerStatus}
      distanceKm={distanceKm}
      userCoords={userCoords}
      alertTitle={title}
      alertArea={alert?.affectedArea || "Affected area"}
    />

      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${scene.mediaSrc})` }}
      />
      <div className="absolute inset-0 bg-slate-950/65" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/alerts"
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/95 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Alerts
          </Link>

          <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleDetectMe}
            disabled={detectingLocation}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-800 shadow-sm transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <MapPin className="h-4 w-4" />
            {detectingLocation ? "Detecting..." : "Detect Me"}
          </button>

          <SoundButton soundSrc={scene.soundSrc} />
        </div>
        </div>

        <section
          className={`relative overflow-hidden rounded-[2rem] bg-gradient-to-br ${scene.heroGradient} shadow-2xl`}
        >
          <div className="absolute inset-0 bg-slate-950/25" />

          <div className="relative z-10 grid gap-8 p-6 lg:grid-cols-[1.2fr,0.8fr] lg:p-8">
            <div className="rounded-[2rem] border border-white/20 bg-white/92 p-6 shadow-xl backdrop-blur-sm">
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {title}
              </h1>

              <p className="mt-3 text-sm font-medium text-white">
                {scene.headline}
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <ReadingCard
                  label={scene.primaryReading}
                  value={sensorData?.primaryValue ?? 0}
                  unit={scene.primaryUnit}
                />
                <ReadingCard
                  label={scene.secondaryReading}
                  value={sensorData?.secondaryValue ?? 0}
                  unit={scene.secondaryUnit}
                />
                <ReadingCard
                  label={scene.meterLabel}
                  value={currentReading}
                  unit={scene.meterUnit}
                />
                <ReadingCard
                  label="Status"
                  value={sensorLoading ? "Refreshing..." : "Live"}
                />
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/20 bg-white/92 p-6 shadow-xl backdrop-blur-sm">
              <p className="text-sm font-medium text-white">Current Situation</p>
              <p className="mt-2 text-4xl font-bold text-white">
                {currentReading} {scene.meterUnit}
              </p>
              <p className="mt-3 text-sm text-white">
                Danger threshold: {threshold} {scene.meterUnit}
              </p>

              <RiskMeter
                  currentReading={currentReading}
                  threshold={threshold}
                  unit={scene.meterUnit}
                />

              <p className="mt-5 text-sm leading-6 text-white">
                {getRiskMessage(typeKey, currentReading, threshold)}
              </p>
            </div>
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
          <div className="rounded-2xl border border-white/20 bg-white/95 p-4 shadow-sm backdrop-blur-sm">
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
          className={`rounded-2xl border p-4 shadow-sm backdrop-blur-sm ${scene.infoStripBorder} ${scene.infoStripBg}`}
        >

          {locationError && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <p className="text-sm font-medium text-red-800">{locationError}</p>
        </section>
      )}

      {dangerStatus && (
        <section className={`rounded-2xl border p-5 shadow-sm ${dangerStatus.classes}`}>
          <h2 className="text-lg font-bold">{dangerStatus.title}</h2>
          <p className="mt-2 text-sm leading-6">{dangerStatus.message}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-white/60 bg-white/70 p-4">
              <p className="text-xs uppercase tracking-wide opacity-70">Your Distance</p>
              <p className="mt-2 text-2xl font-bold">
                {distanceKm?.toFixed(2)} km
              </p>
            </div>

            <div className="rounded-xl border border-white/60 bg-white/70 p-4">
              <p className="text-xs uppercase tracking-wide opacity-70">Your Latitude</p>
              <p className="mt-2 text-sm font-semibold">
                {userCoords?.lat?.toFixed(5)}
              </p>
            </div>

            <div className="rounded-xl border border-white/60 bg-white/70 p-4">
              <p className="text-xs uppercase tracking-wide opacity-70">Your Longitude</p>
              <p className="mt-2 text-sm font-semibold">
                {userCoords?.lng?.toFixed(5)}
              </p>
            </div>
          </div>
        </section>
      )}

          <p className={`text-sm font-medium ${scene.infoStripText}`}>
            {title} • {alert?.affectedArea || "Affected area"} • Current reading {currentReading}{" "}
            {scene.meterUnit} • Danger threshold {threshold} {scene.meterUnit}
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/20 bg-white/95 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/90 px-5 py-4">
              <Activity className="h-5 w-5 text-slate-600" />
              <h2 className="text-lg font-semibold text-slate-900">Alert Description</h2>
            </div>
            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm leading-6 text-slate-700">
                  {alert?.description || "No description available."}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm leading-6 text-slate-700">
                  Last updated: {lastUpdated ? formatDateTime(lastUpdated) : "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/95 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-2 border-b border-emerald-200 px-5 py-4">
              <ShieldAlert className="h-5 w-5 text-emerald-700" />
              <h2 className="text-lg font-semibold text-emerald-900">What You Should Do</h2>
            </div>
            <div className="space-y-3 p-5">
              {scene.tips.map((tip, index) => (
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

        <section className="rounded-2xl border border-amber-200 bg-amber-50/95 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2 border-b border-amber-200 px-5 py-4">
            <AlertTriangle className="h-5 w-5 text-amber-700" />
            <h2 className="text-lg font-semibold text-amber-900">Live Monitoring Notes</h2>
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