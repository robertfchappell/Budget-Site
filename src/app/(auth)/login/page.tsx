import { redirect } from "next/navigation";
import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }
  const showDemoCredentials = process.env.SHOW_DEMO_CREDENTIALS === "true";

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="panel w-full max-w-md p-6 sm:p-8">
        <div className="mb-7">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-300">
            Household
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
            Family Budget
          </h1>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-sm text-slate-400">
          New household?{" "}
          <Link className="font-semibold text-teal-200 hover:text-teal-100" href="/signup">
            Create an account
          </Link>
        </p>
        {showDemoCredentials ? (
          <div className="mt-6 rounded-md border border-slate-700/70 bg-slate-950/45 p-3 text-sm text-slate-300">
            Demo users: <span className="font-semibold text-slate-100">husband@example.com</span> and{" "}
            <span className="font-semibold text-slate-100">wife@example.com</span>
          </div>
        ) : null}
      </section>
    </main>
  );
}
