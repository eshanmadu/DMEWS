"use client";

import { useEffect, useMemo, useState } from "react";
import Loader from "@/components/Loader";
import {
  Building2,
  Plus,
  MapPin,
  Pencil,
  Trash2,
  Save,
  X,
  RefreshCw,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatLkCityLabel } from "@/lib/lkLocations";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const DISTRICTS_FALLBACK = [
  "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya",
  "Galle", "Matara", "Hambantota", "Jaffna", "Kilinochchi", "Mannar",
  "Vavuniya", "Mullaitivu", "Batticaloa", "Ampara", "Trincomalee",
  "Kurunegala", "Puttalam", "Anuradhapura", "Polonnaruwa", "Badulla",
  "Monaragala", "Ratnapura", "Kegalle",
];

const initialForm = {
  name: "",
  location: "",
  district: "",
  districtId: "",
  city: "",
  cityRowId: "",
  cityLatitude: null,
  cityLongitude: null,
  capacity: "",
  contact: "",
  notes: "",
};

export function AdminShelters() {
  const [shelters, setShelters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(initialForm);
  const [rowBusyId, setRowBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [newShelterName, setNewShelterName] = useState("");

  const [districtsList, setDistrictsList] = useState([]);
  const [formCitiesList, setFormCitiesList] = useState([]);
  const [editCitiesList, setEditCitiesList] = useState([]);
  const [formCitiesLoading, setFormCitiesLoading] = useState(false);
  const [editCitiesLoading, setEditCitiesLoading] = useState(false);

  // Filter and pagination
  const [districtFilter, setDistrictFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const districtFilterOptions =
    districtsList.length > 0
      ? [...districtsList].map((d) => d.name_en).sort((a, b) => a.localeCompare(b))
      : DISTRICTS_FALLBACK;

  // Compute filtered shelters
  const filteredShelters = districtFilter
    ? shelters.filter(s => s.district === districtFilter)
    : shelters;

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [districtFilter]);

  function loadShelters() {
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/shelters`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setShelters(data);
        else setError(data?.message || "Failed to load shelters.");
      })
      .catch((e) => setError(e?.message || "Failed to load shelters."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadShelters();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/locations/sri-lanka/districts`)
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        const list = Array.isArray(data?.districts) ? data.districts : [];
        if (!cancelled) setDistrictsList(list);
      })
      .catch(() => {
        if (!cancelled) setDistrictsList([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!form.districtId) {
      setFormCitiesList([]);
      return;
    }
    let cancelled = false;
    setFormCitiesLoading(true);
    fetch(
      `${API_BASE}/locations/sri-lanka/cities?district=${encodeURIComponent(form.districtId)}`
    )
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        const list = data?.success && Array.isArray(data.cities) ? data.cities : [];
        if (!cancelled) setFormCitiesList(list);
      })
      .catch(() => {
        if (!cancelled) setFormCitiesList([]);
      })
      .finally(() => {
        if (!cancelled) setFormCitiesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.districtId]);

  useEffect(() => {
    if (!editingId || !editForm.districtId) {
      setEditCitiesList([]);
      return;
    }
    let cancelled = false;
    setEditCitiesLoading(true);
    fetch(
      `${API_BASE}/locations/sri-lanka/cities?district=${encodeURIComponent(editForm.districtId)}`
    )
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        const list = data?.success && Array.isArray(data.cities) ? data.cities : [];
        if (!cancelled) setEditCitiesList(list);
      })
      .catch(() => {
        if (!cancelled) setEditCitiesList([]);
      })
      .finally(() => {
        if (!cancelled) setEditCitiesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editingId, editForm.districtId]);

  useEffect(() => {
    if (!editingId || !districtsList.length) return;
    setEditForm((prev) => {
      if (!prev.district || prev.districtId) return prev;
      const m = districtsList.find((x) => x.name_en === prev.district);
      return m ? { ...prev, districtId: String(m.id) } : prev;
    });
  }, [editingId, districtsList]);

  useEffect(() => {
    if (!editingId || !editCitiesList.length || !editForm.city || editForm.cityRowId) return;
    const match = editCitiesList.find((c) => {
      const label = formatLkCityLabel(c);
      const latOk =
        typeof editForm.cityLatitude === "number" &&
        typeof c.latitude === "number" &&
        Math.abs(c.latitude - editForm.cityLatitude) < 1e-5;
      return label === editForm.city && latOk;
    });
    if (match) setEditForm((p) => ({ ...p, cityRowId: String(match.id) }));
  }, [editingId, editCitiesList, editForm.city, editForm.cityLatitude, editForm.cityRowId]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.location.trim() || !form.district || form.capacity === "") {
      setError("Name, location, district, and capacity are required.");
      return;
    }
    const cap = parseInt(form.capacity, 10);
    if (isNaN(cap) || cap <= 0) {
      setError("Capacity must be a positive number.");
      return;
    }
    if (form.contact && !/^\d{10}$/.test(form.contact.trim())) {
      setError("Contact must be exactly 10 digits.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      location: form.location.trim(),
      district: form.district,
      capacity: cap,
      contact: (form.contact || "").trim(),
      notes: (form.notes || "").trim(),
      city: (form.city || "").trim(),
    };
    if (form.city && form.cityLatitude != null && form.cityLongitude != null) {
      payload.cityLatitude = form.cityLatitude;
      payload.cityLongitude = form.cityLongitude;
    }
    fetch(`${API_BASE}/shelters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.id) {
          setShelters((prev) => [{ ...data }, ...prev]);
          setNewShelterName(data.name);
          setShowConfirmModal(true);
          setForm(initialForm);
        } else {
          setError(data?.message || "Failed to add shelter.");
        }
      })
      .catch(() => setError("Network error."))
      .finally(() => setSaving(false));
  }

  function startEdit(s) {
    setEditingId(s.id);
    const dMatch = districtsList.find((x) => x.name_en === s.district);
    setEditForm({
      name: s.name || "",
      location: s.location || "",
      district: s.district || "",
      districtId: dMatch ? String(dMatch.id) : "",
      city: s.city || "",
      cityRowId: "",
      cityLatitude: typeof s.cityLatitude === "number" ? s.cityLatitude : null,
      cityLongitude: typeof s.cityLongitude === "number" ? s.cityLongitude : null,
      capacity: String(s.capacity ?? ""),
      contact: s.contact || "",
      notes: s.notes || "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(initialForm);
  }

  function handleEditChange(e) {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  }

  async function saveEdit(id) {
    if (!editForm.name.trim() || !editForm.location.trim() || !editForm.district || editForm.capacity === "") {
      setError("Name, location, district, and capacity are required.");
      return;
    }
    const cap = parseInt(editForm.capacity, 10);
    if (isNaN(cap) || cap <= 0) {
      setError("Capacity must be a positive number.");
      return;
    }
    if (editForm.contact && !/^\d{10}$/.test(editForm.contact.trim())) {
      setError("Contact must be exactly 10 digits.");
      return;
    }
    setRowBusyId(id);
    setError(null);
    try {
      const putBody = {
        name: editForm.name.trim(),
        location: editForm.location.trim(),
        district: editForm.district,
        capacity: cap,
        contact: (editForm.contact || "").trim(),
        notes: (editForm.notes || "").trim(),
        city: (editForm.city || "").trim(),
      };
      if (editForm.city && editForm.cityLatitude != null && editForm.cityLongitude != null) {
        putBody.cityLatitude = editForm.cityLatitude;
        putBody.cityLongitude = editForm.cityLongitude;
      }
      const res = await fetch(`${API_BASE}/shelters/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(putBody),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || "Failed to update shelter.");
      } else {
        setShelters((prev) => prev.map((x) => (x.id === id ? data : x)));
        cancelEdit();
      }
    } catch {
      setError("Network error.");
    } finally {
      setRowBusyId(null);
    }
  }

  async function removeShelter(id) {
    const ok = window.confirm("Delete this shelter permanently?");
    if (!ok) return;
    setRowBusyId(id);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/shelters/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Failed to delete shelter.");
      } else {
        setShelters((prev) => prev.filter((x) => x.id !== id));
        if (editingId === id) cancelEdit();
      }
    } catch {
      setError("Network error.");
    } finally {
      setRowBusyId(null);
    }
  }

  // Pagination
  const totalPages = Math.ceil(filteredShelters.length / itemsPerPage);
  const paginatedShelters = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredShelters.slice(start, start + itemsPerPage);
  }, [filteredShelters, currentPage]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100/40">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        {/* Header Section */}
        
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Add Shelter Form */}
        <section className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 p-2 shadow-md">
              <Plus className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Add new shelter</h2>
          </div>

          <form onSubmit={handleSubmit} className="mt-5">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Central School Hall"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Location <span className="text-red-500">*</span>
                </label>
                <input
                  name="location"
                  type="text"
                  value={form.location}
                  onChange={handleChange}
                  placeholder="Address or area"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  District <span className="text-red-500">*</span>
                </label>
                <select
                  name="district"
                  value={form.district}
                  onChange={(e) => {
                    const name = e.target.value;
                    const d = districtsList.find((x) => x.name_en === name);
                    setForm((prev) => ({
                      ...prev,
                      district: name,
                      districtId: d ? String(d.id) : "",
                      city: "",
                      cityRowId: "",
                      cityLatitude: null,
                      cityLongitude: null,
                    }));
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                >
                  <option value="">Select district</option>
                  {(districtsList.length
                    ? districtsList
                    : DISTRICTS_FALLBACK.map((n) => ({ id: null, name_en: n }))
                  ).map((d, idx) => (
                    <option key={String(d.id ?? `fb-${idx}`)} value={d.name_en}>
                      {d.name_en}
                    </option>
                  ))}
                </select>
                {!districtsList.length && (
                  <p className="mt-1 text-xs text-amber-800/90">Loading official district list…</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  City <span className="text-slate-400">(optional)</span>
                </label>
                <select
                  value={form.cityRowId}
                  disabled={!form.districtId || formCitiesLoading || formCitiesList.length === 0}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id) {
                      setForm((p) => ({
                        ...p,
                        cityRowId: "",
                        city: "",
                        cityLatitude: null,
                        cityLongitude: null,
                      }));
                      return;
                    }
                    const c = formCitiesList.find((x) => String(x.id) === id);
                    if (!c) return;
                    setForm((p) => ({
                      ...p,
                      cityRowId: id,
                      city: formatLkCityLabel(c),
                      cityLatitude: typeof c.latitude === "number" ? c.latitude : null,
                      cityLongitude: typeof c.longitude === "number" ? c.longitude : null,
                    }));
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-50"
                >
                  <option value="">Select city after district</option>
                  {formCitiesList.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {formatLkCityLabel(c)}
                    </option>
                  ))}
                </select>
                {form.districtId && formCitiesLoading && (
                  <p className="mt-1 text-xs text-slate-500">Loading cities…</p>
                )}
                {form.districtId && !formCitiesLoading && formCitiesList.length === 0 && (
                  <p className="mt-1 text-xs text-amber-800/90">No cities returned for this district.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Capacity <span className="text-red-500">*</span>
                </label>
                <input
                  name="capacity"
                  type="number"
                  min={0}
                  value={form.capacity}
                  onChange={handleChange}
                  placeholder="0"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Contact
                </label>
                <input
                  name="contact"
                  type="text"
                  value={form.contact}
                  onChange={handleChange}
                  placeholder="Phone or email"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Notes
                </label>
                <input
                  name="notes"
                  type="text"
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Optional notes"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                />
              </div>
            </div>
            <div className="mt-5">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg disabled:opacity-60"
              >
                {saving && <Loader size="sm" />}
                {saving ? "Adding…" : "Add shelter"}
              </button>
            </div>
          </form>
        </section>

        {/* Shelters Table */}
        <section className="rounded-2xl border border-slate-200/80 bg-white/70 shadow-sm backdrop-blur-sm transition-all hover:shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 p-2 shadow-md">
                <Building2 className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">All shelters</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {filteredShelters.length}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {/* District Filter */}
              <select
                value={districtFilter}
                onChange={(e) => setDistrictFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
              >
                <option value="">All districts</option>
                {districtFilterOptions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              {/* Refresh Button */}
              <button
                type="button"
                onClick={loadShelters}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <Loader />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="py-3 pl-5 pr-3 font-semibold text-slate-700">Name</th>
                    <th className="py-3 px-3 font-medium text-slate-600">Location</th>
                    <th className="py-3 px-3 font-medium text-slate-600">District</th>
                    <th className="py-3 px-3 font-medium text-slate-600">City</th>
                    <th className="py-3 px-3 font-medium text-slate-600">Capacity</th>
                    <th className="py-3 px-3 font-medium text-slate-600">Contact</th>
                    <th className="py-3 px-3 font-medium text-slate-600">Notes</th>
                    <th className="py-3 pr-5 pl-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredShelters.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        <MapPin className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                        {districtFilter ? `No shelters in ${districtFilter} district.` : "No shelters yet. Add one above."}
                      </td>
                    </tr>
                  ) : (
                    <>
                      {paginatedShelters.map((s) => (
                        <tr
                          key={s.id}
                          className="border-b border-slate-100 transition hover:bg-sky-50/40"
                        >
                          <td className="py-3 pl-5 pr-3 font-medium text-slate-800">
                            {editingId === s.id ? (
                              <input
                                name="name"
                                value={editForm.name}
                                onChange={handleEditChange}
                                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                              />
                            ) : (
                              s.name
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {editingId === s.id ? (
                              <input
                                name="location"
                                value={editForm.location}
                                onChange={handleEditChange}
                                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                              />
                            ) : (
                              s.location
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {editingId === s.id ? (
                              <select
                                name="district"
                                value={editForm.district}
                                onChange={(e) => {
                                  const name = e.target.value;
                                  const d = districtsList.find((x) => x.name_en === name);
                                  setEditForm((prev) => ({
                                    ...prev,
                                    district: name,
                                    districtId: d ? String(d.id) : "",
                                    city: "",
                                    cityRowId: "",
                                    cityLatitude: null,
                                    cityLongitude: null,
                                  }));
                                }}
                                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                              >
                                <option value="">Select</option>
                                {(districtsList.length
                                  ? districtsList
                                  : DISTRICTS_FALLBACK.map((n) => ({ id: null, name_en: n }))
                                ).map((d, idx) => (
                                  <option key={String(d.id ?? `fb-${idx}`)} value={d.name_en}>
                                    {d.name_en}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              s.district
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {editingId === s.id ? (
                              <select
                                value={editForm.cityRowId}
                                disabled={!editForm.districtId || editCitiesLoading || editCitiesList.length === 0}
                                onChange={(e) => {
                                  const id = e.target.value;
                                  if (!id) {
                                    setEditForm((p) => ({
                                      ...p,
                                      cityRowId: "",
                                      city: "",
                                      cityLatitude: null,
                                      cityLongitude: null,
                                    }));
                                    return;
                                  }
                                  const c = editCitiesList.find((x) => String(x.id) === id);
                                  if (!c) return;
                                  setEditForm((p) => ({
                                    ...p,
                                    cityRowId: id,
                                    city: formatLkCityLabel(c),
                                    cityLatitude: typeof c.latitude === "number" ? c.latitude : null,
                                    cityLongitude: typeof c.longitude === "number" ? c.longitude : null,
                                  }));
                                }}
                                className="w-full min-w-[140px] rounded-lg border border-slate-200 px-2 py-1 text-sm disabled:bg-slate-50"
                              >
                                <option value="">City (optional)</option>
                                {editCitiesList.map((c) => (
                                  <option key={c.id} value={String(c.id)}>
                                    {formatLkCityLabel(c)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              s.city || "—"
                            )}
                          </td>
                          <td className="py-3 px-3 tabular-nums text-slate-600">
                            {editingId === s.id ? (
                              <input
                                name="capacity"
                                type="number"
                                min={1}
                                value={editForm.capacity}
                                onChange={handleEditChange}
                                className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                              />
                            ) : (
                              s.capacity
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {editingId === s.id ? (
                              <input
                                name="contact"
                                value={editForm.contact}
                                onChange={handleEditChange}
                                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                                placeholder="10 digits"
                              />
                            ) : (
                              s.contact || "—"
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {editingId === s.id ? (
                              <input
                                name="notes"
                                value={editForm.notes}
                                onChange={handleEditChange}
                                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                              />
                            ) : (
                              s.notes || "—"
                            )}
                          </td>
                          <td className="py-3 pr-5 pl-3">
                            <div className="flex items-center gap-2">
                              {editingId === s.id ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={rowBusyId === s.id}
                                    onClick={() => saveEdit(s.id)}
                                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-70"
                                  >
                                    <Save className="h-3.5 w-3.5" /> Save
                                  </button>
                                  <button
                                    type="button"
                                    disabled={rowBusyId === s.id}
                                    onClick={cancelEdit}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                                  >
                                    <X className="h-3.5 w-3.5" /> Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    disabled={rowBusyId === s.id}
                                    onClick={() => startEdit(s)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 shadow-sm hover:bg-sky-100"
                                  >
                                    <Pencil className="h-3.5 w-3.5" /> Edit
                                  </button>
                                  <button
                                    type="button"
                                    disabled={rowBusyId === s.id}
                                    onClick={() => removeShelter(s.id)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 shadow-sm hover:bg-red-100"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 sm:px-6">
              <div className="flex flex-1 justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="relative ml-3 inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-slate-700">
                    Showing{" "}
                    <span className="font-medium">
                      {(currentPage - 1) * itemsPerPage + 1}
                    </span>{" "}
                    to{" "}
                    <span className="font-medium">
                      {Math.min(currentPage * itemsPerPage, filteredShelters.length)}
                    </span>{" "}
                    of <span className="font-medium">{filteredShelters.length}</span>{" "}
                    shelters
                  </p>
                </div>
                <div>
                  <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center rounded-l-md border border-slate-300 bg-white px-2 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 focus:z-20 disabled:opacity-40"
                    >
                      <span className="sr-only">Previous</span>
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`relative inline-flex items-center border px-4 py-2 text-sm font-medium focus:z-20 ${
                          page === currentPage
                            ? "z-10 border-sky-500 bg-sky-50 text-sky-600"
                            : "border-slate-300 bg-white text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center rounded-r-md border border-slate-300 bg-white px-2 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 focus:z-20 disabled:opacity-40"
                    >
                      <span className="sr-only">Next</span>
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-all">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex flex-col items-center gap-4 p-6 text-center">
              <div className="rounded-full bg-emerald-100 p-3">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Shelter Added!</h3>
                <p className="mt-2 text-slate-600">
                  <span className="font-medium text-sky-700">{newShelterName}</span> has been successfully added to the list.
                </p>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 px-4 py-2.5 font-semibold text-white shadow-md transition hover:scale-105 hover:shadow-lg"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}