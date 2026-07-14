"use client";

import { useState, useTransition } from "react";
import { setUserRole } from "@/lib/actions/admin";

export default function RoleToggle({
  userId,
  role,
  isLastAdmin,
  isSelf,
}: {
  userId: string;
  role: string;
  isLastAdmin: boolean;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isAdmin = role === "ADMIN";
  const blocked = isAdmin && isLastAdmin;

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setUserRole(userId, isAdmin ? "LEARNER" : "ADMIN");
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={toggle}
        disabled={pending || blocked}
        title={
          blocked
            ? "You can't demote the last remaining admin."
            : isAdmin
              ? `Make ${isSelf ? "yourself" : "this person"} a learner`
              : "Make this person an admin"
        }
        className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
          isAdmin
            ? "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
            : "border-brand-600 bg-brand-600 text-white hover:bg-brand-700"
        }`}
      >
        {pending ? "Saving…" : isAdmin ? "Demote to learner" : "Promote to admin"}
      </button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
      {blocked && !error && (
        <span className="text-[11px] text-neutral-400">Last admin</span>
      )}
    </div>
  );
}
