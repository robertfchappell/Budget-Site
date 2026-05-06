import Link from "next/link";
import { Banknote, Plus, Save, Trash2 } from "lucide-react";
import { SimpleBarChart } from "@/components/charts";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { createIncomeEntry, deleteIncomeEntry, updateIncomeEntry } from "@/app/(app)/income/actions";
import { getIncomePageData } from "@/lib/budget/data";
import { requireUser } from "@/lib/auth";
import { incomeTypeOptions } from "@/lib/budget/income-types";
import { displayDate, todayIso } from "@/lib/dates";
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
          Paychecks
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Income</h1>
      </div>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <form action={createIncomeEntry} className="panel p-4">
          <div className="mb-4 flex items-center gap-2">
            <Plus aria-hidden className="text-teal-300" size={19} />
            <h2 className="text-lg font-bold text-white">Paycheck Entry</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Source" name="employer" required />
            <div>
              <label className="label" htmlFor="incomeType">
                Income type
              </label>
              <select className="field" id="incomeType" name="incomeType" defaultValue="regular_paycheck">
                {incomeTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="recurrence">
                Recurrence
              </label>
              <select className="field" id="recurrence" name="recurrence" defaultValue="recurring">
                <option value="recurring">Recurring</option>
                <option value="one_time">One-time</option>
              </select>
            </div>
            <Field defaultValue={todayIso()} label="Paycheck date" name="paycheckDate" required type="date" />
            <Field label="Base pay" name="basePay" step="0.01" type="number" />
            <Field label="Overtime pay" name="overtimePay" step="0.01" type="number" />
            <Field label="Bonus pay" name="bonusPay" step="0.01" type="number" />
            <Field label="VA income" name="vaIncome" step="0.01" type="number" />
            <Field label="Taxes withheld" name="taxesWithheld" step="0.01" type="number" />
            <Field label="Deposit amount" name="depositAmount" required step="0.01" type="number" />
            <div>
              <label className="label" htmlFor="categoryId">
                Category
              </label>
              <select className="field" id="categoryId" name="categoryId">
                <option value="">Match income type</option>
                {data.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="accountId">
                Deposit account
              </label>
              <select className="field" id="accountId" name="accountId">
                <option value="">No account update</option>
                {data.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="inline-flex items-center gap-2 pt-6 text-sm font-semibold text-slate-300">
                <input className="size-4 accent-teal-500" name="guaranteed" type="checkbox" />
                Guaranteed
              </label>
            </div>
            <div>
              <label className="label" htmlFor="notes">
                Notes
              </label>
              <input className="field" id="notes" name="notes" />
            </div>
          </div>
          <button className="primary-button mt-4" type="submit">
            <Banknote aria-hidden size={17} />
            Add income
          </button>
        </form>

        <article className="panel p-4">
          <h2 className="text-lg font-bold text-white">Income By Type</h2>
          <p className="text-sm text-slate-400">{data.month.label}</p>
          <SimpleBarChart data={data.totals} />
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
                  {dollars(item.recurring)} recurring · {dollars(item.oneTime)} one-time
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <article className="panel overflow-hidden">
        <div className="border-b border-slate-800 p-4">
          <h2 className="text-lg font-bold text-white">Recent Income</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-slate-950/60 text-xs uppercase text-slate-500">
              <tr>
                <th className="table-cell">Date</th>
                <th className="table-cell">Source</th>
                <th className="table-cell">Type</th>
                <th className="table-cell">Base</th>
                <th className="table-cell">Overtime</th>
                <th className="table-cell">Bonus</th>
                <th className="table-cell">VA</th>
                <th className="table-cell">Taxes</th>
                <th className="table-cell">Deposit</th>
                <th className="table-cell">By</th>
                <th className="table-cell">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="table-cell text-slate-300">{displayDate(entry.paycheckDate)}</td>
                  <td className="table-cell font-semibold text-white">{entry.employer}</td>
                  <td className="table-cell">
                    <span className="badge">{entry.incomeTypeLabel}</span>
                  </td>
                  <td className="table-cell text-slate-300">{dollars(entry.basePay)}</td>
                  <td className="table-cell text-slate-300">{dollars(entry.overtimePay)}</td>
                  <td className="table-cell text-slate-300">{dollars(entry.bonusPay)}</td>
                  <td className="table-cell text-slate-300">{dollars(entry.vaIncome)}</td>
                  <td className="table-cell text-rose-200">{dollars(entry.taxesWithheld)}</td>
                  <td className="table-cell font-bold text-teal-200">{dollars(entry.depositAmount)}</td>
                  <td className="table-cell text-slate-300">{entry.userName}</td>
                  <td className="table-cell">
                    <details>
                      <summary className="secondary-button cursor-pointer">Edit</summary>
                      <div className="mt-3 w-[min(760px,calc(100vw-3rem))] rounded-md border border-slate-800 bg-slate-950 p-3">
                        <form action={updateIncomeEntry} className="grid gap-3 sm:grid-cols-2">
                          <input name="incomeId" type="hidden" value={entry.id} />
                          <Field defaultValue={entry.employer} label="Source" name="employer" required />
                          <select className="field" defaultValue={entry.incomeType} name="incomeType">
                            {incomeTypeOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <select className="field" defaultValue={entry.recurrence} name="recurrence">
                            <option value="recurring">Recurring</option>
                            <option value="one_time">One-time</option>
                          </select>
                          <Field defaultValue={entry.paycheckDate} label="Date" name="paycheckDate" required type="date" />
                          <Field defaultValue={entry.basePay} label="Base pay" name="basePay" step="0.01" type="number" />
                          <Field defaultValue={entry.overtimePay} label="Overtime pay" name="overtimePay" step="0.01" type="number" />
                          <Field defaultValue={entry.bonusPay} label="Bonus pay" name="bonusPay" step="0.01" type="number" />
                          <Field defaultValue={entry.vaIncome} label="VA income" name="vaIncome" step="0.01" type="number" />
                          <Field defaultValue={entry.taxesWithheld} label="Taxes withheld" name="taxesWithheld" step="0.01" type="number" />
                          <Field defaultValue={entry.depositAmount} label="Deposit amount" name="depositAmount" required step="0.01" type="number" />
                          <select className="field" defaultValue={entry.categoryId ?? ""} name="categoryId">
                            <option value="">Match income type</option>
                            {data.categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                          <select className="field" defaultValue={entry.accountId ?? ""} name="accountId">
                            <option value="">No account update</option>
                            {data.accounts.map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.name}
                              </option>
                            ))}
                          </select>
                          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300">
                            <input className="size-4 accent-teal-500" defaultChecked={entry.guaranteed} name="guaranteed" type="checkbox" />
                            Guaranteed
                          </label>
                          <Field defaultValue={entry.notes ?? ""} label="Notes" name="notes" />
                          <button className="secondary-button" type="submit">
                            <Save aria-hidden size={16} />
                            Save
                          </button>
                        </form>
                        <form action={deleteIncomeEntry} className="mt-2">
                          <input name="incomeId" type="hidden" value={entry.id} />
                          <ConfirmSubmitButton className="secondary-button border-rose-400/30 text-rose-100" message={`Delete income from ${entry.employer}?`}>
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
                  <td className="table-cell text-slate-400" colSpan={11}>
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

function Field({
  label,
  name,
  type = "text",
  ...props
}: {
  label: string;
  name: string;
  type?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input className="field" id={name} name={name} type={type} {...props} />
    </div>
  );
}
