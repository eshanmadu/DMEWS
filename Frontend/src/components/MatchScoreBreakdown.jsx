"use client";

const BAR_STYLES = {
  location: "from-sky-500 to-cyan-500",
  age: "from-violet-500 to-purple-500",
  date: "from-amber-400 to-orange-500",
  gender: "from-fuchsia-500 to-pink-500",
  name: "from-emerald-500 to-teal-500",
};

/**
 * @param {{ breakdown: { total?: number, maxTotal?: number, categories?: Array<{ id: string, label: string, earned: number, max: number, skipped?: boolean, note?: string }> } | null | undefined }} props
 */
export function MatchScoreBreakdown({ breakdown, compact = false }) {
  if (!breakdown?.categories?.length) return null;

  const total = Number(breakdown.total ?? 0);
  const maxTotal = Number(breakdown.maxTotal ?? 120);
  const overallPct = maxTotal > 0 ? Math.min(100, Math.round((total / maxTotal) * 100)) : 0;

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Score breakdown
        </span>
        <span className="text-xs font-bold text-slate-800">
          {total} / {maxTotal}{" "}
          <span className="font-normal text-slate-500">({overallPct}%)</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/90">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-sky-500 transition-all duration-500"
          style={{ width: `${overallPct}%` }}
        />
      </div>
      <ul className="space-y-2.5">
        {breakdown.categories.map((cat) => {
          const max = Number(cat.max) || 0;
          const earned = Number(cat.earned) || 0;
          const skipped = Boolean(cat.skipped);
          const barPct = max > 0 && !skipped ? Math.min(100, Math.round((earned / max) * 100)) : 0;
          const grad = BAR_STYLES[cat.id] || "from-slate-400 to-slate-500";

          return (
            <li key={cat.id}>
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-medium text-slate-700">{cat.label}</span>
                <span className="font-mono text-slate-500">
                  {skipped ? (
                    <span className="text-slate-400">Optional · not used</span>
                  ) : (
                    <>
                      +{earned} <span className="text-slate-400">/ {max}</span>
                    </>
                  )}
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                {skipped ? (
                  <div className="h-full w-full bg-[repeating-linear-gradient(45deg,#e2e8f0,#e2e8f0_4px,#f1f5f9_4px,#f1f5f9_8px)]" />
                ) : (
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${grad} transition-all duration-500`}
                    style={{ width: `${barPct}%` }}
                  />
                )}
              </div>
              {cat.note ? (
                <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{cat.note}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
