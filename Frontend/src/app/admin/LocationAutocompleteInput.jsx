"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function LocationAutocompleteInput({
  value,
  onChange,
  onSelectLocation,
  label = "Affected Area",
  placeholder = "Type an area, district, or place...",
  error = "",
}) {
  const [query, setQuery] = useState(value || "");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const wrapperRef = useRef(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    const handleOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 3) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      setFetchError("");
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setFetchError("");

        const res = await fetch(
          `${API_BASE}/geocode/suggest?q=${encodeURIComponent(trimmed)}`,
          { cache: "no-store" }
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.message || "Failed to fetch suggestions.");
        }

        setSuggestions(data?.suggestions || []);
        setOpen(true);
      } catch (err) {
        setFetchError(err?.message || "Failed to fetch suggestions.");
        setSuggestions([]);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  function handleInputChange(e) {
    const next = e.target.value;
    setQuery(next);
    onChange?.(next);
  }

  function handleSelect(item) {
    setQuery(item.name);
    onChange?.(item.name);
    onSelectLocation?.({
      affectedArea: item.name,
      latitude: item.latitude,
      longitude: item.longitude,
    });
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div className="space-y-1.5" ref={wrapperRef}>
      <label className="text-sm font-medium text-slate-700">{label}</label>

      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0 || fetchError) setOpen(true);
          }}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
        />

        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        )}

        {open && (suggestions.length > 0 || fetchError) && (
          <div className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
            {fetchError ? (
              <div className="px-4 py-3 text-sm text-red-700">{fetchError}</div>
            ) : (
              suggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="block w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 last:border-b-0"
                >
                  <p className="text-sm font-medium text-slate-900">{item.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.latitude?.toFixed?.(5)}, {item.longitude?.toFixed?.(5)}
                  </p>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : (
        <p className="text-xs text-slate-500">
          Type at least 3 characters and choose the correct place from suggestions.
        </p>
      )}
    </div>
  );
}