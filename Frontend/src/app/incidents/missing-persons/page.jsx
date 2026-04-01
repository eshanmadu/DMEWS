import Link from "next/link";
import { UserSearch } from "lucide-react";

export const metadata = {
  title: "Missing & found persons | DMEWS",
  description:
    "Report and find missing persons in connection with incidents—coming soon.",
};

export default function MissingPersonsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href="/incidents"
          className="text-sm font-medium text-sky-600 hover:text-sky-700"
        >
          ← Back to incidents
        </Link>
      </div>

      <div className="space-y-6">
        <div>
          <h1 className="font-oswald text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Missing & found persons
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
            A dedicated space to coordinate missing-person notices and found-person
            updates alongside incident reporting.
          </p>
        </div>

        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center">
          <UserSearch className="mb-4 h-12 w-12 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-700">Coming soon</h2>
          <p className="mt-2 max-w-md text-sm text-slate-500">
            This feature is under development. You will be able to view and submit
            missing and found person information here.
          </p>
        </div>
      </div>
    </div>
  );
}
