"use client";

import { useActionState, useState, useTransition } from "react";
import { AlertTriangle, Copy, Link2, RefreshCcw, Send, Trash2, UserMinus, X } from "lucide-react";
import {
  createHouseholdInvite,
  removeHouseholdMember,
  resendHouseholdInvite,
  revokeHouseholdInvite,
  type InviteState
} from "@/app/(app)/settings/actions";
import { displayDate } from "@/lib/dates";
import { userRoleDisplayLabel } from "@/lib/display-labels";
import type { HouseholdInvite, HouseholdMember } from "@/lib/types";

const initialState: InviteState = {};

type Toast = {
  tone: "success" | "error";
  message: string;
};

type ConfirmState = {
  title: string;
  message: string;
  tone?: "danger" | "default";
  confirmLabel: string;
  onConfirm: () => void;
};

export function HouseholdInvites({
  members,
  invites,
  currentUserId
}: {
  members: HouseholdMember[];
  invites: HouseholdInvite[];
  currentUserId: string;
}) {
  const [state, formAction, pending] = useActionState(createHouseholdInvite, initialState);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [suppressActionToast, setSuppressActionToast] = useState(false);
  const [pendingMutation, startMutation] = useTransition();
  const [hiddenInviteIds, setHiddenInviteIds] = useState<Set<string>>(new Set());
  const [removedMemberIds, setRemovedMemberIds] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [latestInviteUrl, setLatestInviteUrl] = useState("");

  const visibleInvites = invites.filter((invite) => !hiddenInviteIds.has(invite.id));
  const visibleMembers = members.filter((member) => !removedMemberIds.has(member.id));

  function showToast(tone: Toast["tone"], message: string) {
    setSuppressActionToast(true);
    setToast({ tone, message });
    window.setTimeout(() => setToast(null), 4200);
  }

  function revokeInvite(invite: HouseholdInvite) {
    setConfirm({
      title: "Revoke invite",
      message: `Cancel the pending invite for ${invite.invitedEmail}? The existing invite link will stop working immediately.`,
      tone: "danger",
      confirmLabel: "Revoke invite",
      onConfirm: () => {
        setHiddenInviteIds((current) => new Set(current).add(invite.id));
        startMutation(async () => {
          const formData = new FormData();
          formData.set("inviteId", invite.id);
          const result = await revokeHouseholdInvite(formData);

          if (result.ok) {
            showToast("success", result.message ?? "Invite revoked.");
          } else {
            setHiddenInviteIds((current) => {
              const next = new Set(current);
              next.delete(invite.id);
              return next;
            });
            showToast("error", result.error ?? "Invite could not be revoked.");
          }
        });
      }
    });
  }

  function resendInvite(invite: HouseholdInvite) {
    startMutation(async () => {
      const formData = new FormData();
      formData.set("inviteId", invite.id);
      formData.set("expiresInDays", "7");
      const result = await resendHouseholdInvite(formData);

      if (result.ok && result.inviteUrl) {
        setLatestInviteUrl(result.inviteUrl);
        setCopied(false);
        showToast("success", result.message ?? "Invite resent.");
      } else {
        showToast("error", result.error ?? "Invite could not be resent.");
      }
    });
  }

  function removeMember(member: HouseholdMember) {
    setConfirm({
      title: "Remove member",
      message: `Remove ${member.name} from this household? They will lose access, but their historical transactions remain in reports.`,
      tone: "danger",
      confirmLabel: "Remove member",
      onConfirm: () => {
        setRemovedMemberIds((current) => new Set(current).add(member.id));
        startMutation(async () => {
          const formData = new FormData();
          formData.set("memberId", member.id);
          const result = await removeHouseholdMember(formData);

          if (result.ok) {
            showToast("success", result.message ?? "Member removed.");
          } else {
            setRemovedMemberIds((current) => {
              const next = new Set(current);
              next.delete(member.id);
              return next;
            });
            showToast("error", result.error ?? "Member could not be removed.");
          }
        });
      }
    });
  }

  const inviteUrl = latestInviteUrl;
  const actionToast =
    toast ??
    (!suppressActionToast && state.error ? { tone: "error" as const, message: state.error } : null) ??
    (!suppressActionToast && state.message ? { tone: "success" as const, message: state.message } : null);
  const displayedInviteUrl = inviteUrl || state.inviteUrl || "";

  return (
    <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
      {actionToast ? <ToastMessage toast={actionToast} /> : null}
      {confirm ? <ConfirmModal confirm={confirm} onClose={() => setConfirm(null)} /> : null}

      <article className="panel p-4">
        <div className="mb-4 flex items-center gap-2">
          <Send aria-hidden className="text-teal-300" size={18} />
          <h2 className="text-lg font-bold text-white">Invite Household Member</h2>
        </div>
        <form action={formAction} className="grid gap-3" onSubmit={() => setSuppressActionToast(false)}>
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
          <button className="primary-button" disabled={pending || pendingMutation} type="submit">
            <Send aria-hidden size={16} />
            {pending ? "Creating invite" : "Create invite"}
          </button>
        </form>

        {displayedInviteUrl ? (
          <div className="mt-4 rounded-md border border-teal-400/30 bg-teal-500/10 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-teal-100">
              <Link2 aria-hidden size={16} />
              Latest invite link
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input className="field" readOnly value={displayedInviteUrl} />
              <button
                className="secondary-button"
                onClick={async () => {
                  await navigator.clipboard.writeText(displayedInviteUrl);
                  setCopied(true);
                  showToast("success", "Invite link copied.");
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
              {visibleMembers.map((member) => (
                <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3 transition duration-200" key={member.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{member.name}</p>
                      <p className="text-sm text-slate-400">{member.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="badge">{userRoleDisplayLabel(member.role)}</span>
                      {member.id !== currentUserId ? (
                        <button
                          aria-label={`Remove ${member.name}`}
                          className="grid size-9 place-items-center rounded-md border border-rose-400/30 text-rose-100 transition hover:bg-rose-500/10"
                          disabled={pendingMutation}
                          onClick={() => removeMember(member)}
                          type="button"
                        >
                          <UserMinus aria-hidden size={16} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
              {!visibleMembers.length ? (
                <p className="rounded-md border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                  No active household members.
                </p>
              ) : null}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase text-slate-400">Pending Invites</h3>
            <div className="mt-3 space-y-2">
              {visibleInvites.length ? (
                visibleInvites.map((invite) => (
                  <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3 transition duration-200" key={invite.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{invite.invitedEmail}</p>
                        <p className="text-sm text-slate-400">
                          {userRoleDisplayLabel(invite.invitedRole)} - expires {displayDate(invite.expiresAt)}
                        </p>
                      </div>
                      <span className="badge">Pending</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="secondary-button"
                        disabled={pendingMutation}
                        onClick={() => resendInvite(invite)}
                        type="button"
                      >
                        <RefreshCcw aria-hidden size={16} />
                        Resend
                      </button>
                      <button
                        className="secondary-button border-rose-400/30 text-rose-100"
                        disabled={pendingMutation}
                        onClick={() => revokeInvite(invite)}
                        type="button"
                      >
                        <Trash2 aria-hidden size={16} />
                        Revoke
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-md border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                  No pending invites.
                </p>
              )}
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}

function ToastMessage({ toast }: { toast: Toast }) {
  return (
    <div className="fixed right-4 top-4 z-[80] w-[min(360px,calc(100vw-2rem))] rounded-lg border border-slate-700 bg-slate-950/96 p-3 shadow-2xl shadow-black/45 backdrop-blur">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 size-2.5 rounded-full ${
            toast.tone === "success" ? "bg-teal-300" : "bg-rose-300"
          }`}
        />
        <p className="text-sm font-semibold text-white">{toast.message}</p>
      </div>
    </div>
  );
}

function ConfirmModal({
  confirm,
  onClose
}: {
  confirm: ConfirmState;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/75 px-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-950 p-5 shadow-2xl shadow-black/45">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`grid size-10 place-items-center rounded-md ${confirm.tone === "danger" ? "bg-rose-400/12 text-rose-200" : "bg-teal-400/12 text-teal-200"}`}>
              <AlertTriangle aria-hidden size={20} />
            </span>
            <div>
              <h3 className="font-bold text-white">{confirm.title}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-300">{confirm.message}</p>
            </div>
          </div>
          <button
            aria-label="Close confirmation"
            className="grid size-9 place-items-center rounded-md border border-slate-700 text-slate-300 hover:bg-slate-900"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden size={17} />
          </button>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className="secondary-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="secondary-button border-rose-400/35 bg-rose-500/10 text-rose-100 hover:bg-rose-500/18"
            onClick={() => {
              onClose();
              confirm.onConfirm();
            }}
            type="button"
          >
            {confirm.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
