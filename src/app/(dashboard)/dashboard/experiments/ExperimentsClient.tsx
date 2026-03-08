"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Field } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { createExperiment, updateExperimentStatus, deleteExperiment } from "./actions";

type Status = "DRAFT" | "RUNNING" | "PAUSED" | "COMPLETED";

type Variant = { id: string; key: string; name: string; weight: number };

type Experiment = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: Status;
  goalEvent: string;
  startedAt: Date | null;
  variants: Variant[];
};

type Props = { experiments: Experiment[]; projectId: string };

const STATUS_STYLES: Record<Status, string> = {
  DRAFT: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  RUNNING: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  PAUSED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  COMPLETED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

const NEXT_STATUS: Partial<Record<Status, Status>> = {
  DRAFT: "RUNNING",
  RUNNING: "PAUSED",
  PAUSED: "RUNNING",
};

export default function ExperimentsClient({ experiments, projectId }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleStatusChange(id: string, next: Status) {
    startTransition(() => updateExperimentStatus(id, next));
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this experiment? This cannot be undone.")) return;
    startTransition(() => deleteExperiment(id));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Experiments</h1>
          <p className="text-sm text-zinc-500">
            {experiments.filter((e) => e.status === "RUNNING").length} running
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          New experiment
        </button>
      </div>

      {experiments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 py-16 text-center dark:border-zinc-800">
          <p className="text-sm text-zinc-400">No experiments yet. Create your first one.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {experiments.map((exp) => {
            const next = NEXT_STATUS[exp.status];
            return (
              <div
                key={exp.id}
                className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[exp.status]}`}>
                        {exp.status}
                      </span>
                      <span className="font-mono text-xs text-zinc-400">{exp.key}</span>
                    </div>
                    <h2 className="font-medium text-zinc-900 dark:text-zinc-50">{exp.name}</h2>
                    {exp.description && (
                      <p className="mt-0.5 text-sm text-zinc-500">{exp.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-400">
                      <span>Goal: <span className="font-mono text-zinc-600 dark:text-zinc-300">{exp.goalEvent}</span></span>
                      <span>{exp.variants.length} variants: {exp.variants.map((v) => `${v.key} (${v.weight}%)`).join(", ")}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                      href={`/dashboard/experiments/${exp.id}/results`}
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      Results
                    </Link>
                    {next && (
                      <button
                        onClick={() => handleStatusChange(exp.id, next)}
                        disabled={isPending}
                        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                      >
                        {next === "RUNNING" ? "▶ Start" : next === "PAUSED" ? "⏸ Pause" : next}
                      </button>
                    )}
                    {exp.status !== "COMPLETED" && (
                      <button
                        onClick={() => handleStatusChange(exp.id, "COMPLETED")}
                        disabled={isPending}
                        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                      >
                        ✓ Complete
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(exp.id)}
                      disabled={isPending}
                      className="text-xs text-zinc-400 transition hover:text-red-500 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateExperimentModal
          projectId={projectId}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

// ── Create modal ──────────────────────────────────────────────────────────────

type VariantInput = { key: string; name: string; weight: number };

function CreateExperimentModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [variants, setVariants] = useState<VariantInput[]>([
    { key: "control", name: "Control", weight: 50 },
    { key: "treatment", name: "Treatment", weight: 50 },
  ]);

  const totalWeight = variants.reduce((s, v) => s + v.weight, 0);

  function updateVariant(i: number, field: keyof VariantInput, value: string | number) {
    setVariants((prev) => prev.map((v, idx) => (idx === i ? { ...v, [field]: value } : v)));
  }

  function addVariant() {
    setVariants((prev) => [...prev, { key: "", name: "", weight: 0 }]);
  }

  function removeVariant(i: number) {
    if (variants.length <= 2) return;
    setVariants((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await createExperiment({
          projectId,
          key: form.get("key") as string,
          name: form.get("name") as string,
          description: (form.get("description") as string) || undefined,
          hypothesis: (form.get("hypothesis") as string) || undefined,
          goalEvent: form.get("goalEvent") as string,
          variants,
        });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <Modal title="New experiment" onClose={onClose} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <fieldset disabled={isPending} className="flex flex-col gap-4 border-0 p-0 m-0">
          <Field label="Key" name="key" placeholder="button-color-test" required hint="Lowercase, alphanumeric, _ or -" />
          <Field label="Name" name="name" placeholder="Button Color Test" required />
          <Field label="Goal event" name="goalEvent" placeholder="purchase_completed" required hint="The event name your app will track()" />
          <Field label="Description" name="description" placeholder="Optional" />
          <Field label="Hypothesis" name="hypothesis" placeholder="Optional" />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Variants
                <span className={`ml-2 text-xs ${totalWeight === 100 ? "text-green-600" : "text-red-500"}`}>
                  ({totalWeight}% / 100%)
                </span>
              </label>
              <button type="button" onClick={addVariant} className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50">
                + Add variant
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {variants.map((v, i) => (
                <div key={i} className="flex gap-2">
                  <input value={v.key} onChange={(e) => updateVariant(i, "key", e.target.value)} placeholder="key" className="w-28 rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs outline-none focus:ring-2 ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:ring-zinc-50" />
                  <input value={v.name} onChange={(e) => updateVariant(i, "name", e.target.value)} placeholder="name" className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:ring-zinc-50" />
                  <input type="number" value={v.weight} onChange={(e) => updateVariant(i, "weight", parseInt(e.target.value) || 0)} placeholder="%" className="w-16 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:ring-zinc-50" />
                  <button type="button" onClick={() => removeVariant(i)} disabled={variants.length <= 2} className="text-xs text-zinc-400 hover:text-red-500 disabled:opacity-30">✕</button>
                </div>
              ))}
            </div>
          </div>
        </fieldset>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">Cancel</button>
          <button type="submit" disabled={isPending || totalWeight !== 100} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200">
            {isPending ? "Creating…" : "Create experiment"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

