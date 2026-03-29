"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const DISTRICTS = [
  "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya",
  "Galle", "Matara", "Hambantota", "Jaffna", "Kilinochchi", "Mannar",
  "Vavuniya", "Mullaitivu", "Batticaloa", "Ampara", "Trincomalee",
  "Kurunegala", "Puttalam", "Anuradhapura", "Polonnaruwa", "Badulla",
  "Monaragala", "Ratnapura", "Kegalle",
];

function InputWithIcon({
  icon: Icon,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
  minLength,
  as = "input",
  options,
}) {
  const base =
    "w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-slate-900 placeholder-slate-400 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200";
  return (
    <div className="relative">
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400">
        {label}
      </label>
      <div className="group relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-slate-500 transition group-focus-within:text-teal-400">
          <Icon className="h-4 w-4" />
        </span>
        {as === "select" ? (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={base}
          >
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
            className={base}
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
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);

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
    const token = window.localStorage.getItem("dmews_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    (async () => {
      setProfileLoading(true);
      setProfileError(null);
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 401) {
            router.replace("/login");
            return;
          }
          setProfileError(data?.message || "Failed to load profile.");
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
    })();
  }, [mounted, router]);

  async function handleProfileSubmit(e) {
    e.preventDefault();
    setProfileMsg(null);
    setProfileSuccess(null);
    const token = typeof window !== "undefined" ? window.localStorage.getItem("dmews_token") : null;
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
        setProfileSaving(false);
        return;
      }
      if (data.token) {
        window.localStorage.setItem("dmews_token", data.token);
      }
      if (data.user) {
        window.localStorage.setItem("dmews_user", JSON.stringify(data.user));
        if (data.user.district) {
          window.localStorage.setItem("dmews_user_district", data.user.district);
        }
        setProfile(data.user);
      }
      setProfileSuccess("Profile updated.");
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
    const token = typeof window !== "undefined" ? window.localStorage.getItem("dmews_token") : null;
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
        body: JSON.stringify({
          currentPassword: currentPassword,
          newPassword: newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordMsg(data?.message || "Failed to change password.");
        setPasswordSaving(false);
        return;
      }
      setPasswordSuccess("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch {
      setPasswordMsg("Network error.");
    } finally {
      setPasswordSaving(false);
    }
  }

  if (!mounted || profileLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-white/80 px-10 py-8 shadow-lg ring-1 ring-slate-200">
          <Loader size="lg" />
          <span className="text-sm font-medium text-slate-600">
            Loading profile…
          </span>
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
      {/* Profile Header Card */}
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-sky-700 via-sky-600 to-sky-800 shadow-lg">
        <div className="relative z-10 px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
            {/* Avatar */}
            <div className="relative">
              <div className="relative h-28 w-28 overflow-hidden rounded-2xl border-4 border-white/30 bg-sky-500/30 shadow-lg sm:h-32 sm:w-32">
                {activeAvatar ? (
                  <Image
                    src={activeAvatar}
                    alt={displayName}
                    fill
                    sizes="128px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sky-100">
                    <User className="h-12 w-12" />
                  </div>
                )}
              </div>
              <button
                onClick={() => setAvatarPickerOpen(true)}
                className="absolute -bottom-2 -right-2 rounded-full bg-sky-800 p-1.5 text-white shadow-md transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2"
                aria-label="Change avatar"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>

            {/* User Info */}
            <div className="text-center sm:text-left">
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <h1 className="text-2xl font-bold text-white sm:text-3xl">
                  {displayName}
                </h1>
                {profile?.volunteerStatus === "approved" && (
                  <BadgeCheck
                    className="h-6 w-6 text-blue-300"
                    aria-label="Verified volunteer"
                  />
                )}
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
              <div className="mt-4 inline-block rounded-full bg-sky-800/50 px-3 py-1 text-xs font-medium text-sky-100 backdrop-blur-sm">
                Disaster Management & Early Warning System
              </div>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 bg-black/10" />
      </div>

      {/* Two‑column layout for forms */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Edit Profile Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100">
              <User className="h-5 w-5 text-sky-700" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Edit Profile
              </h2>
              <p className="text-[11px] text-slate-500">
                Update your personal information.
              </p>
            </div>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <InputWithIcon
              icon={User}
              label="Name"
              value={name}
              onChange={setName}
              placeholder="Your name"
            />
            <InputWithIcon
              icon={Mail}
              label="Email"
              type="email"
              required
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
            />
            <InputWithIcon
              icon={Phone}
              label="Mobile number"
              type="tel"
              value={mobile}
              onChange={setMobile}
              placeholder="e.g. 0771234567"
            />
            <InputWithIcon
              icon={MapPin}
              label="District"
              value={district}
              onChange={setDistrict}
              as="select"
              options={DISTRICTS}
            />

            {profileMsg && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {profileMsg}
              </div>
            )}
            {profileSuccess && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700">
                <CheckCircle className="h-4 w-4 shrink-0" />
                {profileSuccess}
              </div>
            )}

            <button
              type="submit"
              disabled={profileSaving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-slate-50 disabled:opacity-70"
            >
              {profileSaving ? (
                <Loader size="sm" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {profileSaving ? "Saving…" : "Save profile"}
            </button>
          </form>
        </div>

        {/* Security Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
              <Shield className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Security
              </h2>
              <p className="text-[11px] text-slate-500">
                Change your password.
              </p>
            </div>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <InputWithIcon
              icon={Lock}
              label="Current password"
              type="password"
              required
              value={currentPassword}
              onChange={setCurrentPassword}
              placeholder="Enter current password"
            />
            <InputWithIcon
              icon={KeyRound}
              label="New password"
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={setNewPassword}
              placeholder="At least 6 characters"
            />
            <InputWithIcon
              icon={KeyRound}
              label="Confirm new password"
              type="password"
              required
              minLength={6}
              value={confirmNewPassword}
              onChange={setConfirmNewPassword}
              placeholder="Re-enter new password"
            />

            {passwordMsg && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {passwordMsg}
              </div>
            )}
            {passwordSuccess && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700">
                <CheckCircle className="h-4 w-4 shrink-0" />
                {passwordSuccess}
              </div>
            )}

            <button
              type="submit"
              disabled={passwordSaving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 py-2.5 text-sm font-semibold text-slate-50 shadow-sm transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50 disabled:opacity-70"
            >
              {passwordSaving ? (
                <Loader size="sm" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              {passwordSaving ? "Updating…" : "Change password"}
            </button>
          </form>
        </div>
      </div>

      {/* Avatar Picker Modal */}
      {avatarPickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Choose a profile picture"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAvatarPickerOpen(false);
          }}
        >
          <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Choose a profile picture
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Select one avatar. It will be saved when you press “Save profile”.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAvatarPickerOpen(false)}
                className="inline-flex items-center justify-center rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-auto p-5">
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
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
                      className={`group flex flex-col items-center gap-2 rounded-2xl border p-3 text-[11px] font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 ${
                        selected
                          ? "border-sky-500 bg-sky-50 text-sky-700"
                          : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="relative h-14 w-14 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                        <Image
                          src={a.src}
                          alt={a.label}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      </div>
                      <span className="line-clamp-1">{a.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}