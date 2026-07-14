import Sidebar from "@/components/Sidebar";
import { requireUser } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen">
      <Sidebar
        name={user.name ?? "Learner"}
        email={user.email ?? ""}
        image={user.image}
        isAdmin={user.role === "ADMIN"}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
