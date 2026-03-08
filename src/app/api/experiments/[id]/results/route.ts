import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { twoProportionZTest } from "@/lib/stats";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/experiments/[id]/results
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const experiment = await prisma.experiment.findUnique({
    where: { id },
    include: { variants: { orderBy: { key: "asc" } } },
  });

  if (!experiment) return NextResponse.json({ error: "Experiment not found" }, { status: 404 });

  // Count impressions and conversions per variant in one query each
  const [impressionCounts, conversionCounts] = await Promise.all([
    prisma.event.groupBy({
      by: ["variantId"],
      where: { experimentId: id, type: "IMPRESSION" },
      _count: { _all: true },
    }),
    prisma.event.groupBy({
      by: ["variantId"],
      where: { experimentId: id, type: "CONVERSION" },
      _count: { _all: true },
    }),
  ]);

  const impressionMap = Object.fromEntries(
    impressionCounts.map((r) => [r.variantId ?? "__none__", r._count._all]),
  );
  const conversionMap = Object.fromEntries(
    conversionCounts.map((r) => [r.variantId ?? "__none__", r._count._all]),
  );

  // Build per-variant stats
  const variantStats = experiment.variants.map((v) => {
    const impressions = impressionMap[v.id] ?? 0;
    const conversions = conversionMap[v.id] ?? 0;
    const conversionRate = impressions > 0 ? conversions / impressions : 0;
    return { variant: v, impressions, conversions, conversionRate };
  });

  // Control = variant keyed "control", or first variant as fallback
  const control =
    variantStats.find((v) => v.variant.key === "control") ?? variantStats[0];

  const results = variantStats.map(({ variant, impressions, conversions, conversionRate }) => {
    const isControl = variant.id === control?.variant.id;

    const uplift =
      !isControl && control && control.conversionRate > 0
        ? (conversionRate - control.conversionRate) / control.conversionRate
        : null;

    const pValue =
      !isControl && control
        ? twoProportionZTest(
            control.impressions,
            control.conversions,
            impressions,
            conversions,
          )
        : null;

    // Significant at 95% confidence (p < 0.05)
    const significant = pValue !== null ? pValue < 0.05 : null;

    return {
      variantId: variant.id,
      key: variant.key,
      name: variant.name,
      weight: variant.weight,
      impressions,
      conversions,
      conversionRate: Math.round(conversionRate * 10000) / 10000, // 4 decimal places
      uplift: uplift !== null ? Math.round(uplift * 10000) / 10000 : null,
      pValue: pValue !== null ? Math.round(pValue * 10000) / 10000 : null,
      significant,
      isControl,
    };
  });

  return NextResponse.json({
    experimentId: experiment.id,
    key: experiment.key,
    name: experiment.name,
    status: experiment.status,
    goalEvent: experiment.goalEvent,
    startedAt: experiment.startedAt,
    endedAt: experiment.endedAt,
    variants: results,
  });
}
