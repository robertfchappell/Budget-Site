"use client";

import { AlertTriangle, RefreshCcw } from "lucide-react";

export default function DashboardError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="panel mx-auto mt-10 max-w-2xl p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-md bg-amber-400/12 text-amber-300">
          <AlertTriangle aria-hidden size={22} />
        </span>
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard data needs attention</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            One of the dashboard values could not be read safely. The rest of the app is still
            available, and retrying will reload the household budget data.
          </p>
          <button className="secondary-button mt-4" onClick={reset} type="button">
            <RefreshCcw aria-hidden size={16} />
            Retry dashboard
          </button>
        </div>
      </div>
    </section>
  );
}
