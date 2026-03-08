import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const variantSchema = z.object({
  key: z.string().min(1).regex(/^[a-z0-9_-]+$/, "key must be lowercase alphanumeric with _ or -"),
  name: z.string().min(1),
  weight: z.number().int().min(0).max(100),
  description: z.string().optional(),
});

const createExperimentSchema = z.object({
  projectId: z.string().min(1),
  key: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_-]+$/, "key must be lowercase alphanumeric with _ or -"),
  name: z.string().min(1),
  description: z.string().optional(),
  hypothesis: z.string().optional(),
  goalEvent: z.string().min(1),
  variants: z.array(variantSchema).min(2, "At least 2 variants are required"),
});

// GET /api/experiments?projectId=xxx
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 });

  const experiments = await prisma.experiment.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: { variants: true },
  });

  return NextResponse.json(experiments);
}

// POST /api/experiments
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = createExperimentSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const { projectId, key, name, description, hypothesis, goalEvent, variants } = parsed.data;

  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  if (totalWeight !== 100)
    return NextResponse.json({ error: "Variant weights must sum to 100" }, { status: 400 });

  const experiment = await prisma.experiment.create({
    data: {
      projectId,
      key,
      name,
      description: description ?? null,
      hypothesis: hypothesis ?? null,
      goalEvent,
      variants: { create: variants },
    },
    include: { variants: true },
  });

  return NextResponse.json(experiment, { status: 201 });
}
