"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { assertAdmin } from "@/lib/session";
import { lessonTypeFor, parseGoogleFormUrl } from "@/lib/content";
import { getGoogleAccessToken } from "@/lib/googleDrive";
import { getFormInfo } from "@/lib/googleForms";

function revalidateCourse(courseId: string) {
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/");
  revalidatePath("/browse");
}

// ---------- Courses ----------

export async function createCourse() {
  await assertAdmin();
  const course = await prisma.course.create({
    data: { title: "Untitled course", category: "General" },
  });
  revalidatePath("/admin/courses");
  redirect(`/admin/courses/${course.id}`);
}

export async function updateCourse(
  courseId: string,
  data: { title?: string; description?: string; category?: string; color?: string }
) {
  await assertAdmin();
  await prisma.course.update({ where: { id: courseId }, data });
  revalidateCourse(courseId);
}

export async function deleteCourse(courseId: string) {
  await assertAdmin();
  await prisma.course.delete({ where: { id: courseId } });
  revalidatePath("/admin/courses");
  revalidatePath("/");
  revalidatePath("/browse");
  redirect("/admin/courses");
}

// ---------- Modules ----------

export async function createModule(courseId: string) {
  await assertAdmin();
  const count = await prisma.module.count({ where: { courseId } });
  await prisma.module.create({
    data: { courseId, title: "New module", order: count },
  });
  revalidateCourse(courseId);
}

export async function updateModule(moduleId: string, data: { title?: string }) {
  await assertAdmin();
  const mod = await prisma.module.update({ where: { id: moduleId }, data });
  revalidateCourse(mod.courseId);
}

export async function deleteModule(moduleId: string) {
  await assertAdmin();
  const mod = await prisma.module.delete({ where: { id: moduleId } });
  revalidateCourse(mod.courseId);
}

/** Persist a new module order (array of module ids in desired order). */
export async function reorderModules(courseId: string, orderedIds: string[]) {
  await assertAdmin();
  await prisma.$transaction(
    orderedIds.map((id, i) =>
      prisma.module.update({ where: { id, courseId }, data: { order: i } })
    )
  );
  revalidateCourse(courseId);
}

// ---------- Lessons ----------

export async function createLesson(moduleId: string) {
  await assertAdmin();
  const mod = await prisma.module.findUniqueOrThrow({ where: { id: moduleId } });
  const count = await prisma.lesson.count({ where: { moduleId } });
  await prisma.lesson.create({
    data: { moduleId, title: "New lesson", order: count },
  });
  revalidateCourse(mod.courseId);
}

