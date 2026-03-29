"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import homeSlide from "@/img/slides/home.png";
import riskSlide from "@/img/slides/risk.png";
import weatherSlide from "@/img/slides/weather.png";
import shelterSlide from "@/img/slides/shelter.png";

import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination, A11y } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

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
      "bg-red-600/95 text-white hover:bg-red-600 focus-visible:ring-red-400/60",
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
      "bg-amber-400/95 text-slate-900 hover:bg-amber-400 focus-visible:ring-amber-300/70",
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
      "bg-sky-600/95 text-white hover:bg-sky-600 focus-visible:ring-sky-400/70",
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
      "bg-emerald-600/95 text-white hover:bg-emerald-600 focus-visible:ring-emerald-400/70",
  },
  {
    key: "volunteer",
    imageSrc: homeSlide,
    title: "Volunteer for emergencies",
    subtitle: "Community support when it matters most",
    body: "Signed-up users can register to volunteer during disasters. Your request is reviewed by an admin before you are verified.",
    ctaHref: "/volunteer",
    ctaLabel: "Register as volunteer",
    ctaClass:
      "bg-rose-600/95 text-white hover:bg-rose-600 focus-visible:ring-rose-400/70",
  },
];

export function HomeSlideshow() {
  const [broken, setBroken] = useState({});
  const slides = useMemo(() => SLIDES, []);
  const [swiper, setSwiper] = useState(null);

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-sky-200/80 bg-slate-900 shadow-lg">
      <div className="relative h-[280px] sm:h-[340px] lg:h-[380px]">
        <Swiper
          modules={[Autoplay, Navigation, Pagination, A11y]}
          onSwiper={setSwiper}
          slidesPerView={1}
          loop
          speed={650}
          autoplay={{ delay: 5500, disableOnInteraction: false, pauseOnMouseEnter: true }}
          pagination={{ clickable: true }}
          a11y={{ enabled: true }}
          className="h-full"
        >
          {slides.map((slide) => (
            <SwiperSlide key={slide.key} className="relative h-full">
              {!broken[slide.key] ? (
                <Image
                  src={slide.imageSrc}
                  alt={slide.title}
                  fill
                  priority={slide.key === "home"}
                  onError={() => setBroken((p) => ({ ...p, [slide.key]: true }))}
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-sky-900 via-slate-900 to-slate-950" />
              )}

              <div className="absolute inset-0 bg-gradient-to-r from-slate-950/75 via-slate-950/35 to-transparent" />

              <div className="absolute inset-0 flex items-center">
                <div className="w-full max-w-2xl px-6 py-6 sm:px-8">
                  <h1 className="font-oswald text-3xl font-semibold tracking-wide text-white sm:text-4xl">
                    {slide.title}
                  </h1>
                  <h2 className="mt-2 text-sm font-semibold uppercase tracking-wide text-sky-100/90 sm:text-base">
                    {slide.subtitle}
                  </h2>
                  <p className="mt-2 max-w-xl text-sm text-sky-100/85 sm:text-base">
                    {slide.body}
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Link
                      href={slide.ctaHref}
                      className={`inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold shadow-sm outline-none transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${slide.ctaClass}`}
                    >
                      {slide.ctaLabel}
                    </Link>
                    <Link
                      href="/alerts"
                      className="inline-flex items-center rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white shadow-sm outline-none transition hover:bg-white/15 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    >
                      View alerts
                    </Link>
                  </div>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>

        <button
          type="button"
          onClick={() => swiper?.slidePrev()}
          aria-label="Previous slide"
          className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => swiper?.slideNext()}
          aria-label="Next slide"
          className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </section>
  );
}

