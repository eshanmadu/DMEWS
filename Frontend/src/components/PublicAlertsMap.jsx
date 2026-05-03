"use client";

import { MapPin } from "lucide-react";
import { PublicSriLankaMap } from "@/components/PublicSriLankaMap";

export function PublicAlertsMap({
  alerts = [],
  selectedDistrict = "All",
  onSelectDistrict,
}) {
  return (
    <div className="w-full">
      <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/70 backdrop-blur-lg shadow-xl dark:border-slate-700/30 dark:bg-slate-800/80">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 pb-2">
          <div className="flex min-w-0 items-center gap-2">
            <MapPin className="h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400" />
            <div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                Sri Lanka alert map
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 sm:text-xs">
                Active alert districts highlighted by severity
              </p>
            </div>
          </div>
        </div>

        <div className="relative mx-4 mb-4 overflow-hidden rounded-xl shadow-inner">
          <PublicSriLankaMap
            alerts={alerts}
            selectedDistrict={selectedDistrict}
            onSelectDistrict={onSelectDistrict}
          />
        </div>

        <div className="border-t border-slate-200/60 px-5 pb-4 pt-3 dark:border-slate-700/40">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-1 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              High
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              Medium
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-yellow-200 bg-yellow-50 px-2 py-1 text-yellow-700 dark:border-yellow-900/50 dark:bg-yellow-950/40 dark:text-yellow-200">
              <span className="h-2 w-2 rounded-full bg-yellow-400" />
              Low
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-300">
              <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-500" />
              No active alert
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}