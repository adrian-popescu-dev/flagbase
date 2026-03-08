"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAuth() {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
}

// ── Create experiment ─────────────────────────────────────────────────────────

const variantSchema = z.object({
  key: z.string().min(1).regex(/^[a-z0-9_-]+$/),
  name: z.string().min(1),
  weight: z.number().int().min(0).max(100),
});

const createSchema = z.object({
  projectId: z.string().min(1),
  key: z.string().min(1).regex(/^[a-z0-9_-]+$/, "Lowercase alphanumeric, _ or -"),
  name: z.string().min(1),
  description: z.string().optional(),
  hypothesis: z.string().optional(),
  goalEvent: z.string().min(1),
  variants: z.array(variantSchema).min(2),
});

export async function createExperiment(data: z.infer<typeof createSchema>) {
  await requireAuth();

  const parsed = createSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const totalWeight = parsed.data.variants.reduce((s, v) => s + v.weight, 0);
  if (totalWeight !== 100) throw new Error("Variant weights must sum to 100");

  await prisma.experiment.create({
    data: {
      projectId: parsed.data.projectId,
      key: parsed.data.key,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      hypothesis: parsed.data.hypothesis ?? null,
      goalEvent: parsed.data.goalEvent,
      variants: { create: parsed.data.variants },
    },
  });

  revalidatePath("/dashboard/experiments");
}

// ── Update status ─────────────────────────────────────────────────────────────

export async function updateExperimentStatus(
  id: string,
  status: "DRAFT" | "RUNNING" | "PAUSED" | "COMPLETED",
) {
  await requireAuth();

  const existing = await prisma.experiment.findUnique({ where: { id } });
  if (!existing) throw new Error("Not found");

  const extra: { startedAt?: Date; endedAt?: Date } = {};
  if (status === "RUNNING" && existing.status !== "RUNNING") extra.startedAt = new Date();
  if (status === "COMPLETED" && existing.status !== "COMPLETED") extra.endedAt = new Date();

  await prisma.experiment.update({ where: { id }, data: { status, ...extra } });
  revalidatePath("/dashboard/experiments");
}

// ── Delete experiment ─────────────────────────────────────────────────────────

export async function deleteExperiment(id: string) {
  await requireAuth();
  await prisma.experiment.delete({ where: { id } });
  revalidatePath("/dashboard/experiments");
}
