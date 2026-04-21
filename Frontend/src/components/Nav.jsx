"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  AlertTriangle,
  FileWarning,
  UserCircle,
  LogOut,
  Building2,
  Heart,
  BadgeCheck,
  ChevronDown,
} from "lucide-react";
import Image from "next/image";
import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { avatarSrcById } from "@/lib/avatars";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";

const linkKeys = [
  { href: "/", key: "dashboard", icon: LayoutDashboard },
  { href: "/alerts", key: "alerts", icon: AlertTriangle },
  { href: "/incidents", key: "incidents", icon: FileWarning }, // replaced by dropdown
  { href: "/shelters", key: "shelters", icon: Building2 },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState({ token: null, user: null, role: null });
  const { t } = useTranslation();
  const isAdminRoute = pathname?.startsWith("/admin");

  // Incidents dropdown state
  const [incidentsDropdownOpen, setIncidentsDropdownOpen] = useState(false);
  const incidentsDropdownRef = useRef(null);
  const closeTimeoutRef = useRef(null);
  const [volunteerDropdownOpen, setVolunteerDropdownOpen] = useState(false);
  const volunteerDropdownRef = useRef(null);
  const volunteerCloseTimeoutRef = useRef(null);

  const dropdownItems = [
    { href: "/incidents/missing-persons", label: t("nav.findPeople", "Find People") },
    { href: "/incidents", label: t("nav.reports", "Reports") }, // keep current path
  ];
  const volunteerDropdownItems = [
    { href: "/volunteer", label: t("nav.volunteer", "Volunteer") },
    { href: "/resources", label: t("nav.resources", "Resources") },
  ];

  // Close incidents dropdown on route change
  useEffect(() => {
    setIncidentsDropdownOpen(false);
    setVolunteerDropdownOpen(false);
  }, [pathname]);

  // Close incidents dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        incidentsDropdownRef.current &&
        !incidentsDropdownRef.current.contains(event.target)
      ) {
        setIncidentsDropdownOpen(false);
      }
      if (
        volunteerDropdownRef.current &&
        !volunteerDropdownRef.current.contains(event.target)
      ) {
        setVolunteerDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const openDropdown = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    setIncidentsDropdownOpen(true);
  };

  const closeDropdownWithDelay = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setIncidentsDropdownOpen(false);
    }, 150);
  };

  const cancelClose = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
  };
  const openVolunteerDropdown = () => {
    if (volunteerCloseTimeoutRef.current)
      clearTimeout(volunteerCloseTimeoutRef.current);
    setVolunteerDropdownOpen(true);
  };
  const closeVolunteerDropdownWithDelay = () => {
    volunteerCloseTimeoutRef.current = setTimeout(() => {
      setVolunteerDropdownOpen(false);
    }, 150);
  };
  const cancelVolunteerClose = () => {
    if (volunteerCloseTimeoutRef.current)
      clearTimeout(volunteerCloseTimeoutRef.current);
  };

  const isIncidentsActive = dropdownItems.some((item) => pathname === item.href);
  const isVolunteerActive = volunteerDropdownItems.some(
    (item) => pathname === item.href
  );

  // Language enforcement for admin routes
  useEffect(() => {
    if (!isAdminRoute) return;
    if (i18n.language !== "en") i18n.changeLanguage("en");
  }, [isAdminRoute]);

  const readSession = useCallback(() => {
    if (typeof window === "undefined") return;
    const token = window.localStorage.getItem("dmews_token");
    const role = window.localStorage.getItem("dmews_role");
    let user = null;
    try {
      const raw = window.localStorage.getItem("dmews_user");
      user = raw ? JSON.parse(raw) : null;
    } catch {
      user = null;
    }
    setSession({ token, user, role });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    readSession();
    window.addEventListener("storage", readSession);
    window.addEventListener("dmews-auth-changed", readSession);
    return () => {
      window.removeEventListener("storage", readSession);
      window.removeEventListener("dmews-auth-changed", readSession);
    };
  }, [readSession]);

  useEffect(() => {
    readSession();
  }, [pathname, readSession]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = session?.token;
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const res = await fetch(`${base}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || cancelled) return;
        const raw = window.localStorage.getItem("dmews_user");
        let prev = {};
        try {
          prev = raw ? JSON.parse(raw) : {};
        } catch {
          prev = {};
        }
        const merged = { ...prev, ...data };
        if (JSON.stringify(prev) === JSON.stringify(merged)) return;
        window.localStorage.setItem("dmews_user", JSON.stringify(merged));
        window.dispatchEvent(new Event("dmews-auth-changed"));
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, session?.token]);

  function handleLogout() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem("dmews_token");
    window.localStorage.removeItem("dmews_user");
    window.localStorage.removeItem("dmews_user_district");
    window.localStorage.removeItem("dmews_role");
    setSession({ token: null, user: null, role: null });
    window.dispatchEvent(new Event("dmews-auth-changed"));
    router.push("/login");
  }

  const isLoggedIn = Boolean(session?.token);
  const displayName = session?.user?.name || session?.user?.email || "User";
  const avatarId = session?.user?.avatar;
  const avatarSrc = avatarSrcById(avatarId);
  const volunteerApproved = session?.user?.volunteerStatus === "approved";

  /** Admin users: main account chip goes to dashboard, not profile */
  const isAdminUser =
    Boolean(session?.user?.isAdmin) ||
    session?.role === "admin" ||
    String(session?.user?.id || session?.user?._id || "") === "dev-admin-session";
  const accountHref = isAdminUser ? "/admin" : "/profile";
  const accountLinkActive = isAdminUser
    ? pathname?.startsWith("/admin")
    : pathname === "/profile";

  return (
    <header className="sticky top-0 z-[1000] border-b border-sky-200 bg-gradient-to-r from-sky-700 via-sky-600 to-sky-700 text-sky-50 shadow-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-oswald tracking-wide text-white"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
            <AlertTriangle className="h-5 w-5" />
          </span>
          DisasterWatch
        </Link>
        <nav className="flex items-center gap-3">
          <div className="flex gap-1">
            {linkKeys.map(({ href, key: linkKey, icon: Icon }) => {
              // Replace the Incidents link with dropdown
              if (linkKey === "incidents") {
                return (
                  <div
                    key="incidents-dropdown"
                    ref={incidentsDropdownRef}
                    className="relative"
                    onMouseEnter={openDropdown}
                    onMouseLeave={closeDropdownWithDelay}
                  >
                    <button
                      type="button"
                      onClick={() => setIncidentsDropdownOpen((prev) => !prev)}
                      className={clsx(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
                        isIncidentsActive || incidentsDropdownOpen
                          ? "bg-white/15 text-white shadow-sm"
                          : "text-sky-100/80 hover:bg-sky-500/40 hover:text-white"
                      )}
                      aria-expanded={incidentsDropdownOpen}
                      aria-haspopup="true"
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">
                        {t(`nav.${linkKey}`)}
                      </span>
                      <ChevronDown
                        className={clsx(
                          "h-3 w-3 transition-transform duration-200",
                          incidentsDropdownOpen && "rotate-180"
                        )}
                      />
                    </button>
                    {incidentsDropdownOpen && (
                      <div
                        className="absolute left-0 mt-2 min-w-[160px] rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5"
                        onMouseEnter={cancelClose}
                        onMouseLeave={closeDropdownWithDelay}
                        role="menu"
                        aria-orientation="vertical"
                      >
                        {dropdownItems.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={clsx(
                              "block px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-100",
                              pathname === item.href && "bg-gray-100 font-medium"
                            )}
                            role="menuitem"
                            onClick={() => setIncidentsDropdownOpen(false)}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              // Regular nav links
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
                    pathname === href
                      ? "bg-white/15 text-white shadow-sm"
                      : "text-sky-100/80 hover:bg-sky-500/40 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {t(`nav.${linkKey}`)}
                  </span>
                </Link>
              );
            })}
            {isLoggedIn && (
              <div
                ref={volunteerDropdownRef}
                className="relative"
                onMouseEnter={openVolunteerDropdown}
                onMouseLeave={closeVolunteerDropdownWithDelay}
              >
                <button
                  type="button"
                  onClick={() => setVolunteerDropdownOpen((prev) => !prev)}
                  className={clsx(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
                    isVolunteerActive || volunteerDropdownOpen
                      ? "bg-white/15 text-white shadow-sm"
                      : "text-sky-100/80 hover:bg-sky-500/40 hover:text-white"
                  )}
                  aria-expanded={volunteerDropdownOpen}
                  aria-haspopup="true"
                >
                  <Heart className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("nav.volunteer")}</span>
                  <ChevronDown
                    className={clsx(
                      "h-3 w-3 transition-transform duration-200",
                      volunteerDropdownOpen && "rotate-180"
                    )}
                  />
                </button>
                {volunteerDropdownOpen && (
                  <div
                    className="absolute left-0 mt-2 min-w-[170px] rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5"
                    onMouseEnter={cancelVolunteerClose}
                    onMouseLeave={closeVolunteerDropdownWithDelay}
                    role="menu"
                    aria-orientation="vertical"
                  >
                    {volunteerDropdownItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={clsx(
                          "block px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-100",
                          pathname === item.href && "bg-gray-100 font-medium"
                        )}
                        role="menuitem"
                        onClick={() => setVolunteerDropdownOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-2">
            {!isLoggedIn ? (
              <>
                <Link
                  href="/login"
                  className={clsx(
                    "rounded-lg px-3 py-2 text-sm font-medium transition",
                    pathname === "/login"
                      ? "bg-white/15 text-white"
                      : "text-sky-100/80 hover:bg-red-500 hover:text-white"
                  )}
                >
                  {t("nav.login")}
                </Link>
                <Link
                  href="/signup"
                  className={clsx(
                    "rounded-lg px-3 py-2 text-sm font-semibold text-sky-900 transition",
                    pathname === "/signup"
                      ? "bg-amber-300"
                      : "bg-amber-400 hover:bg-amber-300"
                  )}
                >
                  {t("nav.signup")}
                </Link>
              </>
            ) : (
              <>
                <Link
                  href={accountHref}
                  className={clsx(
                    "flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 transition hover:bg-white/15",
                    accountLinkActive ? "ring-1 ring-amber-300/60" : ""
                  )}
                >
                  <span className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-amber-200/30">
                    {avatarSrc ? (
                      <Image
                        src={avatarSrc}
                        alt={displayName}
                        fill
                        sizes="32px"
                        className="object-cover"
                      />
                    ) : (
                      <UserCircle className="h-5 w-5 text-amber-200" />
                    )}
                  </span>
                  <span className="flex max-w-[180px] items-center gap-1 truncate text-sm text-sky-50">
                    <span className="truncate">{displayName}</span>
                    {volunteerApproved && (
                      <BadgeCheck
                        className="h-4 w-4 flex-shrink-0 text-blue-300"
                        aria-label="Verified volunteer"
                        title="Verified volunteer"
                      />
                    )}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-sky-50 transition hover:bg-white/15"
                >
                  <LogOut className="h-4 w-4" />
                  {t("nav.logout")}
                </button>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}