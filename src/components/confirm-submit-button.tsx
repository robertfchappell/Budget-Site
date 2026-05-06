"use client";

import { useRef, useState, type ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";

export function ConfirmSubmitButton({
  children,
  message,
  className = "secondary-button"
}: {
  children: ReactNode;
  message: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        className={className}
        onClick={() => setOpen(true)}
        ref={buttonRef}
        type="button"
      >
        {children}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/75 px-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-950 p-5 shadow-2xl shadow-black/45">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-md bg-rose-400/12 text-rose-200">
                  <AlertTriangle aria-hidden size={20} />
                </span>
                <div>
                  <h3 className="font-bold text-white">Confirm action</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-300">{message}</p>
                </div>
              </div>
              <button
                aria-label="Close confirmation"
                className="grid size-9 place-items-center rounded-md border border-slate-700 text-slate-300 hover:bg-slate-900"
                onClick={() => setOpen(false)}
                type="button"
              >
                <X aria-hidden size={17} />
              </button>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="secondary-button" onClick={() => setOpen(false)} type="button">
                Cancel
              </button>
              <button
                className="secondary-button border-rose-400/35 bg-rose-500/10 text-rose-100 hover:bg-rose-500/18"
                onClick={() => {
                  setOpen(false);
                  buttonRef.current?.closest("form")?.requestSubmit();
                }}
                type="button"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
