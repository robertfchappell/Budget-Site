import { Archive, CheckCircle2, Plus, RefreshCcw, RotateCcw, Save, Trash2 } from "lucide-react";
import { BillCalendar } from "@/components/bill-calendar";
import {
  archiveRecurringBill,
  createRecurringBill,
  deleteRecurringBill,
  markBillPaid,
  markBillUnpaid,
  updateRecurringBill
} from "@/app/(app)/bills/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { getBillsPageData } from "@/lib/budget/data";
import { requireUser } from "@/lib/auth";
import { displayDate, displayShortDate, todayIso } from "@/lib/dates";
import { dollars } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function BillsPage() {
  const user = await requireUser();
  const data = await getBillsPageData(user.householdId);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">
          Recurring bills
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Bills</h1>
      </div>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <form action={createRecurringBill} className="panel p-4">
          <div className="mb-4 flex items-center gap-2">
            <Plus aria-hidden className="text-teal-300" size={19} />
            <h2 className="text-lg font-bold text-white">New Recurring Bill</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bill name" name="name" required />
            <Field label="Amount" name="amount" required step="0.01" type="number" />
            <div>
              <label className="label" htmlFor="frequency">
                Frequency
              </label>
              <select className="field" id="frequency" name="frequency" defaultValue="monthly">
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <Field defaultValue={todayIso()} label="Start date" name="startDate" required type="date" />
            <Field label="Monthly due day" max="31" min="1" name="dueDay" type="number" />
            <div>
              <label className="label" htmlFor="categoryId">
                Category
              </label>
              <select className="field" id="categoryId" name="categoryId">
                <option value="">Uncategorized</option>
                {data.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="accountId">
                Account
              </label>
              <select className="field" id="accountId" name="accountId">
                <option value="">No account</option>
                {data.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-4 pt-6">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300">
                <input className="size-4 accent-teal-500" name="autopay" type="checkbox" />
                Autopay
              </label>
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300">
                <input className="size-4 accent-teal-500" name="isSubscription" type="checkbox" />
                Subscription
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="notes">
                Notes
              </label>
              <textarea className="field min-h-20" id="notes" name="notes" />
            </div>
          </div>
          <button className="primary-button mt-4" type="submit">
            <Plus aria-hidden size={17} />
            Save bill
          </button>
        </form>

        <article className="panel overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 p-4">
            <div>
              <h2 className="text-lg font-bold text-white">Bill Calendar</h2>
              <p className="text-sm text-slate-400">{data.month.label}</p>
            </div>
            <RefreshCcw aria-hidden className="text-sky-300" size={19} />
          </div>
          <BillCalendar
            accounts={data.accounts}
            bills={data.billInstances}
            categories={data.categories}
            monthDate={data.month.startIso}
            recurringBills={data.recurringBills}
          />
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="panel overflow-hidden">
          <div className="border-b border-slate-800 p-4">
            <h2 className="text-lg font-bold text-white">This Month</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-950/60 text-xs uppercase text-slate-500">
                <tr>
                  <th className="table-cell">Bill</th>
                  <th className="table-cell">Due</th>
                  <th className="table-cell">Category</th>
                  <th className="table-cell">Amount</th>
                  <th className="table-cell">Status</th>
                  <th className="table-cell">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.billInstances.map((bill) => (
                  <tr key={bill.id}>
                    <td className="table-cell font-semibold text-white">{bill.billName}</td>
                    <td className="table-cell text-slate-300">{displayDate(bill.dueDate)}</td>
                    <td className="table-cell text-slate-300">{bill.categoryName ?? "Uncategorized"}</td>
                    <td className="table-cell font-bold text-white">{dollars(bill.amount)}</td>
                    <td className="table-cell">
                      <span className="badge capitalize">{bill.status}</span>
                    </td>
                    <td className="table-cell">
                      {bill.status === "paid" ? (
                        <form action={markBillUnpaid}>
                          <input name="billInstanceId" type="hidden" value={bill.id} />
                          <button className="secondary-button" type="submit">
                            <RotateCcw aria-hidden size={16} />
                            Unpaid
                          </button>
                        </form>
                      ) : (
                        <form action={markBillPaid}>
                          <input name="billInstanceId" type="hidden" value={bill.id} />
                          <button className="secondary-button" type="submit">
                            <CheckCircle2 aria-hidden size={16} />
                            Paid
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel p-4">
          <h2 className="text-lg font-bold text-white">Recurring Bill Management</h2>
          <div className="mt-4 space-y-3">
            {data.recurringBills.length ? (
              data.recurringBills.map((bill) => (
                <details className="rounded-md border border-slate-800 bg-slate-950/40 p-3" key={bill.id}>
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{bill.name}</p>
                        <p className="mt-1 text-sm capitalize text-slate-400">
                          {bill.frequency} · due {bill.dueDay ?? displayShortDate(bill.startDate)}
                          {!bill.active ? " · archived" : ""}
                          {bill.isSubscription ? " · subscription" : ""}
                        </p>
                      </div>
                      <p className="font-bold text-teal-200">{dollars(bill.amount)}</p>
                    </div>
                  </summary>

                  <form action={updateRecurringBill} className="mt-4 grid gap-3 sm:grid-cols-2">
                    <input name="billId" type="hidden" value={bill.id} />
                    <Field defaultValue={bill.name} label="Bill name" name="name" required />
                    <Field defaultValue={bill.amount} label="Amount" name="amount" required step="0.01" type="number" />
                    <select className="field" defaultValue={bill.frequency} name="frequency">
                      <option value="monthly">Monthly</option>
                      <option value="weekly">Weekly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                    <Field defaultValue={bill.startDate} label="Start date" name="startDate" required type="date" />
                    <Field defaultValue={bill.dueDay ?? ""} label="Monthly due day" max="31" min="1" name="dueDay" type="number" />
                    <select className="field" defaultValue={bill.categoryId ?? ""} name="categoryId">
                      <option value="">Keep uncategorized</option>
                      {data.categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <select className="field" defaultValue={bill.accountId ?? ""} name="accountId">
                      <option value="">No account</option>
                      {data.accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-4">
                      <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300">
                        <input className="size-4 accent-teal-500" defaultChecked={bill.autopay} name="autopay" type="checkbox" />
                        Autopay
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300">
                        <input className="size-4 accent-teal-500" defaultChecked={bill.isSubscription} name="isSubscription" type="checkbox" />
                        Subscription
                      </label>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label" htmlFor={`notes-${bill.id}`}>
                        Notes
                      </label>
                      <textarea className="field min-h-16" defaultValue={bill.notes ?? ""} id={`notes-${bill.id}`} name="notes" />
                    </div>
                    <button className="secondary-button" type="submit">
                      <Save aria-hidden size={16} />
                      Save edits
                    </button>
                  </form>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {bill.active ? (
                      <form action={archiveRecurringBill}>
                        <input name="billId" type="hidden" value={bill.id} />
                        <ConfirmSubmitButton message={`Archive ${bill.name}? Future instances will stop generating.`}>
                          <Archive aria-hidden size={16} />
                          Archive
                        </ConfirmSubmitButton>
                      </form>
                    ) : null}
                    <form action={deleteRecurringBill}>
                      <input name="billId" type="hidden" value={bill.id} />
                      <ConfirmSubmitButton className="secondary-button border-rose-400/30 text-rose-100" message={`Delete ${bill.name} and its generated bill instances?`}>
                        <Trash2 aria-hidden size={16} />
                        Delete
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </details>
              ))
            ) : (
              <p className="rounded-md border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                No recurring bills have been created yet.
              </p>
            )}
          </div>
        </article>
      </section>
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
