"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Heart,
  Loader2,
  ArrowRight,
  Ambulance,
  Radio,
  Home,
  Package,
  Laptop,
  Activity,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** Rescue / flood response atmosphere (Unsplash). */
const HERO_BG =
  "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=1920&q=75";

function inferDistrict(incident) {
  if (incident?.district) return incident.district;
  const area = String(incident?.area || "");
  const m = area.match(/^([A-Za-z ]+?)\s+District\b/i);
  if (m?.[1]) return m[1].trim();
  const first = area.split(",")[0]?.trim();
  return first || "—";
}

function hashId(s) {
  let h = 0;
  const str = String(s || "");
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function skillsFromType(type, t) {
  const k = String(type || "").toLowerCase();
  if (k.includes("flood")) return t("volunteerHub.skillFlood");
  if (k.includes("landslide")) return t("volunteerHub.skillLandslide");
  if (k.includes("fire")) return t("volunteerHub.skillFire");
  return t("volunteerHub.skillDefault");
}

function formatCategory(category) {
  const value = String(category || "").trim();
  if (!value) return "General";
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function urgencyFromIncident(inc, t) {
  const s = String(inc?.status || "").toLowerCase();
  if (s === "responding") {
    return {
      label: t("volunteerHub.urgencyHigh"),
      ring: "ring-rose-500/30",
      pill: "bg-rose-600 text-white",
    };
  }
  if (s === "reported") {
    return {
      label: t("volunteerHub.urgencyMedium"),
      ring: "ring-amber-400/30",
      pill: "bg-amber-500 text-white",
    };
  }
  return {
    label: t("volunteerHub.urgencyMedium"),
    ring: "ring-amber-400/30",
    pill: "bg-amber-500 text-white",
  };
}

function incidentToMission(inc, t) {
  const id = String(inc.id || inc._id || "");
  const title =
    inc.title?.trim() ||
    `${String(inc.type || "mission").replace(/_/g, " ")} – ${inferDistrict(inc)}`;
  const vol = 5 + (hashId(id) % 16);
  return {
    id,
    title,
    volunteersNeeded: vol,
    skills: skillsFromType(inc.type, t),
    urgency: urgencyFromIncident(inc, t),
    incidentId: id,
  };
}

export default function VolunteerPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [token, setToken] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [missionJoinError, setMissionJoinError] = useState("");
  const [missionJoinSuccess, setMissionJoinSuccess] = useState("");
  const [volunteer, setVolunteer] = useState(null);
  const [missions, setMissions] = useState([]);
  const [missionsLoading, setMissionsLoading] = useState(true);
  const [myMissionIds, setMyMissionIds] = useState(new Set());
  const [joinBusyMissionId, setJoinBusyMissionId] = useState(null);

  const activeMissions = missions;

  function urgencyMeta(urgency) {
    const u = String(urgency || "medium").toLowerCase();
    if (u === "high") {
      return {
        label: t("volunteerHub.urgencyHigh"),
        ring: "ring-rose-500/30",
        pill: "bg-rose-600 text-white",
      };
    }
    if (u === "low") {
      return {
        label: t("volunteerHub.urgencyLow"),
        ring: "ring-emerald-500/30",
        pill: "bg-emerald-600 text-white",
      };
    }
    return {
      label: t("volunteerHub.urgencyMedium"),
      ring: "ring-amber-400/30",
      pill: "bg-amber-500 text-white",
    };
  }

  const volunteerRoles = useMemo(
    () => [
      {
        key: "emergency",
        icon: Ambulance,
        title: t("volunteerHub.roleEmergencyTitle"),
        desc: t("volunteerHub.roleEmergencyDesc"),
        skills: t("volunteerHub.roleEmergencySkills"),
      },
      {
        key: "reporter",
        icon: Radio,
        title: t("volunteerHub.roleReporterTitle"),
        desc: t("volunteerHub.roleReporterDesc"),
        skills: t("volunteerHub.roleReporterSkills"),
      },
      {
        key: "shelter",
        icon: Home,
        title: t("volunteerHub.roleShelterTitle"),
        desc: t("volunteerHub.roleShelterDesc"),
        skills: t("volunteerHub.roleShelterSkills"),
      },
      {
        key: "supply",
        icon: Package,
        title: t("volunteerHub.roleSupplyTitle"),
        desc: t("volunteerHub.roleSupplyDesc"),
        skills: t("volunteerHub.roleSupplySkills"),
      },
      {
        key: "remote",
        icon: Laptop,
        title: t("volunteerHub.roleRemoteTitle"),
        desc: t("volunteerHub.roleRemoteDesc"),
        skills: t("volunteerHub.roleRemoteSkills"),
      },
    ],
    [t]
  );

  const canJoinMissions = Boolean(
    volunteer && String(volunteer?.status || "").toLowerCase() !== "rejected"
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tok = window.localStorage.getItem("dmews_token");
    setToken(tok || null);
    setAuthChecked(true);

    async function loadVolunteer(tkn) {
      try {
        const res = await fetch(`${API_BASE}/volunteers/me`, {
          headers: { Authorization: `Bearer ${tkn}` },
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.volunteer) {
          setVolunteer(data.volunteer);
        }
      } catch {
        // ignore
      }
    }

    if (tok) loadVolunteer(tok);

    loadMissions();
    loadMyMissions(tok);

    const onStorage = () => {
      const next = window.localStorage.getItem("dmews_token");
      setToken(next || null);
      if (next) loadVolunteer(next);
      else setVolunteer(null);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("dmews-auth-changed", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("dmews-auth-changed", onStorage);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !authChecked) return;
    if (window.location.hash !== "#volunteer-apply") return;
    router.replace("/volunteer/join");
  }, [authChecked, router]);

  const goToApply = useCallback(() => {
    router.push("/volunteer/join");
  }, [router]);

  const scrollToMissions = useCallback(() => {
    document.getElementById("active-missions")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const loadMissions = useCallback(async () => {
    setMissionsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/missions/active`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => []);
      setMissions(Array.isArray(data) ? data : []);
    } catch {
      setMissions([]);
    } finally {
      setMissionsLoading(false);
    }
  }, []);

  const loadMyMissions = useCallback(async (tkn) => {
    try {
      if (!tkn) return;
      const res = await fetch(`${API_BASE}/missions/my`, {
        headers: { Authorization: `Bearer ${tkn}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      const ids = Array.isArray(data?.missionIds) ? data.missionIds : [];
      setMyMissionIds(new Set(ids.map(String)));
    } catch {
      setMyMissionIds(new Set());
    }
  }, []);

  async function handleJoinMission(missionId) {
    if (!token) return;
    if (!canJoinMissions) {
      // Guide user to the application page if they haven't registered as a volunteer yet.
      goToApply();
      return;
    }

    const id = String(missionId || "");
    if (!id) return;

    const joined = myMissionIds.has(id);
    if (joined) return;

    setJoinBusyMissionId(id);
    setMissionJoinError("");
    setMissionJoinSuccess("");
    try {
      const res = await fetch(`${API_BASE}/missions/${id}/join`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMissionJoinError(data?.message || "Could not join mission.");
        return;
      }

      // Refresh mission cards (joinedCount) and my mission ids.
      await loadMissions();
      await loadMyMissions(token);
      setMissionJoinSuccess("Joined mission.");
      setTimeout(() => setMissionJoinSuccess(""), 2500);
    } catch {
      setMissionJoinError("Network error. Please try again.");
    } finally {
      setJoinBusyMissionId(null);
    }
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
      </div>
    );
  }

  const status = volunteer?.status;
  const approved = status === "approved";

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Hero */}
      <section
        className="relative isolate overflow-hidden border-b border-sky-900/20"
        aria-labelledby="volunteer-hero-title"
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${HERO_BG})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-sky-950/88 via-slate-900/85 to-sky-900/80" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-100">
              <Activity className="h-3.5 w-3.5" aria-hidden />
              DisasterWatch
            </p>
            <h1
              id="volunteer-hero-title"
              className="mt-5 font-oswald text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl"
            >
              {t("volunteerHub.heroTitle")}
            </h1>
            <p className="mt-4 text-lg text-sky-100/95 sm:text-xl">
              {t("volunteerHub.heroSubtitle")}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={goToApply}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3.5 text-sm font-bold text-sky-950 shadow-lg shadow-black/20 transition hover:bg-amber-300"
              >
                {t("volunteerHub.becomeVolunteer")}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={scrollToMissions}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-white/40 bg-white/10 px-5 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
              >
                {t("volunteerHub.viewMissions")}
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-16 px-4 py-12 sm:px-6 lg:space-y-20 lg:px-8 lg:py-16">
        {/* Active missions */}
        <section id="active-missions" aria-labelledby="missions-heading">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end">
            <div>
              <h2
                id="missions-heading"
                className="font-oswald text-2xl font-bold text-slate-900 sm:text-3xl"
              >
                <span className="mr-2 inline-block" aria-hidden>
                  🚨
                </span>
                {t("volunteerHub.missionsTitle")}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
                {t("volunteerHub.missionsIntro")}
              </p>
            </div>
          </div>

          {missionJoinError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {missionJoinError}
            </div>
          )}
          {missionJoinSuccess && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              {missionJoinSuccess}
            </div>
          )}

          {missionsLoading && (
            <div className="mb-6 flex items-center justify-center gap-2 py-6 text-sm text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
              {t("volunteerHub.missionsLoading")}
            </div>
          )}

          {!missionsLoading && activeMissions.length === 0 && (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {t("volunteerHub.missionsEmpty")}
            </p>
          )}

          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {activeMissions.map((m) => {
              const ui = urgencyMeta(m.urgency);
              const cap = Number(m.volunteersNeeded ?? 0);
              const joinedCount = Number(m.joinedCount ?? 0);
              const joined = myMissionIds.has(String(m.id));
              const full = cap > 0 && joinedCount >= cap;
              const joinDisabled =
                joined || full || !canJoinMissions || joinBusyMissionId === m.id;

              const btnClasses = joined
                ? "bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60"
                : full
                  ? "bg-slate-100 text-slate-700 border border-slate-200 disabled:opacity-60"
                  : "bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-60";

              const btnLabel =
                joinBusyMissionId === m.id
                  ? "Joining…"
                  : joined
                    ? t("volunteerHub.joined")
                    : full
                      ? t("volunteerHub.joinFull")
                      : !canJoinMissions
                        ? t("volunteerHub.joinRequireVolunteer")
                        : t("volunteerHub.joinMission");

              return (
                <li key={m.id}>
                  <article
                    className={`card flex h-full flex-col border-slate-200/80 bg-white p-5 ring-2 ${ui.ring} transition hover:-translate-y-1`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-oswald text-lg font-semibold text-slate-900">
                        {m.title}
                      </h3>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${ui.pill}`}
                      >
                        {ui.label}
                      </span>
                    </div>

                    <p className="mt-3 text-sm font-medium text-slate-700">
                      {t("volunteerHub.volunteersNeeded")}:{" "}
                      <span className="text-sky-800">{cap}</span>
                    </p>
                    <p className="mt-1 text-[12px] text-slate-600">
                      <span className="font-semibold text-slate-500">
                        Joined:
                      </span>{" "}
                      <span className="text-sky-800">
                        {joinedCount}
                        {cap > 0 ? ` / ${cap}` : ""}
                      </span>
                    </p>
                    <p className="mt-2 text-xs text-slate-600">
                      <span className="font-semibold text-slate-500">
                        {t("volunteerHub.skills")}:{" "}
                      </span>
                      {m.skills}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      <span className="font-semibold text-slate-500">
                        Category:{" "}
                      </span>
                      {formatCategory(m.category)}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={joinDisabled}
                        title={!canJoinMissions ? t("volunteerHub.joinRequireVolunteer") : undefined}
                        onClick={() => handleJoinMission(m.id)}
                        className={`inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-2.5 text-xs font-bold shadow-sm transition ${btnClasses}`}
                      >
                        {btnLabel}
                      </button>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Roles */}
        <section aria-labelledby="roles-heading">
          <div className="mb-8">
            <h2
              id="roles-heading"
              className="font-oswald text-2xl font-bold text-slate-900 sm:text-3xl"
            >
              {t("volunteerHub.rolesTitle")}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
              {t("volunteerHub.rolesIntro")}
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {volunteerRoles.map((role) => {
              const Icon = role.icon;
              return (
                <li key={role.key}>
                  <article className="card flex h-full flex-col gap-3 border-slate-200/80 bg-gradient-to-b from-white to-slate-50/80 p-5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-800">
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <h3 className="font-oswald text-base font-semibold text-slate-900">
                      {role.title}
                    </h3>
                    <p className="text-sm text-slate-600">{role.desc}</p>
                    <p className="text-xs text-slate-500">
                      <span className="font-semibold text-slate-600">
                        {t("volunteerHub.skills")}:{" "}
                      </span>
                      {role.skills}
                    </p>
                    <button
                      type="button"
                      onClick={goToApply}
                      className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-lg border border-sky-300 bg-sky-50 py-2.5 text-sm font-semibold text-sky-900 transition hover:bg-sky-100"
                    >
                      {t("volunteerHub.joinRole")}
                    </button>
                  </article>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Impact */}
        <section
          className="rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 to-white p-6 sm:p-8"
          aria-labelledby="impact-heading"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white">
                <Heart className="h-6 w-6" aria-hidden />
              </span>
              <div>
                <h2
                  id="impact-heading"
                  className="font-oswald text-xl font-semibold text-slate-900"
                >
                  {t("volunteerHub.impactTitle")}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {approved
                    ? t("volunteerHub.impactVerified")
                    : t("volunteerHub.impactTeaser")}
                </p>
              </div>
            </div>
            <div className="text-sm text-slate-600">
              {t("volunteerHub.impactTeaser")}
            </div>
          </div>
        </section>

        {/* Apply CTA */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-oswald text-xl font-semibold text-slate-900">
                {t("volunteerHub.applyTitle")}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {t("volunteerHub.applyIntro")}
              </p>
            </div>
            <button
              type="button"
              onClick={goToApply}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white hover:bg-rose-500"
            >
              {t("volunteerHub.joinRole")}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}