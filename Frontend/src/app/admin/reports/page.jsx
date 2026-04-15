"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const buildReportId = (key, index) => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${key}-${date}-${String(index + 1).padStart(3, "0")}`;
};

const safeFileName = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const fmt = (value, digits = 1) =>
  typeof value === "number" ? value.toFixed(digits) : "—";
const todayISO = new Date().toISOString().slice(0, 10);

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [datasets, setDatasets] = useState({
    users: [],
    volunteers: [],
    alerts: [],
    weatherDistricts: [],
    shelters: [],
    missingFound: [],
  });

  const loadReportsData = useCallback(async () => {
    const token =
      typeof window !== "undefined" ? window.localStorage.getItem("dmews_token") : null;
    setLoading(true);
    setError("");

    try {
      const [usersRes, volunteersRes, missingFoundRes, alertsRes, weatherRes, sheltersRes] =
        await Promise.all([
          fetch(`${API_BASE}/admin/users`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            cache: "no-store",
          }),
          fetch(`${API_BASE}/volunteers/admin/list`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            cache: "no-store",
          }),
          fetch(`${API_BASE}/missing-persons/admin/overview`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            cache: "no-store",
          }),
          fetch(`${API_BASE}/alerts`, { cache: "no-store" }),
          fetch(`${API_BASE}/weather/districts`, { cache: "no-store" }),
          fetch(`${API_BASE}/shelters`, { cache: "no-store" }),
        ]);

      const usersJson = await usersRes.json().catch(() => ({}));
      const volunteersJson = await volunteersRes.json().catch(() => ([]));
      const missingFoundJson = await missingFoundRes.json().catch(() => ({}));
      const alertsJson = await alertsRes.json().catch(() => ([]));
      const weatherJson = await weatherRes.json().catch(() => ([]));
      const sheltersJson = await sheltersRes.json().catch(() => ([]));

      setDatasets({
        users: Array.isArray(usersJson?.users) ? usersJson.users : [],
        volunteers: Array.isArray(volunteersJson) ? volunteersJson : [],
        alerts: Array.isArray(alertsJson) ? alertsJson : [],
        weatherDistricts: Array.isArray(weatherJson) ? weatherJson : [],
        shelters: Array.isArray(sheltersJson) ? sheltersJson : [],
        missingFound: [
          ...(Array.isArray(missingFoundJson?.missing)
            ? missingFoundJson.missing.map((item) => ({ ...item, reportType: "Missing" }))
            : []),
          ...(Array.isArray(missingFoundJson?.found)
            ? missingFoundJson.found.map((item) => ({ ...item, reportType: "Found" }))
            : []),
        ],
      });

      if (!token) {
        setError("Log in as admin to load users, volunteers, and missing/found reports.");
      }
    } catch {
      setError("Failed to load report data from server.");
      setDatasets({
        users: [],
        volunteers: [],
        alerts: [],
        weatherDistricts: [],
        shelters: [],
        missingFound: [],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReportsData();
  }, [loadReportsData]);

  const weatherRows = useMemo(
    () =>
      datasets.weatherDistricts.map((d) => ({
        District: d?.name || "",
        Date: d?.daily?.time?.[0] || todayISO,
        Condition: d?.weather?.text || `Code ${d?.weather?.weathercode ?? "—"}`,
        TempNowC: fmt(d?.weather?.temperature),
        TempMinC: fmt(d?.daily?.temperature_2m_min?.[0]),
        TempMaxC: fmt(d?.daily?.temperature_2m_max?.[0]),
        RainMmToday: fmt(d?.daily?.precipitation_sum?.[0]),
        RainChancePct: fmt(d?.daily?.precipitation_probability_max?.[0], 0),
        WindKphNow: fmt(d?.weather?.windspeed),
      })),
    [datasets.weatherDistricts]
  );

  const reports = useMemo(
    () => [
      {
        key: "USR",
        title: "User Reports",
        description: "Live user account data from admin users endpoint.",
        type: "excel",
        rows: datasets.users.map((u) => ({
          UserId: u.id || "",
          Name: u.name || "",
          Email: u.email || "",
          District: u.district || "",
          Status: u.isAdmin ? "Admin" : u.isInactive ? "Inactive" : "Active",
        })),
      },
      {
        key: "VOL",
        title: "Volunteer Reports",
        description: "Live volunteer applications and approval status.",
        type: "excel",
        rows: datasets.volunteers.map((v) => ({
          VolunteerId: v.id || "",
          Name: v.user?.name || v.fullName || "",
          Email: v.user?.email || v.emailAddress || "",
          District: v.user?.district || v.districtCity || "",
          Status: v.status || "",
        })),
      },
      {
        key: "ALT",
        title: "Alerts Reports",
        description: "Live disaster alerts from alerts collection.",
        type: "pdf",
        rows: datasets.alerts.map((a) => ({
          AlertId: a._id || "",
          DisasterType: a.disasterType || "",
          Severity: a.severity || "",
          Area: a.affectedArea || "",
          Status: a.status || "",
        })),
      },
      {
        key: "WTH",
        title: "Weather Reports",
        description: "Today weather for all districts (live district weather API).",
        type: "pdf",
        rows: weatherRows,
      },
      {
        key: "SHL",
        title: "Shelter Reports",
        description: "Live shelters and capacity data.",
        type: "pdf",
        rows: datasets.shelters.map((s) => ({
          ShelterId: s.id || "",
          Name: s.name || "",
          District: s.district || "",
          Capacity: s.capacity ?? "",
          Contact: s.contact || "",
        })),
      },
      {
        key: "MFP",
        title: "Missing & Found Persons Reports",
        description: "Live missing and found records from admin overview.",
        type: "pdf",
        rows: datasets.missingFound.map((m) => ({
          PersonReportId: m.id || "",
          Type: m.reportType || "",
          Name: m.fullName || m.name || "",
          Location: m.lastSeenLocation || m.locationFound || "",
          Contact: m.ifYouSeePhone || "",
        })),
      },
    ],
    [datasets, weatherRows]
  );

  const downloadExcel = (report, reportId) => {
    const worksheet = XLSX.utils.json_to_sheet(report.rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(workbook, `${safeFileName(report.title)}-${reportId}.xlsx`);
  };

  const downloadPdf = (report, reportId) => {
    if (!report.rows.length) return;
  
    const isWide = report.key === "WTH" || report.key === "ALT";
    const doc = new jsPDF({ orientation: isWide ? "landscape" : "portrait" });
  
    const headers = [Object.keys(report.rows[0] ?? {})];
    const body = report.rows.map((row) => Object.values(row));
    const generatedAt = new Date().toLocaleString();
  
    const palette = {
      ALT: [2, 132, 199],
      WTH: [37, 99, 235],
      SHL: [124, 58, 237],
      MFP: [220, 38, 38],
    };
  
    const headColor = palette[report.key] || [14, 116, 144];
  
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
  
    // =========================
    // 🔷 HEADER (Modern Style)
    // =========================

const headerColor = [14, 116, 144]; // clean teal/sky tone

doc.setFillColor(...headerColor);
doc.rect(0, 0, pageWidth, 32, "F");

doc.setTextColor(255, 255, 255);
doc.setFont("helvetica", "bold");

// Project name
doc.setFontSize(16);
doc.text("DisasterWatch", 14, 14);

// Report title
doc.setFontSize(11);
doc.setFont("helvetica", "normal");
doc.text(report.title, 14, 23);

// Right side meta
doc.setFontSize(9);
doc.text(`Report ID: ${reportId}`, pageWidth - 14, 14, { align: "right" });
doc.text(`Generated: ${generatedAt}`, pageWidth - 14, 23, { align: "right" });
    // =========================
    // 🔹 SUMMARY SECTION
    // =========================
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
  
    doc.text(`Total Records: ${report.rows.length}`, 14, 38);
  
    // Divider line
    doc.setDrawColor(200);
    doc.line(14, 42, pageWidth - 14, 42);
  
    // =========================
    // 📊 TABLE
    // =========================
    autoTable(doc, {
      head: headers,
      body,
      startY: 48,
      theme: "grid",
  
      styles: {
        fontSize: report.key === "WTH" ? 8 : 9,
        cellPadding: 3,
        textColor: [31, 41, 55],
        valign: "middle",
      },
  
      headStyles: {
        fillColor: headColor,
        textColor: 255,
        fontStyle: "bold",
        halign: "center",
      },
  
      bodyStyles: {
        halign: "left",
      },
  
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
  
      margin: { left: 14, right: 14, top: 48, bottom: 20 },
  
      didDrawPage: (data) => {
        // =========================
        // 🔻 FOOTER
        // =========================
        const pageNumber = doc.getNumberOfPages();
  
        doc.setFontSize(9);
        doc.setTextColor(120);
  
        // Left footer
        doc.text("DisasterWatch • Disaster Management and Early Warning System", 14, pageHeight - 8);
  
        // Right footer
        doc.text(`Page ${pageNumber}`, pageWidth - 14, pageHeight - 8, {
          align: "right",
        });
      },
    });
  
    doc.save(`${safeFileName(report.title)}-${reportId}.pdf`);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-3 flex items-center gap-3">
          <Download className="h-7 w-7 text-sky-700" />
          <h1 className="text-2xl font-bold text-slate-900">Admin Reports</h1>
        </div>

        <p className="mb-3 text-sm text-slate-600">
          All reports can be downloaded as PDF and Excel.
        </p>

        <button
          type="button"
          onClick={loadReportsData}
          className="mb-6 inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Refresh data
        </button>

        {error ? (
          <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {reports.map((report, index) => {
            const reportId = buildReportId(report.key, index);

            return (
              <div
                key={report.key}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <h2 className="text-lg font-semibold text-slate-900">{report.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{report.description}</p>
                <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 font-mono text-xs text-slate-700">
                  Report ID: {reportId}
                </p>
                <p className="mt-2 text-xs text-slate-500">Total Records: {report.rows.length}</p>

                <div className="mt-4 flex flex-wrap gap-3">
                  {report.type === "excel" ? (
                    <button
                      type="button"
                      disabled={!report.rows.length}
                      onClick={() => downloadExcel(report, reportId)}
                      className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      Download Excel
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!report.rows.length}
                      onClick={() => downloadPdf(report, reportId)}
                      className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <FileText className="h-4 w-4" />
                      Download PDF
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
