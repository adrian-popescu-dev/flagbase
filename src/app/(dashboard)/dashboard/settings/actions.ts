"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateApiKey } from "@/lib/apiKey";

async function requireAuth() {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
}

export async function createKey(formData: FormData): Promise<{ key: string }> {
  await requireAuth();

  const name = formData.get("name") as string;
  const projectId = formData.get("projectId") as string;
  const environmentId = formData.get("environmentId") as string;

  if (!name || !projectId || !environmentId) throw new Error("Missing required fields");

  const { raw, hash, prefix } = generateApiKey();

  await prisma.apiKey.create({
    data: { name, keyHash: hash, keyPrefix: prefix, projectId, environmentId },
  });

  revalidatePath("/dashboard/settings");
  return { key: raw };
}

export async function revokeKey(id: string) {
  await requireAuth();
  await prisma.apiKey.delete({ where: { id } });
  revalidatePath("/dashboard/settings");
}
