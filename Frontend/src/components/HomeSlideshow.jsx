"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Noto_Sans_Sinhala } from "next/font/google";
import localFont from "next/font/local";

import homeSlide from "@/img/slides/home.png";
import riskSlide from "@/img/slides/risk.png";
import weatherSlide from "@/img/slides/weather.png";
import shelterSlide from "@/img/slides/shelter.png";
import personSlide from "@/img/slides/person.png";

import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, A11y, Mousewheel } from "swiper/modules";

import "swiper/css";
import "swiper/css/pagination";

const savenirsans = localFont({
  src: "../fonts/SavenirSans.ttf",
});

const notoSansSinhala = Noto_Sans_Sinhala({
  subsets: ["sinhala"],
  weight: ["600", "700"],
  display: "swap",
});

const BRAND_TITLE = "DisasterWatch";

const SLIDE_DEFS = [
  {
    key: "home",
    imageSrc: homeSlide,
    ctaHref: "/signup",
    ctaClass:
      "bg-gradient-to-r from-red-600 to-rose-600 text-white hover:from-red-700 hover:to-rose-700 shadow-lg shadow-red-500/25",
  },
  {
    key: "risk",
    imageSrc: riskSlide,
    ctaHref: "#risk-map",
    ctaClass:
      "bg-gradient-to-r from-amber-400 to-orange-400 text-slate-900 hover:from-amber-500 hover:to-orange-500 shadow-lg shadow-amber-500/25",
  },
  {
    key: "weather",
    imageSrc: weatherSlide,
    ctaHref: "#weather-map",
    ctaClass:
      "bg-gradient-to-r from-sky-600 to-blue-600 text-white hover:from-sky-700 hover:to-blue-700 shadow-lg shadow-sky-500/25",
  },
  {
    key: "shelter",
    imageSrc: shelterSlide,
    ctaHref: "/shelters",
    ctaClass:
      "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-500/25",
  },
  {
    key: "persons",
    imageSrc: personSlide,
    ctaHref: "/incidents/missing-persons",
    ctaClass:
      "bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/25",
  },
];

function slideCopy(t, key) {
  if (key === "home") {
    return {
      title: BRAND_TITLE,
      subtitle: t("slideshow.homeSubtitle"),
      body: t("slideshow.homeBody"),
      ctaLabel: t("slideshow.homeCta"),
    };
  }
  return {
    title: t(`slideshow.${key}Title`),
    subtitle: t(`slideshow.${key}Subtitle`),
    body: t(`slideshow.${key}Body`),
    ctaLabel: t(`slideshow.${key}Cta`),
  };
}

export function HomeSlideshow() {
  const { t, i18n } = useTranslation();
  const [broken, setBroken] = useState({});
  const slides = useMemo(() => SLIDE_DEFS, []);
  const [swiper, setSwiper] = useState(null);
  const isSinhala = i18n.language?.startsWith("si");

  return (
    <section className="relative mb-12 overflow-hidden rounded-3xl bg-slate-900 shadow-2xl">
      <div className="relative h-[320px] sm:h-[420px] lg:h-[520px]">
        <Swiper
          modules={[Autoplay, Pagination, A11y, Mousewheel]}
          onSwiper={setSwiper}
          direction="vertical"
          slidesPerView={1}
          speed={900}
          loop
          mousewheel
          autoplay={{
            delay: 5000,
            disableOnInteraction: false,
          }}
          pagination={{
            clickable: true,
          }}
          className="h-full modern-vertical-swiper"
        >
          {slides.map((slide) => {
            const copy = slideCopy(t, slide.key);
            const titleFont =
              isSinhala && slide.key !== "home"
                ? notoSansSinhala.className
                : savenirsans.className;

            return (
              <SwiperSlide key={slide.key} className="relative h-full">
                {!broken[slide.key] ? (
                  <Image
                    src={slide.imageSrc}
                    alt={copy.title}
                    fill
                    priority={slide.key === "home"}
                    onError={() =>
                      setBroken((p) => ({ ...p, [slide.key]: true }))
                    }
                    className="scale-105 object-cover transition-transform duration-[7000ms]"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-sky-900 via-slate-900 to-black" />
                )}

                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />

                <div className="absolute inset-0 flex items-center">
                  <div className="max-w-2xl px-8">
                    <h1
                      className={`${titleFont} text-4xl font-bold tracking-wide text-white sm:text-6xl`}
                      lang={slide.key === "home" ? "en" : isSinhala ? "si" : undefined}
                    >
                      {copy.title}
                    </h1>

                    <p
                      className={`mt-2 text-sm tracking-wider text-sky-200 ${isSinhala ? "" : "uppercase"}`}
                      lang={slide.key === "home" && !isSinhala ? "en" : isSinhala ? "si" : undefined}
                    >
                      {copy.subtitle}
                    </p>

                    <p className="mt-4 text-slate-200">{copy.body}</p>

                    <div className="mt-6 flex gap-3">
                      <Link
                        href={slide.ctaHref}
                        className={`rounded-full px-6 py-3 text-sm font-semibold transition hover:scale-105 ${slide.ctaClass}`}
                      >
                        {copy.ctaLabel}
                      </Link>

                      <Link
                        href="/alerts"
                        className="rounded-full border border-white/30 px-6 py-3 text-white transition hover:bg-white/10"
                      >
                        {t("slideshow.viewAlerts")}
                      </Link>
                    </div>
                  </div>
                </div>
              </SwiperSlide>
            );
          })}
        </Swiper>

        <button
          type="button"
          onClick={() => swiper?.slidePrev()}
          className="absolute top-6 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/10 p-3 text-white backdrop-blur-md transition hover:bg-white/20"
          aria-label={t("slideshow.prevSlide")}
        >
          <ChevronUp size={22} />
        </button>

        <button
          type="button"
          onClick={() => swiper?.slideNext()}
          className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/10 p-3 text-white backdrop-blur-md transition hover:bg-white/20"
          aria-label={t("slideshow.nextSlide")}
        >
          <ChevronDown size={22} />
        </button>
      </div>

      <style jsx global>{`
        .modern-vertical-swiper .swiper-pagination {
          right: 18px;
        }

        .modern-vertical-swiper .swiper-pagination-bullet {
          background: rgba(255, 255, 255, 0.6);
          width: 6px;
          height: 6px;
        }

        .modern-vertical-swiper .swiper-pagination-bullet-active {
          height: 20px;
          border-radius: 6px;
          background: linear-gradient(to bottom, #38bdf8, #2563eb);
        }
      `}</style>
    </section>
  );
}
