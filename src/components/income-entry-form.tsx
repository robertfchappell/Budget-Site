"use client";

import { useMemo, useState } from "react";
import { Banknote, ChevronDown, Save } from "lucide-react";
import { createIncomeEntry, updateIncomeEntry } from "@/app/(app)/income/actions";
import { incomeTypeOptions } from "@/lib/budget/income-types";
import { todayIso } from "@/lib/dates";
import type { Account, IncomeEntry, IncomeType } from "@/lib/types";

type IncomePreset = {
  title: string;
  helper: string;
  amountLabel: string;
  dateLabel: string;
  nameLabel?: string;
  namePlaceholder?: string;
  showName: boolean;
  showTerm: boolean;
  showNotes: boolean;
  showRecurring: boolean;
  advancedPayroll: boolean;
};

const presets: Record<IncomeType, IncomePreset> = {
  regular_paycheck: {
    title: "Regular paycheck",
    helper: "Record the money that actually lands in checking. Extra paycheck details can stay tucked away unless you need them.",
    amountLabel: "Net Deposit",
    dateLabel: "Pay date",
    nameLabel: "Employer name",
    namePlaceholder: "Employer",
    showName: true,
    showTerm: false,
    showNotes: false,
    showRecurring: true,
    advancedPayroll: true
  },
  overtime: {
    title: "Overtime",
    helper: "Track overtime separately from regular pay so it stays visible as extra cashflow.",
    amountLabel: "Amount",
    dateLabel: "Pay date",
    showName: false,
    showTerm: false,
    showNotes: true,
    showRecurring: true,
    advancedPayroll: false
  },
  va_disability: {
    title: "VA disability",
    helper: "VA disability stays separate from paycheck income in reports and forecasts.",
    amountLabel: "Amount",
    dateLabel: "Pay date",
    showName: false,
    showTerm: false,
    showNotes: true,
    showRecurring: true,
    advancedPayroll: false
  },
  pell_grant: {
    title: "Pell grant",
    helper: "Keep school funds independent from paychecks and loans.",
    amountLabel: "Amount",
    dateLabel: "Disbursement date",
    nameLabel: "School name",
    namePlaceholder: "School",
    showName: true,
    showTerm: true,
    showNotes: true,
    showRecurring: false,
    advancedPayroll: false
  },
  student_loan: {
    title: "Student loan",
    helper: "Track loan disbursements as their own cashflow source instead of mixing them into income.",
    amountLabel: "Amount",
    dateLabel: "Disbursement date",
    nameLabel: "School name",
    namePlaceholder: "School",
    showName: true,
    showTerm: true,
    showNotes: true,
    showRecurring: false,
    advancedPayroll: false
  },
  va_education_stipend: {
    title: "VA education stipend",
    helper: "Track dependent or spouse education stipends separately from disability and paychecks.",
    amountLabel: "Amount",
    dateLabel: "Pay date",
    nameLabel: "Recipient",
    namePlaceholder: "Recipient",
    showName: true,
    showTerm: false,
    showNotes: false,
    showRecurring: true,
    advancedPayroll: false
  },
  bonus: {
    title: "Bonus",
    helper: "One-off bonuses stay visible as additional income.",
    amountLabel: "Amount",
    dateLabel: "Date received",
    showName: false,
    showTerm: false,
    showNotes: true,
    showRecurring: false,
    advancedPayroll: false
  },
  misc: {
    title: "Miscellaneous income",
    helper: "Use this for anything that does not need its own preset.",
    amountLabel: "Amount",
    dateLabel: "Date received",
    showName: false,
    showTerm: false,
    showNotes: true,
    showRecurring: true,
    advancedPayroll: false
  }
};

const defaultRecurring = new Map(incomeTypeOptions.map((option) => [option.value, option.defaultRecurrence === "recurring"]));

