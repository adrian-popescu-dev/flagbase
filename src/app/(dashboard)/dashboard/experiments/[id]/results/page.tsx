import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { twoProportionZTest } from "@/lib/stats";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

type RouteParams = { params: Promise<{ id: string }> };

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  RUNNING: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  PAUSED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  COMPLETED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

export default async function ResultsPage({ params }: RouteParams) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;

  const experiment = await prisma.experiment.findUnique({
    where: { id },
    include: { variants: { orderBy: { key: "asc" } } },
  });

  if (!experiment) {
    return (
      <div className="py-32 text-center text-sm text-zinc-400">Experiment not found.</div>
    );
  }

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
    impressionCounts.map((r) => [r.variantId ?? "", r._count._all]),
  );
  const conversionMap = Object.fromEntries(
    conversionCounts.map((r) => [r.variantId ?? "", r._count._all]),
  );

  const variantStats = experiment.variants.map((v) => {
    const impressions = impressionMap[v.id] ?? 0;
    const conversions = conversionMap[v.id] ?? 0;
    const conversionRate = impressions > 0 ? conversions / impressions : 0;
    return { variant: v, impressions, conversions, conversionRate };
  });

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
        ? twoProportionZTest(control.impressions, control.conversions, impressions, conversions)
        : null;
    const significant = pValue !== null ? pValue < 0.05 : null;
    return { variant, impressions, conversions, conversionRate, uplift, pValue, significant, isControl };
  });

  const totalImpressions = results.reduce((s, r) => s + r.impressions, 0);
  const totalConversions = results.reduce((s, r) => s + r.conversions, 0);

  return (
    <div>
      {/* Back link */}
      <Link
        href="/dashboard/experiments"
        className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-400 transition hover:text-zinc-700 dark:hover:text-zinc-200"
      >
        ← Experiments
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{experiment.name}</h1>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[experiment.status]}`}>
            {experiment.status}
          </span>
        </div>
        <p className="text-sm text-zinc-500">
          Goal event: <span className="font-mono text-zinc-700 dark:text-zinc-300">{experiment.goalEvent}</span>
        </p>
        {experiment.startedAt && (
          <p className="text-sm text-zinc-400 mt-0.5">
            Started {new Date(experiment.startedAt).toLocaleDateString()}
            {experiment.endedAt && ` · Ended ${new Date(experiment.endedAt).toLocaleDateString()}`}
          </p>
        )}
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <StatCard label="Total impressions" value={totalImpressions.toLocaleString()} />
        <StatCard label="Total conversions" value={totalConversions.toLocaleString()} />
        <StatCard
          label="Overall conversion rate"
          value={totalImpressions > 0 ? `${((totalConversions / totalImpressions) * 100).toFixed(1)}%` : "—"}
        />
      </div>

      {/* Results table */}
      {totalImpressions === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 py-16 text-center dark:border-zinc-800">
          <p className="text-sm text-zinc-400">No events recorded yet for this experiment.</p>
          <p className="mt-1 text-xs text-zinc-400">
            Events are tracked via <span className="font-mono">POST /api/events</span> from your app.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Variant</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Impressions</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Conversions</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Conv. rate</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Uplift</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Significant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {results.map((r) => (
                <tr key={r.variant.id} className="bg-white dark:bg-zinc-900">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-900 dark:text-zinc-50">{r.variant.name}</span>
                      <span className="font-mono text-xs text-zinc-400">{r.variant.key}</span>
                      {r.isControl && (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">
                          control
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                    {r.impressions.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                    {r.conversions.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-zinc-900 dark:text-zinc-50">
                    {r.impressions > 0 ? `${(r.conversionRate * 100).toFixed(2)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.uplift === null ? (
                      <span className="text-zinc-400">—</span>
                    ) : (
                      <span className={r.uplift >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}>
                        {r.uplift >= 0 ? "+" : ""}{(r.uplift * 100).toFixed(1)}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.significant === null ? (
                      <span className="text-zinc-400">—</span>
                    ) : r.significant ? (
                      <span className="text-green-600 dark:text-green-400" title={`p = ${r.pValue?.toFixed(4)}`}>✓ Yes</span>
                    ) : (
                      <span className="text-zinc-400" title={`p = ${r.pValue?.toFixed(4)}`}>✗ No</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-zinc-400">
        Significance computed using a two-proportion z-test at 95% confidence (p &lt; 0.05).
      </p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
    </div>
  );
}
