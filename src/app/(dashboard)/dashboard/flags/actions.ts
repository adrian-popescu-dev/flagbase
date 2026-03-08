"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAuth() {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  return session;
}

// ── Create flag ───────────────────────────────────────────────────────────────

const createFlagSchema = z.object({
  projectId: z.string().min(1),
  key: z.string().min(1).regex(/^[a-z0-9_-]+$/, "Lowercase alphanumeric, _ or -"),
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["BOOLEAN", "STRING", "NUMBER", "JSON"]).default("BOOLEAN"),
});

export async function createFlag(formData: FormData) {
  await requireAuth();

  const parsed = createFlagSchema.safeParse({
    projectId: formData.get("projectId"),
    key: formData.get("key"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    type: formData.get("type") || "BOOLEAN",
  });

  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  await prisma.flag.create({ data: parsed.data });
  revalidatePath("/dashboard/flags");
}

// ── Toggle flag state ─────────────────────────────────────────────────────────

export async function toggleFlag(flagId: string, environmentId: string, enabled: boolean) {
  await requireAuth();

  await prisma.flagState.upsert({
    where: { flagId_environmentId: { flagId, environmentId } },
    update: { enabled },
    create: { flagId, environmentId, enabled },
  });

  revalidatePath("/dashboard/flags");
}

// ── Archive flag ──────────────────────────────────────────────────────────────

export async function archiveFlag(flagId: string) {
  await requireAuth();
  await prisma.flag.update({ where: { id: flagId }, data: { archived: true } });
  revalidatePath("/dashboard/flags");
}

// ── Unarchive flag ────────────────────────────────────────────────────────────

export async function unarchiveFlag(flagId: string) {
  await requireAuth();
  await prisma.flag.update({ where: { id: flagId }, data: { archived: false } });
  revalidatePath("/dashboard/flags");
}
