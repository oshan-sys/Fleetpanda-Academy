import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

// Placeholder content links — swap these for real ones in the admin UI.
const DOC = "https://docs.google.com/document/d/e/2PACX-1vSPLACEHOLDER/pub";
const LOOM = "https://www.loom.com/share/0281766fa2d04bb788eaf19e65135184";

type LessonSeed = {
  title: string;
  type: "READING" | "VIDEO" | "MIXED";
  docUrl?: string;
  loomUrl?: string;
};

type ModuleSeed = { title: string; lessons: LessonSeed[] };

type CourseSeed = {
  title: string;
  description: string;
  category: string;
  color: string;
  modules: ModuleSeed[];
};

const seedCourses: CourseSeed[] = [
  {
    title: "Dispatch fundamentals",
    description:
      "The board, the load sheet, and the daily rhythm of a dispatcher. Start here if you're new to FleetPanda operations.",
    category: "Dispatch",
    color: "#EA580C",
    modules: [
      {
        title: "The dispatch board",
        lessons: [
          { title: "The dispatch board at a glance", type: "VIDEO", loomUrl: LOOM },
          { title: "Reading a load sheet", type: "READING", docUrl: DOC },
          { title: "Creating a load", type: "MIXED", docUrl: DOC, loomUrl: LOOM },
        ],
      },
      {
        title: "Scheduling & assignment",
        lessons: [
          { title: "Scheduling deliveries", type: "VIDEO", loomUrl: LOOM },
          { title: "Assigning drivers to loads", type: "VIDEO", loomUrl: LOOM },
        ],
      },
      {
        title: "Exceptions & close-out",
        lessons: [
          { title: "Handling exceptions and splits", type: "READING", docUrl: DOC },
          { title: "Closing out the day", type: "READING", docUrl: DOC },
        ],
      },
    ],
  },
  {
    title: "Route planning & optimization",
    description:
      "Build routes that respect trucks, compartments, and delivery windows — and fix them live when the day goes sideways.",
    category: "Routing",
    color: "#0F766E",
    modules: [
      {
        title: "Building routes",
        lessons: [
          { title: "Building a route", type: "VIDEO", loomUrl: LOOM },
          { title: "Stop sequencing", type: "VIDEO", loomUrl: LOOM },
        ],
      },
      {
        title: "Constraints & live operations",
        lessons: [
          { title: "Truck & compartment constraints", type: "READING", docUrl: DOC },
          { title: "Live re-routing", type: "VIDEO", loomUrl: LOOM },
          { title: "Route performance review", type: "READING", docUrl: DOC },
        ],
      },
    ],
  },
  {
    title: "Pricing engine essentials",
    description:
      "How prices are built, updated, and published to customers — groups, indexes, surcharges, and the publish flow.",
    category: "Pricing",
    color: "#334155",
    modules: [
      {
        title: "Price structure",
        lessons: [
          { title: "Price groups & tiers", type: "VIDEO", loomUrl: LOOM },
          { title: "Index-based pricing", type: "MIXED", docUrl: DOC, loomUrl: LOOM },
        ],
      },
      {
        title: "Fees & publishing",
        lessons: [
          { title: "Surcharges & fees", type: "READING", docUrl: DOC },
          { title: "Publishing price updates", type: "READING", docUrl: DOC },
        ],
      },
    ],
  },
];

async function main() {
  const existing = await prisma.course.count();
  if (existing > 0) {
    console.log(`Database already has ${existing} course(s) — skipping seed.`);
    return;
  }

  for (const c of seedCourses) {
    await prisma.course.create({
      data: {
        title: c.title,
        description: c.description,
        category: c.category,
        color: c.color,
        modules: {
          create: c.modules.map((m, mi) => ({
            title: m.title,
            order: mi,
            lessons: {
              create: m.lessons.map((l, li) => ({
                title: l.title,
                order: li,
                type: l.type,
                docUrl: l.docUrl ?? null,
                loomUrl: l.loomUrl ?? null,
              })),
            },
          })),
        },
      },
    });
    console.log(`Seeded course: ${c.title}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
