/**
 * Prisma seed — example flags, experiments, variants, and an admin user.
 * Run with: npx prisma db seed
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // ── Admin user ────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("password123", 10);

  const user = await prisma.user.upsert({
    where: { email: "admin@flagbase.dev" },
    update: {},
    create: {
      email: "admin@flagbase.dev",
      name: "Admin",
      password: passwordHash,
      role: "ADMIN",
    },
  });

  console.log(`✓ User: ${user.email}`);

  // ── Project ───────────────────────────────────────────────────────────────
  const project = await prisma.project.upsert({
    where: { slug: "acme" },
    update: {},
    create: {
      name: "Acme Corp",
      slug: "acme",
      description: "Main product project",
    },
  });

  console.log(`✓ Project: ${project.name}`);

  // ── Environments ──────────────────────────────────────────────────────────
  const [production, staging] = await Promise.all([
    prisma.environment.upsert({
      where: { projectId_slug: { projectId: project.id, slug: "production" } },
      update: {},
      create: { name: "Production", slug: "production", projectId: project.id },
    }),
    prisma.environment.upsert({
      where: { projectId_slug: { projectId: project.id, slug: "staging" } },
      update: {},
      create: { name: "Staging", slug: "staging", projectId: project.id },
    }),
  ]);

  console.log(`✓ Environments: ${production.name}, ${staging.name}`);

  // ── Feature flags ─────────────────────────────────────────────────────────
  const flags = [
    {
      key: "new-dashboard",
      name: "New Dashboard",
      description: "Enables the redesigned dashboard UI",
      type: "BOOLEAN" as const,
    },
    {
      key: "dark-mode",
      name: "Dark Mode",
      description: "Allows users to switch to dark mode",
      type: "BOOLEAN" as const,
    },
    {
      key: "checkout-v2",
      name: "Checkout V2",
      description: "New one-page checkout flow",
      type: "BOOLEAN" as const,
    },
    {
      key: "items-per-page",
      name: "Items Per Page",
      description: "Number of items shown in listing pages",
      type: "NUMBER" as const,
    },
  ];

  for (const f of flags) {
    const flag = await prisma.flag.upsert({
      where: { projectId_key: { projectId: project.id, key: f.key } },
      update: {},
      create: { ...f, projectId: project.id },
    });

    // Enable flag in staging, disable in production (except dark-mode)
    await Promise.all([
      prisma.flagState.upsert({
        where: { flagId_environmentId: { flagId: flag.id, environmentId: production.id } },
        update: {},
        create: {
          flagId: flag.id,
          environmentId: production.id,
          enabled: f.key === "dark-mode",
          rolloutPct: 100,
        },
      }),
      prisma.flagState.upsert({
        where: { flagId_environmentId: { flagId: flag.id, environmentId: staging.id } },
        update: {},
        create: {
          flagId: flag.id,
          environmentId: staging.id,
          enabled: true,
          rolloutPct: 100,
        },
      }),
    ]);

    console.log(`✓ Flag: ${flag.key}`);
  }

  // ── Experiments ───────────────────────────────────────────────────────────
  const checkoutExp = await prisma.experiment.upsert({
    where: { projectId_key: { projectId: project.id, key: "checkout-cta-test" } },
    update: {},
    create: {
      key: "checkout-cta-test",
      name: "Checkout CTA Test",
      description: "Does changing the CTA button copy improve conversion?",
      hypothesis: "Changing 'Buy Now' to 'Complete Order' will increase checkout completions by 5%.",
      status: "RUNNING",
      goalEvent: "checkout.completed",
      projectId: project.id,
      startedAt: new Date(),
    },
  });

  const [control, treatment] = await Promise.all([
    prisma.variant.upsert({
      where: { experimentId_key: { experimentId: checkoutExp.id, key: "control" } },
      update: {},
      create: {
        experimentId: checkoutExp.id,
        key: "control",
        name: "Control — Buy Now",
        description: "Original CTA button copy",
        weight: 50,
      },
    }),
    prisma.variant.upsert({
      where: { experimentId_key: { experimentId: checkoutExp.id, key: "treatment" } },
      update: {},
      create: {
        experimentId: checkoutExp.id,
        key: "treatment",
        name: "Treatment — Complete Order",
        description: "New CTA button copy",
        weight: 50,
      },
    }),
  ]);

  console.log(`✓ Experiment: ${checkoutExp.name}`);

  // ── Seed events (impressions + conversions) ───────────────────────────────
  // Simulate: 200 impressions per variant, control 18% CVR, treatment 23% CVR
  const eventRows: Array<{
    type: "IMPRESSION" | "CONVERSION";
    experimentId: string;
    variantId: string;
    userId: string;
  }> = [];

  const variants = [
    { variant: control, impressions: 200, conversions: 36 },   // 18% CVR
    { variant: treatment, impressions: 200, conversions: 46 },  // 23% CVR
  ];

  for (const { variant, impressions, conversions } of variants) {
    for (let i = 0; i < impressions; i++) {
      eventRows.push({
        type: "IMPRESSION",
        experimentId: checkoutExp.id,
        variantId: variant.id,
        userId: `user_${variant.key}_${i}`,
      });
    }
    for (let i = 0; i < conversions; i++) {
      eventRows.push({
        type: "CONVERSION",
        experimentId: checkoutExp.id,
        variantId: variant.id,
        userId: `user_${variant.key}_${i}`,
      });
    }
  }

  // Insert in batches of 100 to avoid hitting query size limits
  for (let i = 0; i < eventRows.length; i += 100) {
    await prisma.event.createMany({ data: eventRows.slice(i, i + 100), skipDuplicates: false });
  }

  console.log(`✓ Events: ${eventRows.length} seeded (impressions + conversions)`);
  console.log("\nSeed complete.");
  console.log("  Login: admin@flagbase.dev / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
