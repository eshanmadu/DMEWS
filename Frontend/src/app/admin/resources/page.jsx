"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, History, Loader2, PackageCheck, PackagePlus, RefreshCw, Trash2 } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
export default function AdminResourcesPage() {
  const [rows, setRows] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [inventory, setInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryForm, setInventoryForm] = useState({ resourceType: "", unit: "units", storageLocation: "", district: "", expiryDate: "" });
  const [activeInventoryId, setActiveInventoryId] = useState(null);
  const [transactionRows, setTransactionRows] = useState([]);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [transactionForm, setTransactionForm] = useState({ type: "receipt", quantity: "", reference: "", notes: "" });
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    target: "",
    date: "",
    location: "",
    resourceFocus: "",
  });

  const canSubmit = useMemo(() => {
    return (
      form.name.trim().length > 2 &&
      form.date.trim().length > 0 &&
      form.location.trim().length > 0
    );
  }, [form.name, form.date, form.location]);
  const minProgramDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const loadPrograms = useCallback(async () => {
    const token = window.localStorage.getItem("dmews_token");
    if (!token) {
      setError("Please login with an admin-enabled account.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/resource-programs/admin/list`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        setError(data?.message || "Could not load resource programs.");
        setRows([]);
      } else {
        setRows(Array.isArray(data) ? data : []);
      }
    } catch {
      setError("Network error while loading programs.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSubmissions = useCallback(async () => {
    const token = window.localStorage.getItem("dmews_token");
    if (!token) {
      setSubmissionsLoading(false);
      return;
    }
    setSubmissionsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/resource-participations/admin/list`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        setError(data?.message || "Could not load submissions.");
        setSubmissions([]);
      } else {
        setSubmissions(Array.isArray(data) ? data : []);
      }
    } catch {
      setError("Network error while loading submissions.");
      setSubmissions([]);
    } finally {
      setSubmissionsLoading(false);
    }
  }, []);

  const loadInventory = useCallback(async () => {
    const token = window.localStorage.getItem("dmews_token");
    if (!token) { setInventoryLoading(false); return; }
    setInventoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/resource-inventory/admin/list`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.message || "Could not load inventory.");
      setInventory(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError?.message || "Network error while loading inventory.");
      setInventory([]);
    } finally { setInventoryLoading(false); }
  }, []);

  useEffect(() => {
    loadPrograms();
    loadSubmissions();
    loadInventory();
  }, [loadPrograms, loadSubmissions, loadInventory]);

  async function createInventoryItem(event) {
    event.preventDefault();
    const token = window.localStorage.getItem("dmews_token");
    if (!token) return setError("Please login with an admin-enabled account.");
    setBusyId("inventory-create");
    setError("");
    try {
      const res = await fetch(`${API_BASE}/resource-inventory/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(inventoryForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Could not create inventory item.");
      setInventory((previous) => [...previous, data]);
      setInventoryForm({ resourceType: "", unit: "units", storageLocation: "", district: "", expiryDate: "" });
    } catch (createError) { setError(createError?.message || "Could not create inventory item."); }
    finally { setBusyId(null); }
  }

  async function loadTransactions(inventoryId) {
    const token = window.localStorage.getItem("dmews_token");
    if (!token) return;
    setActiveInventoryId(inventoryId);
    setTransactionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/resource-inventory/admin/${inventoryId}/transactions`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.message || "Could not load transaction history.");
      setTransactionRows(Array.isArray(data) ? data : []);
    } catch (historyError) { setError(historyError?.message || "Could not load transaction history."); }
    finally { setTransactionLoading(false); }
  }

  async function recordTransaction(event) {
    event.preventDefault();
    if (!activeInventoryId) return;
    const token = window.localStorage.getItem("dmews_token");
    setBusyId("transaction");
    setError("");
    try {
      const res = await fetch(`${API_BASE}/resource-inventory/admin/${activeInventoryId}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(transactionForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Could not record transaction.");
      setInventory((previous) => previous.map((item) => item.id === activeInventoryId ? data.inventory : item));
      setTransactionRows((previous) => [data.transaction, ...previous]);
      setTransactionForm({ type: "receipt", quantity: "", reference: "", notes: "" });
    } catch (transactionError) { setError(transactionError?.message || "Could not record transaction."); }
    finally { setBusyId(null); }
  }

  async function createProgram(e) {
    e.preventDefault();
    const token = window.localStorage.getItem("dmews_token");
    if (!token) {
      setError("Please login with an admin-enabled account.");
      return;
    }
    setBusyId("create");
    setError("");
    if (!form.date.trim()) {
      setError("Program date is required.");
      setBusyId(null);
      return;
    }
    if (form.date < minProgramDate) {
      setError("Program date cannot be in the past.");
      setBusyId(null);
      return;
    }
    if (!form.location.trim()) {
      setError("Program location is required.");
      return;
    }
    const nextProgram = {
      name: form.name.trim(),
      target: form.target.trim(),
      date: form.date.trim(),
      location: form.location.trim(),
      resourceFocus: form.resourceFocus
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    try {
      const res = await fetch(`${API_BASE}/resource-programs/admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(nextProgram),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Could not create program.");
        return;
      }
      await loadPrograms();
    } catch {
      setError("Network error.");
    } finally {
      setBusyId(null);
      setForm({
        name: "",
        target: "",
        date: "",
        location: "",
        resourceFocus: "",
      });
    }
  }

  async function removeProgram(id) {
    const token = window.localStorage.getItem("dmews_token");
    setBusyId(id);
    try {
      if (!token) {
        setError("Please login with an admin-enabled account.");
        return;
      }
      const res = await fetch(`${API_BASE}/resource-programs/admin/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Could not remove program.");
        return;
      }
      setRows((prev) => prev.filter((r) => String(r.id || r._id) !== String(id)));
    } catch {
      setError("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Resource Programs</h1>
          <p className="mt-1 text-sm text-slate-600">
            Create programs shown on the public Resources page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            loadPrograms();
            loadSubmissions();
            loadInventory();
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Create program</h2>
        </div>
        <form onSubmit={createProgram} className="grid gap-4 p-6 sm:grid-cols-2">
          <input
            required
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Program name"
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm sm:col-span-2"
          />
          <input
            required
            type="date"
            min={minProgramDate}
            value={form.date}
            onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
          />
          <input
            required
            value={form.location}
            onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
            placeholder="Program location / collection center"
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
          />
          <input
            value={form.resourceFocus}
            onChange={(e) => setForm((p) => ({ ...p, resourceFocus: e.target.value }))}
            placeholder="Focus tags (comma separated)"
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
          />
          <textarea
            rows={3}
            value={form.target}
            onChange={(e) => setForm((p) => ({ ...p, target: e.target.value }))}
            placeholder="Program target / objective"
            className="resize-none rounded-xl border border-slate-300 px-4 py-2.5 text-sm sm:col-span-2"
          />
          <button
            type="submit"
            disabled={!canSubmit || busyId === "create"}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
          >
            {busyId === "create" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <PackagePlus className="h-4 w-4" />
                Add program
              </>
            )}
          </button>
        </form>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900"><PackageCheck className="h-5 w-5 text-emerald-600" />Confirmed stock inventory</h2>
          <p className="mt-1 text-sm text-slate-600">Pledges become stock only after an administrator records a receipt transaction.</p>
        </div>
        <form onSubmit={createInventoryItem} className="grid gap-3 border-b border-slate-100 p-6 sm:grid-cols-2 lg:grid-cols-5">
          <input required value={inventoryForm.resourceType} onChange={(e) => setInventoryForm((p) => ({ ...p, resourceType: e.target.value }))} placeholder="Resource type" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
          <select value={inventoryForm.unit} onChange={(e) => setInventoryForm((p) => ({ ...p, unit: e.target.value }))} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="units">Units</option><option value="kg">kg</option><option value="liters">Liters</option><option value="boxes">Boxes</option><option value="cartons">Cartons</option><option value="packs">Packs</option><option value="kits">Kits</option><option value="pairs">Pairs</option></select>
          <input required value={inventoryForm.storageLocation} onChange={(e) => setInventoryForm((p) => ({ ...p, storageLocation: e.target.value }))} placeholder="Storage location" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
          <input required value={inventoryForm.district} onChange={(e) => setInventoryForm((p) => ({ ...p, district: e.target.value }))} placeholder="District" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
          <input type="date" value={inventoryForm.expiryDate} onChange={(e) => setInventoryForm((p) => ({ ...p, expiryDate: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
          <button type="submit" disabled={busyId === "inventory-create"} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 sm:col-span-2 lg:col-span-5 lg:justify-self-start"><PackagePlus className="h-4 w-4" />Create stock bucket</button>
        </form>
        {inventoryLoading ? <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-emerald-600" /></div> : inventory.length === 0 ? <p className="px-6 py-10 text-center text-sm text-slate-500">No confirmed stock buckets yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Resource</th><th className="px-4 py-3">Storage</th><th className="px-4 py-3">Received</th><th className="px-4 py-3">Available</th><th className="px-4 py-3">Reserved</th><th className="px-4 py-3">Dispatched</th><th className="px-4 py-3">Damaged</th><th className="px-4 py-3">Expiry</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{inventory.map((item) => <tr key={item.id}><td className="px-4 py-3"><div className="font-semibold text-slate-900">{item.resourceType}</div><div className="text-xs text-slate-500">{item.district} · {item.unit}</div></td><td className="px-4 py-3 text-slate-700">{item.storageLocation}</td><td className="px-4 py-3 text-slate-700">{item.receivedQuantity}</td><td className="px-4 py-3 font-semibold text-emerald-700">{item.availableQuantity}</td><td className="px-4 py-3 text-amber-700">{item.reservedQuantity}</td><td className="px-4 py-3 text-slate-700">{item.dispatchedQuantity}</td><td className="px-4 py-3 text-rose-700">{item.damagedQuantity}</td><td className="px-4 py-3 text-slate-700">{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : "—"}</td><td className="px-4 py-3"><button type="button" onClick={() => loadTransactions(item.id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><History className="h-3.5 w-3.5" />Manage stock</button></td></tr>)}</tbody></table></div>}
      </section>

      {activeInventoryId && <section className="rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-sm"><div className="border-b border-emerald-100 px-6 py-4"><h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900"><ClipboardList className="h-5 w-5 text-emerald-700" />Record stock transaction</h2><p className="mt-1 text-sm text-slate-600">Receipt, reservation, dispatch, damage, and release actions are recorded in the audit history.</p></div><form onSubmit={recordTransaction} className="grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-5"><select value={transactionForm.type} onChange={(e) => setTransactionForm((p) => ({ ...p, type: e.target.value }))} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="receipt">Stock receipt</option><option value="reservation">Reserve stock</option><option value="reservation_release">Release reservation</option><option value="dispatch">Dispatch stock</option><option value="damage">Record damage</option><option value="adjustment">Positive adjustment</option></select><input required min="0.01" type="number" step="0.01" value={transactionForm.quantity} onChange={(e) => setTransactionForm((p) => ({ ...p, quantity: e.target.value }))} placeholder="Quantity" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /><input value={transactionForm.reference} onChange={(e) => setTransactionForm((p) => ({ ...p, reference: e.target.value }))} placeholder="Reference / delivery ID" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /><input value={transactionForm.notes} onChange={(e) => setTransactionForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Notes" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /><button type="submit" disabled={busyId === "transaction"} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">Record transaction</button></form><div className="border-t border-emerald-100 px-6 py-4"><h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Transaction history</h3>{transactionLoading ? <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-emerald-600" /></div> : transactionRows.length === 0 ? <p className="py-6 text-sm text-slate-500">No transactions recorded.</p> : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b border-emerald-100 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Type</th><th className="px-3 py-2">Quantity</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2">Notes</th><th className="px-3 py-2">When</th></tr></thead><tbody className="divide-y divide-emerald-100">{transactionRows.map((row) => <tr key={row.id}><td className="px-3 py-2 font-medium text-slate-800">{row.type}</td><td className="px-3 py-2 text-slate-700">{row.quantity} {row.unit}</td><td className="px-3 py-2 text-slate-700">{row.reference || "—"}</td><td className="px-3 py-2 text-slate-700">{row.notes || "—"}</td><td className="px-3 py-2 text-slate-700">{row.occurredAt ? new Date(row.occurredAt).toLocaleString() : "—"}</td></tr>)}</tbody></table></div>}</div></section>}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Active programs</h2>
        </div>
        {loading ? (
          <div className="flex justify-center py-14">
            <Loader2 className="h-7 w-7 animate-spin text-sky-600" />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-500">
            No programs yet.
          </p>
        ) : (
          <div className="space-y-3 p-6">
            {rows.map((row) => {
              const id = row.id || row._id || row.name;
              return (
                <div key={id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{row.name}</h3>
                      <p className="mt-1 text-sm text-slate-600">{row.target || "—"}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        {row.date ? new Date(row.date).toLocaleDateString() : "—"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Location: {row.location || "—"}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === id}
                      onClick={() => removeProgram(id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">User submissions</h2>
          <p className="mt-1 text-sm text-slate-600">
            Resource participation requests from users.
          </p>
        </div>
        {submissionsLoading ? (
          <div className="flex justify-center py-14">
            <Loader2 className="h-7 w-7 animate-spin text-sky-600" />
          </div>
        ) : submissions.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-500">
            No submissions yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">District</th>
                  <th className="px-4 py-3">Resource</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Delivery</th>
                  <th className="px-4 py-3">Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {submissions.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{row.name}</div>
                      <div className="text-xs text-slate-500">{row.status}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>{row.email}</div>
                      <div className="text-xs text-slate-500">{row.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.district}</td>
                    <td className="px-4 py-3 text-slate-700">{row.resourceType}</td>
                    <td className="px-4 py-3 text-slate-700">{row.quantity}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>{row.deliveryMode === "pickup" ? "Pickup needed" : "Self drop"}</div>
                      {row.deliveryMode === "pickup" && row.pickupAddress && (
                        <div className="text-xs text-slate-500">{row.pickupAddress}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.availableDate
                        ? new Date(row.availableDate).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
