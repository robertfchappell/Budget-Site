"use client";

import { useMemo, useState } from "react";
import { Plus, Save } from "lucide-react";
import { createRecurringBill, updateRecurringBill } from "@/app/(app)/bills/actions";
import { todayIso } from "@/lib/dates";
import type { Account, BillFrequency, Category, RecurringBill } from "@/lib/types";

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

export function BillForm({
  accounts,
  categories,
  bill,
  compact = false
}: {
  accounts: Account[];
  categories: Category[];
  bill?: RecurringBill;
  compact?: boolean;
}) {
  const [frequency, setFrequency] = useState<BillFrequency>(bill?.frequency ?? "monthly");
  const dateParts = useMemo(() => partsFromDate(bill?.startDate), [bill?.startDate]);
  const [dueDay, setDueDay] = useState(String(bill?.dueDay ?? dateParts.day));
  const [weekday, setWeekday] = useState(String(dateParts.weekday));
  const [yearlyMonth, setYearlyMonth] = useState(String(dateParts.month));
  const [yearlyDay, setYearlyDay] = useState(String(bill?.dueDay ?? dateParts.day));
  const [startDate, setStartDate] = useState(bill?.startDate ?? todayIso());
  const action = bill ? updateRecurringBill : createRecurringBill;
  const helper = recurrenceHelper(frequency, {
    dueDay,
    weekday,
    startDate,
    yearlyMonth,
    yearlyDay
  });

  return (
    <form action={action} className={compact ? "mt-4 grid gap-3 sm:grid-cols-2" : "panel p-4"}>
      {bill ? <input name="billId" type="hidden" value={bill.id} /> : null}
      <input name="startDate" type="hidden" value={startDate} />

      {!compact ? (
        <div className="mb-4 flex items-center gap-2">
          <Plus aria-hidden className="text-teal-300" size={19} />
          <div>
            <h2 className="text-lg font-bold text-white">New Bill</h2>
            <p className="mt-1 text-sm text-slate-400">Use household language first; the schedule is handled underneath.</p>
          </div>
        </div>
      ) : null}

      <div className={compact ? "contents" : "grid gap-3 sm:grid-cols-2"}>
        <Field defaultValue={bill?.name} label="Bill name" name="name" required />
        <Field defaultValue={bill?.amount} label="Amount" name="amount" required step="0.01" type="number" />

        <div>
          <label className="label" htmlFor={fieldId("frequency", bill)}>
            Repeats
          </label>
          <select
            className="field"
            id={fieldId("frequency", bill)}
            name="frequency"
            value={frequency}
            onChange={(event) => setFrequency(event.target.value as BillFrequency)}
          >
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every other week</option>
            <option value="yearly">Yearly</option>
            <option value="one_time">One-Time</option>
          </select>
        </div>

        <RecurrenceFields
          dueDay={dueDay}
          frequency={frequency}
          setDueDay={setDueDay}
          setStartDate={setStartDate}
          setWeekday={setWeekday}
          setYearlyDay={setYearlyDay}
          setYearlyMonth={setYearlyMonth}
          startDate={startDate}
          weekday={weekday}
          yearlyDay={yearlyDay}
          yearlyMonth={yearlyMonth}
        />

        <div className="sm:col-span-2 rounded-md border border-slate-800 bg-slate-950/35 p-3 text-sm text-slate-400">
          {helper}
        </div>

        <div>
          <label className="label" htmlFor={fieldId("categoryId", bill)}>
            Category
          </label>
          <select className="field" defaultValue={bill?.categoryId ?? ""} id={fieldId("categoryId", bill)} name="categoryId">
            <option value="">Uncategorized</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor={fieldId("accountId", bill)}>
            Account
          </label>
          <select className="field" defaultValue={bill?.accountId ?? ""} id={fieldId("accountId", bill)} name="accountId">
            <option value="">No account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4 pt-1">
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300">
            <input className="size-4 accent-teal-500" defaultChecked={bill?.autopay} name="autopay" type="checkbox" />
            Autopay
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300">
            <input className="size-4 accent-teal-500" defaultChecked={bill?.isSubscription} name="isSubscription" type="checkbox" />
            Subscription
          </label>
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor={fieldId("notes", bill)}>
            Notes
          </label>
          <textarea className="field min-h-20" defaultValue={bill?.notes ?? ""} id={fieldId("notes", bill)} name="notes" />
        </div>
      </div>

      <button className={compact ? "secondary-button" : "primary-button mt-4"} type="submit">
        {bill ? <Save aria-hidden size={16} /> : <Plus aria-hidden size={17} />}
        {bill ? "Save bill" : "Save bill"}
      </button>
    </form>
  );
}

