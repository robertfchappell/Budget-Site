"use client";

import { useActionState, useState } from "react";
import { Copy, Link2, Send, Trash2 } from "lucide-react";
import {
  createHouseholdInvite,
  revokeHouseholdInvite,
  type InviteState
} from "@/app/(app)/settings/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { displayDate } from "@/lib/dates";
import type { HouseholdInvite, HouseholdMember } from "@/lib/types";

const initialState: InviteState = {};

export function HouseholdInvites({
  members,
  invites
}: {
  members: HouseholdMember[];
  invites: HouseholdInvite[];
}) {
  const [state, formAction, pending] = useActionState(createHouseholdInvite, initialState);
  const [copied, setCopied] = useState(false);

  return (
    <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
      <article className="panel p-4">
        <div className="mb-4 flex items-center gap-2">
          <Send aria-hidden className="text-teal-300" size={18} />
          <h2 className="text-lg font-bold text-white">Invite Household Member</h2>
        </div>
        <form action={formAction} className="grid gap-3">
          <div>
            <label className="label" htmlFor="invitedEmail">
              Email
            </label>
            <input className="field" id="invitedEmail" name="invitedEmail" required type="email" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="invitedRole">
                Role
              </label>
              <select className="field" defaultValue="wife" id="invitedRole" name="invitedRole">
                <option value="husband">Husband</option>
                <option value="wife">Wife</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="expiresInDays">
                Expires
              </label>
              <select className="field" defaultValue="7" id="expiresInDays" name="expiresInDays">
                <option value="1">1 day</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
            </div>
          </div>
          {state.error ? (
            <p className="rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
              {state.error}
            </p>
          ) : null}
          <button className="primary-button" disabled={pending} type="submit">
            <Send aria-hidden size={16} />
            {pending ? "Creating invite" : "Create invite"}
          </button>
        </form>

        {state.inviteUrl ? (
          <div className="mt-4 rounded-md border border-teal-400/30 bg-teal-500/10 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-teal-100">
              <Link2 aria-hidden size={16} />
              Invite link
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input className="field" readOnly value={state.inviteUrl} />
              <button
                className="secondary-button"
                onClick={async () => {
                  await navigator.clipboard.writeText(state.inviteUrl ?? "");
                  setCopied(true);
                }}
                type="button"
              >
                <Copy aria-hidden size={16} />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        ) : null}
      </article>

      <article className="panel p-4">
        <h2 className="text-lg font-bold text-white">Household Access</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-bold uppercase text-slate-400">Members</h3>
            <div className="mt-3 space-y-2">
              {members.map((member) => (
                <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3" key={member.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{member.name}</p>
                      <p className="text-sm text-slate-400">{member.email}</p>
                    </div>
                    <span className="badge capitalize">{member.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase text-slate-400">Invites</h3>
            <div className="mt-3 space-y-2">
              {invites.length ? (
                invites.map((invite) => {
                  const status = invite.acceptedAt
                    ? "accepted"
                    : invite.revokedAt
                      ? "revoked"
                      : "pending";

                  return (
                    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3" key={invite.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{invite.invitedEmail}</p>
                          <p className="text-sm text-slate-400">
                            {invite.invitedRole} - expires {displayDate(invite.expiresAt)}
                          </p>
                        </div>
                        <span className="badge capitalize">{status}</span>
                      </div>
                      {!invite.acceptedAt && !invite.revokedAt ? (
                        <form action={revokeHouseholdInvite} className="mt-3">
                          <input name="inviteId" type="hidden" value={invite.id} />
                          <ConfirmSubmitButton className="secondary-button border-rose-400/30 text-rose-100" message={`Revoke invite for ${invite.invitedEmail}?`}>
                            <Trash2 aria-hidden size={16} />
                            Revoke
                          </ConfirmSubmitButton>
                        </form>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <p className="rounded-md border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                  No household invites have been created yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}
