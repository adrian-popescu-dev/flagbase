import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invalidateFlagCache } from "@/lib/redis";

const updateFlagSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  archived: z.boolean().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/flags/[id]
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const flag = await prisma.flag.findUnique({
    where: { id },
    include: {
      states: {
        include: { environment: { select: { id: true, name: true, slug: true } } },
      },
      rules: { orderBy: { priority: "asc" } },
    },
  });

  if (!flag) return NextResponse.json({ error: "Flag not found" }, { status: 404 });

  return NextResponse.json(flag);
}

// PATCH /api/flags/[id]
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = updateFlagSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const existing = await prisma.flag.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Flag not found" }, { status: 404 });

  const flag = await prisma.flag.update({
    where: { id },
    data: parsed.data,
  });

  await invalidateFlagCache(existing.projectId, existing.key);

  return NextResponse.json(flag);
}

// DELETE /api/flags/[id]
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.flag.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Flag not found" }, { status: 404 });

  await prisma.flag.delete({ where: { id } });
  await invalidateFlagCache(existing.projectId, existing.key);

  return new NextResponse(null, { status: 204 });
}
