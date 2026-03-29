"use client";

import { useState } from "react";
import Loader from "@/components/Loader";
import { TriangleAlert, ShieldAlert, Clock3, MapPin, FileText } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const DISASTER_TYPES = [
  "Flood",
  "Landslide",
  "Cyclone",
  "Tsunami",
];

const SEVERITY_LEVELS = [
  { value: "Low", label: "Low" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" },
];

const INITIAL_FORM = {
  disasterType: "",
  severity: "",
  affectedArea: "",
  startTime: "",
  expectedEndTime: "",
  description: "",
  safetyInstructions: "",
  status: "Active",
};

export function AdminCreateAlert() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    setError(null);
    setSuccess(null);
  }

  function validateForm() {
    const errors = {};

    if (!form.disasterType.trim()) errors.disasterType = "Disaster type is required.";
    if (!form.severity.trim()) errors.severity = "Severity level is required.";
    if (!form.affectedArea.trim()) errors.affectedArea = "Affected area is required.";
    if (!form.startTime) errors.startTime = "Start time is required.";
    if (!form.expectedEndTime) errors.expectedEndTime = "Expected end time is required.";
    if (!form.description.trim()) errors.description = "Description is required.";
    if (!form.safetyInstructions.trim()) errors.safetyInstructions = "Safety instructions are required.";

    if (form.startTime && form.expectedEndTime) {
      const start = new Date(form.startTime);
      const end = new Date(form.expectedEndTime);

      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end <= start) {
        errors.expectedEndTime = "Expected end time must be later than start time.";
      }
    }

    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const errors = validateForm();
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      const payload = {
        ...form,
      };

      const res = await fetch(`${API_BASE}/alerts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message || "Failed to create alert.");
        setSubmitting(false);
        return;
      }

      setSuccess("Alert created successfully.");
      setForm(INITIAL_FORM);
      setFieldErrors({});
    } catch (err) {
      setError(err?.message || "Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setForm(INITIAL_FORM);
    setFieldErrors({});
    setError(null);
    setSuccess(null);
  }

  return (
    <div className="space-y-6">
      {(error || success) && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            error
              ? "border border-red-200 bg-red-50/80 text-red-800"
              : "border border-emerald-200 bg-emerald-50/80 text-emerald-800"
          }`}
        >
          {error || success}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
          <TriangleAlert className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">Create disaster alert</h2>
          <p className="text-xs text-slate-500">Issue a new public warning with severity, timing, and safety instructions.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Disaster type */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Disaster type</label>
              <select
                name="disasterType"
                value={form.disasterType}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
              >
                <option value="">Select disaster type</option>
                {DISASTER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              {fieldErrors.disasterType && (
                <p className="text-xs text-red-600">{fieldErrors.disasterType}</p>
              )}
            </div>

            {/* Severity */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Severity level</label>
              <select
                name="severity"
                value={form.severity}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
              >
                <option value="">Select severity</option>
                {SEVERITY_LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
              {fieldErrors.severity && (
                <p className="text-xs text-red-600">{fieldErrors.severity}</p>
              )}
            </div>

            {/* Affected area */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Affected area</label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  name="affectedArea"
                  value={form.affectedArea}
                  onChange={handleChange}
                  placeholder="Enter district, city, or area name"
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                />
              </div>
              {fieldErrors.affectedArea && (
                <p className="text-xs text-red-600">{fieldErrors.affectedArea}</p>
              )}
            </div>

            {/* Start time */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Start time</label>
              <div className="relative">
                <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="datetime-local"
                  name="startTime"
                  value={form.startTime}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                />
              </div>
              {fieldErrors.startTime && (
                <p className="text-xs text-red-600">{fieldErrors.startTime}</p>
              )}
            </div>

            {/* Expected end time */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Expected end time</label>
              <div className="relative">
                <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="datetime-local"
                  name="expectedEndTime"
                  value={form.expectedEndTime}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                />
              </div>
              {fieldErrors.expectedEndTime && (
                <p className="text-xs text-red-600">{fieldErrors.expectedEndTime}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Description</label>
              <div className="relative">
                <FileText className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Describe the disaster situation and current warning details"
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                />
              </div>
              {fieldErrors.description && (
                <p className="text-xs text-red-600">{fieldErrors.description}</p>
              )}
            </div>

            {/* Safety instructions */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Safety instructions</label>
              <div className="relative">
                <ShieldAlert className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <textarea
                  name="safetyInstructions"
                  value={form.safetyInstructions}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Enter safety guidance for the public"
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                />
              </div>
              {fieldErrors.safetyInstructions && (
                <p className="text-xs text-red-600">{fieldErrors.safetyInstructions}</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
            New alerts will be created with status{" "}
            <span className="font-semibold">Active</span>.
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleReset}
              disabled={submitting}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Reset
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting && <Loader size="sm" />}
              {submitting ? "Creating..." : "Create alert"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

