import Link from "next/link";
import { redirect } from "next/navigation";
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
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="panel w-full max-w-md p-6 sm:p-8">
        <div className="mb-7">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-300">
            Household access
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
            {invite ? `Join ${invite.household_name}` : "Create your account"}
          </h1>
          {invite ? (
            <p className="mt-2 text-sm text-slate-400">
              Invite for {invite.invited_email} expires {displayDate(invite.expires_at)}.
            </p>
          ) : null}
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
          <Link className="font-semibold text-teal-200 hover:text-teal-100" href="/login">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
