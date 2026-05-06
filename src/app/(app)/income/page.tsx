import Link from "next/link";
import { Banknote, Trash2 } from "lucide-react";
import { SimpleBarChart } from "@/components/charts";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { IncomeEntryForm } from "@/components/income-entry-form";
import { deleteIncomeEntry } from "@/app/(app)/income/actions";
import { getIncomePageData } from "@/lib/budget/data";
import { requireUser } from "@/lib/auth";
import { incomeTypeOptions } from "@/lib/budget/income-types";
import { displayDate } from "@/lib/dates";
import { incomeFrequencyDisplayLabel } from "@/lib/display-labels";
import { dollars } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function IncomePage({
  searchParams
}: {
  searchParams?: Promise<{ type?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const data = await getIncomePageData(user.householdId, params?.type);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-300">
          Household cashflow
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Income</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Add the money coming into the household without turning every deposit into an accounting chore.
        </p>
      </div>

      <section className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <IncomeEntryForm accounts={data.accounts} />

        <article className="panel p-4">
          <h2 className="text-lg font-bold text-white">Income By Type</h2>
          <p className="text-sm text-slate-400">{data.month.label}</p>
          {data.totals.length ? (
            <SimpleBarChart data={data.totals} />
          ) : (
            <p className="mt-4 rounded-md border border-dashed border-slate-700 p-4 text-sm text-slate-400">
              No income has been recorded for this month yet.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link className="secondary-button" href="/income">
              All
            </Link>
            {incomeTypeOptions.map((option) => (
              <Link
                className={`secondary-button ${data.selectedIncomeType === option.value ? "border-teal-400/60 text-teal-100" : ""}`}
                href={`/income?type=${option.value}`}
                key={option.value}
              >
                {option.label}
              </Link>
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {data.byType.map((item) => (
              <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3" key={item.incomeType}>
                <div className="flex justify-between gap-3">
                  <span className="text-sm font-semibold text-white">{item.label}</span>
                  <span className="font-bold text-teal-200">{dollars(item.total)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {dollars(item.recurring)} recurring - {dollars(item.oneTime)} one-time
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <article className="panel overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 p-4">
          <div>
            <h2 className="text-lg font-bold text-white">Recent Income</h2>
            <p className="text-sm text-slate-400">A simple household view of recent deposits.</p>
          </div>
          <Banknote aria-hidden className="text-teal-300" size={20} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-950/60 text-xs uppercase text-slate-500">
              <tr>
                <th className="table-cell">Date</th>
                <th className="table-cell">Type</th>
                <th className="table-cell">Details</th>
                <th className="table-cell">Repeat</th>
                <th className="table-cell">Account</th>
                <th className="table-cell">Amount</th>
                <th className="table-cell">By</th>
                <th className="table-cell">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="table-cell text-slate-300">{displayDate(entry.paycheckDate)}</td>
                  <td className="table-cell">
                    <span className="badge">{entry.incomeTypeLabel}</span>
                  </td>
                  <td className="table-cell">
                    <p className="font-semibold text-white">{incomeDetail(entry)}</p>
                    {entry.term ? <p className="mt-1 text-xs text-slate-400">{entry.term}</p> : null}
                  </td>
                  <td className="table-cell text-slate-300">
                    {incomeFrequencyDisplayLabel(entry.incomeFrequency)}
                  </td>
                  <td className="table-cell text-slate-300">{entry.accountName ?? "Not linked"}</td>
                  <td className="table-cell font-bold text-teal-200">{dollars(entry.depositAmount)}</td>
                  <td className="table-cell text-slate-300">{entry.userName}</td>
                  <td className="table-cell">
                    <details>
                      <summary className="secondary-button cursor-pointer">Edit</summary>
                      <div className="mt-3 w-[min(760px,calc(100vw-3rem))] rounded-md border border-slate-800 bg-slate-950 p-3">
                        <IncomeEntryForm accounts={data.accounts} compact entry={entry} />
                        <form action={deleteIncomeEntry} className="mt-2">
                          <input name="incomeId" type="hidden" value={entry.id} />
                          <ConfirmSubmitButton className="secondary-button border-rose-400/30 text-rose-100" message={`Delete ${entry.incomeTypeLabel}?`}>
                            <Trash2 aria-hidden size={16} />
                            Delete
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
              {!data.entries.length ? (
                <tr>
                  <td className="table-cell text-slate-400" colSpan={8}>
                    No income entries match this filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}

function incomeDetail(entry: { incomeType: string; employer: string }) {
  if (entry.incomeType === "va_disability") {
    return "VA Disability";
  }

  if (entry.incomeType === "bonus") {
    return "Bonus";
  }

  if (entry.incomeType === "misc") {
    return entry.employer.toLowerCase() === "miscellaneous income" ? "Miscellaneous Income" : entry.employer;
  }

  return entry.employer;
}
