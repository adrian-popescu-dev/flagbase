import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { evaluateFlag } from "@/lib/evaluation";
import { flagCacheKey, getCachedFlag, setCachedFlag } from "@/lib/redis";
import type { EvalRule, EvalState, FlagType } from "@/lib/evaluation";

// Auth for this endpoint comes from API keys (checkpoint 10).
// For now, the session check is skipped so the SDK can call it without a browser session.
// TODO: replace with API key auth in checkpoint 10.

const evaluateSchema = z.object({
  flagKey: z.string().min(1),
  projectId: z.string().min(1),
  environmentId: z.string().min(1),
  userId: z.string().min(1),
  attributes: z.record(z.string(), z.any()).optional(),
});

// POST /api/evaluate
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = evaluateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const { flagKey, projectId, environmentId, userId, attributes } = parsed.data;

  // Try cache first — stores { type, state, rules } for 60s
  const cacheKey = flagCacheKey(projectId, flagKey, environmentId);
  type CachedFlag = { type: FlagType; state: EvalState; rules: EvalRule[] };
  let cached: CachedFlag | null = await getCachedFlag(cacheKey);

  if (!cached) {
    const flag = await prisma.flag.findUnique({
      where: { projectId_key: { projectId, key: flagKey } },
      include: {
        states: { where: { environmentId } },
        rules: true,
      },
    });

    if (!flag || flag.archived || !flag.states[0]) {
      return NextResponse.json({ flagKey, value: false, reason: "FLAG_NOT_FOUND" });
    }

    cached = { type: flag.type as FlagType, state: flag.states[0] as EvalState, rules: flag.rules as EvalRule[] };
    await setCachedFlag(cacheKey, cached);
  }

  const result = evaluateFlag({
    flagKey,
    flagType: cached.type,
    state: cached.state,
    rules: cached.rules,
    context: { userId, attributes: attributes as Record<string, string | number | boolean> | undefined },
  });

  return NextResponse.json({ flagKey, ...result });
}
