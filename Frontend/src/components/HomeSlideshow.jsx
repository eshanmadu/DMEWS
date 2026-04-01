"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

import homeSlide from "@/img/slides/home.png";
import riskSlide from "@/img/slides/risk.png";
import weatherSlide from "@/img/slides/weather.png";
import shelterSlide from "@/img/slides/shelter.png";
import personSlide from "@/img/slides/person.png";

import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, A11y, Mousewheel } from "swiper/modules";

import "swiper/css";
import "swiper/css/pagination";

import localFont from "next/font/local";

const savenirsans = localFont({
  src: "../fonts/SavenirSans.ttf",
  
});

const SLIDES = [
  {
    key: "home",
    imageSrc: homeSlide,
    title: "DisasterWatch",
    subtitle: "Disaster Management & Early Warning System",
    body: "Stay informed. Stay prepared. Monitor live risk across Sri Lanka.",
    ctaHref: "/signup",
    ctaLabel: "Sign up",
    ctaClass:
      "bg-gradient-to-r from-red-600 to-rose-600 text-white hover:from-red-700 hover:to-rose-700 shadow-lg shadow-red-500/25",
  },
  {
    key: "risk",
    imageSrc: riskSlide,
    title: "Risk map",
    subtitle: "District risk levels",
    body: "View live risk by district and see updates when admins change levels.",
    ctaHref: "#risk-map",
    ctaLabel: "Open risk map",
    ctaClass:
      "bg-gradient-to-r from-amber-400 to-orange-400 text-slate-900 hover:from-amber-500 hover:to-orange-500 shadow-lg shadow-amber-500/25",
  },
  {
    key: "weather",
    imageSrc: weatherSlide,
    title: "Weather forecast",
    subtitle: "Stay ahead of conditions",
    body: "Check the forecast and district conditions to plan safely.",
    ctaHref: "#weather-map",
    ctaLabel: "View forecast",
    ctaClass:
      "bg-gradient-to-r from-sky-600 to-blue-600 text-white hover:from-sky-700 hover:to-blue-700 shadow-lg shadow-sky-500/25",
  },
  {
    key: "shelter",
    imageSrc: shelterSlide,
    title: "Shelters",
    subtitle: "Find evacuation shelters",
    body: "See shelters near you when logged in, plus safety instructions.",
    ctaHref: "/shelters",
    ctaLabel: "Find shelters",
    ctaClass:
      "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-500/25",
  },
  {
    key: "persons",
    imageSrc: personSlide,
    title: "Missing & found persons",
    subtitle: "Under incident response",
    body: "Browse reports of missing people and reunions—linked to local incidents when available.",
    ctaHref: "/incidents/missing-persons",
    ctaLabel: "Learn more",
    ctaClass:
      "bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/25",
  },
];

export function HomeSlideshow() {
  const [broken, setBroken] = useState({});
  const slides = useMemo(() => SLIDES, []);
  const [swiper, setSwiper] = useState(null);

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
          {slides.map((slide) => (
            <SwiperSlide key={slide.key} className="relative h-full">

              {/* Background */}
              {!broken[slide.key] ? (
                <Image
                  src={slide.imageSrc}
                  alt={slide.title}
                  fill
                  priority={slide.key === "home"}
                  onError={() =>
                    setBroken((p) => ({ ...p, [slide.key]: true }))
                  }
                  className="object-cover transition-transform duration-[7000ms] scale-105"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-sky-900 via-slate-900 to-black" />
              )}

              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />

              {/* Content */}
              <div className="absolute inset-0 flex items-center">
                <div className="max-w-2xl px-8">
                  <h1 className={`${savenirsans.className} text-4xl sm:text-6xl font-bold tracking-wide text-white`}>
                    {slide.title}
                  </h1>

                  <p className="mt-2 text-sky-200 uppercase tracking-wider text-sm">
                    {slide.subtitle}
                  </p>

                  <p className="mt-4 text-slate-200">
                    {slide.body}
                  </p>

                  <div className="mt-6 flex gap-3">
                    <Link
                      href={slide.ctaHref}
                      className={`rounded-full px-6 py-3 text-sm font-semibold transition hover:scale-105 ${slide.ctaClass}`}
                    >
                      {slide.ctaLabel}
                    </Link>

                    <Link
                      href="/alerts"
                      className="rounded-full border border-white/30 px-6 py-3 text-white hover:bg-white/10 transition"
                    >
                      View alerts
                    </Link>
                  </div>
                </div>
              </div>

            </SwiperSlide>
          ))}
        </Swiper>

        {/* Up button */}
        <button
          onClick={() => swiper?.slidePrev()}
          className="absolute top-6 left-1/2 -translate-x-1/2 z-10 rounded-full bg-white/10 p-3 text-white backdrop-blur-md hover:bg-white/20 transition"
        >
          <ChevronUp size={22} />
        </button>

        {/* Down button */}
        <button
          onClick={() => swiper?.slideNext()}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 rounded-full bg-white/10 p-3 text-white backdrop-blur-md hover:bg-white/20 transition"
        >
          <ChevronDown size={22} />
        </button>

      </div>

      <style jsx global>{`
        .modern-vertical-swiper .swiper-pagination {
          right: 18px;
        }

        .modern-vertical-swiper .swiper-pagination-bullet {
          background: rgba(255,255,255,0.6);
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