/**
 * Flagbase — Client SDK
 *
 * Copy this file into your app (e.g. lib/flagbase-client.tsx).
 * Use in React client components ("use client").
 *
 * Required env vars (must be prefixed with NEXT_PUBLIC_ to be available in the browser):
 *   NEXT_PUBLIC_FLAGBASE_URL            = https://your-flagbase.com
 *   NEXT_PUBLIC_FLAGBASE_API_KEY        = fb_xxxxxxxxxxxxxxxx
 *   NEXT_PUBLIC_FLAGBASE_PROJECT_ID     = <your project id>
 *   NEXT_PUBLIC_FLAGBASE_ENVIRONMENT_ID = <your environment id>
 */

"use client";

import { useState, useEffect } from "react";

export type FlagContext = {
  userId: string;
  attributes?: Record<string, string | number | boolean>;
};

export type TrackPayload = {
  type: "IMPRESSION" | "CONVERSION";
  experimentId: string;
  variantId?: string;
  userId: string;
  attributes?: Record<string, unknown>;
};

function config() {
  const url = process.env.NEXT_PUBLIC_FLAGBASE_URL;
  const apiKey = process.env.NEXT_PUBLIC_FLAGBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FLAGBASE_PROJECT_ID;
  const environmentId = process.env.NEXT_PUBLIC_FLAGBASE_ENVIRONMENT_ID;

  if (!url || !apiKey || !projectId || !environmentId) {
    throw new Error(
      "Flagbase: missing env vars. Set NEXT_PUBLIC_FLAGBASE_URL, NEXT_PUBLIC_FLAGBASE_API_KEY, NEXT_PUBLIC_FLAGBASE_PROJECT_ID, NEXT_PUBLIC_FLAGBASE_ENVIRONMENT_ID."
    );
  }

  return { url, apiKey, projectId, environmentId };
}

/**
 * React hook to evaluate a feature flag in a client component.
 *
 * @example
 * const { value, loading } = useFlag("show-new-ui", { userId: "user_123" }, false);
 * if (loading) return <Skeleton />;
 * return value ? <NewUI /> : <OldUI />;
 */
export function useFlag<T = boolean>(
  flagKey: string,
  context: FlagContext,
  defaultValue: T = false as unknown as T
): { value: T; loading: boolean } {
  const [value, setValue] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);

  // Stable JSON representation to avoid re-fetching on every render
  const contextKey = JSON.stringify(context);

  useEffect(() => {
    let cancelled = false;

    async function evaluate() {
      try {
        const { url, apiKey, projectId, environmentId } = config();
        const ctx = JSON.parse(contextKey) as FlagContext;

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
            userId: ctx.userId,
            attributes: ctx.attributes,
          }),
        });

        if (!res.ok || cancelled) return;

        const data = await res.json();
        if (!cancelled) setValue((data.value as T) ?? defaultValue);
      } catch {
        // Graceful degradation: keep defaultValue on error
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true);
    evaluate();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagKey, contextKey]);

  return { value, loading };
}

/**
 * Track an impression or conversion event from a client component.
 * Fails silently — never throws, so it won't break your app.
 */
export async function track(payload: TrackPayload): Promise<void> {
  try {
    const { url, apiKey } = config();

    await fetch(`${url}/api/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Fail silently
  }
}
