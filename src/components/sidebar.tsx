import Link from "next/link";
import {
  Banknote,
  CalendarDays,
  Download,
  LayoutDashboard,
  LogOut,
  PiggyBank,
  ReceiptText,
  Settings,
  WalletCards
} from "lucide-react";
import { logoutAction } from "@/app/(app)/actions";
import type { UserContext } from "@/lib/types";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/bills", label: "Bills", icon: CalendarDays },
  { href: "/income", label: "Income", icon: Banknote },
  { href: "/expenses", label: "Expenses", icon: ReceiptText },
  { href: "/planning", label: "Planning", icon: PiggyBank },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function Sidebar({ user }: { user: UserContext }) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-slate-800 bg-slate-950/92 px-4 py-5 md:flex md:flex-col">
        <Link href="/dashboard" className="flex items-center gap-3 px-2">
          <span className="grid size-10 place-items-center rounded-md bg-teal-500/15 text-teal-300">
            <WalletCards aria-hidden size={21} />
          </span>
          <span>
            <span className="block text-base font-bold text-white">Family Budget</span>
            <span className="block text-xs text-slate-400">{user.householdName}</span>
          </span>
        </Link>

        <nav className="mt-8 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-800/70 hover:text-white"
                href={item.href}
                key={item.href}
              >
                <Icon aria-hidden size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-slate-800 pt-4">
          <div className="mb-3 px-2">
            <p className="text-sm font-semibold text-white">{user.name}</p>
            <p className="text-xs capitalize text-slate-400">{user.role}</p>
          </div>
          <form action={logoutAction}>
            <button className="secondary-button w-full" type="submit">
              <LogOut aria-hidden size={17} />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/92 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-white">
            <WalletCards aria-hidden size={19} />
            Family Budget
          </Link>
          <form action={logoutAction}>
            <button
              aria-label="Sign out"
              className="grid size-9 place-items-center rounded-md border border-slate-700 text-slate-200"
              type="submit"
            >
              <LogOut aria-hidden size={17} />
            </button>
          </form>
        </div>
        <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                className="inline-flex shrink-0 items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300"
                href={item.href}
                key={item.href}
              >
                <Icon aria-hidden size={15} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
