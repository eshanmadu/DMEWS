"use client";

import { useEffect, useState } from "react";
import Loader from "@/components/Loader";
import { Building2, Plus, MapPin, Pencil, Trash2, Save, X, RefreshCw, CheckCircle } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const DISTRICTS = [
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
    fetch(`${API_BASE}/shelters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        location: form.location.trim(),
        district: form.district,
        capacity: cap,
        contact: (form.contact || "").trim(),
        notes: (form.notes || "").trim(),
      }),
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
    setEditForm({
      name: s.name || "",
      location: s.location || "",
      district: s.district || "",
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
      const res = await fetch(`${API_BASE}/shelters/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          location: editForm.location.trim(),
          district: editForm.district,
          capacity: cap,
          contact: (editForm.contact || "").trim(),
          notes: (editForm.notes || "").trim(),
        }),
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
                  onChange={handleChange}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                >
                  <option value="">Select district</option>
                  {DISTRICTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
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
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 p-2 shadow-md">
                <Building2 className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">All shelters</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {shelters.length}
              </span>
            </div>
            <button
              type="button"
              onClick={loadShelters}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
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
                    <th className="py-3 px-3 font-medium text-slate-600">Capacity</th>
                    <th className="py-3 px-3 font-medium text-slate-600">Contact</th>
                    <th className="py-3 px-3 font-medium text-slate-600">Notes</th>
                    <th className="py-3 pr-5 pl-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shelters.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        <MapPin className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                        No shelters yet. Add one above.
                       </td>
                    </tr>
                  ) : (
                    shelters.map((s) => (
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
                              onChange={handleEditChange}
                              className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                            >
                              <option value="">Select</option>
                              {DISTRICTS.map((d) => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          ) : (
                            s.district
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
                    ))
                  )}
                </tbody>
              </table>
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