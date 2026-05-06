import { Download, Plus, ReceiptText, Save, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { BudgetTrendChart, CategoryDonut } from "@/components/charts";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { createExpense, deleteExpense, importExpensesCsv, updateExpense } from "@/app/(app)/expenses/actions";
import { getExpensesPageData } from "@/lib/budget/data";
import { requireUser } from "@/lib/auth";
import { displayDate, todayIso } from "@/lib/dates";
import { dollars } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const user = await requireUser();
  const data = await getExpensesPageData(user.householdId);
  const defaultExpenseAccountId =
    data.accounts.find((account) => account.type === "checking")?.id ?? data.accounts[0]?.id ?? "";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-300">
          Transactions
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Expenses</h1>
      </div>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <form action={createExpense} className="panel p-4">
          <div className="mb-4 flex items-center gap-2">
            <Plus aria-hidden className="text-teal-300" size={19} />
            <h2 className="text-lg font-bold text-white">Quick Expense</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Amount" name="amount" required step="0.01" type="number" />
            <Field label="Merchant" name="merchant" required />
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
            <Field defaultValue={todayIso()} label="Date" name="expenseDate" required type="date" />
            <div>
              <label className="label" htmlFor="paymentMethod">
                Payment method
              </label>
              <select className="field" id="paymentMethod" name="paymentMethod" defaultValue="debit">
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
                <option value="cash">Cash</option>
                <option value="ach">ACH</option>
                <option value="check">Check</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="accountId">
                Account
              </label>
              <select className="field" defaultValue={defaultExpenseAccountId} id="accountId" name="accountId">
                <option value="">Manual / no balance update</option>
                {data.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="notes">
                Notes
              </label>
              <input className="field" id="notes" name="notes" />
            </div>
          </div>
          <button className="primary-button mt-4" type="submit">
            <ReceiptText aria-hidden size={17} />
            Add expense
          </button>
        </form>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-1">
          <article className="panel p-4">
            <h2 className="text-lg font-bold text-white">Category Mix</h2>
            <p className="text-sm text-slate-400">{data.month.label}</p>
            <CategoryDonut data={data.byCategory} />
          </article>
          <article className="panel p-4">
            <h2 className="text-lg font-bold text-white">CSV Import</h2>
            <form action={importExpensesCsv} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="file">
                  CSV file
                </label>
                <input
                  accept=".csv,text/csv"
                  className="field file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-slate-100"
                  id="file"
                  name="file"
                  required
                  type="file"
                />
              </div>
              <select className="field" defaultValue={defaultExpenseAccountId} name="accountId">
                <option value="">Manual / no balance update</option>
                {data.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
              <button className="secondary-button" type="submit">
                <Upload aria-hidden size={16} />
                Import
              </button>
            </form>
            <Link className="secondary-button mt-3" href="/api/export/expenses" prefetch={false}>
              <Download aria-hidden size={16} />
              Export expenses
            </Link>
          </article>
        </div>
      </section>

      <article className="panel p-4">
        <h2 className="text-lg font-bold text-white">Spending Trend</h2>
        <BudgetTrendChart data={data.trend} />
      </article>

      <article className="panel overflow-hidden">
        <div className="border-b border-slate-800 p-4">
          <h2 className="text-lg font-bold text-white">Recent Expenses</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-950/60 text-xs uppercase text-slate-500">
              <tr>
                <th className="table-cell">Date</th>
                <th className="table-cell">Merchant</th>
                <th className="table-cell">Category</th>
                <th className="table-cell">Method</th>
                <th className="table-cell">Account</th>
                <th className="table-cell">Amount</th>
                <th className="table-cell">By</th>
                <th className="table-cell">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.expenses.map((expense) => (
                <tr key={expense.id}>
                  <td className="table-cell text-slate-300">{displayDate(expense.expenseDate)}</td>
                  <td className="table-cell font-semibold text-white">{expense.merchant}</td>
                  <td className="table-cell text-slate-300">{expense.categoryName ?? "Uncategorized"}</td>
                  <td className="table-cell">
                    <span className="badge capitalize">{expense.paymentMethod}</span>
                  </td>
                  <td className="table-cell text-slate-300">{expense.accountName ?? "Manual"}</td>
                  <td className="table-cell font-bold text-rose-200">{dollars(expense.amount)}</td>
                  <td className="table-cell text-slate-300">{expense.userName}</td>
                  <td className="table-cell">
                    <details>
                      <summary className="secondary-button cursor-pointer">Edit</summary>
                      <div className="mt-3 w-[min(680px,calc(100vw-3rem))] rounded-md border border-slate-800 bg-slate-950 p-3">
                        <form action={updateExpense} className="grid gap-3 sm:grid-cols-2">
                          <input name="expenseId" type="hidden" value={expense.id} />
                          <Field defaultValue={expense.amount} label="Amount" name="amount" required step="0.01" type="number" />
                          <Field defaultValue={expense.merchant} label="Merchant" name="merchant" required />
                          <select className="field" defaultValue={expense.categoryId ?? ""} name="categoryId">
                            <option value="">Uncategorized</option>
                            {data.categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                          <Field defaultValue={expense.expenseDate} label="Date" name="expenseDate" required type="date" />
                          <select className="field" defaultValue={expense.paymentMethod} name="paymentMethod">
                            <option value="debit">Debit</option>
                            <option value="credit">Credit</option>
                            <option value="cash">Cash</option>
                            <option value="ach">ACH</option>
                            <option value="check">Check</option>
                            <option value="other">Other</option>
                          </select>
                          <select className="field" defaultValue={expense.accountId ?? ""} name="accountId">
                            <option value="">Manual / no balance update</option>
                            {data.accounts.map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.name}
                              </option>
                            ))}
                          </select>
                          <div className="sm:col-span-2">
                            <Field defaultValue={expense.notes ?? ""} label="Notes" name="notes" />
                          </div>
                          <button className="secondary-button" type="submit">
                            <Save aria-hidden size={16} />
                            Save
                          </button>
                        </form>
                        <form action={deleteExpense} className="mt-2">
                          <input name="expenseId" type="hidden" value={expense.id} />
                          <ConfirmSubmitButton className="secondary-button border-rose-400/30 text-rose-100" message={`Delete expense at ${expense.merchant}?`}>
                            <Trash2 aria-hidden size={16} />
                            Delete
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
              {!data.expenses.length ? (
                <tr>
                  <td className="table-cell text-slate-400" colSpan={8}>
                    No expenses have been entered yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
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
