import Link from "next/link";

export default function MapPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100">Map View</h1>
        <p className="mt-1 text-slate-400">
          Geographic view of alerts, incidents, and resources
        </p>
      </div>

      <div className="card flex min-h-[480px] flex-col items-center justify-center gap-6 p-12">
        <div className="rounded-full bg-slate-700/50 p-6">
          <svg
            className="h-16 w-16 text-slate-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-200">
            Map integration ready
          </h2>
          <p className="mt-2 max-w-md text-slate-400">
            Connect a mapping provider (e.g. Leaflet, Mapbox, or Google Maps) to
            display alerts and incidents by location. Use the Backend API{" "}
            <code className="rounded bg-slate-700 px-1.5 py-0.5 text-teal-400">
              {apiUrl}/alerts
            </code>{" "}
            and{" "}
            <code className="rounded bg-slate-700 px-1.5 py-0.5 text-teal-400">
              {apiUrl}/incidents
            </code>{" "}
            for coordinates (lat, lng).
          </p>
          <p className="mt-3 text-sm text-slate-500">
            See{" "}
            <Link
              href="/"
              className="text-teal-400 hover:text-teal-300 hover:underline"
            >
              Dashboard
            </Link>{" "}
            for the live weather map of Sri Lanka.
          </p>
        </div>
      </div>
    </div>
  );
}

