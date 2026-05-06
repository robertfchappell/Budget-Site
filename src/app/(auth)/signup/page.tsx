import Link from "next/link";
import { redirect } from "next/navigation";
import { Banknote, CalendarDays, PiggyBank, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { SignupForm } from "@/components/signup-form";
import { getCurrentUser } from "@/lib/auth";
import { getInvitePreview } from "@/app/(auth)/signup/actions";
import { displayDate } from "@/lib/dates";

export default async function SignupPage({
  searchParams
}: {
  searchParams?: Promise<{ invite?: string }>;
}) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const inviteToken = String(params?.invite ?? "");
  const invite = inviteToken ? await getInvitePreview(inviteToken) : null;
  const inviteUnavailable =
    inviteToken &&
    (!invite || invite.accepted_at || invite.revoked_at || invite.expired);

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="auth-ambient" aria-hidden />
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="relative z-10 py-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-teal-300/10 px-3 py-1.5 text-sm font-semibold text-teal-100 shadow-[0_0_28px_rgba(45,212,191,0.12)]">
            <Sparkles aria-hidden size={15} />
            Shared household budgeting
          </div>

          <h1 className="mt-6 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Track every dollar together.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
            Plan bills, savings, paychecks, and shared cash in one private family budget built for the way real households move money.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Feature icon={CalendarDays} title="Bill Planning" text="Recurring bills, due dates, and paid status stay visible." />
            <Feature icon={Banknote} title="Income Types" text="Paychecks, VA benefits, grants, loans, and bonuses stay separate." />
            <Feature icon={PiggyBank} title="Savings Goals" text="Emergency funds and transfers sync into projections." />
          </div>

          <div className="auth-dashboard-preview mt-8 max-w-2xl rounded-lg border border-slate-700/70 bg-slate-950/70 p-4 shadow-2xl shadow-teal-950/20">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-md bg-teal-400/15 text-teal-200">
                  <WalletCards aria-hidden size={20} />
                </span>
                <div>
                  <p className="font-bold text-white">Household snapshot</p>
                  <p className="text-sm text-slate-400">Private, self-hosted, ready for two users</p>
                </div>
              </div>
              <ShieldCheck aria-hidden className="text-teal-200" size={20} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Checking", "$4,850"],
                ["Upcoming bills", "$1,420"],
                ["Savings", "$2,500"]
              ].map(([label, value]) => (
                <div className="rounded-md border border-slate-800 bg-slate-900/75 p-3" key={label}>
                  <p className="text-xs font-semibold text-slate-400">{label}</p>
                  <p className="mt-2 text-xl font-bold text-white">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="auth-progress h-full rounded-full bg-teal-300" />
            </div>
          </div>
        </div>

        <aside className="relative z-10">
          <div className="rounded-lg border border-slate-700/70 bg-slate-900/86 p-5 shadow-2xl shadow-black/35 backdrop-blur sm:p-7">
            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-300">
                Household access
              </p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {invite ? `Join ${invite.household_name}` : "Create your account"}
              </h2>
              {invite ? (
                <p className="mt-2 text-sm text-slate-400">
                  Invite for {invite.invited_email} expires {displayDate(invite.expires_at)}.
                </p>
              ) : (
                <p className="mt-2 text-sm text-slate-400">
                  Start a household, then invite your spouse or partner from Settings.
                </p>
              )}
            </div>

            {inviteUnavailable ? (
              <div className="rounded-md border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
                This invite is not available. Ask your household to create a fresh invite.
              </div>
            ) : (
              <SignupForm
                householdName={invite?.household_name ?? ""}
                inviteToken={inviteToken}
                invitedEmail={invite?.invited_email ?? ""}
                invitedRole={invite?.invited_role ?? "wife"}
              />
            )}

            <p className="mt-6 text-center text-sm text-slate-400">
              Already have an account?{" "}
              <Link className="font-semibold text-teal-200 transition hover:text-teal-100" href="/login">
                Sign in
              </Link>
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}

function Feature({
  icon: Icon,
  title,
  text
}: {
  icon: typeof CalendarDays;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-lg border border-slate-700/70 bg-slate-900/64 p-4 shadow-lg shadow-black/10 backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:border-teal-300/35">
      <Icon aria-hidden className="text-teal-200" size={19} />
      <p className="mt-3 font-bold text-white">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-400">{text}</p>
    </div>
  );
}
