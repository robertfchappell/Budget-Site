"use client";

import { type FormEvent, useRef, useState } from "react";
import { Banknote, ChevronDown, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { createIncomeEntry, updateIncomeEntry } from "@/app/(app)/income/actions";
import { defaultFrequencyForIncomeType, incomeTypeOptions } from "@/lib/budget/income-types";
import { todayIso } from "@/lib/dates";
import type { Account, IncomeEntry, IncomeFrequency, IncomeType } from "@/lib/types";

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

const frequencyLabels: Array<{ value: IncomeFrequency; label: string }> = [
  { value: "one_time", label: "One-time" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" }
];

export function IncomeEntryForm({
  accounts,
  entry,
  compact = false
}: {
  accounts: Account[];
  entry?: IncomeEntry;
  compact?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [incomeType, setIncomeType] = useState<IncomeType>(entry?.incomeType ?? "regular_paycheck");
  const [incomeFrequency, setIncomeFrequency] = useState<IncomeFrequency>(
    entry?.incomeFrequency ?? defaultFrequencyForIncomeType(entry?.incomeType ?? "regular_paycheck")
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const preset = presets[incomeType];
  const action = entry ? updateIncomeEntry : createIncomeEntry;
  const hasPayrollDetails = Boolean(entry && (entry.basePay || entry.overtimePay || entry.bonusPay || entry.taxesWithheld));
  const isRecurring = incomeFrequency !== "one_time";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = formRef.current;

    if (!form || saveState === "saving") {
      return;
    }

    setSaveState("saving");

    try {
      await action(new FormData(form));
      router.refresh();
      setSaveState("saved");

      if (entry) {
        window.setTimeout(() => {
          const details = form.closest("details") as HTMLDetailsElement | null;

          if (details) {
            details.open = false;
          }

          setSaveState("idle");
        }, 650);
        return;
      }

      form.reset();
      setIncomeType("regular_paycheck");
      setIncomeFrequency(defaultFrequencyForIncomeType("regular_paycheck"));
      window.setTimeout(() => setSaveState("idle"), 1400);
    } catch (error) {
      console.error("[income-entry-form] Income save failed", error);
      setSaveState("error");
    }
  }

  return (
    <form
      action={action}
      className={compact ? "grid gap-3 sm:grid-cols-2" : "panel p-4"}
      ref={formRef}
      onSubmit={handleSubmit}
    >
      {entry ? <input name="incomeId" type="hidden" value={entry.id} /> : null}
      <input name="recurrence" type="hidden" value={isRecurring ? "recurring" : "one_time"} />
      <input name="incomeFrequency" type="hidden" value={preset.showRecurring ? incomeFrequency : "one_time"} />
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
              setIncomeFrequency(defaultFrequencyForIncomeType(nextType));
            }}
          >
            {incomeTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-400">{preset.helper}</p>
        </div>

        <div className="sm:col-span-2 rounded-md border border-slate-800 bg-slate-950/35 p-3 transition-all duration-200" key={incomeType}>
          <p className="text-sm font-bold text-white">{preset.title}</p>
          <p className="mt-1 text-xs text-slate-400">
            {incomeFrequencyHelper(incomeFrequency)}
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
          <div>
            <label className="label" htmlFor={fieldId("incomeFrequency", entry)}>
              How often?
            </label>
            <select
              className="field"
              id={fieldId("incomeFrequency", entry)}
              onChange={(event) => setIncomeFrequency(event.target.value as IncomeFrequency)}
              value={incomeFrequency}
            >
              {frequencyLabels.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
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

      <div className={compact ? "sm:col-span-2 flex flex-wrap items-center gap-3" : "mt-4 flex flex-wrap items-center gap-3"}>
        <button
          className={`${compact ? "secondary-button" : "primary-button"} transition-all duration-200 ${saveState === "saved" ? "ring-2 ring-teal-300/45" : ""}`}
          disabled={saveState === "saving"}
          type="submit"
        >
          {entry ? <Save aria-hidden size={16} /> : <Banknote aria-hidden size={17} />}
          {saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : entry ? "Save income" : "Add income"}
        </button>
        <p
          aria-live="polite"
          className={`text-sm transition-opacity duration-200 ${
            saveState === "idle" ? "opacity-0" : saveState === "error" ? "text-rose-200" : "text-teal-200"
          }`}
        >
          {saveState === "error" ? "Could not save. Check the fields and try again." : saveState === "saved" ? "Income saved." : "Updating account balance..."}
        </p>
      </div>
    </form>
  );
}

function incomeFrequencyHelper(frequency: IncomeFrequency) {
  if (frequency === "weekly") {
    return "Included as weekly recurring income in the monthly outlook.";
  }

  if (frequency === "biweekly") {
    return "Included as biweekly recurring income in the monthly outlook.";
  }

  if (frequency === "monthly") {
    return "Included as monthly recurring income in the monthly outlook.";
  }

  return "Counted for the selected month only.";
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
