# FleetPanda Academy — internal training LMS

A lightweight internal training platform (TalentLMS/Docebo-inspired) built with:

- **Next.js 16** (App Router) + TypeScript
- **NextAuth v5** with Google sign-in (database sessions)
- **Prisma 7** + SQLite for local dev (swappable to Postgres)
- **Tailwind CSS 4**

Content lives in **Google Docs** and **Loom** — paste a link on a lesson and it
embeds automatically.

## Quick start

```bash
npm install
npx prisma migrate dev   # creates dev.db and applies the schema
npm run db:seed          # loads 3 sample courses (skips if data exists)
npm run dev              # http://localhost:3000
```

You'll land on the sign-in page. Before Google sign-in works you need OAuth
credentials — follow the next section once.

## Google Cloud Console setup (one-time, ~5 minutes)

1. Go to <https://console.cloud.google.com/> and pick (or create) a project,
   e.g. **FleetPanda Academy**.
2. **APIs & Services → OAuth consent screen** (a.k.a. *Google Auth Platform → Branding*):
   - User type: **Internal** if your org uses Google Workspace (only fleetpanda.com
     accounts can sign in — recommended). Otherwise **External**.
   - App name: `FleetPanda Academy`, add your support email, save.
   - No extra scopes are needed — the defaults (openid, email, profile) are enough.
3. **APIs & Services → Credentials → + Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Name: `FleetPanda Academy (dev)`
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
   - Click **Create**, then copy the **Client ID** and **Client Secret**.
4. Put them in `.env` (copy `.env.example` to `.env` if you don't have one):

   ```env
   AUTH_GOOGLE_ID="<your client id>.apps.googleusercontent.com"
   AUTH_GOOGLE_SECRET="<your client secret>"
   ```

5. Set `AUTH_SECRET` (any random string; generate one with
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).

6. Set your admin email(s):

   ```env
   INITIAL_ADMIN_EMAILS="you@fleetpanda.com,other@fleetpanda.com"
   ```

   Anyone on this list is forced to **ADMIN** on every sign-in, so there is
   always at least one real admin. Everyone else starts as a **LEARNER**.

7. Restart `npm run dev` and sign in.

When you deploy, create a second OAuth client (or add the production URL to
this one) with origin `https://your-domain` and redirect URI
`https://your-domain/api/auth/callback/google`.

## How it works

### Roles & access

- Two roles: `ADMIN` and `LEARNER`, stored on the `User` row.
- First sign-in creates the user (Google account only — no passwords).
- Admins manage roles at **Admins** in the sidebar; the last remaining admin
  cannot be demoted (enforced in the UI *and* the server action).
- All `/admin` pages and admin server actions check the session role
  **server-side** — hiding the nav is not the security boundary.

### Content model

```
Course → Module (ordered) → Lesson (ordered, READING | VIDEO | MIXED)
Assignment  — restricts a course to specific users (none = open to everyone)
Progress    — one row per user per completed lesson
```

### Content links

On a lesson, paste either link type into the single "Add content" field:

- **Google Doc** — a shareable `/document/d/<id>/edit` link or a *File →
  Share → Publish to web* link. Shareable links are fetched **server-side
  with the viewer's own Google credentials** (the app requests the
  `drive.readonly` scope at sign-in) and rendered inline as a PDF, so
  restricted docs display for anyone who can open them in Drive — no
  sharing-settings changes needed. This requires the **Google Drive API**
  to be enabled in the same Google Cloud project as the OAuth client:
  <https://console.cloud.google.com/apis/library/drive.googleapis.com>.
  The lesson page always shows an **Open in Google Docs** fallback.
- **Loom** — a `loom.com/share/<id>` link; the video id is extracted and
  embedded as `loom.com/embed/<id>`.
- **Google Form (quiz)** — paste the form's **edit link**
  (`docs.google.com/forms/d/<id>/edit`). The app **imports the form's
  questions and answer key** via the Forms API (using the pasting admin's
  credentials) and renders the quiz **natively in the lesson page**:
  learners answer in-app with no Google sign-in wall, grading happens
  server-side against the imported answer key, submitting auto-completes
  the lesson, and scores land in **Reports** straight from the app's
  database. Author the form as a quiz (**Settings → Make this a quiz**)
  with answer keys and point values; re-paste the link after editing the
  form to re-import. Requires the **Google Forms API** enabled in the
  Cloud project:
  <https://console.cloud.google.com/apis/library/forms.googleapis.com>.
  Supported question types: multiple choice, checkboxes, dropdown, short
  answer, paragraph (paragraph answers aren't auto-graded). Published
  `/forms/d/e/…` links fall back to a plain Google Form embed with
  API-based results.

A lesson with a form becomes **QUIZ**; one holding a doc and a video becomes
**MIXED** — all automatic.

### Seed data

`npm run db:seed` creates three courses (Dispatch fundamentals, Route
planning & optimization, Pricing engine essentials) with placeholder Doc/Loom
links — swap them for real content in **Manage courses**.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | dev server on :3000 |
| `npm run build` / `npm start` | production build / serve |
| `npm run db:migrate` | create/apply migrations |
| `npm run db:seed` | seed sample courses |
| `npm run db:studio` | Prisma Studio DB browser |

## Swapping SQLite → Postgres later

1. Change `provider = "sqlite"` to `postgresql` in `prisma/schema.prisma`.
2. Point `DATABASE_URL` at your Postgres instance.
3. Replace the `@prisma/adapter-better-sqlite3` adapter in `src/lib/prisma.ts`
   and `prisma/seed.ts` with `@prisma/adapter-pg`.
4. `npx prisma migrate dev`.

## Deliberately out of scope (for now)

- **No SCORM/xAPI** support
- **No native file uploads** — content stays linked via Google Docs/Loom, not hosted
- **No quiz scoring logic**
- **No email notifications**
