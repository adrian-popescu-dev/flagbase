import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const upsertStateSchema = z.object({
  environmentId: z.string().min(1),
  enabled: z.boolean().optional(),
  rolloutPct: z.number().int().min(0).max(100).optional(),
  defaultValue: z.string().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

// PATCH /api/flags/[id]/state  — upsert per-environment state
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: flagId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = upsertStateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const { environmentId, ...rest } = parsed.data;

  const flag = await prisma.flag.findUnique({ where: { id: flagId } });
  if (!flag) return NextResponse.json({ error: "Flag not found" }, { status: 404 });

  const state = await prisma.flagState.upsert({
    where: { flagId_environmentId: { flagId, environmentId } },
    create: { flagId, environmentId, ...rest },
    update: rest,
  });

  return NextResponse.json(state);
}
