"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Loader from "@/components/Loader";
import { AVATARS, avatarSrcById } from "@/lib/avatars";
import { useTranslation } from "react-i18next";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Lock,
  CheckCircle,
  AlertCircle,
  Save,
  KeyRound,
  Shield,
  Camera,
  X,
  BadgeCheck,
  FileText,
  Users,
  Trash2,
  LogOut,
  Settings,
  ChevronRight,
  Home,
} from "lucide-react";
import { formatLkCityLabel } from "@/lib/lkLocations";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const NAME_RE = /^[A-Za-z]+(?:\s+[A-Za-z]+)*$/;

// -------------------- Reusable Components --------------------
function InputField({
  icon: Icon,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
  minLength,
  readOnly = false,
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
          <Icon className="h-4 w-4" />
        </span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          readOnly={readOnly}
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        />
      </div>
    </div>
  );
}

function SelectField({ icon: Icon, label, value, onChange, disabled, options, placeholder }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
          <Icon className="h-4 w-4" />
        </span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:opacity-60"
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.id} value={String(opt.id)}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// -------------------- Main Component --------------------
export default function ProfilePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("profile"); // "profile", "security", "danger"

  // State (unchanged)
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [district, setDistrict] = useState("");
  const [districtsList, setDistrictsList] = useState([]);
  const [citiesList, setCitiesList] = useState([]);
  const [districtId, setDistrictId] = useState("");
  const [cityRowId, setCityRowId] = useState("");
  const [city, setCity] = useState("");
  const [cityLatitude, setCityLatitude] = useState(null);
  const [cityLongitude, setCityLongitude] = useState(null);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsError, setLocationsError] = useState(null);
  const [avatar, setAvatar] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(null);
  const [profileMsg, setProfileMsg] = useState(null);
  const [leavingVolunteer, setLeavingVolunteer] = useState(false);
  const [volunteerMsg, setVolunteerMsg] = useState(null);
  const [volunteerErr, setVolunteerErr] = useState(null);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState("");
  const [deleteAccountBusy, setDeleteAccountBusy] = useState(false);
  const [deleteAccountErr, setDeleteAccountErr] = useState(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(null);
  const [passwordMsg, setPasswordMsg] = useState(null);

  const avatars = AVATARS;

  // All useEffect hooks unchanged (fetch profile, districts, cities, etc.)
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    const token = localStorage.getItem("dmews_token");
    if (!token) { router.replace("/login"); return; }
    const fetchProfile = async () => {
      setProfileLoading(true);
      setProfileError(null);
      try {
        const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 401) router.replace("/login");
          else setProfileError(data?.message || t("profilePage.errors.loadProfile"));
          setProfileLoading(false);
          return;
        }
        setProfile(data);
        setName(data.name || "");
        setEmail(data.email || "");
        setMobile(data.mobile || "");
        setDistrict(data.district || "");
        setCity(data.city || "");
        setCityLatitude(typeof data.cityLatitude === "number" ? data.cityLatitude : null);
        setCityLongitude(typeof data.cityLongitude === "number" ? data.cityLongitude : null);
        setCityRowId("");
        setDistrictId("");
        setAvatar(data.avatar || "");
      } catch { setProfileError(t("profilePage.errors.network")); } finally { setProfileLoading(false); }
    };
    fetchProfile();
  }, [mounted, router]);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    const token = localStorage.getItem("dmews_token");
    if (!token || profileLoading || !profile) return;
    let cancelled = false;
    (async () => {
      setLocationsLoading(true);
      setLocationsError(null);
      try {
        const res = await fetch(`${API_BASE}/locations/sri-lanka/districts`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || t("profilePage.errors.loadDistricts"));
        const list = Array.isArray(data?.districts) ? data.districts : [];
        const sorted = [...list].sort((a, b) => String(a.name_en || "").localeCompare(String(b.name_en || "")));
        if (!cancelled) setDistrictsList(sorted);
      } catch (e) { if (!cancelled) setLocationsError(e?.message || t("profilePage.errors.loadDistricts")); } finally { if (!cancelled) setLocationsLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [mounted, profile, profileLoading]);

  useEffect(() => {
    if (!districtId) { setCitiesList([]); return; }
    let cancelled = false;
    (async () => {
      setLocationsLoading(true);
      setLocationsError(null);
      try {
        const res = await fetch(`${API_BASE}/locations/sri-lanka/cities?district=${encodeURIComponent(districtId)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || t("profilePage.errors.loadCities"));
        const list = Array.isArray(data?.cities) ? data.cities : [];
        const sorted = [...list].sort((a, b) => String(a.name_en || "").localeCompare(String(b.name_en || "")));
        if (!cancelled) setCitiesList(sorted);
      } catch (e) { if (!cancelled) { setLocationsError(e?.message || t("profilePage.errors.loadCities")); setCitiesList([]); } } finally { if (!cancelled) setLocationsLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [districtId]);

  useEffect(() => {
    if (!districtsList.length || !district || districtId) return;
    const match = districtsList.find((d) => d.name_en === district);
    if (match) setDistrictId(String(match.id));
  }, [districtsList, district, districtId]);

  useEffect(() => {
    if (!citiesList.length || !city || cityLatitude == null) return;
    const match = citiesList.find((c) => formatLkCityLabel(c) === city && typeof c.latitude === "number" && Math.abs(c.latitude - cityLatitude) < 1e-5);
    if (match) setCityRowId(String(match.id));
  }, [citiesList, city, cityLatitude]);

  // Handlers unchanged
  async function handleProfileSubmit(e) { /* same as before */ e.preventDefault(); setProfileMsg(null); setProfileSuccess(null); const trimmedName = String(name || "").trim(); if (!NAME_RE.test(trimmedName)) { setProfileMsg("Name must contain letters only."); return; } const token = localStorage.getItem("dmews_token"); if (!token) { router.replace("/login"); return; } setProfileSaving(true); try { const res = await fetch(`${API_BASE}/auth/profile`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: trimmedName, mobile, district, city, cityLatitude, cityLongitude, avatar }) }); const data = await res.json(); if (!res.ok) { setProfileMsg(data?.message || t("profilePage.errors.updateProfile")); return; } if (data.token) localStorage.setItem("dmews_token", data.token); if (data.user) { localStorage.setItem("dmews_user", JSON.stringify(data.user)); if (data.user.district) localStorage.setItem("dmews_user_district", data.user.district); setProfile(data.user); setName(data.user.name || ""); setEmail(data.user.email || ""); setCity(data.user.city || ""); setCityLatitude(typeof data.user.cityLatitude === "number" ? data.user.cityLatitude : null); setCityLongitude(typeof data.user.cityLongitude === "number" ? data.user.cityLongitude : null); } setProfileSuccess(t("profilePage.success.profileUpdated")); window.dispatchEvent(new Event("dmews-auth-changed")); } catch { setProfileMsg(t("profilePage.errors.network")); } finally { setProfileSaving(false); } }
  async function handlePasswordSubmit(e) { /* same */ e.preventDefault(); setPasswordMsg(null); setPasswordSuccess(null); if (newPassword !== confirmNewPassword) { setPasswordMsg(t("profilePage.errors.passwordMismatch")); return; } if (newPassword.length < 6) { setPasswordMsg(t("profilePage.errors.passwordTooShort")); return; } const token = localStorage.getItem("dmews_token"); if (!token) { router.replace("/login"); return; } setPasswordSaving(true); try { const res = await fetch(`${API_BASE}/auth/change-password`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ currentPassword, newPassword }) }); const data = await res.json(); if (!res.ok) { setPasswordMsg(data?.message || t("profilePage.errors.changePassword")); return; } setPasswordSuccess(t("profilePage.success.passwordUpdated")); setCurrentPassword(""); setNewPassword(""); setConfirmNewPassword(""); } catch { setPasswordMsg(t("profilePage.errors.network")); } finally { setPasswordSaving(false); } }
  async function handleLeaveVolunteer() { /* same */ const token = localStorage.getItem("dmews_token"); if (!token) { router.replace("/login"); return; } setVolunteerErr(null); setVolunteerMsg(null); setLeavingVolunteer(true); try { const res = await fetch(`${API_BASE}/volunteers/me`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); const data = await res.json().catch(() => ({})); if (!res.ok) { setVolunteerErr(data?.message || t("profilePage.errors.leaveVolunteer")); return; } const nextProfile = { ...(profile || {}), volunteerStatus: null }; setProfile(nextProfile); try { const raw = localStorage.getItem("dmews_user"); const parsed = raw ? JSON.parse(raw) : {}; localStorage.setItem("dmews_user", JSON.stringify({ ...parsed, volunteerStatus: null })); } catch {} window.dispatchEvent(new Event("dmews-auth-changed")); setVolunteerMsg(data?.message || t("profilePage.success.leftVolunteer")); } catch { setVolunteerErr(t("profilePage.errors.network")); } finally { setLeavingVolunteer(false); } }
  async function handleDeleteAccount() { /* same */ const token = localStorage.getItem("dmews_token"); if (!token) { router.replace("/login"); return; } setDeleteAccountErr(null); setDeleteAccountBusy(true); try { const res = await fetch(`${API_BASE}/auth/account`, { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(accountHasPassword ? { currentPassword: deleteAccountPassword } : {}) }); const data = await res.json().catch(() => ({})); if (!res.ok) { setDeleteAccountErr(data?.message || t("profilePage.errors.deleteAccount")); return; } localStorage.removeItem("dmews_token"); localStorage.removeItem("dmews_user"); localStorage.removeItem("dmews_user_district"); window.dispatchEvent(new Event("dmews-auth-changed")); router.replace("/login?deleted=1"); } catch { setDeleteAccountErr(t("profilePage.errors.network")); } finally { setDeleteAccountBusy(false); } }

  if (!mounted || profileLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex animate-pulse flex-col gap-6 lg:flex-row">
          <div className="lg:w-80"><div className="h-64 rounded-2xl bg-slate-200" /></div>
          <div className="flex-1"><div className="h-96 rounded-2xl bg-slate-200" /></div>
        </div>
      </div>
    );
  }

  if (profileError && !profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-6 py-5 text-red-700 shadow-sm">
          <AlertCircle className="h-5 w-5 shrink-0" /> {profileError}
        </div>
      </div>
    );
  }

  const displayName = profile?.name?.trim() || profile?.email || t("profilePage.userFallback");
  const activeAvatar = avatarSrcById(avatar);
  const accountHasPassword = Boolean(profile?.hasPassword);

  const districtOptions = districtsList.map(d => ({ id: d.id, label: d.name_en }));
  const cityOptions = citiesList.map(c => ({ id: c.id, label: formatLkCityLabel(c) }));
  const nameValid = NAME_RE.test(String(name || "").trim());

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Two-column layout */}
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Left Sidebar - Profile Card (Sticky) */}
          <div className="lg:w-80 lg:shrink-0">
            <div className="sticky top-8 space-y-5">
              {/* User Card */}
              <div className="overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-slate-200/50">
                <div className="bg-gradient-to-r from-sky-500 to-indigo-600 px-6 pb-8 pt-10">
                  <div className="relative mx-auto h-24 w-24">
                    <div className="relative h-full w-full overflow-hidden rounded-2xl border-4 border-white/30 shadow-xl">
                      {activeAvatar ? (
                        <Image src={activeAvatar} alt={displayName} fill className="object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-white/20 text-white">
                          <User className="h-10 w-10" />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setAvatarPickerOpen(true)}
                      className="absolute -bottom-1 -right-1 rounded-full bg-white p-1.5 text-sky-600 shadow-md transition hover:scale-110"
                    >
                      <Camera className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-4 text-center">
                    <h2 className="text-xl font-bold text-white">{displayName}</h2>
                    <div className="mt-1 flex items-center justify-center gap-1 text-sm text-sky-100">
                      <Mail className="h-3.5 w-3.5" /> {profile?.email}
                    </div>
                    {profile?.volunteerStatus === "approved" && (
                      <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                        <BadgeCheck className="h-3.5 w-3.5" /> Volunteer
                      </div>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-slate-100 px-5 py-3">
                  {profile?.mobile && (
                    <div className="flex items-center gap-3 py-3">
                      <Phone className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-slate-700">{profile.mobile}</span>
                    </div>
                  )}
                  {(profile?.city || profile?.district) && (
                    <div className="flex items-center gap-3 py-3">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-slate-700">
                        {profile.city ? `${profile.city}${profile.district ? `, ${profile.district}` : ""}` : profile.district}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 py-3">
                    <Shield className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-slate-700">
                      {accountHasPassword ? t("profilePage.security.passwordProtected") : t("profilePage.security.googleSignIn")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Links Card */}
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/50">
                <h3 className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{t("profilePage.quickAccess")}</h3>
                <nav className="space-y-1">
                  <Link href="/profile/incidents" className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    <span className="flex items-center gap-3"><FileText className="h-4 w-4 text-sky-500" /> {t("profilePage.myIncidents")}</span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </Link>
                  <Link href="/profile/missions" className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    <span className="flex items-center gap-3"><Users className="h-4 w-4 text-sky-500" /> {t("profilePage.myMissions")}</span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </Link>
                </nav>
              </div>

              {/* Volunteer Status (if applicable) */}
              {profile?.volunteerStatus && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4">
                  <p className="text-sm font-semibold text-rose-900">{t("profilePage.volunteerProgram.title")}</p>
                  <p className="mt-1 text-xs text-rose-700">{t("profilePage.volunteerProgram.status")}: <span className="font-medium capitalize">{profile.volunteerStatus}</span></p>
                  <button onClick={() => setShowLeaveConfirm(true)} disabled={leavingVolunteer} className="mt-3 w-full rounded-lg border border-rose-300 bg-white py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60">
                    {leavingVolunteer ? t("profilePage.volunteerProgram.leaving") : t("profilePage.volunteerProgram.leaveProgram")}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Main Content - Tabs */}
          <div className="flex-1">
            <div className="overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-slate-200/50">
              {/* Tab Headers */}
              <div className="flex border-b border-slate-200 bg-slate-50/50 px-2">
                {["profile", "security", "danger"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-6 py-3 text-sm font-medium capitalize transition ${
                      activeTab === tab
                        ? "border-b-2 border-sky-500 text-sky-600"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {tab === "profile"
                      ? t("profilePage.tabs.profile")
                      : tab === "security"
                        ? t("profilePage.tabs.security")
                        : t("profilePage.tabs.danger")}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === "profile" && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-slate-900">{t("profilePage.personalInfo")}</h3>
                    <form onSubmit={handleProfileSubmit} className="space-y-5">
                      <div className="grid gap-5 sm:grid-cols-2">
                        <InputField icon={User} label={t("profilePage.fields.fullName")} value={name} onChange={setName} placeholder={t("profilePage.fields.fullNamePlaceholder")} />
                        <InputField icon={Mail} label={t("profilePage.fields.emailAddress")} type="email" required value={email} onChange={setEmail} readOnly placeholder="you@example.com" />
                        <InputField icon={Phone} label={t("profilePage.fields.mobileNumber")} type="tel" value={mobile} onChange={(v) => setMobile(v.replace(/\D/g, "").slice(0, 10))} placeholder={t("profilePage.fields.mobilePlaceholder")} />
                      </div>
                      {name && !nameValid && (
                        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                          Name must contain letters only.
                        </div>
                      )}
                      <div className="grid gap-5 sm:grid-cols-2">
                        <SelectField
                          icon={MapPin}
                          label={t("profilePage.fields.district")}
                          value={districtId}
                          onChange={(id) => {
                            setDistrictId(id);
                            setCityRowId("");
                            setCity(""); setCityLatitude(null); setCityLongitude(null);
                            if (!id) { setDistrict(""); return; }
                            const d = districtsList.find(x => String(x.id) === String(id));
                            setDistrict(d?.name_en || "");
                          }}
                          disabled={locationsLoading || !!locationsError}
                          options={districtOptions}
                          placeholder={t("profilePage.fields.selectDistrict")}
                        />
                        <SelectField
                          icon={MapPin}
                          label={t("profilePage.fields.cityArea")}
                          value={cityRowId}
                          onChange={(id) => {
                            setCityRowId(id);
                            if (!id) { setCity(""); setCityLatitude(null); setCityLongitude(null); return; }
                            const c = citiesList.find(x => String(x.id) === String(id));
                            if (!c) return;
                            setCity(formatLkCityLabel(c));
                            setCityLatitude(typeof c.latitude === "number" ? c.latitude : null);
                            setCityLongitude(typeof c.longitude === "number" ? c.longitude : null);
                          }}
                          disabled={!districtId || locationsLoading || !!locationsError || citiesList.length === 0}
                          options={cityOptions}
                          placeholder={t("profilePage.fields.selectCity")}
                        />
                      </div>
                      {locationsLoading && <p className="text-xs text-slate-500">{t("profilePage.loadingLocations")}</p>}
                      {locationsError && <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{locationsError}</div>}
                      {profileMsg && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{profileMsg}</div>}
                      {profileSuccess && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{profileSuccess}</div>}
                      <div className="flex justify-end">
                        <button type="submit" disabled={profileSaving || locationsLoading} className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 disabled:opacity-70">
                          {profileSaving ? <Loader size="sm" /> : <Save className="h-4 w-4" />}
                          {profileSaving ? t("profilePage.actions.saving") : t("profilePage.actions.saveChanges")}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {activeTab === "security" && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-slate-900">{t("profilePage.security.title")}</h3>
                    {accountHasPassword ? (
                      <form onSubmit={handlePasswordSubmit} className="space-y-5">
                        <InputField icon={Lock} label={t("profilePage.security.currentPassword")} type="password" required value={currentPassword} onChange={setCurrentPassword} placeholder={t("profilePage.security.currentPasswordPlaceholder")} />
                        <div className="grid gap-5 sm:grid-cols-2">
                          <InputField icon={KeyRound} label={t("profilePage.security.newPassword")} type="password" required minLength={6} value={newPassword} onChange={setNewPassword} placeholder={t("profilePage.security.newPasswordPlaceholder")} />
                          <InputField icon={KeyRound} label={t("profilePage.security.confirmNewPassword")} type="password" required minLength={6} value={confirmNewPassword} onChange={setConfirmNewPassword} placeholder={t("profilePage.security.confirmNewPasswordPlaceholder")} />
                        </div>
                        {passwordMsg && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{passwordMsg}</div>}
                        {passwordSuccess && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{passwordSuccess}</div>}
                        <div className="flex justify-end">
                          <button type="submit" disabled={passwordSaving} className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 disabled:opacity-70">
                            {passwordSaving ? <Loader size="sm" /> : <Lock className="h-4 w-4" />}
                            {passwordSaving ? t("profilePage.actions.updating") : t("profilePage.actions.changePassword")}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="rounded-lg bg-sky-50 p-4 text-sm text-sky-800">
                        {t("profilePage.security.googleNoPassword")}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "danger" && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-rose-900">{t("profilePage.danger.title")}</h3>
                    <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h4 className="font-semibold text-rose-800">{t("profilePage.danger.deleteAccount")}</h4>
                          <p className="mt-1 text-sm text-rose-700/80">
                            {t("profilePage.danger.deleteDescription")}
                          </p>
                        </div>
                        <button
                          onClick={() => { setDeleteAccountErr(null); setDeleteAccountPassword(""); setShowDeleteAccount(true); }}
                          className="shrink-0 rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm hover:bg-rose-100"
                        >
                          {t("profilePage.danger.deleteAccount")}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals (unchanged) */}
      {avatarPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && setAvatarPickerOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-lg font-semibold">{t("profilePage.chooseAvatar")}</h3>
              <button onClick={() => setAvatarPickerOpen(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-5">
              <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
                {avatars.map((a) => {
                  const selected = avatar === a.id;
                  return (
                    <button key={a.id} onClick={() => { setAvatar(a.id); setAvatarPickerOpen(false); }} className={`group relative flex flex-col items-center rounded-xl p-2 text-center ${selected ? "bg-sky-50 ring-2 ring-sky-500" : "hover:bg-slate-50"}`}>
                      <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100 shadow-sm group-hover:border-sky-300">
                        <Image src={a.src} alt={a.label} fill sizes="64px" className="object-cover" />
                      </div>
                      <span className="mt-2 text-xs font-medium text-slate-700">{a.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && !deleteAccountBusy && setShowDeleteAccount(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-lg font-semibold">{t("profilePage.danger.deletePermanently")}</h3>
              <button onClick={() => !deleteAccountBusy && setShowDeleteAccount(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm text-slate-600">{accountHasPassword ? t("profilePage.danger.enterPasswordConfirm") : t("profilePage.danger.confirmDeletion")}</p>
              {accountHasPassword && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">{t("profilePage.security.currentPassword")}</label>
                  <input type="password" autoComplete="current-password" value={deleteAccountPassword} onChange={(e) => setDeleteAccountPassword(e.target.value)} className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm" placeholder={t("profilePage.security.currentPasswordPlaceholder")} />
                </div>
              )}
              {deleteAccountErr && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{deleteAccountErr}</div>}
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowDeleteAccount(false)} disabled={deleteAccountBusy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium">{t("profilePage.actions.cancel")}</button>
                <button onClick={handleDeleteAccount} disabled={deleteAccountBusy || (accountHasPassword && !deleteAccountPassword.trim())} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50">{deleteAccountBusy ? t("profilePage.actions.deleting") : t("profilePage.danger.deleteForever")}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && setShowLeaveConfirm(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-lg font-semibold">{t("profilePage.volunteerProgram.leaveConfirmTitle")}</h3>
              <button onClick={() => setShowLeaveConfirm(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5">
              <p className="text-sm text-slate-600">{t("profilePage.volunteerProgram.leaveConfirmText")}</p>
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setShowLeaveConfirm(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium">{t("profilePage.actions.cancel")}</button>
                <button onClick={() => { setShowLeaveConfirm(false); handleLeaveVolunteer(); }} disabled={leavingVolunteer} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-70">{leavingVolunteer ? t("profilePage.volunteerProgram.leaving") : t("profilePage.volunteerProgram.leaveYes")}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}