"use client";

import { useState } from "react";
import { Loader2, Sparkles, Trash2 } from "lucide-react";

/**
 * Tattoos, scars, birthmarks, piercings, other marks, clothing, jewellery and
 * personal items. Same shape as the backend's personDetails.cleanFeatures, so
 * officer scans and public reports are compared like with like.
 */

export const MARK_FIELDS = [
  { key: "bodyLocation", label: "Body location", placeholder: "e.g. left forearm" },
  { key: "description", label: "Description", placeholder: "Shape, size, colour, design" },
  { key: "visibleText", label: "Text in mark", placeholder: "Exact letters, if any" },
];
export const ITEM_FIELDS = [
  { key: "item", label: "Item", placeholder: "e.g. T-shirt, ring" },
  { key: "color", label: "Colour", placeholder: "" },
  { key: "bodyLocation", label: "Worn / found on", placeholder: "" },
  { key: "description", label: "Description", placeholder: "Pattern, logo, printed text" },
];
export const MARK_SECTIONS = [
  ["tattoos", "Tattoos", "පච්ච"],
  ["scars", "Scars", "කැළැල්"],
  ["birthmarks", "Birthmarks", "උපන් ලප"],
  ["piercings", "Piercings", "සිදුරු කිරීම්"],
  ["otherMarks", "Other distinguishing features", "වෙනත් විශේෂ ලක්ෂණ"],
];
export const ITEM_SECTIONS = [
  ["clothing", "Clothing", "ඇඳුම්"],
  ["jewellery", "Jewellery", "ආභරණ"],
  ["personalItems", "Personal items", "පුද්ගලික භාණ්ඩ"],
];
const LIST_KEYS = [...MARK_SECTIONS, ...ITEM_SECTIONS].map(([key]) => key);

const inputClass =
  "mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

export function TextField({ label, value, onChange, placeholder, type = "text", className = "" }) {
  return (
    <label className={`block text-xs font-semibold text-slate-600 ${className}`}>
      {label}
      <input type={type} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    </label>
  );
}

export function ListEditor({ title, items, fields, onChange }) {
  const list = Array.isArray(items) ? items : [];
  const blank = Object.fromEntries(fields.map((f) => [f.key, ""]));
  const update = (index, key, value) => onChange(list.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-slate-900">{title} <span className="ml-1 text-xs font-bold text-indigo-600">{list.length}</span></h4>
        <button type="button" onClick={() => onChange([...list, blank])} className="text-xs font-bold text-indigo-700 hover:text-indigo-900">+ Add</button>
      </div>
      {list.length === 0 ? <p className="mt-2 text-xs text-slate-500">None recorded.</p> : null}
      {list.map((item, index) => (
        <div key={index} className="mt-3 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-[repeat(auto-fit,minmax(140px,1fr))_auto] sm:items-end">
          {fields.map((field) => (
            <TextField key={field.key} label={field.label} placeholder={field.placeholder} value={item[field.key]} onChange={(v) => update(index, field.key, v)} />
          ))}
          <button type="button" onClick={() => onChange(list.filter((_, i) => i !== index))} className="mb-1 inline-flex h-10 items-center justify-center rounded-lg px-2 text-rose-600 hover:bg-rose-50" aria-label={`Remove ${title} entry`}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Number of entries across all feature lists. */
export function countFeatures(features) {
  return LIST_KEYS.reduce((sum, key) => sum + (features?.[key]?.length || 0), 0) + (features?.visibleText?.length || 0);
}

/** Adds suggested entries that are not already in the lists. */
function mergeFeatures(current = {}, suggested = {}) {
  const merged = { ...current };
  const same = (a, b) => JSON.stringify(a).toLowerCase() === JSON.stringify(b).toLowerCase();
  for (const key of LIST_KEYS) {
    const existing = current[key] || [];
    merged[key] = [...existing, ...(suggested[key] || []).filter((s) => !existing.some((e) => same(e, s)))];
  }
  merged.visibleText = [...new Set([...(current.visibleText || []), ...(suggested.visibleText || [])])];
  return merged;
}

/**
 * Editable features plus an optional "Suggest from photo" button.
 * @param {{features: object, onChange: Function, photo?: File|null, suggestUrl?: string, authHeaders?: Function, si?: boolean}} props
 */
export default function IdentifyingFeaturesEditor({ features, onChange, photo, suggestUrl, authHeaders, si = false }) {
  const [suggesting, setSuggesting] = useState(false);
  const [note, setNote] = useState("");
  const tr = (en, siText) => (si ? siText : en);
  const value = features || {};
  const set = (key) => (list) => onChange({ ...value, [key]: list });

  async function suggest() {
    if (!photo || !suggestUrl) return;
    setSuggesting(true);
    setNote("");
    try {
      const body = new FormData();
      body.append("photo", photo);
      const response = await fetch(suggestUrl, { method: "POST", headers: authHeaders ? authHeaders() : {}, body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Could not read the photo.");
      const before = countFeatures(value);
      const merged = mergeFeatures(value, data.features || {});
      onChange(merged);
      const added = countFeatures(merged) - before;
      setNote(added
        ? tr(`${added} suggestion(s) added from the photo. Check each one and remove anything wrong.`, `ඡායාරූපයෙන් යෝජනා ${added}ක් එක් කරන ලදී. එක් එක් එක පරීක්ෂා කරන්න.`)
        : tr("No new features were found in the photo.", "ඡායාරූපයෙන් නව ලක්ෂණ හමු නොවීය."));
    } catch (error) {
      setNote(error?.message || "Could not read the photo.");
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <div className="space-y-3">
      {suggestUrl ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 text-sm text-indigo-900">
          <button
            type="button"
            onClick={suggest}
            disabled={!photo || suggesting}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-600 disabled:opacity-50"
          >
            {suggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {suggesting ? tr("Reading photo (up to a minute)…", "ඡායාරූපය කියවමින්…") : tr("Suggest from photo", "ඡායාරූපයෙන් යෝජනා කරන්න")}
          </button>
          <span className="text-xs">
            {note || (photo
              ? tr("AI can fill these in from the photo. You check them before submitting.", "AI මඟින් ඡායාරූපයෙන් පුරවිය හැක. යැවීමට පෙර පරීක්ෂා කරන්න.")
              : tr("Choose a photo below to get AI suggestions, or add details yourself.", "AI යෝජනා සඳහා පහතින් ඡායාරූපයක් තෝරන්න."))}
          </span>
        </div>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {MARK_SECTIONS.map(([key, title, siTitle]) => (
          <ListEditor key={key} title={tr(title, siTitle)} items={value[key]} fields={MARK_FIELDS} onChange={set(key)} />
        ))}
        {ITEM_SECTIONS.map(([key, title, siTitle]) => (
          <ListEditor key={key} title={tr(title, siTitle)} items={value[key]} fields={ITEM_FIELDS} onChange={set(key)} />
        ))}
      </div>
      <TextField
        label={tr("Other readable text, e.g. name on a shirt or bracelet (comma separated)", "වෙනත් කියවිය හැකි පාඨ (කොමාවෙන් වෙන් කරන්න)")}
        value={(value.visibleText || []).join(", ")}
        onChange={(v) => onChange({ ...value, visibleText: v.split(",").map((s) => s.trimStart()) })}
      />
    </div>
  );
}
