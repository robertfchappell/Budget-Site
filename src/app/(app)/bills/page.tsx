import { Archive, CheckCircle2, RefreshCcw, RotateCcw, Trash2 } from "lucide-react";
import { BillForm } from "@/components/bill-form";
import { BillCalendar } from "@/components/bill-calendar";
import {
  archiveRecurringBill,
  deleteRecurringBill,
  markBillPaid,
  markBillUnpaid
} from "@/app/(app)/bills/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { getBillsPageData } from "@/lib/budget/data";
import { describeBillSchedule } from "@/lib/budget/bill-schedules";
import { requireUser } from "@/lib/auth";
import { displayDate } from "@/lib/dates";
import { dollars } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function BillsPage() {
  const user = await requireUser();
  const data = await getBillsPageData(user.householdId);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">
          Household bills
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Bills</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Track due dates in plain language, from monthly utilities to one-time payments.
        </p>
      </div>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <BillForm accounts={data.accounts} categories={data.categories} />

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
          <h2 className="text-lg font-bold text-white">Bill Management</h2>
          <div className="mt-4 space-y-3">
            {data.recurringBills.length ? (
              data.recurringBills.map((bill) => (
                <details className="rounded-md border border-slate-800 bg-slate-950/40 p-3" key={bill.id}>
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{bill.name}</p>
                        <p className="mt-1 text-sm text-slate-400">
                          {describeBillSchedule(bill)}
                          {!bill.active ? " - archived" : ""}
                          {bill.isSubscription ? " - subscription" : ""}
                        </p>
                      </div>
                      <p className="font-bold text-teal-200">{dollars(bill.amount)}</p>
                    </div>
                  </summary>

                  <BillForm accounts={data.accounts} bill={bill} categories={data.categories} compact />

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
                No bills have been created yet.
              </p>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
