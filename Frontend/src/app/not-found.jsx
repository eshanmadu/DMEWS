"use client";

import Link from "next/link";
import Lottie from "lottie-react";
import animationData from "@/img/404.json";
import localFont from "next/font/local";

const savenirsans = localFont({
  src: "../fonts/SavenirSans.ttf",
  
});

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center">
  <h1 className={`${savenirsans.className} text-7xl font-black tracking-tight text-slate-900`}>404</h1>
  <div className="mt-6 w-full max-w-[300px]">
    <Lottie animationData={animationData} loop={true} autoplay={true} />
  </div>
  <h2 className="mt-6 text-2xl font-bold text-slate-800">Look like you&apos;re lost</h2>
  <p className="mt-2 text-sm text-slate-600">The page you requested could not be found.</p>
  <Link href="/" className="mt-8 inline-flex items-center rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-blue-700">
    Go home
  </Link>
</main>
  );
}