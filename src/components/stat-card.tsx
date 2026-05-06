import type { LucideIcon } from "lucide-react";
import { dollars } from "@/lib/money";

export function StatCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = "teal"
}: {
  title: string;
  value: number;
  detail?: string;
  icon: LucideIcon;
  tone?: "teal" | "blue" | "amber" | "rose" | "slate";
}) {
  const tones = {
    teal: "bg-teal-400/12 text-teal-300",
    blue: "bg-sky-400/12 text-sky-300",
    amber: "bg-amber-400/12 text-amber-300",
    rose: "bg-rose-400/12 text-rose-300",
    slate: "bg-slate-400/12 text-slate-300"
  };

  return (
    <article className="panel min-w-0 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-400">{title}</p>
          <p className="mt-2 break-words text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {dollars(value)}
          </p>
        </div>
        <span className={`grid size-10 shrink-0 place-items-center rounded-md ${tones[tone]}`}>
          <Icon aria-hidden size={20} />
        </span>
      </div>
      {detail ? <p className="mt-3 text-sm text-slate-400">{detail}</p> : null}
    </article>
  );
}