export function IncomeEntryForm({
  accounts,
  entry,
  compact = false
}: {
  accounts: Account[];
  entry?: IncomeEntry;
  compact?: boolean;
}) {
  const [incomeType, setIncomeType] = useState<IncomeType>(entry?.incomeType ?? "regular_paycheck");
  const [isRecurring, setIsRecurring] = useState(entry?.recurrence ? entry.recurrence === "recurring" : defaultRecurring.get(incomeType) ?? false);
  const preset = presets[incomeType];
  const action = entry ? updateIncomeEntry : createIncomeEntry;
  const hasPayrollDetails = Boolean(entry && (entry.basePay || entry.overtimePay || entry.bonusPay || entry.taxesWithheld));
  const helper = useMemo(() => preset.helper, [preset]);

  return (
    <form action={action} className={compact ? "grid gap-3 sm:grid-cols-2" : "panel p-4"}>
      {entry ? <input name="incomeId" type="hidden" value={entry.id} /> : null}
      <input name="recurrence" type="hidden" value={isRecurring ? "recurring" : "one_time"} />
      {!preset.advancedPayroll ? (
        <>
          <input name="basePay" type="hidden" value="0" />
          <input name="overtimePay" type="hidden" value="0" />
          <input name="bonusPay" type="hidden" value="0" />
          <input name="vaIncome" type="hidden" value="0" />
          <input name="taxesWithheld" type="hidden" value="0" />
        </>
      ) : null}

      {!compact ? (
        <div className="mb-4 flex items-start gap-3">
          <span className="mt-1 grid size-9 place-items-center rounded-md bg-teal-400/12 text-teal-300">
            <Banknote aria-hidden size={18} />
          </span>
          <div>
            <h2 className="text-lg font-bold text-white">Add Income</h2>
            <p className="mt-1 text-sm text-slate-400">Pick a type and the form only asks for what helps the household budget.</p>
          </div>
        </div>
      ) : null}

      <div className={compact ? "contents" : "grid gap-3 sm:grid-cols-2"}>
        <div className="sm:col-span-2">
          <label className="label" htmlFor={fieldId("incomeType", entry)}>
            Income type
          </label>
          <select
            className="field"
            id={fieldId("incomeType", entry)}
            name="incomeType"
            value={incomeType}
            onChange={(event) => {
              const nextType = event.target.value as IncomeType;
              setIncomeType(nextType);
              setIsRecurring(defaultRecurring.get(nextType) ?? false);
            }}
          >
            {incomeTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-400">{helper}</p>
        </div>

        <div className="sm:col-span-2 rounded-md border border-slate-800 bg-slate-950/35 p-3 transition-all duration-200">
          <p className="text-sm font-bold text-white">{preset.title}</p>
          <p className="mt-1 text-xs text-slate-400">
            {isRecurring ? "Included in recurring income and the monthly outlook." : "Counted for the selected month only."}
          </p>
        </div>

        {preset.showName ? (
          <Field
            defaultValue={entry?.employer ?? ""}
            label={preset.nameLabel ?? "Name"}
            name="employer"
            placeholder={preset.namePlaceholder}
            required
          />
        ) : (
          <input name="employer" type="hidden" value="" />
        )}

        <Field
          defaultValue={entry?.depositAmount}
          label={preset.amountLabel}
          name="depositAmount"
          required
          step="0.01"
          type="number"
        />

        {preset.showTerm ? (
          <Field defaultValue={entry?.term ?? ""} label="Semester / term" name="term" placeholder="Fall 2026" />
        ) : (
          <input name="term" type="hidden" value="" />
        )}

        <Field
          defaultValue={entry?.paycheckDate ?? todayIso()}
          label={preset.dateLabel}
          name="paycheckDate"
          required
          type="date"
        />

        {preset.showRecurring ? (
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-950/35 px-3 text-sm font-semibold text-slate-300">
            <span>Repeats regularly</span>
            <input
              checked={isRecurring}
              className="size-4 accent-teal-500"
              onChange={(event) => setIsRecurring(event.target.checked)}
              type="checkbox"
            />
          </label>
        ) : null}

        <div>
          <label className="label" htmlFor={fieldId("accountId", entry)}>
            Deposit account
          </label>
          <select className="field" defaultValue={entry?.accountId ?? ""} id={fieldId("accountId", entry)} name="accountId">
            <option value="">Do not update balance</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>

        {preset.advancedPayroll ? (
          <details className="sm:col-span-2 rounded-md border border-slate-800 bg-slate-950/35 p-3" open={hasPayrollDetails}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-slate-200">
              Optional paycheck details
              <ChevronDown aria-hidden size={16} />
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field defaultValue={entry?.basePay} label="Gross pay" name="basePay" step="0.01" type="number" />
              <Field defaultValue={entry?.taxesWithheld} label="Taxes withheld" name="taxesWithheld" step="0.01" type="number" />
              <Field defaultValue={entry?.overtimePay} label="Overtime" name="overtimePay" step="0.01" type="number" />
              <Field defaultValue={entry?.bonusPay} label="Bonus" name="bonusPay" step="0.01" type="number" />
              <input name="vaIncome" type="hidden" value="0" />
            </div>
          </details>
        ) : null}

        {preset.showNotes ? <Field defaultValue={entry?.notes ?? ""} label="Notes" name="notes" /> : <input name="notes" type="hidden" value={entry?.notes ?? ""} />}
      </div>

      <button className={compact ? "secondary-button" : "primary-button mt-4"} type="submit">
        {entry ? <Save aria-hidden size={16} /> : <Banknote aria-hidden size={17} />}
        {entry ? "Save income" : "Add income"}
      </button>
    </form>
  );
}

function fieldId(name: string, entry?: IncomeEntry) {
  return `${name}-${entry?.id ?? "new"}`;
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
