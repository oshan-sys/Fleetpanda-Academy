import { requireAdminPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import RoleToggle from "@/components/admin/RoleToggle";

export default async function ManageAdminsPage() {
  const me = await requireAdminPage();

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      createdAt: true,
    },
  });
  const adminCount = users.filter((u) => u.role === "ADMIN").length;

  return (
    <div className="mx-auto max-w-3xl px-10 py-10">
      <h1 className="text-[26px] font-semibold tracking-tight">Admins</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Everyone who has signed in at least once. Admins can manage courses,
        assignments, and reports.
      </p>

      <div className="mt-7 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {users.map((u) => (
          <div
            key={u.id}
            className="flex items-center gap-3.5 border-b border-neutral-100 px-5 py-3.5 last:border-b-0"
          >
            {u.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={u.image}
                alt=""
                className="h-9 w-9 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-600">
                {(u.name ?? u.email ?? "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">
                  {u.name ?? "Unnamed"}
                </span>
                {u.id === me.id && (
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
                    You
                  </span>
                )}
                {u.role === "ADMIN" && (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-800">
                    Admin
                  </span>
                )}
              </div>
              <div className="truncate text-xs text-neutral-500">{u.email}</div>
            </div>
            <RoleToggle
              userId={u.id}
              role={u.role}
              isLastAdmin={u.role === "ADMIN" && adminCount <= 1}
              isSelf={u.id === me.id}
            />
          </div>
        ))}
        {users.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-neutral-500">
            Nobody has signed in yet.
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-neutral-400">
        Emails in <code className="rounded bg-neutral-100 px-1 py-0.5">INITIAL_ADMIN_EMAILS</code>{" "}
        are re-promoted to admin automatically on every sign-in, so there is
        always at least one admin.
      </p>
    </div>
  );
}
