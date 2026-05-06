"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { signupAction, type SignupState } from "@/app/(auth)/signup/actions";

const initialState: SignupState = {};

export function SignupForm({
  inviteToken = "",
  invitedEmail = "",
  invitedRole = "wife",
  householdName = ""
}: {
  inviteToken?: string;
  invitedEmail?: string;
  invitedRole?: "husband" | "wife";
  householdName?: string;
}) {
  const [state, formAction, pending] = useActionState(signupAction, initialState);
  const isInvite = Boolean(inviteToken);

  return (
    <form action={formAction} className="space-y-4">
      <input name="inviteToken" type="hidden" value={inviteToken} />
      <div>
        <label className="label" htmlFor="name">
          Name
        </label>
        <input className="field" id="name" name="name" required autoComplete="name" />
      </div>
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          className="field"
          defaultValue={invitedEmail}
          id="email"
          name="email"
          readOnly={isInvite && Boolean(invitedEmail)}
          required
          type="email"
          autoComplete="email"
        />
      </div>
      {isInvite ? (
        <input name="householdName" type="hidden" value={householdName} />
      ) : (
        <div>
          <label className="label" htmlFor="householdName">
            Household name
          </label>
          <input className="field" id="householdName" name="householdName" required />
        </div>
      )}
      {isInvite ? (
        <input name="role" type="hidden" value={invitedRole} />
      ) : (
        <div>
          <label className="label" htmlFor="role">
            Household role
          </label>
          <select className="field" defaultValue="husband" id="role" name="role">
            <option value="husband">Husband</option>
            <option value="wife">Wife</option>
          </select>
        </div>
      )}
      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          className="field"
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="confirmPassword">
          Confirm password
        </label>
        <input
          className="field"
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      {state.error ? (
        <p className="rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {state.error}
        </p>
      ) : null}
      <button className="primary-button w-full" disabled={pending} type="submit">
        <UserPlus aria-hidden size={18} />
        {pending ? "Creating account" : isInvite ? "Accept invite" : "Create household"}
      </button>
    </form>
  );
}