function RecurrenceFields({
  frequency,
  dueDay,
  setDueDay,
  weekday,
  setWeekday,
  startDate,
  setStartDate,
  yearlyMonth,
  setYearlyMonth,
  yearlyDay,
  setYearlyDay
}: {
  frequency: BillFrequency;
  dueDay: string;
  setDueDay: (value: string) => void;
  weekday: string;
  setWeekday: (value: string) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  yearlyMonth: string;
  setYearlyMonth: (value: string) => void;
  yearlyDay: string;
  setYearlyDay: (value: string) => void;
}) {
  if (frequency === "monthly") {
    return (
      <div>
        <label className="label" htmlFor="dueDay">
          Bill Due On
        </label>
        <div className="flex items-center gap-2">
          <input
            className="field max-w-24"
            id="dueDay"
            max="31"
            min="1"
            name="dueDay"
            onChange={(event) => setDueDay(event.target.value)}
            type="number"
            value={dueDay}
          />
          <span className="text-sm font-semibold text-slate-400">of every month</span>
        </div>
      </div>
    );
  }

  if (frequency === "weekly") {
    return (
      <div>
        <label className="label" htmlFor="weekday">
          Bill Due On
        </label>
        <select className="field" id="weekday" name="weekday" onChange={(event) => setWeekday(event.target.value)} value={weekday}>
          {weekdays.map((day, index) => (
            <option key={day} value={index}>
              {day}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (frequency === "biweekly") {
    return (
      <Field
        label="Starting date"
        name="startDate"
        onChange={(event) => setStartDate(event.target.value)}
        required
        type="date"
        value={startDate}
      />
    );
  }

  if (frequency === "yearly") {
    return (
      <div className="grid gap-3 sm:grid-cols-[1fr_0.55fr]">
        <div>
          <label className="label" htmlFor="yearlyMonth">
            Bill Due In
          </label>
          <select className="field" id="yearlyMonth" name="yearlyMonth" onChange={(event) => setYearlyMonth(event.target.value)} value={yearlyMonth}>
            {months.map((month, index) => (
              <option key={month} value={index + 1}>
                {month}
              </option>
            ))}
          </select>
        </div>
        <Field
          label="Day"
          max="31"
          min="1"
          name="yearlyDay"
          onChange={(event) => setYearlyDay(event.target.value)}
          type="number"
          value={yearlyDay}
        />
      </div>
    );
  }

  return (
    <Field
      label="Due date"
      name="dueDate"
      onChange={(event) => setStartDate(event.target.value)}
      required
      type="date"
      value={startDate}
    />
  );
}

function recurrenceHelper(
  frequency: BillFrequency,
  values: {
    dueDay: string;
    weekday: string;
    startDate: string;
    yearlyMonth: string;
    yearlyDay: string;
  }
) {
  if (frequency === "monthly") {
    return `This bill repeats on the ${values.dueDay || "1"}${ordinal(Number(values.dueDay || 1))} of each month.`;
  }

  if (frequency === "weekly") {
    return `This bill repeats every ${weekdays[Number(values.weekday)] ?? "week"}.`;
  }

  if (frequency === "biweekly") {
    return `This bill repeats every other week starting ${values.startDate}.`;
  }

  if (frequency === "yearly") {
    return `This bill repeats every ${months[Number(values.yearlyMonth) - 1] ?? "year"} ${values.yearlyDay || "1"}.`;
  }

  return "This bill is added once and will not generate future repeats.";
}

function partsFromDate(value: string | null | undefined) {
  const parsed = value ? new Date(`${value}T00:00:00`) : new Date();

  if (Number.isNaN(parsed.getTime())) {
    return partsFromDate(todayIso());
  }

  return {
    day: parsed.getDate(),
    month: parsed.getMonth() + 1,
    weekday: parsed.getDay()
  };
}

function ordinal(value: number) {
  if (value % 100 >= 11 && value % 100 <= 13) {
    return "th";
  }

  if (value % 10 === 1) {
    return "st";
  }

  if (value % 10 === 2) {
    return "nd";
  }

  if (value % 10 === 3) {
    return "rd";
  }

  return "th";
}

function fieldId(name: string, bill?: RecurringBill) {
  return `${name}-${bill?.id ?? "new"}`;
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
