import { ArrowDownUp, Bell, Download, History, PiggyBank, Save, Wallet } from "lucide-react";
import Link from "next/link";
import { transferFunds, updateAccountBalance } from "@/app/(app)/settings/actions";
import { HouseholdInvites } from "@/components/household-invites";
import { getSettingsPageData } from "@/lib/budget/data";
import { requireUser } from "@/lib/auth";
import { displayDate, todayIso } from "@/lib/dates";
import { dollars } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const data = await getSettingsPageData(user.householdId);
  const defaultFromAccount = data.accounts.find((account) => account.type === "checking") ?? data.accounts[0];
  const defaultToAccount =
    data.accounts.find((account) => account.type === "savings" && account.id !== defaultFromAccount?.id) ??
    data.accounts.find((account) => account.id !== defaultFromAccount?.id);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
          Household
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Settings</h1>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <Metric icon={Wallet} label="Checking Balance" value={data.financial.checkingBalance} />
        <Metric icon={PiggyBank} label="Savings Balance" value={data.financial.savingsBalance} />
        <Metric icon={ArrowDownUp} label="Total Net Cash" value={data.financial.netCash} />
      </section>

      <HouseholdInvites currentUserId={user.id} invites={data.invites} members={data.members} />

      <section className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <article className="panel p-4">
          <h2 className="text-lg font-bold text-white">Accounts</h2>
          <div className="mt-4 space-y-3">
            {data.accounts.map((account) => (
              <form
                action={updateAccountBalance}
                className="grid gap-3 rounded-md border border-slate-800 bg-slate-950/40 p-3 sm:grid-cols-[1fr_180px_auto]"
                key={account.id}
              >
                <input name="accountId" type="hidden" value={account.id} />
                <div>
                  <p className="font-semibold text-white">{account.name}</p>
                  <p className="text-sm capitalize text-slate-400">
                    {account.type} · {account.institution ?? "Manual"}
                  </p>
                </div>
                <input
                  className="field"
                  defaultValue={account.currentBalance}
                  name="currentBalance"
                  step="0.01"
                  type="number"
                />
                <button aria-label={`Save ${account.name}`} className="secondary-button" type="submit">
                  <Save aria-hidden size={16} />
                  Save
                </button>
              </form>
            ))}
          </div>
        </article>

        <div className="grid gap-4">
          <article className="panel p-4">
            <div className="mb-4 flex items-center gap-2">
              <ArrowDownUp aria-hidden className="text-teal-300" size={18} />
              <h2 className="text-lg font-bold text-white">Transfer Funds</h2>
            </div>
            <form action={transferFunds} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div>
                <label className="label" htmlFor="fromAccountId">
                  From
                </label>
                <select className="field" defaultValue={defaultFromAccount?.id ?? ""} id="fromAccountId" name="fromAccountId" required>
                  {data.accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="toAccountId">
                  To
                </label>
                <select className="field" defaultValue={defaultToAccount?.id ?? ""} id="toAccountId" name="toAccountId" required>
                  {data.accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>
              <Field label="Amount" name="amount" required step="0.01" type="number" />
              <Field defaultValue={todayIso()} label="Date" name="transferDate" required type="date" />
              <div className="sm:col-span-2 xl:col-span-1">
                <label className="label" htmlFor="notes">
                  Notes
                </label>
                <input className="field" id="notes" name="notes" />
              </div>
              <button className="primary-button sm:col-span-2 xl:col-span-1" type="submit">
                <ArrowDownUp aria-hidden size={16} />
                Transfer
              </button>
            </form>
          </article>

          <article className="panel p-4">
            <div className="mb-4 flex items-center gap-2">
              <Download aria-hidden className="text-teal-300" size={18} />
              <h2 className="text-lg font-bold text-white">CSV Exports</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <Link className="secondary-button" href="/api/export/expenses" prefetch={false}>
                <Download aria-hidden size={16} />
                Expenses
              </Link>
              <Link className="secondary-button" href="/api/export/income" prefetch={false}>
                <Download aria-hidden size={16} />
                Income
              </Link>
              <Link className="secondary-button" href="/api/export/bills" prefetch={false}>
                <Download aria-hidden size={16} />
                Bills
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="panel p-4">
          <div className="mb-4 flex items-center gap-2">
            <ArrowDownUp aria-hidden className="text-sky-300" size={18} />
            <h2 className="text-lg font-bold text-white">Transfer History</h2>
          </div>
          <div className="space-y-3">
            {data.transfers.length ? (
              data.transfers.map((transfer) => (
                <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3" key={transfer.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-white">
                      {transfer.fromAccountName} to {transfer.toAccountName}
                    </p>
                    <p className="font-bold text-teal-200">{dollars(transfer.amount)}</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">
                    {displayDate(transfer.transferDate)} by {transfer.userName ?? "Household"}
                  </p>
                  {transfer.notes ? (
                    <p className="mt-1 text-sm text-slate-300">{transfer.notes}</p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="rounded-md border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                No transfers have been recorded yet.
              </p>
            )}
          </div>
        </article>

        <article className="panel p-4">
          <div className="mb-4 flex items-center gap-2">
            <History aria-hidden className="text-amber-300" size={18} />
            <h2 className="text-lg font-bold text-white">Account Activity</h2>
          </div>
          <div className="space-y-3">
            {data.activity.length ? (
              data.activity.slice(0, 12).map((activity) => (
                <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3" key={activity.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-white">{activity.description}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        {activity.accountName} - {displayDate(activity.activityDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${activity.amount < 0 ? "text-rose-200" : "text-teal-200"}`}>
                        {dollars(activity.amount)}
                      </p>
                      <p className="text-xs text-slate-400">{dollars(activity.balanceAfter)}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-md border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                No account activity has been recorded yet.
              </p>
            )}
          </div>
        </article>
      </section>

      <article className="panel p-4">
        <div className="mb-4 flex items-center gap-2">
          <Bell aria-hidden className="text-amber-300" size={18} />
          <h2 className="text-lg font-bold text-white">Upcoming Notifications</h2>
        </div>
        <div className="space-y-3">
          {data.notifications.length ? (
            data.notifications.map((notification) => (
              <div
                className="flex flex-col justify-between gap-2 rounded-md border border-slate-800 bg-slate-950/40 p-3 sm:flex-row sm:items-center"
                key={notification.id}
              >
                <div>
                  <p className="font-semibold text-white">{notification.title}</p>
                  <p className="text-sm text-slate-400">{notification.body}</p>
                </div>
                <p className="text-sm font-semibold text-amber-200">
                  {displayDate(notification.notify_on)}
                </p>
              </div>
            ))
          ) : (
            <p className="rounded-md border border-dashed border-slate-700 p-4 text-sm text-slate-400">
              No bill notifications are scheduled for the next two weeks.
            </p>
          )}
        </div>
      </article>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Wallet;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-400">{label}</p>
        <Icon aria-hidden className="text-teal-300" size={18} />
      </div>
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
