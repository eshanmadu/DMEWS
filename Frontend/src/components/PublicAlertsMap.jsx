"use client";

import { MapPin } from "lucide-react";
import { PublicSriLankaMap } from "@/components/PublicSriLankaMap";

export function PublicAlertsMap({
  alerts = [],
  selectedDistrict = "All",
  onSelectDistrict,
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <MapPin className="h-4 w-4 text-slate-500" />
        <h2 className="text-sm font-semibold text-slate-800">Sri Lanka alert map</h2>
        <p className="text-xs text-slate-500">
          Active alert districts highlighted by severity
        </p>
      </div>

      <div className="space-y-4 p-4">
        <PublicSriLankaMap
          alerts={alerts}
          selectedDistrict={selectedDistrict}
          onSelectDistrict={onSelectDistrict}
        />

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-1 text-red-700">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            High
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-orange-700">
            <span className="h-2 w-2 rounded-full bg-orange-500" />
            Medium
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-yellow-200 bg-yellow-50 px-2 py-1 text-yellow-700">
            <span className="h-2 w-2 rounded-full bg-yellow-400" />
            Low
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600">
            <span className="h-2 w-2 rounded-full bg-slate-300" />
            No active alert
          </span>
        </div>
      </div>
    </section>
  );
}