import {
  ArrowDownCircle,
  Banknote,
  CalendarClock,
  CircleDollarSign,
  Landmark,
  PiggyBank,
  ReceiptText,
  ShieldCheck,
  WalletCards
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
  const remainingBills = Math.max(data.monthlyBills - data.paidBills, 0);
  const nextBill = data.upcomingBills[0];

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
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            A calm view of what exists, where it sits, what is coming in, and what is due soon.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm font-semibold text-slate-300">
          <ShieldCheck aria-hidden size={17} />
          {user.name}
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
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
          detail="Posted deposits this month"
          icon={Banknote}
          title="Monthly Income"
          tone="teal"
          value={data.monthlyIncome}
        />
        <StatCard
          detail="Expenses recorded this month"
          icon={WalletCards}
          title="Monthly Expenses"
          tone="rose"
          value={data.monthlyExpenses}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="panel p-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold text-white">Savings Progress</h2>
              <p className="text-sm text-slate-400">
                {savingsTarget > 0
                  ? `${dollars(data.savingsBalance)} saved toward ${dollars(savingsTarget)}`
                  : `${dollars(data.savingsBalance)} currently in savings`}
              </p>
            </div>
            {savingsTarget > 0 ? (
              <p className="text-2xl font-bold text-teal-200">
                {Math.round(savingsProgress * 100)}%
              </p>
            ) : null}
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-teal-400 transition-[width] duration-300"
              style={{ width: `${savingsTarget > 0 ? savingsProgress * 100 : 100}%` }}
            />
          </div>
          {data.savingsGoals.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {data.savingsGoals.slice(0, 4).map((goal) => {
                const progress = goal.targetAmount ? Math.min(goal.currentAmount / goal.targetAmount, 1) : 0;
                return (
                  <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3" key={goal.id}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-white">{goal.name}</p>
                      <p className="text-sm font-bold text-teal-200">{goal.targetAmount ? `${Math.round(progress * 100)}%` : "Tracking"}</p>
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
        </article>

        <article className="panel p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Account Allocation</h2>
              <p className="text-sm text-slate-400">Where household cash is sitting right now</p>
            </div>
            <WalletCards aria-hidden className="text-sky-300" size={20} />
          </div>
          <div className="space-y-3">
            {data.accounts.filter((account) => account.type === "checking" || account.type === "savings").length ? (
              data.accounts
                .filter((account) => account.type === "checking" || account.type === "savings")
                .map((account) => {
                const share = data.netCash > 0 ? Math.max(0, account.currentBalance / data.netCash) : 0;
                return (
                  <div key={account.id}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-semibold text-white">{account.name}</span>
                      <span className="shrink-0 font-bold tabular-nums text-slate-200">{dollars(account.currentBalance)}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-sky-400" style={{ width: `${Math.min(share * 100, 100)}%` }} />
                    </div>
                  </div>
                );
                })
            ) : (
              <p className="rounded-md border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                Add checking or savings accounts in Settings to see allocation.
              </p>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <article className="panel p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Cashflow Summary</h2>
              <p className="text-sm text-slate-400">Scheduled income, bills, and recorded expenses</p>
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

      <section className="grid gap-4 xl:grid-cols-3">
        <article className="panel p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Upcoming Deposits</h2>
              <p className="text-sm text-slate-400">Next 14 days</p>
            </div>
            <ArrowDownCircle aria-hidden className="text-teal-300" size={20} />
          </div>
          <div className="space-y-3">
            {data.upcomingDeposits.length ? (
              data.upcomingDeposits.map((deposit) => (
                <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3" key={deposit.id}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-white">{deposit.incomeTypeLabel}</p>
                      <p className="break-words text-sm text-slate-400">
                        {deposit.employer} - {displayShortDate(deposit.paycheckDate)} - {deposit.accountName ?? "not linked"}
                      </p>
                    </div>
                    <p className="shrink-0 font-bold text-teal-200">{dollars(deposit.depositAmount)}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-md border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                No deposits are scheduled in the next two weeks.
              </p>
            )}
          </div>
        </article>

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
              data.upcomingBills.slice(0, 5).map((bill) => (
                <div
                  className="flex items-center justify-between gap-4 rounded-md border border-slate-800 bg-slate-950/40 p-3"
                  key={bill.id}
                >
                  <div>
                    <p className="font-semibold text-white">{bill.billName}</p>
                    <p className="text-sm text-slate-400">
                      {displayShortDate(bill.dueDate)} - {bill.categoryName ?? "Uncategorized"}
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
          <h2 className="text-lg font-bold text-white">Bills Paid vs Remaining</h2>
          <p className="mt-1 text-sm text-slate-400">
            {nextBill ? `Next bill: ${nextBill.billName} on ${displayShortDate(nextBill.dueDate)}` : "No upcoming bill due soon."}
          </p>
          <div className="mt-4 grid gap-3">
            <Metric label="Paid" value={data.paidBills} />
            <Metric label="Remaining" value={remainingBills} />
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="panel p-4">
          <h2 className="text-lg font-bold text-white">Monthly Outlook</h2>
          <p className="mt-1 text-sm text-slate-400">
            Actual balances come from accounts. Forecast values add pending deposits and subtract remaining bills.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Metric label="Forecast Checking" value={data.projection.projectedEndOfMonthBalance} />
            <Metric label="Forecast Savings" value={data.projection.projectedSavingsBalance} />
            <Metric label="Forecast Net Cash" value={data.projection.projectedNetCash} />
            <Metric label="Posted Income" value={data.projection.postedMonthlyIncome} />
            <Metric label="Scheduled Income" value={data.projection.scheduledMonthlyIncome} />
            <Metric label="Pending Deposits" value={data.projection.pendingIncome} />
            <Metric label="Recurring Bills" value={data.projection.totalCommittedBills} />
            <Metric label="Recorded Expenses" value={data.monthlyExpenses} />
            <Metric label="Scheduled Expenses" value={data.projection.scheduledExpensesRemaining} />
            <Metric label="Planned Savings" value={data.projection.projectedSavings} />
            <Metric label="Month Trajectory" value={data.projection.monthlyRollover} />
          </div>
          <div className="mt-4 border-t border-slate-800 pt-4">
            <h3 className="text-sm font-bold uppercase text-slate-400">Recurring Income Breakdown</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {data.incomeByType.length ? (
                data.incomeByType.map((item) => (
                  <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3" key={item.incomeType}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-white">{item.label}</span>
                      <span className="font-bold text-teal-200">{dollars(item.total)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {dollars(item.posted)} posted - {dollars(item.pending)} pending
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

        <article className="panel p-4">
          <h2 className="text-lg font-bold text-white">Recent Transactions</h2>
          <div className="mt-4 space-y-3">
            {data.recentActivity.length ? (
              data.recentActivity.map((activity) => (
                <div className="flex items-center justify-between gap-4 rounded-md border border-slate-800 bg-slate-950/40 p-3" key={activity.id}>
                  <div>
                    <p className="font-semibold text-white">{activity.description}</p>
                    <p className="text-sm text-slate-400">
                      {displayShortDate(activity.activityDate)} - {activity.accountName}
                    </p>
                  </div>
                  <p className={`font-bold ${activity.amount >= 0 ? "text-teal-200" : "text-rose-200"}`}>
                    {dollars(activity.amount)}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-md border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                Account activity will appear here after deposits, transfers, bills, or expenses update an account.
              </p>
            )}
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
