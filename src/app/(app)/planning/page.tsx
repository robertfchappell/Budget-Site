import { Archive, PiggyBank, Plus, Save, Trash2 } from "lucide-react";
import {
  createSavingsGoal,
  deleteSavingsGoal,
  saveMonthlySnapshot,
  updateSavingsGoal
} from "@/app/(app)/planning/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { StatCard } from "@/components/stat-card";
import { getPlanningPageData } from "@/lib/budget/data";
import { requireUser } from "@/lib/auth";
import { displayDate, monthLabel, todayIso } from "@/lib/dates";
import { dollars, percentage } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function PlanningPage() {
  const user = await requireUser();
  const data = await getPlanningPageData(user.householdId);
  const emergencyFund = data.goals.find((goal) => goal.name.toLowerCase().includes("emergency"));

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-300">
            Projection
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Planning</h1>
        </div>
        <form action={saveMonthlySnapshot}>
          <button className="secondary-button" type="submit">
            <Save aria-hidden size={16} />
            Save snapshot
          </button>
        </form>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Archive}
          title="Projected End Balance"
          value={data.dashboard.projection.projectedEndOfMonthBalance}
        />
        <StatCard
          icon={PiggyBank}
          title="Projected Savings Balance"
          tone="blue"
          value={data.dashboard.projection.projectedSavingsBalance}
        />
        <StatCard
          icon={Archive}
          title="Committed Bills"
          tone="amber"
          value={data.dashboard.projection.totalCommittedBills}
        />
        <StatCard
          icon={PiggyBank}
          title="Monthly Rollover"
          tone={data.dashboard.projection.monthlyRollover >= 0 ? "teal" : "rose"}
          value={data.dashboard.projection.monthlyRollover}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Metric label="Guaranteed Income" value={data.dashboard.projection.guaranteedIncome} />
        <Metric label="Variable Income" value={data.dashboard.projection.variableIncome} />
        <Metric label="One-Time Income" value={data.dashboard.projection.oneTimeIncome} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <form action={createSavingsGoal} className="panel p-4">
          <div className="mb-4 flex items-center gap-2">
            <Plus aria-hidden className="text-teal-300" size={19} />
            <h2 className="text-lg font-bold text-white">Savings Goal</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" name="name" required />
            <Field label="Target amount" name="targetAmount" required step="0.01" type="number" />
            <Field label="Current amount" name="currentAmount" step="0.01" type="number" />
            <Field label="Monthly target" name="monthlyTarget" step="0.01" type="number" />
            <Field defaultValue={todayIso()} label="Target date" name="targetDate" type="date" />
            <div>
              <label className="label" htmlFor="accountId">
                Linked account
              </label>
              <select className="field" id="accountId" name="accountId">
                <option value="">Manual tracking</option>
                {data.accounts
                  .filter((account) => account.type === "savings" || account.type === "cash")
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <button className="primary-button mt-4" type="submit">
            <PiggyBank aria-hidden size={17} />
            Save goal
          </button>
        </form>

        <article className="panel p-4">
          <h2 className="text-lg font-bold text-white">Goals</h2>
          <div className="mt-4 space-y-3">
            {data.goals.length ? data.goals.map((goal) => {
              const progress = goal.targetAmount ? goal.currentAmount / goal.targetAmount : 0;
              const linkedAccount = data.accounts.find((account) => account.id === goal.accountId);
              return (
                <details className="rounded-md border border-slate-800 bg-slate-950/40 p-3" key={goal.id}>
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-white">{goal.name}</p>
                        <p className="mt-1 text-sm text-slate-400">
                          {linkedAccount?.name ?? "Manual tracking"}
                        </p>
                      </div>
                      <p className="font-bold text-teal-200">
                        {dollars(goal.currentAmount)} / {dollars(goal.targetAmount)}
                      </p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-teal-400"
                        style={{ width: `${Math.min(progress * 100, 100)}%` }}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm text-slate-400">
                      <span>{percentage(Math.min(progress, 1))}</span>
                      <span>{dollars(goal.monthlyTarget)} monthly</span>
                      <span>{goal.targetDate ? displayDate(goal.targetDate) : "No date"}</span>
                    </div>
                  </summary>

                  <form action={updateSavingsGoal} className="mt-4 grid gap-3 sm:grid-cols-2">
                    <input name="goalId" type="hidden" value={goal.id} />
                    <Field defaultValue={goal.name} label="Name" name="name" required />
                    <Field defaultValue={goal.targetAmount} label="Target amount" name="targetAmount" required step="0.01" type="number" />
                    <Field defaultValue={goal.currentAmount} label="Current amount" name="currentAmount" step="0.01" type="number" />
                    <Field defaultValue={goal.monthlyTarget} label="Monthly target" name="monthlyTarget" step="0.01" type="number" />
                    <Field defaultValue={goal.targetDate ?? ""} label="Target date" name="targetDate" type="date" />
                    <div>
                      <label className="label" htmlFor={`goal-account-${goal.id}`}>
                        Linked account
                      </label>
                      <select
                        className="field"
                        defaultValue={goal.accountId ?? ""}
                        id={`goal-account-${goal.id}`}
                        name="accountId"
                      >
                        <option value="">Manual tracking</option>
                        {data.accounts
                          .filter((account) => account.type === "savings" || account.type === "cash")
                          .map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <button className="secondary-button" type="submit">
                      <Save aria-hidden size={16} />
                      Save edits
                    </button>
                  </form>
                  <form action={deleteSavingsGoal} className="mt-2">
                    <input name="goalId" type="hidden" value={goal.id} />
                    <ConfirmSubmitButton className="secondary-button border-rose-400/30 text-rose-100" message={`Delete ${goal.name}?`}>
                      <Trash2 aria-hidden size={16} />
                      Delete
                    </ConfirmSubmitButton>
                  </form>
                </details>
              );
            }) : (
              <p className="rounded-md border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                No savings goals have been created yet.
              </p>
            )}
          </div>
        </article>
      </section>

      {emergencyFund ? (
        <article className="panel p-4">
          <h2 className="text-lg font-bold text-white">Emergency Fund</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Metric label="Saved" value={emergencyFund.currentAmount} />
            <Metric label="Target" value={emergencyFund.targetAmount} />
            <Metric label="Monthly Target" value={emergencyFund.monthlyTarget} />
          </div>
        </article>
      ) : null}

      <article className="panel overflow-hidden">
        <div className="border-b border-slate-800 p-4">
          <h2 className="text-lg font-bold text-white">Monthly Snapshots</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-slate-950/60 text-xs uppercase text-slate-500">
              <tr>
                <th className="table-cell">Month</th>
                <th className="table-cell">Checking</th>
                <th className="table-cell">Income</th>
                <th className="table-cell">Bills</th>
                <th className="table-cell">Expenses</th>
                <th className="table-cell">Safe</th>
                <th className="table-cell">Savings</th>
                <th className="table-cell">Rollover</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.snapshots.length ? data.snapshots.map((snapshot) => (
                <tr key={snapshot.month}>
                  <td className="table-cell font-semibold text-white">{monthLabel(snapshot.month)}</td>
                  <td className="table-cell text-slate-300">{dollars(snapshot.checking_balance)}</td>
                  <td className="table-cell text-slate-300">{dollars(snapshot.income_total)}</td>
                  <td className="table-cell text-slate-300">{dollars(snapshot.bill_total)}</td>
                  <td className="table-cell text-slate-300">{dollars(snapshot.expense_total)}</td>
                  <td className="table-cell font-bold text-teal-200">{dollars(snapshot.safe_to_spend)}</td>
                  <td className="table-cell text-slate-300">{dollars(snapshot.savings_total)}</td>
                  <td className="table-cell text-slate-300">{dollars(snapshot.rollover_amount)}</td>
                </tr>
              )) : (
                <tr>
                  <td className="table-cell text-slate-400" colSpan={8}>
                    No monthly snapshots have been saved yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
      <p className="text-sm font-semibold text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{dollars(value)}</p>
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
