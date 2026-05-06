"use client";

import { AlertTriangle, RefreshCcw } from "lucide-react";

export default function PlanningError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="panel mx-auto mt-10 max-w-2xl p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-md bg-amber-400/12 text-amber-300">
          <AlertTriangle aria-hidden size={22} />
        </span>
        <div>
          <h1 className="text-xl font-bold text-white">Planning data needs attention</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Some planning values could not be loaded safely. Retry to reload projections,
            goals, and monthly snapshots.
          </p>
          <button className="secondary-button mt-4" onClick={reset} type="button">
            <RefreshCcw aria-hidden size={16} />
            Retry planning
          </button>
        </div>
      </div>
    </section>
  );
}
