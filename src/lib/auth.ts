import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

function initialAdminEmails(): string[] {
  return (process.env.INITIAL_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  trustHost: true,
  providers: [Google],
  pages: { signIn: "/signin" },
  events: {
    // Bootstrap admins: anyone listed in INITIAL_ADMIN_EMAILS becomes ADMIN on
    // every sign-in, regardless of the current database value. This guarantees
    // there is always at least one real admin without hand-editing the DB.
    async signIn({ user }) {
      if (
        user.id &&
        user.email &&
        initialAdminEmails().includes(user.email.toLowerCase())
      ) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: "ADMIN" },
        });
      }
    },
  },
  callbacks: {
    async session({ session, user }) {
      // Database session strategy: `user` is the fresh DB record, so role
      // changes (promote/demote) take effect on the next request.
      session.user.id = user.id;
      session.user.role = (user as { role?: string }).role ?? "LEARNER";
      return session;
    },
  },
});
