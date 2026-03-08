import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateExperimentSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  hypothesis: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "RUNNING", "PAUSED", "COMPLETED"]).optional(),
  goalEvent: z.string().min(1).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/experiments/[id]
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const experiment = await prisma.experiment.findUnique({
    where: { id },
    include: { variants: true },
  });

  if (!experiment) return NextResponse.json({ error: "Experiment not found" }, { status: 404 });

  return NextResponse.json(experiment);
}

// PATCH /api/experiments/[id]
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = updateExperimentSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const existing = await prisma.experiment.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Experiment not found" }, { status: 404 });

  // Automatically set timestamps when status changes
  const extra: { startedAt?: Date; endedAt?: Date } = {};
  if (parsed.data.status === "RUNNING" && existing.status !== "RUNNING") {
    extra.startedAt = new Date();
  }
  if (parsed.data.status === "COMPLETED" && existing.status !== "COMPLETED") {
    extra.endedAt = new Date();
  }

  const experiment = await prisma.experiment.update({
    where: { id },
    data: { ...parsed.data, ...extra },
    include: { variants: true },
  });

  return NextResponse.json(experiment);
}

// DELETE /api/experiments/[id]
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.experiment.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Experiment not found" }, { status: 404 });

  await prisma.experiment.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
