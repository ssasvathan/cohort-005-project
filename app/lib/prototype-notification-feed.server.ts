// PROTOTYPE — throwaway. Wayfinder ticket "How does the Notification feed look
// and behave?" (#5). Builds a stubbed feed from REAL course/lesson/user names so
// the variants are judged against real-looking catalogue entries. No Knock, no
// persistence: read state lives in client memory.
import { eq } from "drizzle-orm";
import { db } from "~/db";
import { courses, lessons, modules, users, UserRole } from "~/db/schema";

export type ProtoNotificationKind =
  | "refund-approved"
  | "refund-declined"
  | "lesson-question"
  | "reply"
  | "seat-claimed";

export interface ProtoNotification {
  id: string;
  kind: ProtoNotificationKind;
  // Parts, so variants can bold names however they like.
  actor: string | null;
  text: string; // full sentence from the catalogue
  subject: string; // course or lesson title, for emphasis
  context?: string; // course title, when the subject is a lesson
  href: string;
  createdAt: string;
  read: boolean;
}

function ago(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function sample() {
  const lessonRows = db
    .select({
      lessonId: lessons.id,
      lessonTitle: lessons.title,
      courseTitle: courses.title,
      courseSlug: courses.slug,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .limit(12)
    .all();
  const students = db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.role, UserRole.Student))
    .limit(6)
    .all()
    .map((u) => u.name);
  const pick = <T,>(xs: T[], i: number, fallback: T) =>
    xs.length ? xs[i % xs.length] : fallback;
  const fallbackLesson = {
    lessonId: 1,
    lessonTitle: "Intro",
    courseTitle: "A Course",
    courseSlug: "a-course",
  };
  return {
    lesson: (i: number) => pick(lessonRows, i, fallbackLesson),
    student: (i: number) => pick(students, i, "A Student"),
  };
}

export function buildPrototypeFeed(
  role: UserRole | null,
  isTeamAdmin: boolean
): ProtoNotification[] {
  if (!role || role === UserRole.Admin) return []; // Platform Admins get none
  const s = sample();
  const feed: ProtoNotification[] = [];
  const lessonHref = (i: number, commentId: number) => {
    const l = s.lesson(i);
    return `/courses/${l.courseSlug}/lessons/${l.lessonId}#comment-${commentId}`;
  };

  if (role === UserRole.Instructor) {
    [0, 1, 2, 3, 4].forEach((i) => {
      const l = s.lesson(i);
      feed.push({
        id: `lq-${i}`,
        kind: "lesson-question",
        actor: s.student(i),
        subject: l.lessonTitle,
        context: l.courseTitle,
        text: `${s.student(i)} asked a question on ${l.lessonTitle}.`,
        href: lessonHref(i, 100 + i),
        createdAt: ago([4, 50, 180, 1500, 4400][i]),
        read: i >= 2,
      });
    });
    const l = s.lesson(5);
    feed.push({
      id: "reply-i",
      kind: "reply",
      actor: s.student(3),
      subject: l.lessonTitle,
      context: l.courseTitle,
      text: `${s.student(3)} replied to your question on ${l.lessonTitle}.`,
      href: lessonHref(5, 210),
      createdAt: ago(95),
      read: false,
    });
  }

  if (role === UserRole.Student) {
    const buyerHref = isTeamAdmin ? "/team" : "/settings";
    const a = s.lesson(0);
    const b = s.lesson(6);
    feed.push(
      {
        id: "rf-ok",
        kind: "refund-approved",
        actor: null,
        subject: a.courseTitle,
        text: `Your Refund Request for ${a.courseTitle} was approved.`,
        href: buyerHref,
        createdAt: ago(12),
        read: false,
      },
      {
        id: "reply-1",
        kind: "reply",
        actor: "Instructor",
        subject: s.lesson(2).lessonTitle,
        context: s.lesson(2).courseTitle,
        text: `Instructor replied to your question on ${s.lesson(2).lessonTitle}.`,
        href: lessonHref(2, 301),
        createdAt: ago(240),
        read: false,
      },
      {
        id: "rf-no",
        kind: "refund-declined",
        actor: null,
        subject: b.courseTitle,
        text: `Your Refund Request for ${b.courseTitle} was declined. See the note from Cadence.`,
        href: buyerHref,
        createdAt: ago(2900),
        read: true,
      },
      {
        id: "reply-2",
        kind: "reply",
        actor: s.student(1),
        subject: s.lesson(3).lessonTitle,
        context: s.lesson(3).courseTitle,
        text: `${s.student(1)} replied to your question on ${s.lesson(3).lessonTitle}.`,
        href: lessonHref(3, 302),
        createdAt: ago(9000),
        read: true,
      }
    );
    if (isTeamAdmin) {
      [0, 1, 2].forEach((i) =>
        feed.push({
          id: `seat-${i}`,
          kind: "seat-claimed",
          actor: s.student(i + 2),
          subject: s.lesson(i * 4).courseTitle,
          text: `${s.student(i + 2)} claimed a Seat on ${s.lesson(i * 4).courseTitle}.`,
          href: "/team",
          createdAt: ago([30, 600, 3000][i]),
          read: i > 0,
        })
      );
    }
  }

  return feed.sort((x, y) => y.createdAt.localeCompare(x.createdAt));
}

// Used by the switcher's "push event" button to simulate a real-time arrival.
export function buildPrototypeIncoming(
  role: UserRole | null,
  isTeamAdmin: boolean
): Omit<ProtoNotification, "id" | "createdAt" | "read">[] {
  return buildPrototypeFeed(role, isTeamAdmin).map(
    ({ id: _id, createdAt: _c, read: _r, ...rest }) => rest
  );
}