export async function updateLesson(
  lessonId: string,
  data: {
    title?: string;
    docUrl?: string | null;
    loomUrl?: string | null;
    formUrl?: string | null;
  }
): Promise<{ warning?: string } | void> {
  const me = await assertAdmin();
  const current = await prisma.lesson.findUniqueOrThrow({
    where: { id: lessonId },
    include: { module: true },
  });
  const docUrl = data.docUrl !== undefined ? data.docUrl : current.docUrl;
  const loomUrl = data.loomUrl !== undefined ? data.loomUrl : current.loomUrl;
  const formUrl = data.formUrl !== undefined ? data.formUrl : current.formUrl;

  let warning: string | undefined;
  let formFields: {
    formUrl?: string | null;
    formId?: string | null;
    formResponderUri?: string | null;
    quizData?: Prisma.InputJsonValue | typeof Prisma.DbNull;
  } = {};

  if (data.formUrl !== undefined) {
    if (!data.formUrl) {
      formFields = {
        formUrl: null,
        formId: null,
        formResponderUri: null,
        quizData: Prisma.DbNull,
      };
    } else {
      const parsed = parseGoogleFormUrl(data.formUrl);
      formFields = {
        formUrl: data.formUrl,
        formId: parsed?.formId ?? null,
        formResponderUri: parsed?.responderUri ?? null,
        quizData: Prisma.DbNull,
      };
      if (parsed?.formId) {
        // Edit link: import the quiz (questions + answer key) with the
        // admin's token so the app can render and grade it natively.
        const token = await getGoogleAccessToken(me.id);
        const info = token ? await getFormInfo(token, parsed.formId) : null;
        if (info?.ok) {
          formFields.formResponderUri = info.form.responderUri;
          if (info.form.quiz.questions.length > 0) {
            formFields.quizData = info.form
              .quiz as unknown as Prisma.InputJsonValue;
            const bits = [
              `Imported "${info.form.title}" — ${info.form.quiz.questions.length} questions, ${info.form.quiz.totalPoints} points. Learners take it right on the lesson page.`,
            ];
            if (!info.form.isQuiz) {
              bits.push(
                "The form isn't in quiz mode (Settings → Make this a quiz), so nothing can be scored yet — re-paste the link after changing it."
              );
            } else if (info.form.ungradedCount > 0) {
              bits.push(
                `${info.form.ungradedCount} question(s) have points but no answer key and will need no grading or a key added in the form (then re-paste).`
              );
            }
            warning = bits.join(" ");
          } else {
            warning =
              "The form has no importable questions (only unsupported types like grids or file uploads) — learners get the embedded form instead.";
          }
        } else {
          warning =
            "Saved, but the form couldn't be imported — learners get an 'open in new tab' link. Check that the Google Forms API is enabled and you have edit access to the form, then re-paste the link.";
        }
      } else if (parsed?.responderUri) {
        warning =
          "Saved as a published link — the quiz embeds as a Google Form, but can't be imported for in-app taking or Reports. Paste the form's EDIT link (docs.google.com/forms/d/…/edit) instead.";
      }
    }
  }

  await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      ...data,
      ...formFields,
      type: lessonTypeFor(docUrl, loomUrl, formUrl),
    },
  });
  revalidateCourse(current.module.courseId);
  return warning ? { warning } : undefined;
}

export async function deleteLesson(lessonId: string) {
  await assertAdmin();
  const lesson = await prisma.lesson.delete({
    where: { id: lessonId },
    include: { module: true },
  });
  revalidateCourse(lesson.module.courseId);
}

export async function moveLesson(lessonId: string, direction: "up" | "down") {
  await assertAdmin();
  const lesson = await prisma.lesson.findUniqueOrThrow({
    where: { id: lessonId },
    include: { module: true },
  });
  const siblings = await prisma.lesson.findMany({
    where: { moduleId: lesson.moduleId },
    orderBy: { order: "asc" },
  });
  const idx = siblings.findIndex((l) => l.id === lessonId);
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= siblings.length) return;
  await prisma.$transaction([
    prisma.lesson.update({
      where: { id: siblings[idx].id },
      data: { order: swapWith },
    }),
    prisma.lesson.update({
      where: { id: siblings[swapWith].id },
      data: { order: idx },
    }),
  ]);
  revalidateCourse(lesson.module.courseId);
}

// ---------- Assignments ----------

export async function setCourseOpenToEveryone(courseId: string) {
  await assertAdmin();
  await prisma.assignment.deleteMany({ where: { courseId } });
  revalidateCourse(courseId);
}

export async function assignUserToCourse(courseId: string, userId: string) {
  await assertAdmin();
  await prisma.assignment.upsert({
    where: { courseId_userId: { courseId, userId } },
    update: {},
    create: { courseId, userId },
  });
  revalidateCourse(courseId);
}

export async function unassignUserFromCourse(courseId: string, userId: string) {
  await assertAdmin();
  await prisma.assignment.deleteMany({ where: { courseId, userId } });
  revalidateCourse(courseId);
}

export async function searchUsers(query: string) {
  await assertAdmin();
  const q = query.trim();
  if (!q) return [];
  return prisma.user.findMany({
    where: {
      OR: [{ name: { contains: q } }, { email: { contains: q } }],
    },
    select: { id: true, name: true, email: true, image: true },
    take: 8,
    orderBy: { name: "asc" },
  });
}

// ---------- Roles ----------

export async function setUserRole(
  userId: string,
  role: "ADMIN" | "LEARNER"
): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertAdmin();

  if (role === "LEARNER") {
    const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (target.role === "ADMIN") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        return { ok: false, error: "Cannot demote the last remaining admin." };
      }
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin/admins");
  return { ok: true };
}
