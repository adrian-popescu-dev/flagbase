/**
 * Flagbase — Middleware SDK
 *
 * Copy this file into your app (e.g. lib/flagbase-middleware.ts).
 * Use inside Next.js middleware.ts to gate routes before any page renders.
 *
 * Required env vars:
 *   FLAGBASE_URL            = https://your-flagbase.com
 *   FLAGBASE_API_KEY        = fb_xxxxxxxxxxxxxxxx
 *   FLAGBASE_PROJECT_ID     = <your project id>
 *   FLAGBASE_ENVIRONMENT_ID = <your environment id>
 *
 * @example
 * // middleware.ts
 * import { NextRequest, NextResponse } from "next/server";
 * import { withFlag } from "@/lib/flagbase-middleware";
 *
 * export async function middleware(req: NextRequest) {
 *   const enabled = await withFlag("new-dashboard", { userId: req.cookies.get("userId")?.value ?? "anon" });
 *   if (!enabled) return NextResponse.redirect(new URL("/old-dashboard", req.url));
 *   return NextResponse.next();
 * }
 *
 * export const config = { matcher: ["/dashboard/:path*"] };
 */

import type { NextRequest } from "next/server";

export type FlagContext = {
  userId: string;
  attributes?: Record<string, string | number | boolean>;
};

function config() {
  const url = process.env.FLAGBASE_URL;
  const apiKey = process.env.FLAGBASE_API_KEY;
  const projectId = process.env.FLAGBASE_PROJECT_ID;
  const environmentId = process.env.FLAGBASE_ENVIRONMENT_ID;

  if (!url || !apiKey || !projectId || !environmentId) {
    throw new Error(
      "Flagbase: missing env vars. Set FLAGBASE_URL, FLAGBASE_API_KEY, FLAGBASE_PROJECT_ID, FLAGBASE_ENVIRONMENT_ID.",
    );
  }

  return { url, apiKey, projectId, environmentId };
}

/**
 * Evaluate a feature flag inside Next.js middleware.
 * Returns `defaultValue` if the platform is unreachable or the flag doesn't exist.
 *
 * @param flagKey       The flag key defined in the Flagbase dashboard
 * @param context       User context for targeting rules
 * @param defaultValue  Fallback value (default: false)
 */
export async function withFlag<T = boolean>(
  flagKey: string,
  context: FlagContext,
  defaultValue: T = false as unknown as T,
): Promise<T> {
  try {
    const { url, apiKey, projectId, environmentId } = config();

    const res = await fetch(`${url}/api/evaluate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        flagKey,
        projectId,
        environmentId,
        userId: context.userId,
        attributes: context.attributes,
      }),
    });

    if (!res.ok) return defaultValue;

    const data = await res.json();
    return (data.value as T) ?? defaultValue;
  } catch {
    // Graceful degradation: never block a request if the platform is down
    return defaultValue;
  }
}

/**
 * Evaluate multiple flags in a single middleware function, in parallel.
 * Returns a map of flagKey → value.
 *
 * @example
 * const flags = await withFlags(
 *   ["new-dashboard", "beta-search"],
 *   { userId: "user_123" },
 * );
 * if (!flags["new-dashboard"]) return NextResponse.redirect(...);
 */
export async function withFlags(
  flagKeys: string[],
  context: FlagContext,
  defaultValue = false,
): Promise<Record<string, boolean>> {
  const entries = await Promise.all(
    flagKeys.map(async (key) => [key, await withFlag(key, context, defaultValue)] as const),
  );
  return Object.fromEntries(entries);
}

/**
 * Helper: read a user ID from a standard cookie inside middleware.
 * Adjust the cookie name to match your auth setup.
 */
export function getUserIdFromRequest(req: NextRequest, cookieName = "userId"): string {
  return req.cookies.get(cookieName)?.value ?? "anonymous";
}
