import { createHash, randomBytes } from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const PREFIX = "fb_";

/** Generate a new API key. Returns the raw key (shown once) and its hash + prefix for storage. */
export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const random = randomBytes(32).toString("hex"); // 64 hex chars
  const raw = `${PREFIX}${random}`;
  const hash = hashApiKey(raw);
  const prefix = raw.slice(0, 12); // "fb_" + 9 chars — enough to identify in UI
  return { raw, hash, prefix };
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export type ApiKeyValidationResult =
  | { valid: true; projectId: string; environmentId: string; keyId: string }
  | { valid: false; error: string };

/**
 * Validates the API key from the Authorization header (Bearer token).
 * Updates lastUsedAt on success.
 */
export async function validateApiKey(req: NextRequest): Promise<ApiKeyValidationResult> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { valid: false, error: "Missing or invalid Authorization header" };
  }

  const raw = authHeader.slice(7).trim();
  if (!raw.startsWith(PREFIX)) {
    return { valid: false, error: "Invalid API key format" };
  }

  const hash = hashApiKey(raw);

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash: hash },
    select: { id: true, projectId: true, environmentId: true, expiresAt: true },
  });

  if (!apiKey) return { valid: false, error: "Invalid API key" };

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return { valid: false, error: "API key expired" };
  }

  // Fire-and-forget lastUsedAt update
  void prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    valid: true,
    projectId: apiKey.projectId,
    environmentId: apiKey.environmentId,
    keyId: apiKey.id,
  };
}
