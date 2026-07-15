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
  providers: [
    Google({
      authorization: {
        params: {
          // drive.readonly lets the app fetch lesson docs with the viewer's
          // own Google access, so restricted docs render in-app for anyone
          // who can open them in Drive. The forms scopes let admins register
          // quizzes by edit link and pull scored responses into Reports.
          scope:
            "openid email profile https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/forms.body.readonly https://www.googleapis.com/auth/forms.responses.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  pages: { signIn: "/signin" },
  events: {
    async signIn({ user, account }) {
      // Bootstrap admins: anyone listed in INITIAL_ADMIN_EMAILS becomes ADMIN
      // on every sign-in, regardless of the current database value. This
      // guarantees there is always at least one real admin without
      // hand-editing the DB.
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
      // The adapter only stores tokens when the account is first linked —
      // persist fresh ones on every sign-in so Drive access keeps working.
      if (user.id && account?.provider === "google") {
        await prisma.account.updateMany({
          where: { userId: user.id, provider: "google" },
          data: {
            access_token: account.access_token,
            expires_at: account.expires_at,
            refresh_token: account.refresh_token ?? undefined,
            scope: account.scope,
          },
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
