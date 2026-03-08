/**
 * Flagbase — Server SDK
 *
 * Copy this file into your app (e.g. lib/flagbase.ts).
 *
 * Required env vars:
 *   FLAGBASE_URL     = https://your-flagbase.com
 *   FLAGBASE_API_KEY = fb_xxxxxxxxxxxxxxxx
 *   FLAGBASE_PROJECT_ID   = <your project id>
 *   FLAGBASE_ENVIRONMENT_ID = <your environment id>
 */

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
 * Evaluate a feature flag for a given user.
 * Returns `defaultValue` if the platform is unreachable or the flag doesn't exist.
 */
export async function getFlag<T = boolean>(
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
      // Don't cache — always get fresh flag values
      cache: "no-store",
    });

    if (!res.ok) return defaultValue;

    const data = await res.json();
    return (data.value as T) ?? defaultValue;
  } catch {
    // Graceful degradation: return default if platform is unreachable
    return defaultValue;
  }
}

/**
 * Track an impression or conversion event.
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
      cache: "no-store",
    });
  } catch {
    // Fail silently
  }
}
