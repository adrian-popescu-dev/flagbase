import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createFlagSchema = z.object({
  projectId: z.string().min(1),
  key: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_-]+$/, "key must be lowercase alphanumeric with _ or -"),
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["BOOLEAN", "STRING", "NUMBER", "JSON"]).default("BOOLEAN"),
});

// GET /api/flags?projectId=xxx
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 });

  const flags = await prisma.flag.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: {
      states: {
        include: { environment: { select: { id: true, name: true, slug: true } } },
      },
    },
  });

  return NextResponse.json(flags);
}

// POST /api/flags
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = createFlagSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const { projectId, key, name, description, type } = parsed.data;

  const flag = await prisma.flag.create({
    data: { projectId, key, name, description: description ?? null, type },
  });

  return NextResponse.json(flag, { status: 201 });
}
