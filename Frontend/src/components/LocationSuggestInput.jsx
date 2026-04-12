"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * Hybrid location field: shows suggestions when available; typing and submit
 * always behave like a plain text input if the suggest API fails or returns nothing.
 */
export function LocationSuggestInput({
  label,
  value,
  onChange,
  error,
  disabled,
  inputClassName,
  hint,
}) {
  const listId = useId();
  const wrapRef = useRef(null);
  const debounceRef = useRef(null);
  const reqIdRef = useRef(0);

  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const fetchSuggestions = useCallback(async (q) => {
    const trimmed = String(q || "").trim();
    const myId = ++reqIdRef.current;
    if (trimmed.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/missing-persons/location-suggest?q=${encodeURIComponent(trimmed)}`
      );
      const data = await res.json().catch(() => ({}));
      if (myId !== reqIdRef.current) return;
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      setHighlight(0);
    } catch {
      if (myId !== reqIdRef.current) return;
      setSuggestions([]);
    } finally {
      if (myId === reqIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    const trimmed = String(value || "").trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 300);
    return () => clearTimeout(debounceRef.current);
  }, [value, fetchSuggestions]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = (text) => {
    onChange(text);
    setOpen(false);
    setSuggestions([]);
  };

  const baseInput =
    inputClassName ||
    "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500";

  const showList = open && suggestions.length > 0;

  return (
    <div ref={wrapRef} className="relative">
      {label ? (
        <label className="block text-sm font-medium text-slate-700">{label}</label>
      ) : null}
      <input
        type="text"
        value={value}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-autocomplete="list"
        aria-busy={loading}
        className={baseInput}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((i) => (i + 1) % suggestions.length);
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((i) => (i - 1 + suggestions.length) % suggestions.length);
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            pick(suggestions[highlight] || suggestions[0]);
          }
        }}
      />
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
        >
          {suggestions.map((s, idx) => (
            <li key={`${s}-${idx}`} role="none">
              <button
                type="button"
                role="option"
                aria-selected={idx === highlight}
                className={`flex w-full items-start px-3 py-2 text-left hover:bg-slate-50 ${
                  idx === highlight ? "bg-sky-50 text-slate-900" : "text-slate-800"
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
