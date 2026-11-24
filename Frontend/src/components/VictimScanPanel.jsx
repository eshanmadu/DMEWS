"use client";

import { useState } from "react";
import { AlertTriangle, ImagePlus, Loader2, ScanFace, Sparkles, X } from "lucide-react";
import { ITEM_FIELDS, ITEM_SECTIONS, ListEditor, MARK_FIELDS, MARK_SECTIONS, TextField } from "@/components/IdentifyingFeaturesEditor";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const MAX_PHOTOS = 4;

const FACE_STATUS_TEXT = {
  ok: "A clear face was found and will be compared with missing-person photos.",
  no_face: "No face was found in the photos. Matching will use the details only.",
  multiple_faces: "Several faces were found and none is clearly the main one. Matching will use the details only.",
  error: "The face service could not process the photos. Matching will use the details only.",
};

function authHeaders() {
  const token = window.localStorage.getItem("dmews_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || `Request failed (${response.status}).`);
  return data;
}

function Choice({ label, value, options, onChange }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-600">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${value === option ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300"}`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReviewForm({ scan, details, setDetails, onSubmit, onCancel, submitting, error }) {
  const set = (key) => (value) => setDetails({ ...details, [key]: value });
  const aiOk = scan.extraction?.status === "ok";
  const warnings = scan.face?.quality?.warnings || [];
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="mt-5 space-y-4">
      <div className={`flex gap-3 rounded-xl border p-4 text-sm ${aiOk ? "border-indigo-200 bg-indigo-50 text-indigo-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
        {aiOk ? <Sparkles className="h-5 w-5 shrink-0" /> : <AlertTriangle className="h-5 w-5 shrink-0" />}
        <div>
          <p className="font-semibold">{aiOk ? "Pre-filled by AI — check every field against the photos" : "Manual entry needed"}</p>
          <p className="mt-1">{aiOk ? "AI can miss or misread marks. You are responsible for the final details." : scan.extraction?.error || "AI unavailable."}</p>
          {aiOk && scan.aiDetails?.uncertainties ? <p className="mt-1"><span className="font-semibold">AI could not determine:</span> {scan.aiDetails.uncertainties}</p> : null}
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <p className="flex items-center gap-2 font-semibold text-slate-900"><ScanFace className="h-4 w-4 text-indigo-600" />Face check</p>
        <p className="mt-1">{FACE_STATUS_TEXT[scan.face?.status] || FACE_STATUS_TEXT.error}</p>
        {warnings.length ? <p className="mt-1 text-amber-700">Quality: {warnings.map((w) => w.replace(/_/g, " ")).join(", ")}</p> : null}
      </div>

      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2">
        <TextField label="Found location (required)" value={details.foundLocation} onChange={set("foundLocation")} placeholder="Town, shelter or incident area" />
        <TextField label="Date found" type="date" value={details.foundDate} onChange={set("foundDate")} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Age from" type="number" value={details.estimatedAgeMin} onChange={set("estimatedAgeMin")} />
          <TextField label="Age to" type="number" value={details.estimatedAgeMax} onChange={set("estimatedAgeMax")} />
        </div>
        <Choice label="Sex" value={details.sex} options={["male", "female", "unknown"]} onChange={set("sex")} />
        <Choice label="Build" value={details.build} options={["slim", "medium", "heavy", "unknown"]} onChange={set("build")} />
        <Choice label="Hair length" value={details.hairLength} options={["bald", "short", "medium", "long", "unknown"]} onChange={set("hairLength")} />
        <TextField label="Skin tone" value={details.skinTone} onChange={set("skinTone")} />
        <TextField label="Hair colour" value={details.hairColor} onChange={set("hairColor")} />
        <TextField label="Facial hair" value={details.facialHair} onChange={set("facialHair")} />
        <TextField label="Other readable text (comma separated)" value={(details.visibleText || []).join(", ")} onChange={(v) => set("visibleText")(v.split(",").map((s) => s.trimStart()))} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {MARK_SECTIONS.map(([key, title]) => <ListEditor key={key} title={title} items={details[key]} fields={MARK_FIELDS} onChange={set(key)} />)}
        {ITEM_SECTIONS.map(([key, title]) => <ListEditor key={key} title={title} items={details[key]} fields={ITEM_FIELDS} onChange={set(key)} />)}
      </div>

      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2">
        <label className="block text-xs font-semibold text-slate-600">Summary
          <textarea rows={3} value={details.summary || ""} onChange={(e) => set("summary")(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
        </label>
        <label className="block text-xs font-semibold text-slate-600">Officer notes
          <textarea rows={3} value={details.notes || ""} onChange={(e) => set("notes")(e.target.value)} placeholder="Optional incident context" className="mt-1 w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
        </label>
      </div>

      {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
        <button type="submit" disabled={submitting || !String(details.foundLocation || "").trim()} className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-60">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanFace className="h-4 w-4" />}Confirm details and find matches
        </button>
      </div>
    </form>
  );
}

function Results({ scan, onReset }) {
  const matches = scan.matches || [];
  const stats = scan.analysisStats || {};
  return (
    <div className="mt-5 space-y-4">
      <div className={`rounded-xl border p-4 text-sm ${scan.status === "completed" ? "border-slate-200 bg-white text-slate-700" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
        <p className="font-semibold text-slate-900">{matches.length ? `${matches.length} potential match${matches.length === 1 ? "" : "es"} to review` : "No potential match"}</p>
        <p className="mt-1">{scan.serviceMessage}</p>
        {stats.candidates != null ? (
          <p className="mt-1 text-xs text-slate-500">
            {stats.candidates} record(s) checked · {stats.queryHasFace ? `${stats.comparedFaces || 0} compared by face` : "no usable face, details only"} · {stats.markQueries || 0} mark(s)/item(s) compared{stats.excludedByDate ? ` · ${stats.excludedByDate} excluded (reported missing after the found date)` : ""}
          </p>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {matches.map((match, index) => (
          <article key={match.personId} className="flex gap-3 rounded-xl border border-sky-100 bg-sky-50/60 p-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-sky-100 bg-white">
              {match.person?.photoUrl ? <img src={match.person.photoUrl} alt={`${match.person.fullName} reference`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[10px] font-bold text-slate-400">No photo</div>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-slate-900">{index + 1}. {match.person?.fullName || "Missing-person record"}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${match.matchType === "face" ? (match.band === "strong" ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800") : "bg-amber-100 text-amber-900"}`}>
                  {match.matchType === "face" ? `${match.band === "strong" ? "Strong" : "Possible"} face` : "Details only"}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600">{match.person?.lastSeenLocation || "Location unavailable"}{match.person?.age != null ? ` · age ${match.person.age}` : ""}{match.person?.gender ? ` · ${match.person.gender}` : ""}</p>
              <p className="mt-1 text-xs text-slate-600">
                Evidence score <span className="font-bold text-slate-900">{match.score ?? match.metadataScore ?? 0}/100</span>
              </p>
              {(match.evidence || []).length ? (
                <ul className="mt-2 space-y-1 border-t border-sky-100 pt-2">
                  {match.evidence.map((item, i) => (
                    <li key={i} className="flex gap-2 text-xs">
                      <span className={`w-8 shrink-0 font-bold ${item.points < 0 ? "text-rose-600" : "text-emerald-700"}`}>{item.points > 0 ? "+" : ""}{item.points}</span>
                      <span className="text-slate-700"><span className="font-semibold">{item.label}</span>{item.detail ? <span className="text-slate-500"> — {item.detail}</span> : null}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-2 text-xs font-semibold text-rose-700">{match.reason || "Potential match only — verify official identity."}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={onReset} className="rounded-xl bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-600">Start a new scan</button>
      </div>
    </div>
  );
}

export default function VictimScanPanel() {
  const [files, setFiles] = useState([]);
  const [scan, setScan] = useState(null);
  const [details, setDetails] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  function addFiles(list) {
    const images = Array.from(list || [])
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({ file, url: URL.createObjectURL(file) }));
    setFiles((current) => [...current, ...images].slice(0, MAX_PHOTOS));
  }

  function removeFile(index) {
    URL.revokeObjectURL(files[index].url);
    setFiles(files.filter((_, i) => i !== index));
  }

  function reset() {
    files.forEach((entry) => URL.revokeObjectURL(entry.url));
    setFiles([]);
    setScan(null);
    setDetails(null);
    setResult(null);
    setError("");
  }

  async function analysePhotos() {
    setBusy("extract");
    setError("");
    try {
      const body = new FormData();
      files.forEach((entry) => body.append("images", entry.file));
      const data = await request("/victim-access/scans", { method: "POST", body });
      setScan(data.scan);
      setDetails(data.scan.details || {});
    } catch (err) {
      setError(err?.message || "Photo analysis failed.");
    } finally {
      setBusy("");
    }
  }

  async function findMatches() {
    setBusy("match");
    setError("");
    try {
      const data = await request(`/victim-access/scans/${scan.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ details }),
      });
      setResult(data.scan);
    } catch (err) {
      setError(err?.message || "Matching failed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <ScanFace className="mt-0.5 h-6 w-6 text-indigo-700" />
        <div>
          <h2 className="text-lg font-bold text-slate-900">Identify a person from photos</h2>
          <p className="mt-1 text-sm text-slate-600">
            Upload the face and any tattoo, scar or clothing close-ups. AI fills in the details, you confirm them, then DMEWS ranks potential matches. Photos are analysed by the DMEWS AI service and are not stored.
          </p>
        </div>
      </div>

      {!scan ? (
        <div className="mt-5">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-300 bg-white px-4 py-8 text-center text-sm text-indigo-800 hover:bg-indigo-50"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}>
            <ImagePlus className="h-7 w-7" />
            <span className="font-semibold">Choose or drop photos (up to {MAX_PHOTOS})</span>
            <span className="text-xs text-slate-500">Face photo first works best. JPEG or PNG, up to 10MB each.</span>
            <input type="file" accept="image/*" multiple className="hidden" disabled={files.length >= MAX_PHOTOS}
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </label>
          {files.length ? (
            <div className="mt-4 flex flex-wrap gap-3">
              {files.map((entry, index) => (
                <div key={entry.url} className="relative h-24 w-24 overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <img src={entry.url} alt={`Photo ${index + 1}`} className="h-full w-full object-cover" />
                  <button type="button" onClick={() => removeFile(index)} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-slate-700 hover:text-rose-600" aria-label={`Remove photo ${index + 1}`}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                  {index === 0 ? <span className="absolute bottom-1 left-1 rounded bg-indigo-700 px-1.5 py-0.5 text-[10px] font-bold text-white">1st</span> : null}
                </div>
              ))}
            </div>
          ) : null}
          {error ? <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={analysePhotos} disabled={!files.length || busy === "extract"} className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-60">
              {busy === "extract" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {busy === "extract" ? "Reading photos (up to a minute)…" : `Analyse ${files.length || ""} photo${files.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      ) : result ? (
        <Results scan={result} onReset={reset} />
      ) : (
        <ReviewForm scan={scan} details={details} setDetails={setDetails} onSubmit={findMatches} onCancel={reset} submitting={busy === "match"} error={error} />
      )}
    </section>
  );
}
