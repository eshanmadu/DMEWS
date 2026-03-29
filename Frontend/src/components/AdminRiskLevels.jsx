"use client";

import { useEffect, useState } from "react";
import Loader from "@/components/Loader";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const DISTRICTS = [
  "Colombo",
  "Gampaha",
  "Kalutara",
  "Kandy",
  "Matale",
  "Nuwara Eliya",
  "Galle",
  "Matara",
  "Hambantota",
  "Jaffna",
  "Kilinochchi",
  "Mannar",
  "Vavuniya",
  "Mullaitivu",
  "Batticaloa",
  "Ampara",
  "Trincomalee",
  "Kurunegala",
  "Puttalam",
  "Anuradhapura",
  "Polonnaruwa",
  "Badulla",
  "Monaragala",
  "Ratnapura",
  "Kegalle",
];

const LEVELS = [
  {
    value: "safe",
    label: "Safe",
    color:
      "bg-emerald-500/20 text-emerald-800 border-emerald-500/50",
  },
  {
    value: "low",
    label: "Low",
    color:
      "bg-yellow-300/30 text-yellow-900 border-yellow-400/60",
  },
  {
    value: "medium",
    label: "Medium",
    color:
      "bg-orange-400/25 text-orange-900 border-orange-500/60",
  },
  {
    value: "high",
    label: "High",
    color: "bg-red-500/25 text-red-50 border-red-500/60",
  },
];

export function AdminRiskLevels() {
  const [levels, setLevels] = useState({}); // { [district]: level }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingDistrict, setSavingDistrict] = useState(null);
  const [pending, setPending] = useState(null); // { district, level, human } | null

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/risk-levels`);
        const data = await res.json();
        if (!res.ok) {
          setError(data?.message || "Failed to load risk levels.");
          setLoading(false);
          return;
        }
        if (cancelled) return;
        const map = {};
        (data || []).forEach((item) => {
          if (item?.district && item?.level) {
            map[item.district] = item.level;
          }
        });
        setLevels(map);
      } catch {
        if (!cancelled) setError("Network error.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
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
      } catch {
        // ignore
      }
    } catch {
      setError("Network error.");
      setSavingDistrict(null);
    }
  }

  function saveLevel(district, level) {
    const human =
      level === "high"
        ? "High"
        : level === "medium"
        ? "Medium"
        : level === "low"
        ? "Low"
        : "Safe";
    setPending({ district, level, human });
  }

  return (
    <div className="relative card h-full p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            District risk levels
          </h2>
          <p className="text-[11px] text-slate-400">
            Set manual risk level per district (safe, low, medium, high).
          </p>
        </div>
      </div>
      {error && (
        <div className="mb-3 rounded-lg bg-red-900/60 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      )}
      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader size="md" />
        </div>
      ) : (
        <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1 text-xs">
          {DISTRICTS.map((district) => {
            const current = levels[district] || "safe";
            return (
              <div
                key={district}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-700/60 bg-slate-900/40 px-3 py-2"
              >
                <span className="text-slate-100">{district}</span>
                <div className="flex items-center gap-1.5">
                  {LEVELS.map((lvl) => {
                    const active = current === lvl.value;
                    return (
                      <button
                        key={lvl.value}
                        type="button"
                        onClick={() => saveLevel(district, lvl.value)}
                        disabled={savingDistrict === district}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                          active
                            ? lvl.color
                            : "border-slate-600/70 bg-slate-800/70 text-slate-300 hover:border-slate-500 hover:bg-slate-700"
                        }`}
                      >
                        {lvl.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pending && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 px-5 py-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-slate-100">
              Confirm risk level change
            </h3>
            <p className="mt-2 text-xs text-slate-300">
              Set{" "}
              <span className="font-semibold text-teal-300">
                {pending.district}
              </span>{" "}
              to{" "}
              <span
                className={
                  pending.level === "high"
                    ? "font-semibold text-red-400"
                    : pending.level === "medium"
                    ? "font-semibold text-amber-300"
                    : "font-semibold text-emerald-300"
                }
              >
                {pending.human} risk
              </span>
              ? This will also send SMS alerts if the level is High.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingDistrict === pending.district}
                onClick={() =>
                  performSave(pending.district, pending.level)
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-70"
              >
                {savingDistrict === pending.district && (
                  <Loader size="sm" />
                )}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

