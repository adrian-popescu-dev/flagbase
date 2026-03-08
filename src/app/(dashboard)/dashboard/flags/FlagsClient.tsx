"use client";

import { useState, useTransition } from "react";
import { Field } from "@/components/Field";
import { Modal } from "@/components/Modal";
import {
  createFlag,
  toggleFlag,
  archiveFlag,
  unarchiveFlag,
} from "@/app/(dashboard)/dashboard/flags/actions";

type FlagType = "BOOLEAN" | "STRING" | "NUMBER" | "JSON";

type Flag = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  type: FlagType;
  archived: boolean;
  states: { enabled: boolean }[];
};

type Props = {
  flags: Flag[];
  projectId: string;
  environmentId: string;
};

export default function FlagsClient({ flags, projectId, environmentId }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [isPending, startTransition] = useTransition();

  const visible = flags.filter((f) => showArchived || !f.archived);

  function handleToggle(flagId: string, currentEnabled: boolean) {
    startTransition(() => toggleFlag(flagId, environmentId, !currentEnabled));
  }

  function handleArchive(flagId: string, archived: boolean) {
    startTransition(() => (archived ? unarchiveFlag(flagId) : archiveFlag(flagId)));
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Feature Flags</h1>
          <p className="text-sm text-zinc-500">
            {flags.filter((f) => !f.archived).length} active flags
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-500">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded"
            />
            Show archived
          </label>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            New flag
          </button>
        </div>
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 py-16 text-center dark:border-zinc-800">
          <p className="text-sm text-zinc-400">No flags yet. Create your first one.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Key</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Type</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Enabled</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {visible.map((flag) => {
                const enabled = flag.states[0]?.enabled ?? false;
                return (
                  <tr
                    key={flag.id}
                    className={`bg-white transition dark:bg-zinc-900 ${flag.archived ? "opacity-50" : ""}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                      {flag.key}
                    </td>
                    <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                      {flag.name}
                      {flag.description && (
                        <span className="ml-2 text-xs text-zinc-400">{flag.description}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {flag.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggle(flag.id, enabled)}
                        disabled={isPending || flag.archived}
                        aria-label={enabled ? "Disable flag" : "Enable flag"}
                        aria-checked={enabled}
                        role="switch"
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                          enabled ? "bg-zinc-900 dark:bg-zinc-50" : "bg-zinc-200 dark:bg-zinc-700"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 dark:bg-zinc-900 ${
                            enabled ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleArchive(flag.id, flag.archived)}
                        disabled={isPending}
                        className="text-xs text-zinc-400 transition hover:text-zinc-700 disabled:opacity-50 dark:hover:text-zinc-200"
                      >
                        {flag.archived ? "Unarchive" : "Archive"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create flag modal */}
      {showCreate && <CreateFlagModal projectId={projectId} onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreateFlagModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    form.set("projectId", projectId);

    startTransition(async () => {
      try {
        await createFlag(form);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <Modal title="New flag" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <fieldset disabled={isPending} className="flex flex-col gap-4 border-0 p-0 m-0">
          <Field label="Key" name="key" placeholder="my-feature-flag" required hint="Lowercase, alphanumeric, _ or -" />
          <Field label="Name" name="name" placeholder="My Feature Flag" required />
          <Field label="Description" name="description" placeholder="Optional" />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Type</label>
            <select name="type" defaultValue="BOOLEAN" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50">
              <option value="BOOLEAN">Boolean</option>
              <option value="STRING">String</option>
              <option value="NUMBER">Number</option>
              <option value="JSON">JSON</option>
            </select>
          </div>
        </fieldset>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
            Cancel
          </button>
          <button type="submit" disabled={isPending} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200">
            {isPending ? "Creating…" : "Create flag"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

