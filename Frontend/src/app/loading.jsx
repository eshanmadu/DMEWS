import Loader from "@/components/Loader";

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900">
      <Loader size="lg" />
      <span className="text-sm font-medium text-slate-100">
        Loading DMEWS dashboard…
      </span>
    </div>
  );
}

