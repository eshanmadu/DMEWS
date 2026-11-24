"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, CircleHelp, Eye, EyeOff, History, Loader2, RotateCcw, Trash2, XCircle } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function authHeaders() {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("dmews_token") : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, { cache: "no-store", ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || `Request failed (${response.status}).`);
  return data;
}

const DECISIONS = {
  pending: { label: "Not reviewed", className: "bg-slate-100 text-slate-700" },
  confirmed: { label: "Confirmed", className: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Rejected", className: "bg-rose-100 text-rose-800" },
  needs_verification: { label: "Needs verification", className: "bg-amber-100 text-amber-900" },
};
const CASE_STATUS = {
  open: "bg-sky-100 text-sky-800",
  identified: "bg-emerald-100 text-emerald-800",
  closed: "bg-slate-200 text-slate-700",
};
const ACTION_LABELS = {
  scan_created: "Scan created",
  details_confirmed: "Details confirmed and matching run",
  photo_viewed: "Photo viewed",
  match_confirmed: "Match confirmed",
  match_rejected: "Match rejected",
  match_needs_verification: "Marked as needing verification",
  match_reset: "Decision reset",
  match_added: "New suggestion from a later report",
  case_closed: "Case closed",
  photos_deleted: "Photos deleted",
};
const MARK_KEYS = [["tattoos", "Tattoo"], ["scars", "Scar"], ["birthmarks", "Birthmark"], ["piercings", "Piercing"], ["otherMarks", "Other feature"]];
const ITEM_KEYS = [["clothing", "Clothing"], ["jewellery", "Jewellery"], ["personalItems", "Personal item"]];

const date = (value) => (value ? new Date(value).toLocaleDateString("en-GB") : "—");
const dateTime = (value) => (value ? new Date(value).toLocaleString("en-GB") : "—");

function featureLines(features) {
  if (!features) return [];
  const lines = [];
  for (const [key, word] of MARK_KEYS) {
    for (const m of features[key] || []) {
      lines.push(`${word}${m.bodyLocation ? ` (${m.bodyLocation})` : ""}: ${m.description || "—"}${m.visibleText ? ` — text "${m.visibleText}"` : ""}`);
    }
  }
  for (const [key, word] of ITEM_KEYS) {
    for (const i of features[key] || []) {
      lines.push(`${word}: ${[i.color, i.item, i.description].filter(Boolean).join(" ")}${i.bodyLocation ? ` (${i.bodyLocation})` : ""}`);
    }
  }
  for (const t of features.visibleText || []) lines.push(`Readable text: "${t}"`);
  return lines;
}

/** Scan photo fetched with the admin's token; blurred until revealed (may be graphic). */
function ScanPhoto({ scanId, index, label }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [revealed, setRevealed] = useState(false);

  async function reveal() {
    if (!url) {
      try {
        const response = await fetch(`${API_BASE}/victim-access/scans/${scanId}/photos/${index}`, { headers: authHeaders(), cache: "no-store" });
        if (!response.ok) throw new Error((await response.json().catch(() => ({})))?.message || "Photo unavailable.");
        setUrl(URL.createObjectURL(await response.blob()));
      } catch (err) {
        setError(err?.message || "Photo unavailable.");
        return;
      }
    }
    setRevealed(true);
  }

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  return (
    <figure className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
      <div className="relative flex aspect-[4/5] items-center justify-center">
        {url ? <img src={url} alt={label} className={`h-full w-full object-contain transition ${revealed ? "" : "scale-110 blur-2xl"}`} /> : null}
        {!revealed ? (
          <button type="button" onClick={reveal} className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/70 text-center text-sm font-semibold text-white">
            <Eye className="h-6 w-6" />
            {error || "Show photo (may be graphic) — viewing is logged"}
          </button>
        ) : (
          <button type="button" onClick={() => setRevealed(false)} className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-slate-700" aria-label="Hide photo">
            <EyeOff className="h-4 w-4" />
          </button>
        )}
      </div>
      <figcaption className="bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">{label}</figcaption>
    </figure>
  );
}

function CompareRow({ label, scan, report }) {
  return (
    <tr className="border-t border-slate-100 align-top">
      <th className="w-32 py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</th>
      <td className="py-2 pr-3 text-sm text-slate-800">{scan || "—"}</td>
      <td className="py-2 text-sm text-slate-800">{report || "—"}</td>
    </tr>
  );
}

function DecisionPanel({ match, disabled, onDecide }) {
  const [note, setNote] = useState(match.decision?.note || "");
  const [busy, setBusy] = useState("");
  useEffect(() => setNote(match.decision?.note || ""), [match.personId, match.decision?.note]);

  async function decide(decision) {
    setBusy(decision);
    await onDecide(match.personId, decision, note);
    setBusy("");
  }

  const button = (decision, label, Icon, className) => (
    <button type="button" disabled={disabled || Boolean(busy)} onClick={() => decide(decision)}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 ${className}`}>
      {busy === decision ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}{label}
    </button>
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-900">Your decision</p>
      <p className="mt-1 text-xs text-slate-600">
        Confirm only after independent verification (DNA, fingerprints, dental records, official documents or family viewing through the proper process). Record how it was verified.
      </p>
      <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} disabled={disabled}
        placeholder="Verification method, reasons, reference numbers…"
        className="mt-3 w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
      <div className="mt-3 flex flex-wrap gap-2">
        {button("confirmed", "Confirm identity", CheckCircle2, "bg-emerald-700 text-white hover:bg-emerald-600")}
        {button("needs_verification", "Needs verification", CircleHelp, "bg-amber-500 text-white hover:bg-amber-400")}
        {button("rejected", "Not this person", XCircle, "bg-rose-600 text-white hover:bg-rose-500")}
        {match.decision?.status !== "pending" ? button("pending", "Reset", RotateCcw, "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100") : null}
      </div>
      {match.decision?.at ? (
        <p className="mt-3 text-xs text-slate-500">Last decision by {match.decision.byEmail || "—"} on {dateTime(match.decision.at)}</p>
      ) : null}
    </div>
  );
}

export default function VictimScanReviewPage() {
  const { id } = useParams();
  const router = useRouter();
  const [scan, setScan] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [closeNote, setCloseNote] = useState("");
  const [closing, setClosing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await request(`/victim-access/admin/scans/${id}`);
      setScan(data.scan);
      setSelectedId((current) => current || data.scan.identifiedPersonId || data.scan.matches?.[0]?.personId || "");
      setError("");
    } catch (err) {
      setError(err?.message || "Could not load the scan.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function decide(personId, decision, note) {
    try {
      const data = await request(`/victim-access/admin/scans/${id}/matches/${personId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note }),
      });
      setScan(data.scan);
      setError("");
    } catch (err) {
      setError(err?.message || "Could not save the decision.");
    }
  }

  async function deleteCase() {
    const ok = window.confirm(
      "Permanently delete this case?\n\nThe scan, its photos, the details, all suggestions and decisions, and its activity log will be deleted and cannot be recovered."
    );
    if (!ok) return;
    setClosing(true);
    try {
      await request(`/victim-access/admin/scans/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: closeNote }),
      });
      router.push("/admin/victim-identification");
    } catch (err) {
      setError(err?.message || "Could not delete the case.");
      setClosing(false);
    }
  }

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-sky-600" /></div>;
  if (!scan) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">{error || "Scan not found."}</div>;

  const details = scan.details || {};
  const match = (scan.matches || []).find((m) => m.personId === selectedId);
  const person = match?.person;
  const closed = scan.caseStatus === "closed";
  const facePhoto = scan.photoIndexes?.includes(scan.face?.imageIndex) ? scan.face.imageIndex : scan.photoIndexes?.[0];
  const ageRange = details.estimatedAgeMin != null || details.estimatedAgeMax != null
    ? `${details.estimatedAgeMin ?? "?"}–${details.estimatedAgeMax ?? "?"} (estimate)` : "";

  return (
    <div className="space-y-6">
      <Link href="/admin/victim-identification" className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:text-sky-900">
        <ArrowLeft className="h-4 w-4" />Back to all scans
      </Link>

      <header className="flex flex-col gap-4 rounded-2xl bg-slate-950 px-6 py-6 text-white sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${CASE_STATUS[scan.caseStatus] || CASE_STATUS.open}`}>{scan.caseStatus}</span>
            <span className="text-xs text-slate-400">Scan {scan.id.slice(-6)} · {dateTime(scan.createdAt)}</span>
          </div>
          <h1 className="mt-2 text-2xl font-black">Review victim identification</h1>
          <p className="mt-1 text-sm text-slate-300">
            By {scan.officer?.name || "officer"} {scan.officer?.district ? `(${scan.officer.district})` : ""} · found at {details.foundLocation || "—"} on {details.foundDate ? date(details.foundDate) : "—"}
          </p>
        </div>
        {closed ? (
          <p className="text-sm text-slate-300">Closed {dateTime(scan.closedAt)}{scan.closeNote ? ` — ${scan.closeNote}` : ""}</p>
        ) : (
          <div className="flex flex-col gap-2 sm:items-end">
            <input value={closeNote} onChange={(e) => setCloseNote(e.target.value)} placeholder="Reason for deletion (optional)"
              className="h-9 w-64 rounded-lg border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-slate-400" />
            <button type="button" onClick={deleteCase} disabled={closing}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-500 disabled:opacity-60">
              {closing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Delete case permanently
            </button>
          </div>
        )}
      </header>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[18rem_1fr]">
        <aside className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Suggestions ({scan.matches?.length || 0})</h2>
          {scan.newMatchCount ? (
            <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800">
              {scan.newMatchCount} new suggestion{scan.newMatchCount === 1 ? "" : "s"} from reports filed after this scan.
            </p>
          ) : null}
          {(scan.matches || []).length === 0 ? <p className="text-sm text-slate-500">No suggestions for this scan.</p> : null}
          {(scan.matches || []).map((m, index) => (
            <button key={m.personId} type="button" onClick={() => setSelectedId(m.personId)}
              className={`w-full rounded-xl border p-3 text-left transition ${m.personId === selectedId ? "border-sky-400 bg-sky-50 shadow-sm" : "border-slate-200 bg-white hover:border-sky-200"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-900">{index + 1}. {m.person?.fullName || "Record"}</span>
                <span className="text-sm font-black text-sky-700">{m.score ?? m.metadataScore ?? 0}</span>
              </div>
              <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${DECISIONS[m.decision?.status || "pending"].className}`}>
                {DECISIONS[m.decision?.status || "pending"].label}
              </span>
              {m.source === "new_report" ? (
                <span className="ml-1 mt-2 inline-block rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-800" title={`Added ${dateTime(m.addedAt)}`}>
                  From a later report
                </span>
              ) : null}
            </button>
          ))}
        </aside>

        <section className="space-y-5">
          {match ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-bold text-slate-900">Scanned person</p>
                  {facePhoto != null ? (
                    <ScanPhoto scanId={scan.id} index={facePhoto} label={`Scan photo ${facePhoto + 1}`} />
                  ) : (
                    <div className="flex aspect-[4/5] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
                      {scan.photosDeletedAt ? `Photos deleted on ${dateTime(scan.photosDeletedAt)}` : "No stored photo for this scan"}
                    </div>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-sm font-bold text-slate-900">Missing-person report: {person?.fullName || "—"}</p>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="flex aspect-[4/5] items-center justify-center bg-slate-100">
                      {person?.photoUrl ? <img src={person.photoUrl} alt={`${person.fullName} reference`} className="h-full w-full object-contain" /> : <span className="text-sm text-slate-500">No photo in the report</span>}
                    </div>
                    <p className="px-3 py-1.5 text-xs font-semibold text-slate-600">Photo provided by the reporter</p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th />
                      <th className="pb-2 text-left text-sm font-bold text-slate-900">Scan (officer-confirmed)</th>
                      <th className="pb-2 text-left text-sm font-bold text-slate-900">Report</th>
                    </tr>
                  </thead>
                  <tbody>
                    <CompareRow label="Age" scan={ageRange} report={person?.age != null ? String(person.age) : ""} />
                    <CompareRow label="Sex" scan={details.sex !== "unknown" ? details.sex : ""} report={person?.gender} />
                    <CompareRow label="Place" scan={`Found: ${details.foundLocation || "—"}`} report={`Last seen: ${person?.lastSeenLocation || "—"}`} />
                    <CompareRow label="Date" scan={`Found: ${details.foundDate ? date(details.foundDate) : "—"}`} report={`Missing since: ${date(person?.dateMissing)}`} />
                    <CompareRow label="Appearance"
                      scan={[details.build !== "unknown" && `${details.build} build`, details.skinTone, details.hairColor && `${details.hairColor} hair`, details.hairLength !== "unknown" && details.hairLength, details.facialHair].filter(Boolean).join(", ")}
                      report={person?.description} />
                    <CompareRow label="Marks & items"
                      scan={<ul className="list-disc pl-4">{featureLines(details).map((l, i) => <li key={i}>{l}</li>)}</ul>}
                      report={featureLines(person?.identifyingFeatures).length ? <ul className="list-disc pl-4">{featureLines(person.identifyingFeatures).map((l, i) => <li key={i}>{l}</li>)}</ul> : "See description"} />
                    <CompareRow label="Notes" scan={details.notes} report={person?.reporterName ? `Reported by ${person.reporterName}${person.ifYouSeePhone ? ` · ${person.ifYouSeePhone}` : ""}` : ""} />
                  </tbody>
                </table>
              </div>

              <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4">
                <p className="text-sm font-bold text-slate-900">Why this record was suggested — score {match.score ?? match.metadataScore ?? 0}/100</p>
                <ul className="mt-2 space-y-1">
                  {(match.evidence || []).map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className={`w-9 shrink-0 font-bold ${item.points < 0 ? "text-rose-600" : "text-emerald-700"}`}>{item.points > 0 ? "+" : ""}{item.points}</span>
                      <span className="text-slate-700"><span className="font-semibold">{item.label}</span>{item.detail ? <span className="text-slate-500"> — {item.detail}</span> : null}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <DecisionPanel match={match} disabled={closed} onDecide={decide} />
            </>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Select a suggestion to compare.</p>
          )}

          {(scan.photoIndexes || []).length > 1 ? (
            <div>
              <p className="mb-2 text-sm font-bold text-slate-900">All scan photos</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {scan.photoIndexes.map((index) => <ScanPhoto key={index} scanId={scan.id} index={index} label={`Scan photo ${index + 1}`} />)}
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-slate-900"><History className="h-4 w-4 text-slate-500" />Audit log</p>
            <ul className="mt-3 divide-y divide-slate-100">
              {(scan.auditLog || []).map((entry, i) => {
                const who = scan.matches?.find((m) => m.personId === entry.personId)?.person?.fullName;
                return (
                  <li key={i} className="flex flex-col gap-0.5 py-2 text-sm sm:flex-row sm:gap-3">
                    <span className="w-44 shrink-0 text-xs text-slate-500">{dateTime(entry.at)}</span>
                    <span className="text-slate-800">
                      <span className="font-semibold">{ACTION_LABELS[entry.action] || entry.action}</span>
                      {who ? ` — ${who}` : ""}{entry.note ? <span className="text-slate-500"> · {entry.note}</span> : null}
                      <span className="text-slate-400"> · {entry.userEmail}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
