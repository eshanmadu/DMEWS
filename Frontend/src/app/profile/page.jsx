"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Loader from "@/components/Loader";
import { AVATARS, avatarSrcById } from "@/lib/avatars";
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
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const DISTRICTS = [
  "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya",
  "Galle", "Matara", "Hambantota", "Jaffna", "Kilinochchi", "Mannar",
  "Vavuniya", "Mullaitivu", "Batticaloa", "Ampara", "Trincomalee",
  "Kurunegala", "Puttalam", "Anuradhapura", "Polonnaruwa", "Badulla",
  "Monaragala", "Ratnapura", "Kegalle",
];

function InputWithIcon({ icon: Icon, label, type = "text", value, onChange, placeholder, required, minLength, as = "input", options }) {
  const baseClasses = "w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200";
  return (
    <div className="relative">
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</label>
      <div className="group relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-slate-400 transition group-focus-within:text-sky-500">
          <Icon className="h-4 w-4" />
        </span>
        {as === "select" ? (
          <select value={value} onChange={(e) => onChange(e.target.value)} className={baseClasses}>
            <option value="">Select district</option>
            {(options || []).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        ) : (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            minLength={minLength}
            className={baseClasses}
          />
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [district, setDistrict] = useState("");
  const [avatar, setAvatar] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(null);
  const [profileMsg, setProfileMsg] = useState(null);
  const [leavingVolunteer, setLeavingVolunteer] = useState(false);
  const [volunteerMsg, setVolunteerMsg] = useState(null);
  const [volunteerErr, setVolunteerErr] = useState(null);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false); // NEW

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

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    const token = localStorage.getItem("dmews_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    const fetchProfile = async () => {
      setProfileLoading(true);
      setProfileError(null);
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 401) router.replace("/login");
          else setProfileError(data?.message || "Failed to load profile.");
          setProfileLoading(false);
          return;
        }
        setProfile(data);
        setName(data.name || "");
        setEmail(data.email || "");
        setMobile(data.mobile || "");
        setDistrict(data.district || "");
        setAvatar(data.avatar || "");
      } catch {
        setProfileError("Network error.");
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();
  }, [mounted, router]);

  async function handleProfileSubmit(e) {
    e.preventDefault();
    setProfileMsg(null);
    setProfileSuccess(null);
    const token = localStorage.getItem("dmews_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    setProfileSaving(true);
    try {
      const res = await fetch(`${API_BASE}/auth/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, email, mobile, district, avatar }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileMsg(data?.message || "Failed to update profile.");
        return;
      }
      if (data.token) localStorage.setItem("dmews_token", data.token);
      if (data.user) {
        localStorage.setItem("dmews_user", JSON.stringify(data.user));
        if (data.user.district) localStorage.setItem("dmews_user_district", data.user.district);
        setProfile(data.user);
      }
      setProfileSuccess("Profile updated successfully.");
      window.dispatchEvent(new Event("dmews-auth-changed"));
    } catch {
      setProfileMsg("Network error.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPasswordMsg(null);
    setPasswordSuccess(null);
    if (newPassword !== confirmNewPassword) {
      setPasswordMsg("New passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg("New password must be at least 6 characters.");
      return;
    }
    const token = localStorage.getItem("dmews_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordMsg(data?.message || "Failed to change password.");
        return;
      }
      setPasswordSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch {
      setPasswordMsg("Network error.");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleLeaveVolunteer() {
    const token = localStorage.getItem("dmews_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    setVolunteerErr(null);
    setVolunteerMsg(null);
    setLeavingVolunteer(true);
    try {
      const res = await fetch(`${API_BASE}/volunteers/me`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setVolunteerErr(data?.message || "Failed to leave volunteer program.");
        return;
      }

      const nextProfile = { ...(profile || {}), volunteerStatus: null };
      setProfile(nextProfile);

      try {
        const raw = localStorage.getItem("dmews_user");
        const parsed = raw ? JSON.parse(raw) : {};
        localStorage.setItem(
          "dmews_user",
          JSON.stringify({ ...parsed, volunteerStatus: null })
        );
      } catch {
        // ignore storage parse errors
      }
      window.dispatchEvent(new Event("dmews-auth-changed"));
      setVolunteerMsg(data?.message || "You have left the volunteer program.");
    } catch {
      setVolunteerErr("Network error.");
    } finally {
      setLeavingVolunteer(false);
    }
  }

  async function handleDeleteAccount() {
    const token = localStorage.getItem("dmews_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    setDeleteAccountErr(null);
    setDeleteAccountBusy(true);
    try {
      const res = await fetch(`${API_BASE}/auth/account`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword: deleteAccountPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteAccountErr(data?.message || "Could not delete account.");
        return;
      }
      localStorage.removeItem("dmews_token");
      localStorage.removeItem("dmews_user");
      localStorage.removeItem("dmews_user_district");
      window.dispatchEvent(new Event("dmews-auth-changed"));
      router.replace("/login?deleted=1");
    } catch {
      setDeleteAccountErr("Network error.");
    } finally {
      setDeleteAccountBusy(false);
    }
  }

  if (!mounted || profileLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="animate-pulse">
          <div className="mb-8 h-40 w-full rounded-2xl bg-slate-200" />
          <div className="grid gap-6 md:grid-cols-2">
            <div className="h-80 rounded-2xl bg-slate-100" />
            <div className="h-80 rounded-2xl bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  if (profileError && !profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {profileError}
        </div>
      </div>
    );
  }

  const displayName = profile?.name?.trim() || profile?.email || "User";
  const activeAvatar = avatarSrcById(avatar);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Profile Header with Navigation Links */}
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-sky-600 to-sky-800 shadow-lg">
        <div className="relative z-10 px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
            {/* Avatar */}
            <div className="relative">
              <div className="relative h-28 w-28 overflow-hidden rounded-2xl border-4 border-white/30 bg-white/10 shadow-lg sm:h-32 sm:w-32">
                {activeAvatar ? (
                  <Image src={activeAvatar} alt={displayName} fill sizes="128px" className="object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-white">
                    <User className="h-12 w-12" />
                  </div>
                )}
              </div>
              <button
                onClick={() => setAvatarPickerOpen(true)}
                className="absolute -bottom-2 -right-2 rounded-full bg-white p-1.5 text-sky-600 shadow-md transition hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2"
                aria-label="Change avatar"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>

            {/* User Info */}
            <div className="text-center sm:text-left">
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <h1 className="text-2xl font-bold text-white sm:text-3xl">{displayName}</h1>
                {profile?.volunteerStatus === "approved" && <BadgeCheck className="h-6 w-6 text-blue-300" />}
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-sky-100 sm:justify-start">
                <span className="flex items-center gap-1.5">
                  <Mail className="h-4 w-4" />
                  {profile?.email || "—"}
                </span>
                {profile?.mobile && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-4 w-4" />
                    {profile.mobile}
                  </span>
                )}
                {profile?.district && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {profile.district}
                  </span>
                )}
              </div>
              <div className="mt-4 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                Disaster Management & Early Warning System
              </div>
            </div>
          </div>

          {/* Navigation Shortcuts */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Link
              href="/profile/incidents"
              className="group flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white backdrop-blur-md transition hover:bg-white/20 hover:shadow-lg"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">My Incidents</p>
                <p className="text-xs text-sky-100">Incidents &amp; missing / found persons</p>
              </div>
            </Link>

            <Link
              href="/profile/missions"
              className="group flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white backdrop-blur-md transition hover:bg-white/20 hover:shadow-lg"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">My Missions</p>
                <p className="text-xs text-sky-100">Volunteer work you joined</p>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Volunteer section with confirmation button */}
      {profile?.volunteerStatus && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50/60 p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Volunteer Program
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Current status:{" "}
                <span className="font-semibold capitalize text-rose-700">
                  {profile.volunteerStatus}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowLeaveConfirm(true)} // Open confirmation modal
              disabled={leavingVolunteer}
              className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
            >
              {leavingVolunteer ? "Leaving..." : "Leave volunteer program"}
            </button>
          </div>
          {volunteerErr && (
            <p className="mt-3 text-sm text-rose-700">{volunteerErr}</p>
          )}
          {volunteerMsg && (
            <p className="mt-3 text-sm text-emerald-700">{volunteerMsg}</p>
          )}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Personal Information Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Personal Information</h2>
              <p className="text-xs text-slate-500">Update your personal details</p>
            </div>
          </div>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <InputWithIcon icon={User} label="Full Name" value={name} onChange={setName} placeholder="Your name" />
            <InputWithIcon icon={Mail} label="Email Address" type="email" required value={email} onChange={setEmail} placeholder="you@example.com" />
            <InputWithIcon icon={Phone} label="Mobile Number" type="tel" value={mobile} onChange={setMobile} placeholder="e.g., 0771234567" />
            <InputWithIcon icon={MapPin} label="District" value={district} onChange={setDistrict} as="select" options={DISTRICTS} />
            {profileMsg && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {profileMsg}
              </div>
            )}
            {profileSuccess && (
              <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-700">
                <CheckCircle className="h-4 w-4 shrink-0" />
                {profileSuccess}
              </div>
            )}
            <button
              type="submit"
              disabled={profileSaving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 disabled:opacity-70"
            >
              {profileSaving ? <Loader size="sm" /> : <Save className="h-4 w-4" />}
              {profileSaving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </div>

        {/* Security Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Security</h2>
              <p className="text-xs text-slate-500">Change your password</p>
            </div>
          </div>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <InputWithIcon icon={Lock} label="Current Password" type="password" required value={currentPassword} onChange={setCurrentPassword} placeholder="Enter current password" />
            <InputWithIcon icon={KeyRound} label="New Password" type="password" required minLength={6} value={newPassword} onChange={setNewPassword} placeholder="At least 6 characters" />
            <InputWithIcon icon={KeyRound} label="Confirm New Password" type="password" required minLength={6} value={confirmNewPassword} onChange={setConfirmNewPassword} placeholder="Re-enter new password" />
            {passwordMsg && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {passwordMsg}
              </div>
            )}
            {passwordSuccess && (
              <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-700">
                <CheckCircle className="h-4 w-4 shrink-0" />
                {passwordSuccess}
              </div>
            )}
            <button
              type="submit"
              disabled={passwordSaving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:opacity-70"
            >
              {passwordSaving ? <Loader size="sm" /> : <Lock className="h-4 w-4" />}
              {passwordSaving ? "Updating..." : "Change Password"}
            </button>
          </form>
        </div>
      </div>

      {profile?.id && profile.id !== "dev-admin-session" && (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/50 p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-rose-900">
                <Trash2 className="h-4 w-4" />
                Delete account
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-rose-800/90">
                Permanently remove your DMEWS account. Your incident reports, SOS alerts, missing and
                found person reports, volunteer application, mission sign-ups, and sign-in history will
                be deleted from our database. This cannot be undone.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDeleteAccountErr(null);
                setDeleteAccountPassword("");
                setShowDeleteAccount(true);
              }}
              className="shrink-0 rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-800 shadow-sm transition hover:bg-rose-50"
            >
              Delete my account…
            </button>
          </div>
        </div>
      )}

      {/* Avatar Picker Modal */}
      {avatarPickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setAvatarPickerOpen(false)}
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Choose an avatar</h3>
              <button onClick={() => setAvatarPickerOpen(false)} className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-5">
              <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
                {avatars.map((a) => {
                  const selected = avatar === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setAvatar(a.id);
                        setAvatarPickerOpen(false);
                      }}
                      className={`group relative flex flex-col items-center rounded-xl p-2 text-center transition focus:outline-none focus:ring-2 focus:ring-sky-300 ${
                        selected ? "bg-sky-50 ring-2 ring-sky-500" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="relative h-16 w-16 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && !deleteAccountBusy && setShowDeleteAccount(false)}
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Delete account permanently?</h3>
              <button
                type="button"
                onClick={() => !deleteAccountBusy && setShowDeleteAccount(false)}
                className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm text-slate-600">
                Enter your current password to confirm. All content you submitted through this account
                will be removed.
              </p>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Current password
                </label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={deleteAccountPassword}
                  onChange={(e) => setDeleteAccountPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                  placeholder="Your password"
                />
              </div>
              {deleteAccountErr && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {deleteAccountErr}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={deleteAccountBusy}
                  onClick={() => setShowDeleteAccount(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteAccountBusy || !deleteAccountPassword.trim()}
                  onClick={handleDeleteAccount}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deleteAccountBusy ? "Deleting…" : "Delete forever"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Leaving Volunteer Program */}
      {showLeaveConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setShowLeaveConfirm(false)}
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Confirm leaving volunteer program</h3>
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-slate-600">
                Are you sure you want to leave the volunteer program? You will no longer be able to accept missions or receive volunteer-related notifications.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowLeaveConfirm(false);
                    handleLeaveVolunteer();
                  }}
                  disabled={leavingVolunteer}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-70"
                >
                  {leavingVolunteer ? "Leaving..." : "Yes, leave"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}