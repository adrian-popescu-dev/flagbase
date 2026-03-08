/**
 * Two-proportion z-test.
 * Returns the two-tailed p-value for the hypothesis that treatment CR ≠ control CR.
 */
export function twoProportionZTest(
  controlImpressions: number,
  controlConversions: number,
  treatmentImpressions: number,
  treatmentConversions: number,
): number | null {
  if (controlImpressions === 0 || treatmentImpressions === 0) return null;

  const p1 = controlConversions / controlImpressions;
  const p2 = treatmentConversions / treatmentImpressions;
  const pooled =
    (controlConversions + treatmentConversions) /
    (controlImpressions + treatmentImpressions);

  const se = Math.sqrt(
    pooled * (1 - pooled) * (1 / controlImpressions + 1 / treatmentImpressions),
  );

  if (se === 0) return null;

  const z = Math.abs((p2 - p1) / se);

  // Approximation of the complementary error function for two-tailed p-value
  return 2 * (1 - normalCdf(z));
}

/** Standard normal CDF via Abramowitz & Stegun approximation (error < 7.5e-8) */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * z);
  const poly =
    t *
    (0.319381530 +
      t *
        (-0.356563782 +
          t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return 1 - (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * z * z) * poly;
}
