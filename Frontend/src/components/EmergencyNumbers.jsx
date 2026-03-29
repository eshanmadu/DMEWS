"use client";

import Lottie from "lottie-react";
import { PhoneCall, Ambulance, Flame, ShieldAlert, Phone } from "lucide-react";
import { useTranslation } from "react-i18next";

const pulseDot = {
  v: "5.7.4",
  fr: 30,
  ip: 0,
  op: 60,
  w: 120,
  h: 120,
  nm: "pulse",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "ring",
      sr: 1,
      ks: {
        o: { a: 1, k: [{ t: 0, s: [60] }, { t: 60, s: [0] }] },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [60, 60, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: [{ t: 0, s: [60, 60, 100] }, { t: 60, s: [140, 140, 100] }] },
      },
      shapes: [
        {
          ty: "el",
          p: { a: 0, k: [0, 0] },
          s: { a: 0, k: [56, 56] },
          nm: "ellipse",
        },
        {
          ty: "st",
          c: { a: 0, k: [1, 1, 1, 1] },
          o: { a: 0, k: 100 },
          w: { a: 0, k: 6 },
          lc: 2,
          lj: 2,
          nm: "stroke",
        },
        { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } },
      ],
      ao: 0,
      ip: 0,
      op: 60,
      st: 0,
      bm: 0,
    },
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: "dot",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [60, 60, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: [{ t: 0, s: [100, 100, 100] }, { t: 30, s: [112, 112, 100] }, { t: 60, s: [100, 100, 100] }] },
      },
      shapes: [
        { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [22, 22] }, nm: "ellipse" },
        { ty: "fl", c: { a: 0, k: [1, 1, 1, 1] }, o: { a: 0, k: 100 }, r: 1, nm: "fill" },
        { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } },
      ],
      ao: 0,
      ip: 0,
      op: 60,
      st: 0,
      bm: 0,
    },
  ],
};

const ITEMS = [
  {
    titleKey: "emergency.police",
    number: "119",
    Icon: PhoneCall,
    ring: "from-indigo-600 to-sky-600",
    bgGradient: "from-indigo-50/80 to-sky-50/80",
    num: "text-indigo-700",
    iconBg: "bg-gradient-to-br from-indigo-500 to-sky-500",
  },
  {
    titleKey: "emergency.ambulance",
    number: "1990",
    Icon: Ambulance,
    ring: "from-emerald-600 to-teal-600",
    bgGradient: "from-emerald-50/80 to-teal-50/80",
    num: "text-emerald-700",
    iconBg: "bg-gradient-to-br from-emerald-500 to-teal-500",
  },
  {
    titleKey: "emergency.fire",
    number: "110",
    Icon: Flame,
    ring: "from-orange-600 to-rose-600",
    bgGradient: "from-orange-50/80 to-rose-50/80",
    num: "text-orange-700",
    iconBg: "bg-gradient-to-br from-orange-500 to-rose-500",
  },
  {
    titleKey: "emergency.disaster",
    number: "117",
    Icon: ShieldAlert,
    ring: "from-amber-500 to-yellow-500",
    bgGradient: "from-amber-50/80 to-yellow-50/80",
    num: "text-amber-800",
    iconBg: "bg-gradient-to-br from-amber-500 to-yellow-500",
  },
];

export function EmergencyNumbers() {
  const { t } = useTranslation();

  const sectionTitle = t("emergency.title");
  const sectionSubtitle = t("emergency.subtitle");
  const tapToCall = t("emergency.tapToCall");

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-sky-200/80 bg-white shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-sky-50 via-white to-sky-50 px-5 py-4">
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-900">
            {sectionTitle}
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">
            {sectionSubtitle}
          </p>
        </div>
        <span className="rounded-full bg-red-600/10 px-3 py-1 text-xs font-semibold text-red-700">
          24/7
        </span>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map(({ titleKey, number, Icon, bgGradient, num, iconBg }) => (
          <a
            key={number}
            href={`tel:${number}`}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-slate-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-sky-400/60 focus-visible:ring-offset-2"
            aria-label={`Call ${t(titleKey)} ${number}`}
          >
            {/* Subtle background gradient that appears on hover */}
            <div
              className={`absolute inset-0 bg-gradient-to-br ${bgGradient} opacity-0 transition-opacity group-hover:opacity-100`}
            />

            {/* Content */}
            <div className="relative z-10">
              <div className="flex items-start justify-between">
                <div className="relative">
                  <div className="absolute inset-0 opacity-20">
                    <Lottie
                      animationData={pulseDot}
                      loop
                      autoplay
                      className="h-14 w-14"
                    />
                  </div>
                  <div
                    className={`relative flex h-14 w-14 items-center justify-center rounded-2xl ${iconBg} shadow-sm transition group-hover:shadow-md`}
                  >
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                </div>
                <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur-sm">
                  {tapToCall}
                </span>
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t(titleKey)}
                </p>
                <p className={`mt-1 text-3xl font-extrabold tracking-tight ${num}`}>
                  {number}
                </p>
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                <Phone className="h-3 w-3" />
                <span className="transition group-hover:text-slate-600">
                  Tap to call
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}