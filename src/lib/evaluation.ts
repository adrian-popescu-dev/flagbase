// ─── Types ────────────────────────────────────────────────────────────────────

export type FlagType = "BOOLEAN" | "STRING" | "NUMBER" | "JSON";
export type Operator =
  | "EQUALS"
  | "NOT_EQUALS"
  | "CONTAINS"
  | "NOT_CONTAINS"
  | "GREATER_THAN"
  | "LESS_THAN";

export type EvalReason =
  | "FLAG_DISABLED" // flag.enabled = false in this environment
  | "RULE_MATCH" // a targeting rule matched
  | "ROLLOUT_EXCLUDED" // user bucket fell outside rolloutPct
  | "ROLLOUT" // user is in rollout, no rule matched
  | "DEFAULT"; // fallback

export interface EvalContext {
  userId: string;
  attributes?: Record<string, string | number | boolean>;
}

export interface EvalRule {
  attribute: string;
  operator: Operator;
  value: string;
  serveValue: string;
  priority: number;
}

export interface EvalState {
  enabled: boolean;
  rolloutPct: number; // 0–100
  defaultValue: string; // raw string; parsed based on flagType
}

export interface EvalInput {
  flagKey: string;
  flagType: FlagType;
  state: EvalState;
  rules: EvalRule[];
  context: EvalContext;
}

export interface EvalResult {
  value: boolean | string | number | object;
  reason: EvalReason;
}

// ─── Hash bucketing ───────────────────────────────────────────────────────────

/**
 * FNV-1a 32-bit hash. Returns a stable integer in [0, 99].
 * Same userId + flagKey always gets the same bucket, across environments.
 */
function hashBucket(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash % 100;
}

// ─── Rule matching ────────────────────────────────────────────────────────────

function matchesRule(rule: EvalRule, attributes: Record<string, string | number | boolean> = {}): boolean {
  const raw = attributes[rule.attribute];
  if (raw === undefined) return false;

  const attrStr = String(raw);

  switch (rule.operator) {
    case "EQUALS":
      return attrStr === rule.value;
    case "NOT_EQUALS":
      return attrStr !== rule.value;
    case "CONTAINS":
      return attrStr.includes(rule.value);
    case "NOT_CONTAINS":
      return !attrStr.includes(rule.value);
    case "GREATER_THAN":
      return parseFloat(attrStr) > parseFloat(rule.value);
    case "LESS_THAN":
      return parseFloat(attrStr) < parseFloat(rule.value);
  }
}

// ─── Value parsing ────────────────────────────────────────────────────────────

function parseValue(raw: string, type: FlagType): boolean | string | number | object {
  switch (type) {
    case "BOOLEAN":
      return raw === "true";
    case "NUMBER":
      return parseFloat(raw);
    case "JSON":
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    default:
      return raw;
  }
}

// ─── Core evaluator ───────────────────────────────────────────────────────────

export function evaluateFlag(input: EvalInput): EvalResult {
  const { flagKey, flagType, state, rules, context } = input;

  // 1. Flag disabled in this environment
  if (!state.enabled) {
    return { value: parseValue(state.defaultValue, flagType), reason: "FLAG_DISABLED" };
  }

  // 2. Targeting rules (sorted by priority ascending — lower number = higher priority)
  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);
  for (const rule of sortedRules) {
    if (matchesRule(rule, context.attributes)) {
      return { value: parseValue(rule.serveValue, flagType), reason: "RULE_MATCH" };
    }
  }

  // 3. Rollout bucketing — deterministic per user+flag
  const bucket = hashBucket(`${flagKey}-${context.userId}`);
  if (bucket >= state.rolloutPct) {
    return { value: parseValue(state.defaultValue, flagType), reason: "ROLLOUT_EXCLUDED" };
  }

  // 4. User is in rollout
  if (flagType === "BOOLEAN") {
    return { value: true, reason: "ROLLOUT" };
  }

  // For STRING/NUMBER/JSON: defaultValue is the configured value; targeting rules handle variants
  return { value: parseValue(state.defaultValue, flagType), reason: "ROLLOUT" };
}
