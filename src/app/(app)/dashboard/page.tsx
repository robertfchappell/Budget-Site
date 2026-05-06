import {
  Banknote,
  CalendarClock,
  CircleDollarSign,
  Landmark,
  PiggyBank,
  ReceiptText,
  ShieldCheck,
  Wallet
} from "lucide-react";
import { BudgetTrendChart, CategoryDonut } from "@/components/charts";
import { StatCard } from "@/components/stat-card";
import { getDashboardData } from "@/lib/budget/data";
import { requireUser } from "@/lib/auth";
import { displayShortDate, monthLabel } from "@/lib/dates";
import { dollars } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboardData(user.householdId);
  const savingsTarget = data.savingsGoals.reduce((total, goal) => total + goal.targetAmount, 0);
  const savingsProgress = savingsTarget > 0 ? Math.min(data.savingsBalance / savingsTarget, 1) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-300">
            {monthLabel(data.month.start)}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
            Household Dashboard
          </h1>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm font-semibold text-slate-300">
          <ShieldCheck aria-hidden size={17} />
          {user.name}
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          detail="Manual checking account total"
          icon={Landmark}
          title="Checking Balance"
          value={data.checkingBalance}
        />
        <StatCard
          detail="Savings accounts total"
          icon={PiggyBank}
          title="Savings Balance"
          tone="blue"
          value={data.savingsBalance}
        />
        <StatCard
          detail="Checking plus savings"
          icon={CircleDollarSign}
          title="Total Net Cash"
          tone="slate"
          value={data.netCash}
        />
        <StatCard
          detail="Deposits recorded this month"
          icon={Banknote}
          title="Monthly Income"
          tone="teal"
          value={data.monthlyIncome}
        />
        <StatCard
          detail={`${dollars(data.paidBills)} paid so far`}
          icon={ReceiptText}
          title="Monthly Bills"
          tone="amber"
          value={data.monthlyBills}
        />
        <StatCard
          detail={`${dollars(data.unpaidBillsRemaining)} in unpaid commitments`}
          icon={Wallet}
          title="Safe To Spend"
          tone="teal"
          value={data.projection.remainingSafeToSpend}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Metric label="Recurring Guaranteed Income" value={data.guaranteedIncome} />
        <Metric label="Variable Recurring Income" value={data.variableIncome} />
        <Metric label="One-Time Income" value={data.oneTimeIncome} />
      </section>

      <section className="panel p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-white">Savings Progress</h2>
            <p className="text-sm text-slate-400">
              {dollars(data.savingsBalance)} saved against {dollars(savingsTarget)}
            </p>
          </div>
          <p className="text-2xl font-bold text-teal-200">
            {Math.round(savingsProgress * 100)}%
          </p>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-teal-400"
            style={{ width: `${savingsProgress * 100}%` }}
          />
        </div>
        {data.savingsGoals.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.savingsGoals.slice(0, 4).map((goal) => {
              const progress = goal.targetAmount ? Math.min(goal.currentAmount / goal.targetAmount, 1) : 0;
              return (
                <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3" key={goal.id}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-white">{goal.name}</p>
                    <p className="text-sm font-bold text-teal-200">{Math.round(progress * 100)}%</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {dollars(goal.currentAmount)} / {dollars(goal.targetAmount)}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 rounded-md border border-dashed border-slate-700 p-4 text-sm text-slate-400">
            No savings goals are active yet.
          </p>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <article className="panel p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Spending Trend</h2>
              <p className="text-sm text-slate-400">Income, bills, and expenses</p>
            </div>
            <CircleDollarSign aria-hidden className="text-teal-300" size={20} />
          </div>
          <BudgetTrendChart data={data.trend} />
        </article>

        <article className="panel p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Spending By Category</h2>
              <p className="text-sm text-slate-400">Current month</p>
            </div>
            <ReceiptText aria-hidden className="text-sky-300" size={20} />
          </div>
          <CategoryDonut data={data.spendingByCategory} />
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <article className="panel p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Upcoming Bills</h2>
              <p className="text-sm text-slate-400">Next 14 days</p>
            </div>
            <CalendarClock aria-hidden className="text-amber-300" size={20} />
          </div>
          <div className="space-y-3">
            {data.upcomingBills.length ? (
              data.upcomingBills.map((bill) => (
                <div
                  className="flex items-center justify-between gap-4 rounded-md border border-slate-800 bg-slate-950/40 p-3"
                  key={bill.id}
                >
                  <div>
                    <p className="font-semibold text-white">{bill.billName}</p>
                    <p className="text-sm text-slate-400">
                      {displayShortDate(bill.dueDate)} · {bill.categoryName ?? "Uncategorized"}
                    </p>
                  </div>
                  <p className="font-bold text-amber-200">{dollars(bill.amount)}</p>
                </div>
              ))
            ) : (
              <p className="rounded-md border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                No unpaid bills due in the next two weeks.
              </p>
            )}
          </div>
        </article>

        <article className="panel p-4">
          <h2 className="text-lg font-bold text-white">Projection Engine</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Metric label="Projected End Balance" value={data.projection.projectedEndOfMonthBalance} />
            <Metric label="Projected Savings Balance" value={data.projection.projectedSavingsBalance} />
            <Metric label="Projected Net Cash" value={data.projection.projectedNetCash} />
            <Metric label="Committed Bills" value={data.projection.totalCommittedBills} />
            <Metric label="Projected Savings" value={data.projection.projectedSavings} />
            <Metric label="Monthly Rollover" value={data.projection.monthlyRollover} />
          </div>
          <div className="mt-4 border-t border-slate-800 pt-4">
            <h3 className="text-sm font-bold uppercase text-slate-400">Income Types</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {data.incomeByType.length ? (
                data.incomeByType.map((item) => (
                  <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3" key={item.incomeType}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-white">{item.label}</span>
                      <span className="font-bold text-teal-200">{dollars(item.total)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {dollars(item.guaranteed)} guaranteed · {dollars(item.oneTime)} one-time
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-md border border-dashed border-slate-700 p-3 text-sm text-slate-400">
                  No income has been recorded this month.
                </p>
              )}
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/45 p-3">
      <p className="text-sm font-semibold text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-bold text-white">{dollars(value)}</p>
    </div>
  );
}
