"use client";

import { useState } from "react";
import { eachDayOfInterval, endOfMonth, format, getDay, isValid, parseISO, startOfMonth } from "date-fns";
import { Archive, CheckCircle2, RotateCcw, Save, Trash2, X } from "lucide-react";
import {
  archiveRecurringBill,
  deleteBillInstance,
  deleteRecurringBill,
  markBillPaid,
  markBillUnpaid,
  updateBillInstance,
  updateRecurringBill
} from "@/app/(app)/bills/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { asArray } from "@/lib/coerce";
import { safeIsoDate, todayIso } from "@/lib/dates";
import { dollars } from "@/lib/money";
import type { Account, BillInstance, Category, RecurringBill } from "@/lib/types";

export function BillCalendar({
  bills,
  monthDate,
  categories,
  accounts,
  recurringBills
}: {
  bills: BillInstance[];
  monthDate: string;
  categories: Category[];
  accounts: Account[];
  recurringBills: RecurringBill[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const month = parseMonth(monthDate);
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const days = eachDayOfInterval({ start, end });
  const offset = getDay(start);
  const safeBills = asArray<BillInstance>(bills);
  const selectedBill = safeBills.find((bill) => bill.id === selectedId) ?? null;
  const selectedRecurringBill =
    recurringBills.find((bill) => bill.id === selectedBill?.recurringBillId) ?? null;

  const byDay = new Map<string, BillInstance[]>();

  for (const bill of safeBills) {
    const key = safeIsoDate(bill?.dueDate);

    if (!key) {
      continue;
    }

    byDay.set(key, [...(byDay.get(key) ?? []), bill]);
  }

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-slate-800 text-center text-xs font-bold uppercase text-slate-500">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div className="py-2" key={day}>
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: offset }).map((_, index) => (
          <div className="min-h-24 border-b border-r border-slate-800/80 bg-slate-950/30" key={`blank-${index}`} />
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayBills = byDay.get(key) ?? [];

          return (
            <div className="min-h-24 border-b border-r border-slate-800/80 p-2" key={key}>
              <p className="text-xs font-bold text-slate-400">{format(day, "d")}</p>
              <div className="mt-2 space-y-1">
                {dayBills.slice(0, 3).map((bill) => (
                  <button
                    className="w-full rounded-md border border-slate-700/80 bg-slate-900/80 px-2 py-1 text-left hover:border-teal-400/50 hover:bg-slate-800"
                    key={bill.id}
                    onClick={() => setSelectedId(bill.id)}
                    type="button"
                  >
                    <p className="truncate text-xs font-semibold text-white">{bill.billName}</p>
                    <p className="text-[0.68rem] text-slate-400">{dollars(bill.amount)}</p>
                  </button>
                ))}
                {dayBills.length > 3 ? (
                  <p className="text-[0.68rem] font-semibold text-teal-300">
                    +{dayBills.length - 3} more
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {selectedBill ? (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="ml-auto flex h-full w-full max-w-2xl flex-col border-l border-slate-800 bg-slate-950 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-300">
                  Bill details
                </p>
                <h3 className="mt-1 text-xl font-bold text-white">{selectedBill.billName}</h3>
                <p className="mt-1 text-sm text-slate-400">
                  {safeIsoDate(selectedBill.dueDate, todayIso())} - {selectedBill.status}
                </p>
              </div>
              <button
                aria-label="Close bill details"
                className="secondary-button size-10 p-0"
                onClick={() => setSelectedId(null)}
                type="button"
              >
                <X aria-hidden size={18} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <section className="rounded-md border border-slate-800 bg-slate-900/50 p-4">
                <h4 className="font-bold text-white">Bill Instance</h4>
                <form action={updateBillInstance} className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={() => setSelectedId(null)}>
                  <input name="billInstanceId" type="hidden" value={selectedBill.id} />
                  <Field defaultValue={selectedBill.billName} label="Bill name" name="billName" required />
                  <Field defaultValue={selectedBill.amount} label="Amount" name="amount" required step="0.01" type="number" />
                  <Field defaultValue={safeIsoDate(selectedBill.dueDate, todayIso())} label="Due date" name="dueDate" required type="date" />
                  <div>
                    <label className="label" htmlFor={`bill-category-${selectedBill.id}`}>
                      Category
                    </label>
                    <select
                      className="field"
                      defaultValue={selectedBill.categoryId ?? ""}
                      id={`bill-category-${selectedBill.id}`}
                      name="categoryId"
                    >
                      <option value="">Uncategorized</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor={`bill-account-${selectedBill.id}`}>
                      Account
                    </label>
                    <select
                      className="field"
                      defaultValue={selectedBill.accountId ?? ""}
                      id={`bill-account-${selectedBill.id}`}
                      name="accountId"
                    >
                      <option value="">No account</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label" htmlFor={`bill-notes-${selectedBill.id}`}>
                      Notes
                    </label>
                    <textarea className="field min-h-20" defaultValue={selectedBill.notes ?? ""} id={`bill-notes-${selectedBill.id}`} name="notes" />
                  </div>
                  <button className="secondary-button" type="submit">
                    <Save aria-hidden size={16} />
                    Save bill
                  </button>
                </form>

                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedBill.status === "paid" ? (
                    <form action={markBillUnpaid} onSubmit={() => setSelectedId(null)}>
                      <input name="billInstanceId" type="hidden" value={selectedBill.id} />
                      <button className="secondary-button" type="submit">
                        <RotateCcw aria-hidden size={16} />
                        Mark unpaid
                      </button>
                    </form>
                  ) : (
                    <form action={markBillPaid} onSubmit={() => setSelectedId(null)}>
                      <input name="billInstanceId" type="hidden" value={selectedBill.id} />
                      <button className="secondary-button" type="submit">
                        <CheckCircle2 aria-hidden size={16} />
                        Mark paid
                      </button>
                    </form>
                  )}
                  <form action={deleteBillInstance} onSubmit={() => setSelectedId(null)}>
                    <input name="billInstanceId" type="hidden" value={selectedBill.id} />
                    <ConfirmSubmitButton className="secondary-button border-rose-400/30 text-rose-100" message={`Delete ${selectedBill.billName}?`}>
                      <Trash2 aria-hidden size={16} />
                      Delete bill
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </section>

              {selectedRecurringBill ? (
                <section className="rounded-md border border-slate-800 bg-slate-900/50 p-4">
                  <h4 className="font-bold text-white">Recurring Settings</h4>
                  <form action={updateRecurringBill} className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={() => setSelectedId(null)}>
                    <input name="billId" type="hidden" value={selectedRecurringBill.id} />
                    <Field defaultValue={selectedRecurringBill.name} label="Bill name" name="name" required />
                    <Field defaultValue={selectedRecurringBill.amount} label="Amount" name="amount" required step="0.01" type="number" />
                    <div>
                      <label className="label" htmlFor={`recurring-frequency-${selectedRecurringBill.id}`}>
                        Frequency
                      </label>
                      <select
                        className="field"
                        defaultValue={selectedRecurringBill.frequency}
                        id={`recurring-frequency-${selectedRecurringBill.id}`}
                        name="frequency"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="weekly">Weekly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                    <Field defaultValue={selectedRecurringBill.startDate} label="Start date" name="startDate" required type="date" />
                    <Field defaultValue={selectedRecurringBill.dueDay ?? ""} label="Monthly due day" max="31" min="1" name="dueDay" type="number" />
                    <select className="field" defaultValue={selectedRecurringBill.categoryId ?? ""} name="categoryId">
                      <option value="">Uncategorized</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <select className="field" defaultValue={selectedRecurringBill.accountId ?? ""} name="accountId">
                      <option value="">No account</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300">
                        <input className="size-4 accent-teal-500" defaultChecked={selectedRecurringBill.autopay} name="autopay" type="checkbox" />
                        Autopay
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300">
                        <input className="size-4 accent-teal-500" defaultChecked={selectedRecurringBill.isSubscription} name="isSubscription" type="checkbox" />
                        Subscription
                      </label>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label" htmlFor={`recurring-notes-${selectedRecurringBill.id}`}>
                        Notes
                      </label>
                      <textarea className="field min-h-16" defaultValue={selectedRecurringBill.notes ?? ""} id={`recurring-notes-${selectedRecurringBill.id}`} name="notes" />
                    </div>
                    <button className="secondary-button" type="submit">
                      <Save aria-hidden size={16} />
                      Save recurring
                    </button>
                  </form>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedRecurringBill.active ? (
                      <form action={archiveRecurringBill} onSubmit={() => setSelectedId(null)}>
                        <input name="billId" type="hidden" value={selectedRecurringBill.id} />
                        <ConfirmSubmitButton message={`Archive ${selectedRecurringBill.name}? Future instances will stop generating.`}>
                          <Archive aria-hidden size={16} />
                          Archive recurring
                        </ConfirmSubmitButton>
                      </form>
                    ) : null}
                    <form action={deleteRecurringBill} onSubmit={() => setSelectedId(null)}>
                      <input name="billId" type="hidden" value={selectedRecurringBill.id} />
                      <ConfirmSubmitButton className="secondary-button border-rose-400/30 text-rose-100" message={`Delete ${selectedRecurringBill.name} and generated bill instances?`}>
                        <Trash2 aria-hidden size={16} />
                        Delete recurring
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function parseMonth(value: string) {
  const parsed = typeof value === "string" ? parseISO(value) : new Date();
  return isValid(parsed) ? parsed : new Date();
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
