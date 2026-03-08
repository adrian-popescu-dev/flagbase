import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// Auth for this endpoint comes from API keys (checkpoint 10).
// For now, auth is skipped so the SDK can call it without a browser session.
// TODO: replace with API key auth in checkpoint 10.

const eventSchema = z.object({
  type: z.enum(["IMPRESSION", "CONVERSION"]),
  experimentId: z.string().min(1),
  variantId: z.string().optional(),
  userId: z.string().min(1),
  attributes: z.record(z.string(), z.any()).optional(),
});

// POST /api/events
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = eventSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const { type, experimentId, variantId, userId, attributes } = parsed.data;

  // Verify experiment exists
  const experiment = await prisma.experiment.findUnique({
    where: { id: experimentId },
    select: { id: true },
  });
  if (!experiment)
    return NextResponse.json({ error: "Experiment not found" }, { status: 404 });

  // Verify variant belongs to this experiment (if provided)
  if (variantId) {
    const variant = await prisma.variant.findFirst({
      where: { id: variantId, experimentId },
      select: { id: true },
    });
    if (!variant)
      return NextResponse.json({ error: "Variant not found in this experiment" }, { status: 404 });
  }

  const event = await prisma.event.create({
    data: {
      type,
      experimentId,
      variantId: variantId ?? null,
      userId,
      ...(attributes !== undefined && { attributes }),
    },
  });

  return NextResponse.json(event, { status: 201 });
}
